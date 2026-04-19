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

  if (KEY_ALIASES.has(text)) {
    return KEY_ALIASES.get(text);
  }
  if (/^[a-z]$/.test(text)) {
    return `key${text}`;
  }
  if (/^\d$/.test(text)) {
    return `digit${text}`;
  }
  if (/^key[a-z]$/.test(text)) {
    return text;
  }
  if (/^digit\d$/.test(text)) {
    return text;
  }
  if (/^f\d{1,2}$/.test(text)) {
    return text;
  }
  if (text.startsWith('arrow')) {
    return text;
  }
  return text;
}

export function normalizeShortcut(shortcut) {
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
      continue;
    }
    key = normalizeKeyToken(token);
  }

  if (!key) return '';

  const orderedModifiers = MODIFIER_ORDER.filter(mod => modifiers.has(mod));
  return [...orderedModifiers, key].join('+');
}

export function eventToShortcut(event) {
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

export function createRapidShortcutConflictChecker(context) {
  const reserved = collectRapidReservedShortcuts(context);
  return shortcut => reserved.has(normalizeShortcut(shortcut));
}

export function createShortcutClaims(pluginID, options = {}) {
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

    release(shortcut) {
      const normalized = normalizeShortcut(shortcut);
      if (!normalized) return;
      const registry = getShortcutRegistry();
      const owner = registry.get(normalized);
      if (owner?.pluginID !== ownerID) return;
      registry.delete(normalized);
      claims.delete(normalized);
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

export function acquireToolLock(pluginID, label = '') {
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

export function releaseToolLock(pluginID) {
  const ownerID = String(pluginID ?? '').trim();
  const lock = getToolLockState();
  if (!lock || lock.pluginID !== ownerID) return;
  delete globalThis[TOOL_LOCK_KEY];
}

export function getToolLock() {
  return getToolLockState();
}

export const __testing = {
  SHORTCUT_REGISTRY_KEY,
  TOOL_LOCK_KEY,
  RAPID_SHORTCUT_SPECS,
  RAPID_LITERAL_SHORTCUTS
};
