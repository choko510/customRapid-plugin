import test from 'node:test';
import assert from 'node:assert/strict';

import { __testing, enable } from '../../plugins/fastdraw-tools/index.mjs';

const { buildWayNodes, parseClipboardTags, parseSettingsText, simplifyPolyline } = __testing;

test('fastdraw-tools registers commands and toolbar button', () => {
  const commands = [];
  const toolbarButtons = [];

  const api = {
    context: { systems: {} },
    registerCommand: command => {
      commands.push(command);
      return () => {};
    },
    registerToolbarButton: button => {
      toolbarButtons.push(button);
      return () => {};
    },
    notify: () => {}
  };

  enable(api);

  assert.equal(commands.length, 3);
  assert.equal(toolbarButtons.length, 1);
  assert.equal(commands[0].id, 'toggle-fastdraw-mode');
  assert.equal(commands[1].id, 'open-fastdraw-settings');
  assert.equal(commands[2].id, 'toggle-fastdraw-geometry');
  assert.equal(toolbarButtons[0].id, 'toggle-fastdraw-mode');
});

test('fastdraw-tools simplification keeps fixed points', () => {
  const viewport = {
    project: loc => loc
  };
  const points = [
    { loc: [0, 0] },
    { loc: [1, 0.05] },
    { loc: [2, 0] },
    { loc: [3, 0.04] },
    { loc: [4, 0] }
  ];

  const simplified = simplifyPolyline(points, new Set([2]), 0.2, viewport);
  assert.deepEqual(simplified.indices, [0, 2, 4]);
  assert.equal(simplified.points[1].sourceIndex, 2);
});

test('fastdraw-tools parses clipboard tags from key/value text and json', () => {
  const textTags = parseClipboardTags('highway=track\nsurface=gravel');
  assert.deepEqual(textTags, { highway: 'track', surface: 'gravel' });

  const jsonTags = parseClipboardTags('{"natural":"water","name":"Pond"}');
  assert.deepEqual(jsonTags, { natural: 'water', name: 'Pond' });
});

test('fastdraw-tools parses fastdraw.* settings text', () => {
  const settings = parseSettingsText('fastdraw.epsilonPx=9\nfastdraw.autoSampleByDistance=false');
  assert.equal(settings.epsilonPx, 9);
  assert.equal(settings.autoSampleByDistance, false);
});

test('fastdraw-tools builds way nodes for line/area', () => {
  assert.deepEqual(buildWayNodes(['n1', 'n2', 'n3'], 'line'), ['n1', 'n2', 'n3']);
  assert.deepEqual(buildWayNodes(['n1', 'n2', 'n3'], 'area'), ['n1', 'n2', 'n3', 'n1']);
  assert.equal(buildWayNodes(['n1', 'n1'], 'area'), null);
});
