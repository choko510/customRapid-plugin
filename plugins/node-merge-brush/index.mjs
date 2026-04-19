import {
  acquireToolLock,
  createRapidShortcutConflictChecker,
  createShortcutClaims,
  releaseToolLock
} from '../_shared/shortcut-guard.mjs';

const DEFAULT_SETTINGS = Object.freeze({
  mergeDistancePx: 10,
  minBrushRadiusPx: 24,
  maxCandidateNodes: 800,
  verticesOnly: true
});

const Z_AXIS_KEYS = ['layer', 'level', 'addr:housenumber', 'addr:unit'];

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function distance2D(a, b) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalizeSettings(raw = {}) {
  const next = { ...DEFAULT_SETTINGS };

  if (isFiniteNumber(raw.mergeDistancePx)) {
    next.mergeDistancePx = clamp(raw.mergeDistancePx, 1, 60);
  }
  if (isFiniteNumber(raw.minBrushRadiusPx)) {
    next.minBrushRadiusPx = clamp(raw.minBrushRadiusPx, 2, 400);
  }
  if (isFiniteNumber(raw.maxCandidateNodes)) {
    next.maxCandidateNodes = clamp(Math.round(raw.maxCandidateNodes), 50, 5000);
  }
  if (typeof raw.verticesOnly === 'boolean') {
    next.verticesOnly = raw.verticesOnly;
  }

  return next;
}

function hasInterestingTags(node) {
  if (typeof node?.hasInterestingTags === 'function') {
    return node.hasInterestingTags();
  }
  return false;
}

export function areNodeTagsCompatible(nodeA, nodeB) {
  const tagsA = nodeA?.tags ?? {};
  const tagsB = nodeB?.tags ?? {};

  for (const key of Z_AXIS_KEYS) {
    const valueA = tagsA[key] ?? '0';
    const valueB = tagsB[key] ?? '0';
    if (valueA !== valueB) return false;
  }

  if (hasInterestingTags(nodeA) && hasInterestingTags(nodeB)) {
    return false;
  }

  return true;
}

export function sharesAdjacentParentWay(nodeA, nodeB, graph) {
  const parentWaysA = graph.parentWays(nodeA);
  if (!parentWaysA.length) return false;

  const parentWayIDsB = new Set(graph.parentWays(nodeB).map(way => way.id));
  for (const way of parentWaysA) {
    if (!parentWayIDsB.has(way.id)) continue;
    if (way.areAdjacent(nodeA.id, nodeB.id)) {
      return true;
    }
  }
  return false;
}

export function canMergeNodePair(nodeA, nodeB, graph) {
  if (!nodeA || !nodeB || nodeA.id === nodeB.id) return false;
  if (!areNodeTagsCompatible(nodeA, nodeB)) return false;
  if (sharesAdjacentParentWay(nodeA, nodeB, graph)) return false;
  return true;
}

export function buildMergeClusters(candidates, thresholdPx, canMergePairFn = () => true) {
  const items = Array.isArray(candidates) ? candidates : [];
  if (items.length < 2) return [];

  const threshold = Math.max(0, Number(thresholdPx) || 0);
  if (threshold <= 0) return [];

  const parents = items.map((_, index) => index);

  const find = index => {
    let current = index;
    while (parents[current] !== current) {
      parents[current] = parents[parents[current]];
      current = parents[current];
    }
    return current;
  };

  const union = (a, b) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;
    parents[rootB] = rootA;
  };

  for (let i = 0; i < items.length - 1; i++) {
    const pointA = items[i].screen;
    for (let j = i + 1; j < items.length; j++) {
      const pointB = items[j].screen;
      if (distance2D(pointA, pointB) > threshold) continue;
      if (!canMergePairFn(items[i], items[j])) continue;
      union(i, j);
    }
  }

  const grouped = new Map();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    if (!grouped.has(root)) {
      grouped.set(root, []);
    }
    grouped.get(root).push(items[i].id);
  }

  return [...grouped.values()]
    .map(ids => [...new Set(ids)])
    .filter(ids => ids.length >= 2);
}

export function runMergeClusters(graph, clusters, Rapid) {
  let nextGraph = graph;
  let mergedGroups = 0;
  let mergedNodes = 0;

  for (const cluster of clusters) {
    const existing = cluster.filter(id => nextGraph.hasEntity(id)?.type === 'node');
    if (existing.length < 2) continue;

    const action = Rapid.actionMergeNodes(existing);
    const disabled = (typeof action.disabled === 'function') ? action.disabled(nextGraph) : false;
    if (disabled) continue;

    const mergedGraph = action(nextGraph);
    if (mergedGraph === nextGraph) continue;

    nextGraph = mergedGraph;
    mergedGroups += 1;
    mergedNodes += existing.length;
  }

  const selectedIDs = [];
  for (const cluster of clusters) {
    const survivorID = cluster.find(id => nextGraph.hasEntity(id)?.type === 'node');
    if (survivorID) selectedIDs.push(survivorID);
  }

  return {
    graph: nextGraph,
    mergedGroups,
    mergedNodes,
    selectedIDs: [...new Set(selectedIDs)]
  };
}

function canUseDOM() {
  return Boolean(globalThis.window?.document);
}

class NodeMergeBrushController {
  constructor(api) {
    this.api = api;
    this.context = api.context;
    this.settings = normalizeSettings();

    this._registeredDisposers = [];
    this._shortcutClaims = createShortcutClaims('node-merge-brush', {
      isReservedShortcut: createRapidShortcutConflictChecker(this.context)
    });
    this._toggleShortcutEnabled = false;
    this._active = false;
    this._brushing = false;
    this._brushCenterScreen = null;
    this._brushCurrentScreen = null;
    this._previewWrap = null;
    this._previewSVG = null;
    this._previewCircle = null;
    this._previewNodes = null;
    this._suspendedBehaviors = new Map();

    this._pointerdown = this._pointerdown.bind(this);
    this._pointermove = this._pointermove.bind(this);
    this._pointerup = this._pointerup.bind(this);
    this._keydown = this._keydown.bind(this);
    this._drawPreview = this._drawPreview.bind(this);
  }

  enable() {
    const toggleShortcutClaim = this._shortcutClaims.claim('Shift+M', 'Node Merge Brush');
    this._toggleShortcutEnabled = toggleShortcutClaim.ok;
    if (!toggleShortcutClaim.ok && toggleShortcutClaim.owner) {
      this._notify(
        `Node Merge Brush: Shift+M は "${toggleShortcutClaim.owner.label}" と競合するため無効化されました`,
        'warning'
      );
    }

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
      id: 'toggle-node-merge-brush-mode',
      label: 'Node Merge Brush',
      keywords: 'merge snap connect align close nodes',
      shortcut: this._toggleShortcutEnabled ? 'Shift+M' : '',
      run: () => this.toggleMode()
    });

    registerToolbarButton({
      id: 'toggle-node-merge-brush-mode',
      label: 'Merge',
      title: 'Node Merge Brush (Shift+M)',
      run: () => this.toggleMode()
    });

    if (canUseDOM()) {
      globalThis.window.addEventListener('keydown', this._keydown, true);
    }

    this.context.systems.gfx?.on('draw', this._drawPreview);
  }

  disable() {
    this.deactivateMode({ silent: true });
    this._shortcutClaims.releaseAll();
    releaseToolLock('node-merge-brush');

    this.context.systems.gfx?.off('draw', this._drawPreview);
    if (canUseDOM()) {
      globalThis.window.removeEventListener('keydown', this._keydown, true);
    }

    for (const dispose of this._registeredDisposers) {
      dispose();
    }
    this._registeredDisposers = [];
  }

  toggleMode() {
    if (this._active) {
      this.deactivateMode();
    } else {
      this.activateMode();
    }
  }

  activateMode() {
    if (this._active) return;

    const lock = acquireToolLock('node-merge-brush', 'Node Merge Brush');
    if (!lock.ok) {
      this._notify(`Node Merge Brush: "${lock.owner.label}" の編集中は開始できません`, 'warning');
      return;
    }

    this._active = true;
    this._brushing = false;
    this._brushCenterScreen = null;
    this._brushCurrentScreen = null;

    this.context.enter('browse');
    this._suspendBehaviors(['select', 'drag', 'lasso']);
    this._bindPointerEvents();
    this._ensurePreview();
    this._notify('Node Merge Brush: ドラッグで範囲を指定してノードを自動マージします', 'info');
  }

  deactivateMode(options = {}) {
    if (!this._active) return;
    releaseToolLock('node-merge-brush');

    this._restoreBehaviors();
    this._unbindPointerEvents();
    this._destroyPreview();
    this._active = false;
    this._brushing = false;
    this._brushCenterScreen = null;
    this._brushCurrentScreen = null;

    if (!options.silent) {
      this._notify('Node Merge Brush: モード終了', 'info');
    }
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
    if (this._toggleShortcutEnabled && this._shortcutClaims.ownsEvent(e) &&
      e.code === 'KeyM' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this._consumeKeyEvent(e);
      this.toggleMode();
      return;
    }

    if (!this._active) return;

    if (e.key === 'Escape') {
      this._consumeKeyEvent(e);
      this.deactivateMode();
    }
  }

  _pointerdown(e) {
    if (!this._active) return;
    if (this.context.systems.gfx?.events?.pointerOverRenderer === false) return;

    const mapCoord = this._eventMapCoord(e);
    if (!mapCoord) return;

    this._stopPixiEvent(e);
    this._brushing = true;
    this._brushCenterScreen = mapCoord.screen;
    this._brushCurrentScreen = mapCoord.screen;
    this._drawPreview();
  }

  _pointermove(e) {
    if (!this._active || !this._brushing) return;

    const mapCoord = this._eventMapCoord(e);
    if (!mapCoord) return;

    this._stopPixiEvent(e);
    this._brushCurrentScreen = mapCoord.screen;
    this._drawPreview();
  }

  _pointerup(e) {
    if (!this._active || !this._brushing) return;

    const mapCoord = this._eventMapCoord(e);
    if (mapCoord) {
      this._brushCurrentScreen = mapCoord.screen;
    }

    this._stopPixiEvent(e);
    this._applyBrush();

    this._brushing = false;
    this._brushCenterScreen = null;
    this._brushCurrentScreen = null;
    this._drawPreview();
  }

  _applyBrush() {
    if (typeof this.context.editable === 'function' && !this.context.editable()) {
      this._notify('Node Merge Brush: この場所は編集できません', 'error');
      return;
    }

    const Rapid = globalThis.Rapid;
    const editor = this.context.systems.editor;
    const graph = editor?.staging?.graph;
    if (!Rapid?.actionMergeNodes || !editor || !graph) {
      this._notify('Node Merge Brush: 編集システムにアクセスできません', 'error');
      return;
    }

    const center = this._brushCenterScreen;
    const edge = this._brushCurrentScreen ?? center;
    if (!center || !edge) return;

    const radiusPx = Math.max(this.settings.minBrushRadiusPx, distance2D(center, edge));
    const candidates = this._collectCandidateNodes(center, radiusPx, graph);
    if (candidates.length >= this.settings.maxCandidateNodes) {
      this._notify('Node Merge Brush: 候補が多いため上限までを処理しました。範囲を小さくすると精度が上がります', 'warning');
    }

    if (candidates.length < 2) {
      this._notify('Node Merge Brush: 範囲内にマージ候補がありません', 'info');
      return;
    }

    const clusters = buildMergeClusters(
      candidates,
      this.settings.mergeDistancePx,
      (a, b) => canMergeNodePair(a.node, b.node, graph)
    );

    if (!clusters.length) {
      this._notify('Node Merge Brush: 条件に合う近接ノードが見つかりませんでした', 'info');
      return;
    }

    const preview = runMergeClusters(graph, clusters, Rapid);
    if (!preview.mergedGroups) {
      this._notify('Node Merge Brush: 制約のためマージできませんでした', 'info');
      return;
    }

    const action = currentGraph => runMergeClusters(currentGraph, clusters, Rapid).graph;

    editor.beginTransaction();
    editor.perform(action);
    editor.commit({
      annotation: `Node Merge Brush: merged ${preview.mergedGroups} groups`,
      selectedIDs: preview.selectedIDs
    });
    editor.endTransaction();

    const mergedExtraNodes = Math.max(0, preview.mergedNodes - preview.mergedGroups);
    this._notify(
      `Node Merge Brush: ${preview.mergedGroups}グループを整列マージしました（${mergedExtraNodes}ノード統合）`,
      'info'
    );
  }

  _collectCandidateNodes(centerScreen, radiusPx, graph) {
    const editor = this.context.systems.editor;
    const viewport = this.context.viewport;
    const extent = this._circleExtent(centerScreen, radiusPx);
    if (!extent) return [];

    const intersected = editor.intersects(extent) ?? [];
    const candidates = [];

    for (const entity of intersected) {
      if (entity?.type !== 'node') continue;

      if (this.settings.verticesOnly && entity.geometry(graph) !== 'vertex') {
        continue;
      }

      const screen = viewport.project(entity.loc);
      if (distance2D(screen, centerScreen) > radiusPx) continue;

      candidates.push({
        id: entity.id,
        node: entity,
        screen
      });

      if (candidates.length >= this.settings.maxCandidateNodes) {
        break;
      }
    }

    return candidates;
  }

  _circleExtent(centerScreen, radiusPx) {
    const Rapid = globalThis.Rapid;
    const Extent = Rapid?.sdk?.Extent;
    if (!Extent) return null;

    const viewport = this.context.viewport;
    const corners = [
      [centerScreen[0] - radiusPx, centerScreen[1] - radiusPx],
      [centerScreen[0] + radiusPx, centerScreen[1] - radiusPx],
      [centerScreen[0] + radiusPx, centerScreen[1] + radiusPx],
      [centerScreen[0] - radiusPx, centerScreen[1] + radiusPx]
    ];

    const locs = corners.map(screen => viewport.unproject(this._mapPointFromScreen(screen)));
    const lons = locs.map(loc => loc[0]);
    const lats = locs.map(loc => loc[1]);

    return new Extent(
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)]
    );
  }

  _eventMapCoord(e) {
    if (!e?.global || !this.context?.viewport) return null;
    const screen = [e.global.x, e.global.y];
    return { screen, map: this._mapPointFromScreen(screen) };
  }

  _mapPointFromScreen(screen) {
    const viewport = this.context.viewport;
    const rotation = viewport.transform?.r ?? 0;
    if (!rotation) return screen;

    const center = viewport.center?.() ?? [0, 0];
    const x = screen[0] - center[0];
    const y = screen[1] - center[1];
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);

    return [
      x * cos - y * sin + center[0],
      x * sin + y * cos + center[1]
    ];
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

  _ensurePreview() {
    if (!canUseDOM() || this._previewWrap) return;
    const containerNode = this.context.container?.().node?.();
    if (!containerNode) return;

    const mapContainer = containerNode.querySelector('.main-map') || containerNode;
    const doc = globalThis.document;
    const wrap = doc.createElement('div');
    wrap.className = 'node-merge-brush-preview';
    wrap.style.position = 'absolute';
    wrap.style.inset = '0';
    wrap.style.pointerEvents = 'none';
    wrap.style.zIndex = '150';

    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${mapContainer.clientWidth || 1} ${mapContainer.clientHeight || 1}`);

    const circle = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('fill', 'rgba(255, 255, 255, 0.15)');
    circle.setAttribute('stroke', '#f0f0f0');
    circle.setAttribute('stroke-width', '1.5');

    const nodesGroup = doc.createElementNS('http://www.w3.org/2000/svg', 'g');

    svg.appendChild(circle);
    svg.appendChild(nodesGroup);
    wrap.appendChild(svg);

    const computed = globalThis.window.getComputedStyle(mapContainer);
    if (computed.position === 'static') {
      mapContainer.style.position = 'relative';
    }
    mapContainer.appendChild(wrap);

    this._previewWrap = wrap;
    this._previewSVG = svg;
    this._previewCircle = circle;
    this._previewNodes = nodesGroup;
  }

  _destroyPreview() {
    if (!this._previewWrap) return;
    this._previewWrap.remove();
    this._previewWrap = null;
    this._previewSVG = null;
    this._previewCircle = null;
    this._previewNodes = null;
  }

  _drawPreview() {
    if (!this._previewWrap || !this._previewCircle || !this._previewNodes || !this._previewSVG) return;
    if (!this._active || !this._brushing || !this._brushCenterScreen) {
      this._previewCircle.setAttribute('r', '0');
      this._previewNodes.textContent = '';
      return;
    }

    const mapContainer = this._previewWrap.parentElement;
    const width = mapContainer?.clientWidth || 1;
    const height = mapContainer?.clientHeight || 1;
    this._previewSVG.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const center = this._brushCenterScreen;
    const edge = this._brushCurrentScreen ?? center;
    const radiusPx = Math.max(this.settings.minBrushRadiusPx, distance2D(center, edge));

    this._previewCircle.setAttribute('cx', center[0]);
    this._previewCircle.setAttribute('cy', center[1]);
    this._previewCircle.setAttribute('r', radiusPx);

    const graph = this.context.systems.editor?.staging?.graph;
    if (!graph) {
      this._previewNodes.textContent = '';
      return;
    }

    const candidates = this._collectCandidateNodes(center, radiusPx, graph);
    const clusters = buildMergeClusters(
      candidates,
      this.settings.mergeDistancePx,
      (a, b) => canMergeNodePair(a.node, b.node, graph)
    );
    const highlightIDs = new Set(clusters.flat());

    this._previewNodes.textContent = '';
    for (const candidate of candidates) {
      if (!highlightIDs.has(candidate.id)) continue;
      const ring = globalThis.document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', candidate.screen[0]);
      ring.setAttribute('cy', candidate.screen[1]);
      ring.setAttribute('r', '7');
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#fadb14');
      ring.setAttribute('stroke-width', '2');
      this._previewNodes.appendChild(ring);
    }
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
}

let controller = null;

export function enable(api) {
  if (controller) {
    controller.disable();
  }
  controller = new NodeMergeBrushController(api);
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
  normalizeSettings,
  areNodeTagsCompatible,
  sharesAdjacentParentWay,
  canMergeNodePair,
  buildMergeClusters,
  runMergeClusters
};
