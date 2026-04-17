const SETTINGS_STORAGE_KEY = 'fastdraw.settings.v1';
const SETTINGS_KEYS = [
  'epsilonPx',
  'epsilonStepFactor',
  'sampleMinDistancePx',
  'snapDistancePx',
  'autoSampleByDistance'
];
const DEFAULT_SETTINGS = Object.freeze({
  epsilonPx: 6,
  epsilonStepFactor: 1.35,
  sampleMinDistancePx: 4,
  snapDistancePx: 8,
  autoSampleByDistance: true
});

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeSettings(raw = {}) {
  const result = { ...DEFAULT_SETTINGS };
  if (isFiniteNumber(raw.epsilonPx)) {
    result.epsilonPx = clamp(raw.epsilonPx, 0.25, 200);
  }
  if (isFiniteNumber(raw.epsilonStepFactor)) {
    result.epsilonStepFactor = clamp(raw.epsilonStepFactor, 1.01, 4);
  }
  if (isFiniteNumber(raw.sampleMinDistancePx)) {
    result.sampleMinDistancePx = clamp(raw.sampleMinDistancePx, 0, 50);
  }
  if (isFiniteNumber(raw.snapDistancePx)) {
    result.snapDistancePx = clamp(raw.snapDistancePx, 0, 40);
  }
  if (typeof raw.autoSampleByDistance === 'boolean') {
    result.autoSampleByDistance = raw.autoSampleByDistance;
  }
  return result;
}

function toBoolean(value) {
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'off'].includes(text)) return false;
  return null;
}

function parseSettingsText(text) {
  const next = {};
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith('#')) continue;
    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;

    const rawKey = line.slice(0, equalIndex).trim();
    const key = rawKey.startsWith('fastdraw.') ? rawKey.slice('fastdraw.'.length) : rawKey;
    const rawValue = line.slice(equalIndex + 1).trim();

    if (!SETTINGS_KEYS.includes(key)) continue;

    if (key === 'autoSampleByDistance') {
      const parsedBool = toBoolean(rawValue);
      if (parsedBool !== null) {
        next[key] = parsedBool;
      }
    } else {
      const parsedNumber = Number(rawValue);
      if (Number.isFinite(parsedNumber)) {
        next[key] = parsedNumber;
      }
    }
  }

  return sanitizeSettings(next);
}

function stringifySettings(settings) {
  return [
    '# FastDraw settings (fastdraw.*)',
    `fastdraw.epsilonPx=${settings.epsilonPx}`,
    `fastdraw.epsilonStepFactor=${settings.epsilonStepFactor}`,
    `fastdraw.sampleMinDistancePx=${settings.sampleMinDistancePx}`,
    `fastdraw.snapDistancePx=${settings.snapDistancePx}`,
    `fastdraw.autoSampleByDistance=${settings.autoSampleByDistance}`
  ].join('\n');
}

function distance2D(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function sameLoc(a, b, epsilon = 1e-10) {
  return Math.abs(a[0] - b[0]) <= epsilon && Math.abs(a[1] - b[1]) <= epsilon;
}

function pointSegmentDistance(point, segA, segB) {
  const vx = segB[0] - segA[0];
  const vy = segB[1] - segA[1];
  const wx = point[0] - segA[0];
  const wy = point[1] - segA[1];
  const denom = vx * vx + vy * vy;
  if (denom <= 0) {
    return distance2D(point, segA);
  }
  const t = clamp((wx * vx + wy * vy) / denom, 0, 1);
  const proj = [segA[0] + t * vx, segA[1] + t * vy];
  return distance2D(point, proj);
}

function rdpKeepIndices(points, startIndex, endIndex, epsilonPx, viewport) {
  const keep = new Set([startIndex, endIndex]);
  const stack = [[startIndex, endIndex]];

  while (stack.length) {
    const [start, end] = stack.pop();
    if (end - start <= 1) continue;

    const startPoint = viewport.project(points[start].loc);
    const endPoint = viewport.project(points[end].loc);

    let maxDistance = -1;
    let maxIndex = -1;

    for (let i = start + 1; i < end; i++) {
      const candidatePoint = viewport.project(points[i].loc);
      const distance = pointSegmentDistance(candidatePoint, startPoint, endPoint);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }

    if (maxDistance > epsilonPx && maxIndex !== -1) {
      keep.add(maxIndex);
      stack.push([start, maxIndex], [maxIndex, end]);
    }
  }

  return keep;
}

export function simplifyPolyline(rawPoints, fixedIndices, epsilonPx, viewport) {
  const source = Array.isArray(rawPoints) ? rawPoints : [];
  if (source.length === 0) {
    return { indices: [], points: [] };
  }
  if (source.length === 1) {
    return {
      indices: [0],
      points: [{ ...source[0], sourceIndex: 0 }]
    };
  }

  const required = new Set([0, source.length - 1]);
  for (const idx of fixedIndices ?? []) {
    if (Number.isInteger(idx) && idx >= 0 && idx < source.length) {
      required.add(idx);
    }
  }

  const keep = new Set(required);
  const anchors = [...required].sort((a, b) => a - b);
  for (let i = 0; i < anchors.length - 1; i++) {
    const start = anchors[i];
    const end = anchors[i + 1];
    for (const idx of rdpKeepIndices(source, start, end, epsilonPx, viewport)) {
      keep.add(idx);
    }
  }

  const indices = [...keep].sort((a, b) => a - b);
  return {
    indices,
    points: indices.map(idx => ({ ...source[idx], sourceIndex: idx }))
  };
}

function closestPointIndex(points, screenPoint, viewport, thresholdPx = 10) {
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length; i++) {
    const screen = viewport.project(points[i].loc);
    const distance = distance2D(screen, screenPoint);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestDistance <= thresholdPx ? bestIndex : -1;
}

function closestSegmentIndex(points, screenPoint, viewport, thresholdPx = 10) {
  if (points.length < 2) return -1;

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < points.length - 1; i++) {
    const start = viewport.project(points[i].loc);
    const end = viewport.project(points[i + 1].loc);
    const distance = pointSegmentDistance(screenPoint, start, end);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }

  return bestDistance <= thresholdPx ? bestIndex : -1;
}

function shiftSetAfterRemoval(sourceSet, removedIndex) {
  const next = new Set();
  for (const idx of sourceSet) {
    if (idx === removedIndex) continue;
    next.add(idx > removedIndex ? idx - 1 : idx);
  }
  return next;
}

function dedupeConsecutive(points) {
  if (points.length <= 1) return points.slice();
  const next = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = next[next.length - 1];
    const curr = points[i];
    if (curr.nodeID && prev.nodeID && curr.nodeID === prev.nodeID) continue;
    if (sameLoc(curr.loc, prev.loc)) continue;
    next.push(curr);
  }
  return next;
}

export function buildWayNodes(nodeIDs, geometry = 'line') {
  const next = Array.isArray(nodeIDs) ? nodeIDs.filter(Boolean) : [];
  if (!next.length) return null;

  if (geometry !== 'area') {
    return next;
  }

  const uniqueNodeCount = new Set(next).size;
  if (uniqueNodeCount < 3) return null;

  if (next[0] !== next[next.length - 1]) {
    next.push(next[0]);
  }

  return next;
}

export function parseClipboardTags(text) {
  if (typeof text !== 'string') return {};
  const raw = text.trim();
  if (!raw) return {};

  if (raw.startsWith('{')) {
    const json = JSON.parse(raw);
    if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
    const tags = {};
    for (const [key, value] of Object.entries(json)) {
      if (typeof key !== 'string' || !key.trim()) continue;
      if (typeof value !== 'string') continue;
      tags[key.trim()] = value;
    }
    return tags;
  }

  const tags = {};
  const lines = raw.split(/\r?\n|;/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (!key || !value) continue;
    tags[key] = value;
  }

  return tags;
}

function canUseDOM() {
  return Boolean(globalThis.window?.document);
}

class FastDrawController {
  constructor(api) {
    this.api = api;
    this.context = api.context;
    this.settings = this._loadSettings();

    this._registeredDisposers = [];
    this._active = false;
    this._phase = 'capture';
    this._geometry = 'line';
    this._awaitingSelectedWayConfirm = false;
    this._replaceWayID = null;
    this._selectedWayCandidateID = null;
    this._isPointerDown = false;
    this._pointerMoved = false;
    this._downPoint = null;
    this._pointerDownScreen = null;
    this._draggingReviewIndex = null;
    this._finalizing = false;

    this._rawPoints = [];
    this._reviewPoints = [];
    this._fixedRawIndices = new Set();
    this._fixedReviewIndices = new Set();

    this._lastPointerEvent = null;
    this._previewWrap = null;
    this._previewPath = null;
    this._previewDots = null;
    this._previewAnchors = null;
    this._suspendedBehaviors = new Map();

    this._keydown = this._keydown.bind(this);
    this._pointerdown = this._pointerdown.bind(this);
    this._pointermove = this._pointermove.bind(this);
    this._pointerup = this._pointerup.bind(this);
    this._draw = this._draw.bind(this);
  }

  enable() {
    const registerCommand = spec => {
      const disposer = this.api.registerCommand(spec);
      if (typeof disposer === 'function') {
        this._registeredDisposers.push(disposer);
      }
    };
    const registerToolbarButton = spec => {
      const disposer = this.api.registerToolbarButton(spec);
      if (typeof disposer === 'function') {
        this._registeredDisposers.push(disposer);
      }
    };

    registerCommand({
      id: 'toggle-fastdraw-mode',
      label: 'FastDraw Mode',
      keywords: 'fastdraw draw line trace simplify',
      shortcut: 'Shift+F',
      run: () => this.toggleMode()
    });

    registerCommand({
      id: 'open-fastdraw-settings',
      label: 'FastDraw Settings',
      keywords: 'fastdraw settings epsilon simplify',
      shortcut: 'Q',
      run: () => this.openSettings()
    });

    registerCommand({
      id: 'toggle-fastdraw-geometry',
      label: 'FastDraw Toggle Area/Line',
      keywords: 'fastdraw area line polygon close',
      shortcut: 'A',
      run: () => this.toggleGeometry()
    });

    registerToolbarButton({
      id: 'toggle-fastdraw-mode',
      label: 'FastDraw',
      title: 'FastDraw Mode (Shift+F)',
      run: () => this.toggleMode()
    });

    if (canUseDOM()) {
      globalThis.window.addEventListener('keydown', this._keydown, true);
    }

    this.context.systems.gfx?.on('draw', this._draw);
  }

  disable() {
    this.deactivateMode({ silent: true });

    this.context.systems.gfx?.off('draw', this._draw);
    if (canUseDOM()) {
      globalThis.window.removeEventListener('keydown', this._keydown, true);
    }

    for (const dispose of this._registeredDisposers) {
      dispose();
    }
    this._registeredDisposers = [];
  }

  toggleMode() {
    if (!this._active) {
      this.activateMode();
      return;
    }

    if (this._awaitingSelectedWayConfirm && this._selectedWayCandidateID && this._rawPoints.length === 0) {
      this._importSelectedWay();
      return;
    }

    this.deactivateMode();
  }

  activateMode() {
    if (this._active) return;

    this._resetSessionState();
    this._active = true;
    this._phase = 'capture';
    this.context.enter('browse');
    this._suspendBehaviors(['select', 'drag', 'lasso']);

    const selectedWayID = this._selectedWayFromContext();
    if (selectedWayID) {
      this._selectedWayCandidateID = selectedWayID;
      this._awaitingSelectedWayConfirm = true;
      this._notify('FastDraw: Shift+F をもう一度押すと選択中のウェイを再簡略化します（タグは削除されます）', 'info');
    } else {
      this._notify('FastDraw: キャプチャ開始 (クリック/Space + Shiftドラッグ)。Aでライン/エリア切替。', 'info');
    }

    this._bindPointerEvents();
    this._ensurePreview();
    this._draw();
  }

  deactivateMode(options = {}) {
    if (!this._active) return;
    this._restoreBehaviors();
    this._unbindPointerEvents();
    this._destroyPreview();
    this._resetSessionState();
    this._active = false;
    if (!options.silent) {
      this._notify('FastDraw: モード終了', 'info');
    }
  }

  openSettings() {
    if (!canUseDOM()) return;

    const promptText = [
      'FastDraw settings を編集してください。',
      '形式: fastdraw.<key>=<value>',
      '',
      stringifySettings(this.settings)
    ].join('\n');

    const nextText = globalThis.window.prompt(promptText, stringifySettings(this.settings));
    if (nextText === null) return;

    this.settings = parseSettingsText(nextText);
    this._saveSettings();
    this._notify(`FastDraw settings 更新: epsilon=${this.settings.epsilonPx.toFixed(2)}px`, 'info');

    if (this._phase === 'review') {
      this._rebuildReviewFromRaw();
      this._draw();
    }
  }

  toggleGeometry() {
    if (!this._active) return;
    this._geometry = this._geometry === 'area' ? 'line' : 'area';
    const label = this._geometry === 'area' ? 'area' : 'line';
    this._notify(`FastDraw: geometry = ${label}`, 'info');
    this._draw();
  }

  _resetSessionState() {
    this._phase = 'capture';
    this._geometry = 'line';
    this._awaitingSelectedWayConfirm = false;
    this._replaceWayID = null;
    this._selectedWayCandidateID = null;
    this._isPointerDown = false;
    this._pointerMoved = false;
    this._downPoint = null;
    this._pointerDownScreen = null;
    this._draggingReviewIndex = null;
    this._finalizing = false;
    this._rawPoints = [];
    this._reviewPoints = [];
    this._fixedRawIndices = new Set();
    this._fixedReviewIndices = new Set();
    this._lastPointerEvent = null;
  }

  _suspendBehaviors(behaviorIDs) {
    for (const behaviorID of behaviorIDs) {
      const behavior = this.context.behaviors?.[behaviorID];
      if (!behavior || this._suspendedBehaviors.has(behaviorID)) continue;
      this._suspendedBehaviors.set(behaviorID, behavior.enabled);
      if (behavior.enabled) {
        behavior.disable();
      }
    }
  }

  _restoreBehaviors() {
    for (const [behaviorID, wasEnabled] of this._suspendedBehaviors) {
      const behavior = this.context.behaviors?.[behaviorID];
      if (behavior && wasEnabled && !behavior.enabled) {
        behavior.enable();
      }
    }
    this._suspendedBehaviors.clear();
  }

  _bindPointerEvents() {
    const events = this.context.systems.gfx?.events;
    if (!events) return;
    events.on('pointerdown', this._pointerdown);
    events.on('pointermove', this._pointermove);
    events.on('pointerup', this._pointerup);
    events.on('pointercancel', this._pointerup);
  }

  _unbindPointerEvents() {
    const events = this.context.systems.gfx?.events;
    if (!events) return;
    events.off('pointerdown', this._pointerdown);
    events.off('pointermove', this._pointermove);
    events.off('pointerup', this._pointerup);
    events.off('pointercancel', this._pointerup);
  }

  _keydown(e) {
    if (this._inEditableField(e)) return;

    if (e.code === 'KeyF' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this._consumeKeyEvent(e);
      this.toggleMode();
      return;
    }

    if (!this._active) return;

    if (e.code === 'KeyQ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this._consumeKeyEvent(e);
      this.openSettings();
      return;
    }

    if (e.code === 'KeyA' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this._consumeKeyEvent(e);
      this.toggleGeometry();
      return;
    }

    if (e.code === 'Space' && this._phase === 'capture') {
      this._consumeKeyEvent(e);
      this._appendRawFromLastEvent({ force: true, markFixed: false });
      this._draw();
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      this._consumeKeyEvent(e);
      this._removeLastPoint();
      this._draw();
      return;
    }

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      if (this._phase !== 'review') return;
      this._consumeKeyEvent(e);
      const factor = this.settings.epsilonStepFactor;
      if (e.key === 'ArrowUp') {
        this.settings.epsilonPx = clamp(this.settings.epsilonPx * factor, 0.25, 200);
      } else {
        this.settings.epsilonPx = clamp(this.settings.epsilonPx / factor, 0.25, 200);
      }
      this._saveSettings();
      this._rebuildReviewFromRaw();
      this._notify(`FastDraw epsilon: ${this.settings.epsilonPx.toFixed(2)}px`, 'info');
      this._draw();
      return;
    }

    if (e.key === 'Enter') {
      this._consumeKeyEvent(e);
      if (this._phase === 'capture') {
        this._enterReview();
      } else if (this._phase === 'review') {
        void this._finalize({ applyClipboardTags: e.ctrlKey || e.metaKey });
      }
    }
  }

  _pointerdown(e) {
    if (!this._active) return;
    this._lastPointerEvent = e;

    if (this._phase === 'review') {
      this._stopPixiEvent(e);
      this._handleReviewPointerDown(e);
      this._draw();
      return;
    }

    this._isPointerDown = true;
    this._pointerMoved = false;
    this._downPoint = this._pointFromEvent(e);
    this._pointerDownScreen = this._eventMapCoord(e)?.screen ?? null;
  }

  _pointermove(e) {
    if (!this._active) return;
    this._lastPointerEvent = e;

    if (this._phase === 'review' && this._draggingReviewIndex !== null) {
      this._stopPixiEvent(e);
      this._moveDraggedReviewPoint(e);
      this._draw();
      return;
    }

    if (this._phase === 'capture' && this._isPointerDown) {
      const screen = this._eventMapCoord(e)?.screen;
      const dragDistance = (screen && this._pointerDownScreen) ? distance2D(screen, this._pointerDownScreen) : 0;
      const movedEnough = dragDistance >= 4;

      if (!e.shiftKey) {
        this._pointerMoved = this._pointerMoved || movedEnough;
        return;
      }

      if (movedEnough && !this._pointerMoved && this._downPoint) {
        this._appendRawPoint(this._downPoint, { force: true, markFixed: false });
      }
      this._pointerMoved = this._pointerMoved || movedEnough;
      this._appendRawFromEvent(e, { force: false, markFixed: false });
      this._draw();
    }
  }

  _pointerup(e) {
    if (!this._active) return;
    this._lastPointerEvent = e;

    if (this._phase === 'review') {
      this._stopPixiEvent(e);
      this._draggingReviewIndex = null;
      return;
    }

    if (this._isPointerDown && !this._pointerMoved) {
      this._appendRawFromEvent(e, { force: true, markFixed: this._hasFixedModifier(e) });
      this._draw();
    }
    this._isPointerDown = false;
    this._pointerMoved = false;
    this._downPoint = null;
    this._pointerDownScreen = null;
  }

  _handleReviewPointerDown(e) {
    const viewport = this.context.viewport;
    const mapCoord = this._eventMapCoord(e);
    if (!mapCoord) return;
    const screenPoint = mapCoord.screen;

    if (e.shiftKey) {
      this._deletePointOrSegmentAt(screenPoint, viewport);
      return;
    }

    if (this._hasFixedModifier(e)) {
      this._toggleFixedPointAt(screenPoint, viewport);
      return;
    }

    this._draggingReviewIndex = closestPointIndex(this._reviewPoints, screenPoint, viewport, 10);
  }

  _moveDraggedReviewPoint(e) {
    if (this._draggingReviewIndex === null) return;
    const point = this._pointFromEvent(e);
    if (!point) return;

    const reviewPoint = this._reviewPoints[this._draggingReviewIndex];
    if (!reviewPoint) return;

    reviewPoint.loc = point.loc;
    reviewPoint.nodeID = point.nodeID || null;

    if (Number.isInteger(reviewPoint.sourceIndex) && reviewPoint.sourceIndex >= 0 && reviewPoint.sourceIndex < this._rawPoints.length) {
      this._rawPoints[reviewPoint.sourceIndex].loc = point.loc;
      this._rawPoints[reviewPoint.sourceIndex].nodeID = point.nodeID || null;
    }
  }

  _deletePointOrSegmentAt(screenPoint, viewport) {
    if (this._rawPoints.length <= 2) return;

    const pointIndex = closestPointIndex(this._reviewPoints, screenPoint, viewport, 10);
    if (pointIndex !== -1) {
      const sourceIndex = this._reviewPoints[pointIndex].sourceIndex;
      if (Number.isInteger(sourceIndex) && sourceIndex > 0 && sourceIndex < this._rawPoints.length - 1) {
        this._removeRawPointAt(sourceIndex);
        this._rebuildReviewFromRaw();
      }
      return;
    }

    const segmentIndex = closestSegmentIndex(this._reviewPoints, screenPoint, viewport, 10);
    if (segmentIndex !== -1) {
      const nextPoint = this._reviewPoints[segmentIndex + 1];
      const sourceIndex = nextPoint?.sourceIndex;
      if (Number.isInteger(sourceIndex) && sourceIndex > 0 && sourceIndex < this._rawPoints.length - 1) {
        this._removeRawPointAt(sourceIndex);
        this._rebuildReviewFromRaw();
      }
    }
  }

  _toggleFixedPointAt(screenPoint, viewport) {
    const pointIndex = closestPointIndex(this._reviewPoints, screenPoint, viewport, 10);
    if (pointIndex === -1) return;

    const sourceIndex = this._reviewPoints[pointIndex].sourceIndex;
    if (!Number.isInteger(sourceIndex)) return;

    if (this._fixedRawIndices.has(sourceIndex)) {
      this._fixedRawIndices.delete(sourceIndex);
    } else {
      this._fixedRawIndices.add(sourceIndex);
    }
    this._rebuildReviewFromRaw();
  }

  _removeLastPoint() {
    if (this._phase === 'capture') {
      if (!this._rawPoints.length) return;
      this._removeRawPointAt(this._rawPoints.length - 1);
      return;
    }

    if (this._phase === 'review') {
      if (this._rawPoints.length <= 2) return;
      this._removeRawPointAt(this._rawPoints.length - 2);
      this._rebuildReviewFromRaw();
    }
  }

  _removeRawPointAt(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this._rawPoints.length) return;
    this._rawPoints.splice(index, 1);
    this._fixedRawIndices = shiftSetAfterRemoval(this._fixedRawIndices, index);
  }

  _appendRawFromLastEvent(options) {
    if (!this._lastPointerEvent) return;
    this._appendRawFromEvent(this._lastPointerEvent, options);
  }

  _appendRawFromEvent(e, options = {}) {
    const point = this._pointFromEvent(e);
    if (!point) return false;
    return this._appendRawPoint(point, options);
  }

  _appendRawPoint(point, options = {}) {
    const { force = false, markFixed = false } = options;
    const viewport = this.context.viewport;
    const last = this._rawPoints[this._rawPoints.length - 1];

    if (last) {
      const lastScreen = viewport.project(last.loc);
      const currScreen = viewport.project(point.loc);
      const distance = distance2D(lastScreen, currScreen);
      const threshold = force ? 1 : (this.settings.autoSampleByDistance ? this.settings.sampleMinDistancePx : 0);
      if (distance < threshold) {
        return false;
      }
    }

    const nextIndex = this._rawPoints.length;
    this._rawPoints.push({
      loc: point.loc,
      nodeID: point.nodeID || null
    });

    if (markFixed || point.nodeID) {
      this._fixedRawIndices.add(nextIndex);
    }
    return true;
  }

  _enterReview() {
    if (this._rawPoints.length < 2) {
      this._notify('FastDraw: 少なくとも2点必要です', 'error');
      return;
    }
    this._phase = 'review';
    this._suspendBehaviors(['mapInteraction']);
    this._rebuildReviewFromRaw();
    this._notify('FastDraw: レビュー中 (↑/↓で簡略化、Aでライン/エリア切替、Enterで確定)', 'info');
    this._draw();
  }

  _rebuildReviewFromRaw() {
    if (!this._rawPoints.length) {
      this._reviewPoints = [];
      this._fixedReviewIndices = new Set();
      return;
    }

    const simplified = simplifyPolyline(this._rawPoints, this._fixedRawIndices, this.settings.epsilonPx, this.context.viewport);
    this._reviewPoints = simplified.points;

    const fixedReviewIndices = new Set();
    for (let i = 0; i < this._reviewPoints.length; i++) {
      const sourceIndex = this._reviewPoints[i].sourceIndex;
      if (this._fixedRawIndices.has(sourceIndex) || this._reviewPoints[i].nodeID) {
        fixedReviewIndices.add(i);
      }
    }
    this._fixedReviewIndices = fixedReviewIndices;
  }

  async _finalize(options = {}) {
    if (this._finalizing) return;
    this._finalizing = true;
    try {
      const applyClipboardTags = Boolean(options.applyClipboardTags);
      let tags = {};
      if (applyClipboardTags) {
        const text = await this._readClipboardText();
        tags = parseClipboardTags(text);
      }

      const finalPoints = dedupeConsecutive(this._reviewPoints);
      const minPoints = this._geometry === 'area' ? 3 : 2;
      if (finalPoints.length < minPoints) {
        this._notify(`FastDraw: ${this._geometry === 'area' ? 'エリア' : 'ウェイ'}確定には${minPoints}点以上必要です`, 'error');
        return;
      }

      const Rapid = globalThis.Rapid;
      const editor = this.context.systems.editor;
      const graph = editor?.staging?.graph;
      if (!Rapid || !editor || !graph) {
        this._notify('FastDraw: 編集システムにアクセスできません', 'error');
        return;
      }

      const actions = [];
      const nodeIDs = [];

      for (const point of finalPoints) {
        if (point.nodeID && graph.hasEntity(point.nodeID)?.type === 'node') {
          nodeIDs.push(point.nodeID);
          continue;
        }
        const node = Rapid.osmNode({ loc: point.loc });
        actions.push(Rapid.actionAddEntity(node));
        nodeIDs.push(node.id);
      }

      if (this._replaceWayID && graph.hasEntity(this._replaceWayID)?.type === 'way') {
        actions.push(Rapid.actionDeleteWay(this._replaceWayID));
      }

      const wayNodes = buildWayNodes(nodeIDs, this._geometry);
      if (!wayNodes) {
        this._notify('FastDraw: エリア確定には3つ以上の異なる点が必要です', 'error');
        return;
      }

      const way = Rapid.osmWay({ tags, nodes: wayNodes });
      actions.push(Rapid.actionAddEntity(way));

      editor.beginTransaction();
      editor.perform(...actions);
      editor.commit({
        annotation: 'FastDraw: create way',
        selectedIDs: [way.id]
      });
      editor.endTransaction();

      this.deactivateMode({ silent: true });
      this.context.enter('select-osm', { selection: { osm: [way.id] }, newFeature: Object.keys(tags).length === 0 });
      this._notify('FastDraw: ウェイを作成しました', 'info');
    } catch (err) {
      this._notify(`FastDraw: ${err.message}`, 'error');
    } finally {
      this._finalizing = false;
    }
  }

  _selectedWayFromContext() {
    const selectedIDs = this.context.selectedIDs?.() ?? [];
    if (selectedIDs.length !== 1) return null;
    const candidateID = selectedIDs[0];
    const graph = this.context.systems.editor?.staging?.graph;
    const entity = graph?.hasEntity(candidateID);
    return entity?.type === 'way' ? candidateID : null;
  }

  _importSelectedWay() {
    const graph = this.context.systems.editor?.staging?.graph;
    const way = graph?.hasEntity(this._selectedWayCandidateID);
    if (!way || way.type !== 'way') {
      this._notify('FastDraw: 選択ウェイを再読込できませんでした', 'error');
      return;
    }

    const nodes = graph.childNodes(way);
    if (!Array.isArray(nodes) || nodes.length < 2) {
      this._notify('FastDraw: 再簡略化には2点以上のウェイが必要です', 'error');
      return;
    }

    this._rawPoints = nodes.map(node => ({ loc: node.loc, nodeID: node.id }));
    this._fixedRawIndices = new Set([0, this._rawPoints.length - 1]);
    this._replaceWayID = way.id;
    this._awaitingSelectedWayConfirm = false;
    this._selectedWayCandidateID = null;
    this._phase = 'review';
    this._geometry = way.isClosed() ? 'area' : 'line';
    this._suspendBehaviors(['mapInteraction']);
    this._rebuildReviewFromRaw();
    this._notify(`FastDraw: 選択ウェイを読み込みました (${this._geometry})。Enterで置き換えます（タグは削除されます）`, 'info');
    this._draw();
  }

  async _readClipboardText() {
    if (!globalThis.navigator?.clipboard?.readText) {
      throw new Error('クリップボードAPIが利用できません');
    }
    const text = await globalThis.navigator.clipboard.readText();
    return text ?? '';
  }

  _pointFromEvent(e) {
    const mapCoord = this._eventMapCoord(e);
    if (!mapCoord) return null;
    const viewport = this.context.viewport;
    let loc = viewport.unproject(mapCoord.map);
    let nodeID = null;

    const snapNode = this._snappedNodeFromEvent(e, mapCoord.screen);
    if (snapNode) {
      loc = snapNode.loc;
      nodeID = snapNode.id;
    }

    return { loc, nodeID };
  }

  _snappedNodeFromEvent(e, screenPoint) {
    const graph = this.context.systems.editor?.staging?.graph;
    const target = this._targetDataFromPixiEvent(e);
    if (!target?.dataID || !graph) return null;

    const entity = graph.hasEntity(target.dataID);
    if (!entity || entity.type !== 'node') return null;

    const viewport = this.context.viewport;
    const nodePoint = viewport.project(entity.loc);
    const distance = distance2D(screenPoint, nodePoint);
    if (distance > this.settings.snapDistancePx) return null;
    return entity;
  }

  _targetDataFromPixiEvent(e) {
    let displayObject = e?.target;
    while (displayObject) {
      const feature = displayObject.__feature__;
      if (feature) {
        return {
          data: feature.data,
          dataID: feature.dataID ?? feature.data?.id
        };
      }
      displayObject = displayObject.parent;
    }
    return null;
  }

  _eventMapCoord(e) {
    if (!e?.global || !this.context?.viewport) return null;
    const viewport = this.context.viewport;
    const screen = [e.global.x, e.global.y];
    const rotation = viewport.transform?.r ?? 0;
    if (!rotation) {
      return { screen, map: screen };
    }

    const center = viewport.center?.() ?? [0, 0];
    const map = this._rotatePoint(screen, -rotation, center);
    return { screen, map };
  }

  _rotatePoint(point, radians, center) {
    const x = point[0] - center[0];
    const y = point[1] - center[1];
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return [
      x * cos - y * sin + center[0],
      x * sin + y * cos + center[1]
    ];
  }

  _inEditableField(e) {
    const target = e?.target;
    if (!target || !target.closest) return false;
    return Boolean(target.closest('input, textarea, [contenteditable="true"], [contenteditable=""], .modal'));
  }

  _hasFixedModifier(e) {
    return Boolean(e?.ctrlKey || e?.metaKey);
  }

  _notify(message, kind = 'info') {
    if (typeof this.api.notify === 'function') {
      this.api.notify(message, kind);
      return;
    }
    if (kind === 'error') {
      console.error(message);
    } else {
      console.log(message);
    }
  }

  _stopPixiEvent(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
  }

  _consumeKeyEvent(e) {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    e?.stopImmediatePropagation?.();
  }

  _ensurePreview() {
    if (!canUseDOM() || this._previewWrap) return;
    const containerNode = this.context.container?.().node?.();
    if (!containerNode) return;

    const mapContainer = containerNode.querySelector('.main-map') || containerNode;
    const doc = globalThis.document;
    const wrap = doc.createElement('div');
    wrap.className = 'fastdraw-preview';
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    wrap.style.pointerEvents = 'none';
    wrap.style.zIndex = '150';

    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${mapContainer.clientWidth || 1} ${mapContainer.clientHeight || 1}`);

    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#ff4d4f');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    const pointsGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
    const anchorsGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g');

    svg.appendChild(path);
    svg.appendChild(pointsGroup);
    svg.appendChild(anchorsGroup);
    wrap.appendChild(svg);

    const computed = globalThis.window.getComputedStyle(mapContainer);
    if (computed.position === 'static') {
      mapContainer.style.position = 'relative';
    }
    mapContainer.appendChild(wrap);

    this._previewWrap = wrap;
    this._previewPath = path;
    this._previewDots = pointsGroup;
    this._previewAnchors = anchorsGroup;
  }

  _destroyPreview() {
    if (!this._previewWrap) return;
    this._previewWrap.remove();
    this._previewWrap = null;
    this._previewPath = null;
    this._previewDots = null;
    this._previewAnchors = null;
  }

  _draw() {
    if (!this._active || !this._previewWrap || !this._previewPath) return;
    const viewport = this.context.viewport;
    const points = this._phase === 'review' ? this._reviewPoints : this._rawPoints;
    if (!points.length) {
      this._previewPath.setAttribute('d', '');
      this._previewDots.textContent = '';
      this._previewAnchors.textContent = '';
      return;
    }

    const screenPoints = points.map(point => viewport.project(point.loc));
    const pathD = screenPoints
      .map((point, idx) => `${idx === 0 ? 'M' : 'L'}${point[0]} ${point[1]}`)
      .join(' ');
    const isArea = this._geometry === 'area' && screenPoints.length >= 3;
    this._previewPath.setAttribute('d', isArea ? `${pathD} Z` : pathD);
    this._previewPath.setAttribute('stroke', this._phase === 'review' ? '#52c41a' : '#ff4d4f');
    this._previewPath.setAttribute('fill', isArea
      ? (this._phase === 'review' ? 'rgba(82, 196, 26, 0.18)' : 'rgba(255, 77, 79, 0.14)')
      : 'none');

    this._previewDots.textContent = '';
    this._previewAnchors.textContent = '';

    if (this._phase !== 'review') return;

    for (let i = 0; i < screenPoints.length; i++) {
      const point = screenPoints[i];
      const dot = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      dot.setAttribute('cx', point[0]);
      dot.setAttribute('cy', point[1]);
      dot.setAttribute('r', '2.8');
      dot.setAttribute('fill', '#ffffff');
      dot.setAttribute('stroke', '#2f54eb');
      dot.setAttribute('stroke-width', '1.2');
      this._previewDots.appendChild(dot);

      if (this._fixedReviewIndices.has(i)) {
        const anchor = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        anchor.setAttribute('cx', point[0]);
        anchor.setAttribute('cy', point[1]);
        anchor.setAttribute('r', '4.2');
        anchor.setAttribute('fill', 'none');
        anchor.setAttribute('stroke', '#faad14');
        anchor.setAttribute('stroke-width', '1.4');
        this._previewAnchors.appendChild(anchor);
      }
    }
  }

  _loadSettings() {
    const storage = this.context.systems.storage;
    const text = storage?.getItem?.(SETTINGS_STORAGE_KEY);
    if (!text) return { ...DEFAULT_SETTINGS };

    try {
      return sanitizeSettings(JSON.parse(text));
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  _saveSettings() {
    const storage = this.context.systems.storage;
    storage?.setItem?.(SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeSettings(this.settings)));
  }
}

let controller = null;

export function enable(api) {
  if (controller) {
    controller.disable();
  }
  controller = new FastDrawController(api);
  controller.enable();
}

export function disable() {
  if (!controller) return;
  controller.disable();
}

export function dispose() {
  if (!controller) return;
  controller.disable();
  controller = null;
}

export const __testing = {
  DEFAULT_SETTINGS,
  parseSettingsText,
  stringifySettings,
  simplifyPolyline,
  parseClipboardTags,
  buildWayNodes
};
