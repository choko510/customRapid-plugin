const SHORTCUT_REGISTRY_KEY = '__customRapidPluginShortcutRegistry_v1';
const TOOL_LOCK_KEY = '__customRapidPluginToolLock_v1';
const MODIFIER_ORDER = ['ctrl', 'meta', 'alt', 'shift'];
const RAPID_EDITOR_OWNER = Object.freeze({
  pluginID: 'rapid-editor',
  label: 'Rapid Editor'
});

const RAPID_SHORTCUT_SPECS = Object.freeze([
  { keyID: 'shortcuts.command.add_point.key' },
  { keyID: 'shortcuts.command.add_line.key' },
  { keyID: 'shortcuts.command.add_area.key' },
  { keyID: 'shortcuts.command.add_note.key' },
  { keyID: 'shortcuts.command.accept_feature.key' },
  { keyID: 'shortcuts.command.ignore_feature.key' },
  { keyID: 'shortcuts.command.zoom_to.key' },
  { keyID: 'shortcuts.command.move.key' },
  { keyID: 'shortcuts.command.rotate.key' },
  { keyID: 'shortcuts.command.orthogonalize.key' },
  { keyID: 'shortcuts.command.straighten.key' },
  { keyID: 'shortcuts.command.circularize.key' },
  { keyID: 'shortcuts.command.divide.key' },
  { keyID: 'shortcuts.command.continue_line.key' },
  { keyID: 'shortcuts.command.merge.key' },
  { keyID: 'shortcuts.command.disconnect.key' },
  { keyID: 'shortcuts.command.extract.key' },
  { keyID: 'shortcuts.command.split.key' },
  { keyID: 'shortcuts.command.reverse.key' },
  { keyID: 'shortcuts.command.reflect_long.key' },
  { keyID: 'shortcuts.command.reflect_short.key' },
  { keyID: 'shortcuts.command.toggle_help.key' },
  { keyID: 'shortcuts.command.keyboard_shortcuts.key' },
  { keyID: 'shortcuts.command.toggle_background.key' },
  { keyID: 'shortcuts.command.background_previous.key' },
  { keyID: 'shortcuts.command.background_next.key' },
  { keyID: 'shortcuts.command.toggle_map_data.key' },
  { keyID: 'shortcuts.command.toggle_issues.key' },
  { keyID: 'shortcuts.command.toggle_preferences.key' },
  { keyID: 'shortcuts.command.toggle_inspector.key' },
  { keyID: 'shortcuts.command.wireframe.key' },
  { keyID: 'shortcuts.command.highlight_edits.key' },
  { keyID: 'shortcuts.command.toggle_minimap.key' },
  { keyID: 'shortcuts.command.toggle_background_card.key', modifiers: ['meta', 'shift'] },
  { keyID: 'shortcuts.command.toggle_history_card.key', modifiers: ['meta', 'shift'] },
  { keyID: 'shortcuts.command.toggle_location_card.key', modifiers: ['meta', 'shift'] },
  { keyID: 'shortcuts.command.toggle_measurement_card.key', modifiers: ['meta', 'shift'] },
  { keyID: 'shortcuts.command.toggle_3dmap.key', modifiers: ['meta'] },
  { keyID: 'shortcuts.command.toggle_all_layers.key', modifiers: ['shift'] },
  { keyID: 'shortcuts.command.toggle_osm_data.key', modifiers: ['shift'] },
  { keyID: 'shortcuts.command.toggle_osm_notes.key', modifiers: ['shift'] },
  { keyID: 'shortcuts.command.toggle_rapid_data.key', modifiers: ['shift'] },
  { keyID: 'shortcuts.command.toggle_mapillary.key', modifiers: ['shift'] },
  { keyID: 'shortcuts.command.toggle_streetside.key', modifiers: ['shift'] },
  { keyID: 'shortcuts.command.toggle_kartaview.key', modifiers: ['shift'] },
  { keyID: 'shortcuts.command.toggle_all_cards.key', modifiers: ['meta'] },
  { keyID: 'shortcuts.command.background_switch.key', modifiers: ['meta'] },
  { keyID: 'shortcuts.command.command_palette.key', modifiers: ['meta'] },
  { keyID: 'shortcuts.command.find.key', modifiers: ['meta'] },
  { keyID: 'shortcuts.command.copy.key', modifiers: ['meta'] },
  { keyID: 'shortcuts.command.paste.key', modifiers: ['meta'] },
  { keyID: 'shortcuts.command.undo.key', modifiers: ['meta'] },
  { keyID: 'shortcuts.command.redo.key', modifiers: ['meta', 'shift'] },
  { keyID: 'shortcuts.command.save.key', modifiers: ['meta'] },
  { keyID: 'shortcuts.command.cycle_highway_tag.key', modifiers: ['shift'] }
]);

const RAPID_LITERAL_SHORTCUTS = Object.freeze([
  'meta+k',
  'meta+z',
  'meta+shift+z',
  'meta+c',
  'meta+v',
  'meta+s',
  'meta+f',
  'meta+shift+b',
  'meta+shift+h',
  'meta+shift+l',
  'meta+shift+m'
]);

const MODIFIER_ALIASES = new Map([
  ['⌃', 'ctrl'],
  ['⌥', 'alt'],
  ['⇧', 'shift'],
  ['⌘', 'meta'],
  ['ctrl', 'ctrl'],
  ['control', 'ctrl'],
  ['cmd', 'meta'],
  ['command', 'meta'],
  ['meta', 'meta'],
  ['win', 'meta'],
  ['super', 'meta'],
  ['alt', 'alt'],
  ['option', 'alt'],
  ['shift', 'shift']
]);

const KEY_ALIASES = new Map([
  ['esc', 'escape'],
  ['return', 'enter'],
  ['spacebar', 'space'],
  ['del', 'delete']
]);

function getShortcutRegistry() {
  if (!(globalThis[SHORTCUT_REGISTRY_KEY] instanceof Map)) {
    globalThis[SHORTCUT_REGISTRY_KEY] = new Map();
  }
  return globalThis[SHORTCUT_REGISTRY_KEY];
}

function getToolLockState() {
  const lock = globalThis[TOOL_LOCK_KEY];
  if (!lock || typeof lock !== 'object') return null;
  if (!lock.pluginID) return null;
  return lock;
}

function normalizeKeyToken(token) {
  const text = String(token ?? '').trim().toLowerCase();
  if (!text) return '';
  if (KEY_ALIASES.has(text)) return KEY_ALIASES.get(text);
  if (/^[a-z]$/.test(text)) return `key${text}`;
  if (/^\d$/.test(text)) return `digit${text}`;
  if (/^key[a-z]$/.test(text)) return text;
  if (/^digit\d$/.test(text)) return text;
  if (/^f\d{1,2}$/.test(text)) return text;
  if (text.startsWith('arrow')) return text;
  return text;
}

function normalizeShortcut(shortcut) {
  const raw = String(shortcut ?? '').trim()
    .replace(/⌃/g, 'ctrl+')
    .replace(/⌥/g, 'alt+')
    .replace(/⇧/g, 'shift+')
    .replace(/⌘/g, 'meta+');
  if (!raw) return '';

  const modifiers = new Set();
  let key = '';
  for (const token of raw.split('+').map(part => part.trim().toLowerCase()).filter(Boolean)) {
    const modifier = MODIFIER_ALIASES.get(token);
    if (modifier) {
      modifiers.add(modifier);
    } else {
      key = normalizeKeyToken(token);
    }
  }
  if (!key) return '';

  const orderedModifiers = MODIFIER_ORDER.filter(mod => modifiers.has(mod));
  return [...orderedModifiers, key].join('+');
}

function eventToShortcut(event) {
  if (!event) return '';
  const modifiers = [];
  if (event.ctrlKey) modifiers.push('ctrl');
  if (event.metaKey) modifiers.push('meta');
  if (event.altKey) modifiers.push('alt');
  if (event.shiftKey) modifiers.push('shift');

  const key = normalizeKeyToken(event.code || event.key);
  if (!key) return '';
  return [...modifiers, key].join('+');
}

function splitKeyVariants(value) {
  return String(value ?? '')
    .split(/[,|/]/)
    .map(part => part.trim())
    .filter(Boolean);
}

function resolveShortcutFromSpec(spec, l10n) {
  if (!l10n || typeof l10n.t !== 'function') return [];
  const raw = String(l10n.t(spec.keyID) ?? '').trim();
  if (!raw || raw === spec.keyID) return [];

  return splitKeyVariants(raw)
    .map(key => normalizeShortcut([...(spec.modifiers ?? []), key].join('+')))
    .filter(Boolean);
}

function collectRapidReservedShortcuts(context) {
  const l10n = context?.systems?.l10n;
  const reserved = new Set(RAPID_LITERAL_SHORTCUTS.map(normalizeShortcut).filter(Boolean));
  for (const spec of RAPID_SHORTCUT_SPECS) {
    for (const shortcut of resolveShortcutFromSpec(spec, l10n)) {
      reserved.add(shortcut);
    }
  }
  return reserved;
}

function createRapidShortcutConflictChecker(context) {
  const reserved = collectRapidReservedShortcuts(context);
  return shortcut => reserved.has(normalizeShortcut(shortcut));
}

function createShortcutClaims(pluginID, options = {}) {
  const ownerID = String(pluginID ?? '').trim();
  const claims = new Set();
  const isReservedShortcut = (typeof options.isReservedShortcut === 'function')
    ? options.isReservedShortcut
    : () => false;

  return {
    claim(shortcut, label = '') {
      const normalized = normalizeShortcut(shortcut);
      if (!normalized) {
        return { ok: false, reason: 'invalid_shortcut', shortcutID: '' };
      }

      if (isReservedShortcut(normalized)) {
        return { ok: false, reason: 'reserved', shortcutID: normalized, owner: RAPID_EDITOR_OWNER };
      }

      const registry = getShortcutRegistry();
      const owner = registry.get(normalized);
      if (owner && owner.pluginID !== ownerID) {
        return { ok: false, reason: 'conflict', shortcutID: normalized, owner };
      }

      registry.set(normalized, {
        pluginID: ownerID,
        label: String(label ?? '').trim() || shortcut
      });
      claims.add(normalized);
      return { ok: true, reason: '', shortcutID: normalized };
    },

    releaseAll() {
      const registry = getShortcutRegistry();
      for (const shortcutID of claims) {
        const owner = registry.get(shortcutID);
        if (owner?.pluginID === ownerID) {
          registry.delete(shortcutID);
        }
      }
      claims.clear();
    },

    ownsEvent(event) {
      const shortcutID = eventToShortcut(event);
      if (!shortcutID) return false;
      const owner = getShortcutRegistry().get(shortcutID);
      return owner?.pluginID === ownerID;
    }
  };
}

function acquireToolLock(pluginID, label = '') {
  const ownerID = String(pluginID ?? '').trim();
  const nextLabel = String(label ?? '').trim() || ownerID;
  const lock = getToolLockState();
  if (lock && lock.pluginID !== ownerID) {
    return { ok: false, owner: lock };
  }

  globalThis[TOOL_LOCK_KEY] = {
    pluginID: ownerID,
    label: nextLabel
  };
  return { ok: true, owner: globalThis[TOOL_LOCK_KEY] };
}

function releaseToolLock(pluginID) {
  const ownerID = String(pluginID ?? '').trim();
  const lock = getToolLockState();
  if (!lock || lock.pluginID !== ownerID) return;
  delete globalThis[TOOL_LOCK_KEY];
}

const PLUGIN_ID = 'photo-adjust-tools';
const PHOTO_LAYER_IDS = Object.freeze(['mapillary', 'kartaview', 'streetside']);
const MAP_MODE_LOCK_LABEL = 'Photo Adjust Map Mode';
const DRAG_START_DISTANCE_PX = 4;

function canUseDOM() {
  return Boolean(globalThis.window?.document);
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function keyFor(layerID, photoID) {
  return `${layerID}/${photoID}`;
}

function parseKey(key) {
  if (!key || typeof key !== 'string') return null;
  const [layerID, photoID] = key.split('/', 2);
  if (!layerID || !photoID) return null;
  return { layerID, photoID };
}

function normalizeHeading(value) {
  const num = toNumber(value);
  if (num === null) return null;
  const normalized = ((num % 360) + 360) % 360;
  return Number.isFinite(normalized) ? normalized : null;
}

function distance2D(a, b) {
  return Math.hypot((a[0] ?? 0) - (b[0] ?? 0), (a[1] ?? 0) - (b[1] ?? 0));
}

function byCapturedAtThenID(a, b) {
  const at = Date.parse(a?.captured_at ?? '') || 0;
  const bt = Date.parse(b?.captured_at ?? '') || 0;
  if (at !== bt) return at - bt;
  return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
}

export function resolveEditableLayerIDs(options = {}) {
  const enabledLayerIDs = Array.isArray(options.enabledLayerIDs) ? options.enabledLayerIDs : [];
  const currentLayerID = typeof options.currentLayerID === 'string' ? options.currentLayerID : '';
  const mapMode = Boolean(options.mapMode);

  const enabledKnown = [...new Set(enabledLayerIDs.filter(id => PHOTO_LAYER_IDS.includes(id)))];
  if (currentLayerID && enabledKnown.includes(currentLayerID)) {
    return [currentLayerID];
  }
  if (enabledKnown.length === 1) {
    return enabledKnown;
  }
  if (mapMode) {
    return enabledKnown.length ? enabledKnown : [...PHOTO_LAYER_IDS];
  }
  return enabledKnown.length ? [enabledKnown[0]] : [];
}

export function buildRangeSelection(sortedKeys, anchorKey, targetKey) {
  if (!Array.isArray(sortedKeys) || !sortedKeys.length) return [];
  const from = sortedKeys.indexOf(anchorKey);
  const to = sortedKeys.indexOf(targetKey);
  if (from === -1 || to === -1) return [];
  const [start, end] = from <= to ? [from, to] : [to, from];
  return sortedKeys.slice(start, end + 1);
}

export function parseGPSDataText(text) {
  const result = {};
  let lat = null;
  let lon = null;
  let heading = null;

  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    const [rawKey, ...rest] = line.split('=');
    if (!rawKey || !rest.length) continue;
    const key = rawKey.trim().toLowerCase();
    const value = rest.join('=').trim();

    if (['lat', 'latitude', 'y'].includes(key)) {
      lat = toNumber(value);
    } else if (['lon', 'lng', 'longitude', 'x'].includes(key)) {
      lon = toNumber(value);
    } else if (['direction', 'heading', 'bearing', 'ca'].includes(key)) {
      heading = normalizeHeading(value);
    }
  }

  if (lat !== null || lon !== null) {
    if (lat === null || lon === null) {
      return { error: 'latitude と longitude は両方指定してください' };
    }
    if (lat < -90 || lat > 90) {
      return { error: 'latitude は -90..90 の範囲で指定してください' };
    }
    if (lon < -180 || lon > 180) {
      return { error: 'longitude は -180..180 の範囲で指定してください' };
    }
    result.loc = [lon, lat];
  }

  if (heading !== null) {
    result.ca = heading;
  }

  if (!result.loc && result.ca === undefined) {
    return { error: '変更項目がありません（latitude/longitude または direction を指定）' };
  }

  return result;
}

export function computeBearingDegrees(fromLoc, toLoc) {
  if (!Array.isArray(fromLoc) || !Array.isArray(toLoc)) return null;
  const lon1 = toNumber(fromLoc[0]);
  const lat1 = toNumber(fromLoc[1]);
  const lon2 = toNumber(toLoc[0]);
  const lat2 = toNumber(toLoc[1]);
  if (lon1 === null || lat1 === null || lon2 === null || lat2 === null) return null;

  const φ1 = lat1 * (Math.PI / 180);
  const φ2 = lat2 * (Math.PI / 180);
  const λ1 = lon1 * (Math.PI / 180);
  const λ2 = lon2 * (Math.PI / 180);

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
  const degrees = Math.atan2(y, x) * (180 / Math.PI);
  return normalizeHeading(degrees);
}

function collectLayerPhotos(context, layerID) {
  const service = context?.services?.[layerID];
  if (!service) return [];

  if (layerID === 'mapillary') {
    return [...(service._cache?.images?.data?.values?.() ?? [])];
  }
  if (layerID === 'kartaview') {
    return [...(service._cache?.images?.values?.() ?? [])];
  }
  if (layerID === 'streetside') {
    return [...(service._cache?.bubbles?.values?.() ?? [])];
  }
  return [];
}

class PhotoAdjustController {
  constructor(api) {
    this.api = api;
    this.context = api.context;
    this._registeredDisposers = [];

    this._shortcutClaims = createShortcutClaims(PLUGIN_ID, {
      isReservedShortcut: createRapidShortcutConflictChecker(this.context)
    });
    this._toggleShortcutEnabled = false;

    this._mapMode = false;
    this._suspendedBehaviors = new Map();
    this._selectedKeys = new Set();
    this._anchorKey = null;
    this._primaryKey = null;

    this._pendingPointer = null;
    this._dragging = false;
    this._dragStartLoc = null;
    this._dragStartPositions = new Map();

    this._keydown = this._keydown.bind(this);
    this._pointerdown = this._pointerdown.bind(this);
    this._pointermove = this._pointermove.bind(this);
    this._pointerup = this._pointerup.bind(this);
    this._layerchange = this._layerchange.bind(this);
  }

  enable() {
    const toggleShortcutClaim = this._shortcutClaims.claim('Shift+P', 'Photo Adjust Map Mode');
    this._toggleShortcutEnabled = toggleShortcutClaim.ok;
    if (!toggleShortcutClaim.ok && toggleShortcutClaim.owner) {
      this._notify(
        `Photo Adjust: Shift+P は "${toggleShortcutClaim.owner.label}" と競合するため無効化されました`,
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
      id: 'toggle-photo-adjust-map-mode',
      label: 'Photo Adjust Map Mode',
      keywords: 'photo adjust geotag gps map mode',
      shortcut: this._toggleShortcutEnabled ? 'Shift+P' : '',
      run: () => this.toggleMapMode()
    });

    registerCommand({
      id: 'edit-photo-gps-data',
      label: 'Edit Photo GPS Data',
      keywords: 'photo gps latitude longitude direction heading',
      run: () => this.openGPSDataEditor()
    });

    registerToolbarButton({
      id: 'toggle-photo-adjust-map-mode',
      label: 'Photo Adjust',
      title: 'Photo Adjust Map Mode (Shift+P)',
      run: () => this.toggleMapMode()
    });

    const gfx = this.context.systems.gfx;
    const scene = gfx?.scene;
    const events = gfx?.events;
    events?.on('pointerdown', this._pointerdown);
    events?.on('pointermove', this._pointermove);
    events?.on('pointerup', this._pointerup);
    events?.on('pointercancel', this._pointerup);
    scene?.on('layerchange', this._layerchange);

    if (canUseDOM()) {
      globalThis.window.addEventListener('keydown', this._keydown, true);
    }
  }

  disable() {
    this._deactivateMapMode({ silent: true });
    this._shortcutClaims.releaseAll();
    releaseToolLock(PLUGIN_ID);

    this._clearSelection({ keepCurrentPhoto: true });

    const gfx = this.context.systems.gfx;
    const scene = gfx?.scene;
    const events = gfx?.events;
    events?.off('pointerdown', this._pointerdown);
    events?.off('pointermove', this._pointermove);
    events?.off('pointerup', this._pointerup);
    events?.off('pointercancel', this._pointerup);
    scene?.off('layerchange', this._layerchange);

    if (canUseDOM()) {
      globalThis.window.removeEventListener('keydown', this._keydown, true);
    }

    for (const dispose of this._registeredDisposers) {
      dispose();
    }
    this._registeredDisposers = [];
  }

  toggleMapMode() {
    if (this._mapMode) {
      this._deactivateMapMode();
    } else {
      this._activateMapMode();
    }
  }

  openGPSDataEditor() {
    if (!canUseDOM()) return;
    const current = this._currentPhotoRef();
    if (!current) {
      this._notify('Photo Adjust: 編集対象の写真が選択されていません', 'warning');
      return;
    }

    const defaultText = [
      `latitude=${current.photo.loc?.[1] ?? ''}`,
      `longitude=${current.photo.loc?.[0] ?? ''}`,
      `direction=${current.photo.ca ?? 0}`
    ].join('\n');

    const message = [
      'Photo GPS Data を編集してください。',
      '形式: latitude=<number> / longitude=<number> / direction=<number>',
      '空欄の項目は変更されません。'
    ].join('\n');

    const input = globalThis.window.prompt(message, defaultText);
    if (input === null) return;

    const parsed = parseGPSDataText(input);
    if (parsed.error) {
      this._notify(`Photo Adjust: ${parsed.error}`, 'error');
      return;
    }

    if (parsed.loc) {
      this._movePhoto(current.layerID, current.photoID, parsed.loc);
    }
    if (parsed.ca !== undefined) {
      this._setPhotoDirection(current.layerID, current.photoID, parsed.ca);
    }
    this._notify('Photo Adjust: 写真のGPSデータを更新しました', 'info');
  }

  _activateMapMode() {
    if (this._mapMode) return;
    const lock = acquireToolLock(PLUGIN_ID, MAP_MODE_LOCK_LABEL);
    if (!lock.ok) {
      this._notify(`Photo Adjust: "${lock.owner.label}" の編集中は開始できません`, 'warning');
      return;
    }
    this._mapMode = true;
    this._suspendBehaviors(['select', 'drag', 'lasso']);
    this._notify('Photo Adjust: Map Mode ON', 'info');
    this._syncSelectionToEditableLayers();
  }

  _deactivateMapMode(options = {}) {
    if (!this._mapMode) return;
    this._mapMode = false;
    releaseToolLock(PLUGIN_ID);
    this._restoreBehaviors();
    this._pendingPointer = null;
    this._dragging = false;
    this._dragStartLoc = null;
    this._dragStartPositions.clear();
    if (!options.silent) {
      this._notify('Photo Adjust: Map Mode OFF', 'info');
    }
    this._syncSelectionToEditableLayers();
  }

  _enabledPhotoLayerIDs() {
    const scene = this.context.systems.gfx?.scene;
    if (!scene?.layers) return [];
    return PHOTO_LAYER_IDS.filter(layerID => scene.layers.get(layerID)?.enabled);
  }

  _editableLayerIDs() {
    const photos = this.context.systems.photos;
    return resolveEditableLayerIDs({
      enabledLayerIDs: this._enabledPhotoLayerIDs(),
      currentLayerID: photos?.currPhotoLayerID ?? null,
      mapMode: this._mapMode
    });
  }

  _isOperational() {
    return this._mapMode || this._enabledPhotoLayerIDs().length > 0;
  }

  _isLayerEditable(layerID) {
    return this._editableLayerIDs().includes(layerID);
  }

  _layerchange() {
    this._syncSelectionToEditableLayers();
  }

  _syncSelectionToEditableLayers() {
    const editable = new Set(this._editableLayerIDs());
    const kept = [...this._selectedKeys].filter(key => {
      const parsed = parseKey(key);
      return parsed && editable.has(parsed.layerID);
    });

    const keepSet = new Set(kept);
    const anchorValid = this._anchorKey && keepSet.has(this._anchorKey);
    const primaryValid = this._primaryKey && keepSet.has(this._primaryKey);
    this._setSelection(kept, {
      anchorKey: anchorValid ? this._anchorKey : null,
      primaryKey: primaryValid ? this._primaryKey : null,
      keepCurrentPhoto: true
    });
  }

  _orderedPhotoKeys(layerID) {
    const photos = collectLayerPhotos(this.context, layerID)
      .filter(photo => photo?.id)
      .sort(byCapturedAtThenID);
    return photos.map(photo => keyFor(layerID, photo.id));
  }

  _currentPhotoRef() {
    const photos = this.context.systems.photos;
    let layerID = photos?.currPhotoLayerID ?? null;
    let photoID = photos?.currPhotoID ?? null;

    if (!layerID || !photoID) {
      const parsed = parseKey(this._primaryKey);
      layerID = parsed?.layerID ?? null;
      photoID = parsed?.photoID ?? null;
    }
    if (!layerID || !photoID) return null;

    const photo = this._getPhoto(layerID, photoID);
    if (!photo) return null;
    return { layerID, photoID, photo };
  }

  _getPhoto(layerID, photoID) {
    const service = this.context.services?.[layerID];
    if (!service || !photoID) return null;

    if (layerID === 'mapillary') return service._cache?.images?.data?.get(photoID) ?? null;
    if (layerID === 'kartaview') return service._cache?.images?.get(photoID) ?? null;
    if (layerID === 'streetside') return service._cache?.bubbles?.get(photoID) ?? null;
    return null;
  }

  _extractPhotoTarget(e) {
    let dObj = e?.target;
    while (dObj) {
      const feature = dObj.__feature__;
      if (feature) {
        const data = feature.data;
        const layerID = feature.layer?.id;
        if (data?.type !== 'photo' || !layerID || !feature.dataID) {
          return null;
        }
        return {
          layerID,
          photoID: feature.dataID,
          photo: data,
          key: keyFor(layerID, feature.dataID)
        };
      }
      dObj = dObj.parent;
    }
    return null;
  }

  _eventMapCoord(e) {
    if (!e?.global || !this.context?.viewport) return null;
    const screen = [e.global.x, e.global.y];
    const map = this._mapPointFromScreen(screen);
    const loc = this.context.viewport.unproject(map);
    return { screen, map, loc };
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

  _pointerdown(e) {
    if (!this._isOperational()) return;
    if (this.context.systems.gfx?.events?.pointerOverRenderer === false) return;

    const mapCoord = this._eventMapCoord(e);
    if (!mapCoord) return;

    if (e.ctrlKey && e.altKey) {
      this._consumePointerEvent(e);
      this._placeCurrentPhoto(mapCoord.loc);
      return;
    }
    if (e.ctrlKey && !e.altKey && !e.shiftKey) {
      this._consumePointerEvent(e);
      this._setCurrentPhotoDirection(mapCoord.loc);
      return;
    }

    const target = this._extractPhotoTarget(e);
    if (!target || !this._isLayerEditable(target.layerID)) {
      return;
    }

    this._consumePointerEvent(e);
    if (e.shiftKey && e.ctrlKey) {
      this._selectRangeToTarget(target);
      return;
    }
    if (e.shiftKey) {
      this._addTargetToSelection(target);
      return;
    }

    this._pendingPointer = {
      id: e.pointerId ?? 'mouse',
      target,
      startScreen: mapCoord.screen
    };
  }

  _pointermove(e) {
    const pending = this._pendingPointer;
    if (!pending) return;
    if ((e.pointerId ?? 'mouse') !== pending.id) return;

    const mapCoord = this._eventMapCoord(e);
    if (!mapCoord) return;

    if (!this._dragging) {
      const moved = distance2D(mapCoord.screen, pending.startScreen) >= DRAG_START_DISTANCE_PX;
      if (!moved) return;

      if (!this._selectedKeys.has(pending.target.key)) {
        this._selectOnlyTarget(pending.target);
      }
      this._startDragging(mapCoord.loc);
    }

    this._consumePointerEvent(e);
    this._dragTo(mapCoord.loc);
  }

  _pointerup(e) {
    const pending = this._pendingPointer;
    if (!pending) return;
    if ((e.pointerId ?? 'mouse') !== pending.id) return;

    this._consumePointerEvent(e);
    if (this._dragging) {
      const movedCount = this._dragStartPositions.size;
      this._notify(`Photo Adjust: ${movedCount}件の写真位置を更新`, 'info');
    } else {
      this._selectOnlyTarget(pending.target);
    }

    this._pendingPointer = null;
    this._dragging = false;
    this._dragStartLoc = null;
    this._dragStartPositions.clear();
  }

  _startDragging(startLoc) {
    this._dragging = true;
    this._dragStartLoc = [...startLoc];
    this._dragStartPositions.clear();

    for (const key of this._selectedKeys) {
      const parsed = parseKey(key);
      if (!parsed) continue;
      const photo = this._getPhoto(parsed.layerID, parsed.photoID);
      if (!photo?.loc) continue;
      this._dragStartPositions.set(key, [...photo.loc]);
    }
  }

  _dragTo(currentLoc) {
    if (!this._dragging || !this._dragStartLoc) return;
    const delta = [
      currentLoc[0] - this._dragStartLoc[0],
      currentLoc[1] - this._dragStartLoc[1]
    ];

    for (const [key, startLoc] of this._dragStartPositions) {
      const parsed = parseKey(key);
      if (!parsed) continue;
      const nextLoc = [startLoc[0] + delta[0], startLoc[1] + delta[1]];
      this._movePhoto(parsed.layerID, parsed.photoID, nextLoc, { quiet: true });
    }
    this._deferredRedraw();
  }

  _selectOnlyTarget(target) {
    this._setSelection([target.key], {
      anchorKey: target.key,
      primaryKey: target.key
    });
  }

  _addTargetToSelection(target) {
    const next = new Set(this._selectedKeys);
    next.add(target.key);
    this._setSelection([...next], {
      anchorKey: this._anchorKey ?? target.key,
      primaryKey: target.key
    });
  }

  _selectRangeToTarget(target) {
    const anchor = this._anchorKey;
    const anchorParsed = parseKey(anchor);
    if (!anchorParsed || anchorParsed.layerID !== target.layerID) {
      this._addTargetToSelection(target);
      return;
    }

    const sorted = this._orderedPhotoKeys(target.layerID);
    const range = buildRangeSelection(sorted, anchor, target.key);
    if (!range.length) {
      this._addTargetToSelection(target);
      return;
    }

    const next = new Set(this._selectedKeys);
    for (const key of range) {
      next.add(key);
    }
    this._setSelection([...next], {
      anchorKey: anchor,
      primaryKey: target.key
    });
  }

  _setSelection(keys, options = {}) {
    const keepCurrentPhoto = Boolean(options.keepCurrentPhoto);
    const editableLayerIDs = new Set(this._editableLayerIDs());
    const nextSet = new Set();
    for (const key of keys ?? []) {
      const parsed = parseKey(key);
      if (!parsed) continue;
      if (!editableLayerIDs.has(parsed.layerID)) continue;
      nextSet.add(key);
    }

    // remove stale plugin highlights
    for (const key of this._selectedKeys) {
      if (nextSet.has(key)) continue;
      const parsed = parseKey(key);
      if (!parsed) continue;
      this.context.systems.gfx?.scene?.unsetClass('highlightphoto', parsed.layerID, parsed.photoID);
    }

    this._selectedKeys = nextSet;
    this._anchorKey = options.anchorKey && nextSet.has(options.anchorKey) ? options.anchorKey : null;

    let primaryKey = options.primaryKey && nextSet.has(options.primaryKey) ? options.primaryKey : null;
    if (!primaryKey && nextSet.size) {
      primaryKey = [...nextSet][nextSet.size - 1];
    }
    this._primaryKey = primaryKey;

    if (!keepCurrentPhoto && primaryKey) {
      const parsed = parseKey(primaryKey);
      this.context.systems.photos?.selectPhoto(parsed.layerID, parsed.photoID);
    }

    for (const key of nextSet) {
      if (key === primaryKey) continue;
      const parsed = parseKey(key);
      if (!parsed) continue;
      this.context.systems.gfx?.scene?.setClass('highlightphoto', parsed.layerID, parsed.photoID);
    }

    this._deferredRedraw();
  }

  _clearSelection(options = {}) {
    for (const key of this._selectedKeys) {
      const parsed = parseKey(key);
      if (!parsed) continue;
      this.context.systems.gfx?.scene?.unsetClass('highlightphoto', parsed.layerID, parsed.photoID);
    }
    this._selectedKeys.clear();
    this._anchorKey = null;
    this._primaryKey = null;
    if (!options.keepCurrentPhoto) {
      this.context.systems.photos?.selectPhoto();
    }
    this._deferredRedraw();
  }

  _placeCurrentPhoto(loc) {
    const current = this._currentPhotoRef();
    if (!current) {
      this._notify('Photo Adjust: 配置対象の写真が選択されていません', 'warning');
      return;
    }

    if (!this._isLayerEditable(current.layerID)) {
      this._notify('Photo Adjust: 現在の対象レイヤーでは写真を配置できません', 'warning');
      return;
    }

    this._movePhoto(current.layerID, current.photoID, loc);
    this._notify('Photo Adjust: 写真をマップ上に配置しました', 'info');
  }

  _setCurrentPhotoDirection(targetLoc) {
    const current = this._currentPhotoRef();
    if (!current || !current.photo.loc) {
      this._notify('Photo Adjust: 方向設定対象の写真が選択されていません', 'warning');
      return;
    }

    if (!this._isLayerEditable(current.layerID)) {
      this._notify('Photo Adjust: 現在の対象レイヤーでは方向を更新できません', 'warning');
      return;
    }

    const heading = computeBearingDegrees(current.photo.loc, targetLoc);
    if (heading === null) {
      this._notify('Photo Adjust: 方向を計算できませんでした', 'error');
      return;
    }
    this._setPhotoDirection(current.layerID, current.photoID, heading);
    this._notify(`Photo Adjust: 方向を ${heading.toFixed(1)}° に更新`, 'info');
  }

  _setPhotoDirection(layerID, photoID, heading) {
    const photo = this._getPhoto(layerID, photoID);
    if (!photo) return false;
    photo.ca = heading;

    const layer = this.context.systems.gfx?.scene?.layers?.get(layerID);
    layer?.dirtyData?.(photoID);
    this._deferredRedraw();
    return true;
  }

  _movePhoto(layerID, photoID, nextLoc, options = {}) {
    const photo = this._getPhoto(layerID, photoID);
    if (!photo) return false;
    const loc = [Number(nextLoc[0]), Number(nextLoc[1])];
    if (!Number.isFinite(loc[0]) || !Number.isFinite(loc[1])) return false;

    const service = this.context.services?.[layerID];
    if (layerID === 'mapillary') {
      const cache = service?._cache?.images;
      const box = cache?.boxes?.get?.(photoID);
      if (cache?.rbush && box) {
        cache.rbush.remove(box);
        box.minX = loc[0];
        box.maxX = loc[0];
        box.minY = loc[1];
        box.maxY = loc[1];
        cache.rbush.insert(box);
      }
    } else if (layerID === 'kartaview') {
      const cache = service?._cache;
      if (cache?.rbush) {
        cache.rbush.remove({ data: { id: photoID } }, (a, b) => a.data?.id === b.data?.id);
        cache.rbush.insert({ minX: loc[0], minY: loc[1], maxX: loc[0], maxY: loc[1], data: photo });
      }
    } else if (layerID === 'streetside') {
      const cache = service?._cache;
      if (cache?.rbush) {
        cache.rbush.remove({ data: { id: photoID } }, (a, b) => a.data?.id === b.data?.id);
        cache.rbush.insert({ minX: loc[0], minY: loc[1], maxX: loc[0], maxY: loc[1], data: photo });
      }
    }

    photo.loc = loc;
    this._updateFeatureGeometry(layerID, photoID, loc);

    if (!options.quiet) {
      this._deferredRedraw();
    }
    return true;
  }

  _updateFeatureGeometry(layerID, photoID, loc) {
    const layer = this.context.systems.gfx?.scene?.layers?.get(layerID);
    const featureID = `${layerID}-photo-${photoID}`;
    const feature = layer?.features?.get(featureID);
    if (feature?.geometry?.setCoords) {
      feature.geometry.setCoords(loc);
      feature.dirty = true;
    }
    layer?.dirtyData?.(photoID);
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

  _deferredRedraw() {
    this.context.systems.gfx?.deferredRedraw?.();
  }

  _keydown(e) {
    if (this._inEditableField(e)) return;

    if (this._toggleShortcutEnabled && this._shortcutClaims.ownsEvent(e) &&
      e.code === 'KeyP' && e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      this._consumeKeyEvent(e);
      this.toggleMapMode();
      return;
    }

    if (e.key === 'Escape' && this._mapMode) {
      this._consumeKeyEvent(e);
      this._deactivateMapMode();
    }
  }

  _inEditableField(e) {
    const activeElement = e?.target || globalThis.document?.activeElement;
    if (!activeElement) return false;
    const tag = (activeElement.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    return Boolean(activeElement.isContentEditable);
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

  _consumePointerEvent(e) {
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
  controller = new PhotoAdjustController(api);
  controller.enable();
}

export function disable() {
  controller?.disable();
  controller = null;
}

export function dispose() {
  controller?.disable();
  controller = null;
}

export const __testing = {
  PHOTO_LAYER_IDS,
  buildRangeSelection,
  computeBearingDegrees,
  parseGPSDataText,
  resolveEditableLayerIDs
};
