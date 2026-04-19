import test from 'node:test';
import assert from 'node:assert/strict';

import {
  __testing,
  acquireToolLock,
  createRapidShortcutConflictChecker,
  createShortcutClaims,
  eventToShortcut,
  normalizeShortcut,
  releaseToolLock
} from '../../plugins/_shared/shortcut-guard.mjs';

function resetGlobals() {
  delete globalThis[__testing.SHORTCUT_REGISTRY_KEY];
  delete globalThis[__testing.TOOL_LOCK_KEY];
}

test('shortcut-guard normalizes shortcut strings and keyboard events', () => {
  assert.equal(normalizeShortcut('Shift+F'), 'shift+keyf');
  assert.equal(normalizeShortcut('Ctrl+Alt+1'), 'ctrl+alt+digit1');
  assert.equal(normalizeShortcut('⌘K'), 'meta+keyk');
  assert.equal(normalizeShortcut(''), '');

  assert.equal(eventToShortcut({ code: 'KeyF', shiftKey: true }), 'shift+keyf');
  assert.equal(eventToShortcut({ key: 'Escape', ctrlKey: true }), 'ctrl+escape');
});

test('shortcut-guard detects reserved Rapid shortcuts', () => {
  const context = {
    systems: {
      l10n: {
        t: keyID => {
          if (keyID === 'shortcuts.command.toggle_mapillary.key') return 'M';
          if (keyID === 'shortcuts.command.add_area.key') return 'A';
          return keyID;
        }
      }
    }
  };

  const isReserved = createRapidShortcutConflictChecker(context);
  assert.equal(isReserved('Shift+M'), true);
  assert.equal(isReserved('A'), true);
  assert.equal(isReserved('Shift+F'), false);
});

test('shortcut-guard prevents duplicate shortcut claims across plugins', () => {
  resetGlobals();

  const fastdraw = createShortcutClaims('fastdraw-tools');
  const mergeBrush = createShortcutClaims('node-merge-brush');

  const first = fastdraw.claim('Shift+F', 'FastDraw Mode');
  assert.equal(first.ok, true);

  const second = mergeBrush.claim('Shift+F', 'Node Merge Brush');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'conflict');
  assert.equal(second.owner.pluginID, 'fastdraw-tools');

  fastdraw.releaseAll();
  const retry = mergeBrush.claim('Shift+F', 'Node Merge Brush');
  assert.equal(retry.ok, true);
});

test('shortcut-guard allows only one active tool lock at a time', () => {
  resetGlobals();

  const fastdrawLock = acquireToolLock('fastdraw-tools', 'FastDraw Mode');
  assert.equal(fastdrawLock.ok, true);

  const mergeLock = acquireToolLock('node-merge-brush', 'Node Merge Brush');
  assert.equal(mergeLock.ok, false);
  assert.equal(mergeLock.owner.pluginID, 'fastdraw-tools');

  releaseToolLock('fastdraw-tools');
  const retry = acquireToolLock('node-merge-brush', 'Node Merge Brush');
  assert.equal(retry.ok, true);
});
