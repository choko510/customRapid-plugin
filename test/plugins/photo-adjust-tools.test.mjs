import test from 'node:test';
import assert from 'node:assert/strict';

import { __testing, enable } from '../../plugins/photo-adjust-tools/index.mjs';

test('photo-adjust-tools resolves editable layer scope with precedence', () => {
  const { resolveEditableLayerIDs } = __testing;

  assert.deepEqual(
    resolveEditableLayerIDs({
      enabledLayerIDs: ['mapillary', 'kartaview'],
      currentLayerID: 'mapillary',
      mapMode: true
    }),
    ['mapillary']
  );

  assert.deepEqual(
    resolveEditableLayerIDs({
      enabledLayerIDs: ['mapillary', 'kartaview'],
      currentLayerID: null,
      mapMode: true
    }),
    ['mapillary', 'kartaview']
  );

  assert.deepEqual(
    resolveEditableLayerIDs({
      enabledLayerIDs: ['mapillary', 'kartaview'],
      currentLayerID: null,
      mapMode: false
    }),
    ['mapillary']
  );
});

test('photo-adjust-tools builds inclusive range selection', () => {
  const { buildRangeSelection } = __testing;
  const keys = ['mapillary/a', 'mapillary/b', 'mapillary/c', 'mapillary/d'];

  assert.deepEqual(buildRangeSelection(keys, 'mapillary/b', 'mapillary/d'), ['mapillary/b', 'mapillary/c', 'mapillary/d']);
  assert.deepEqual(buildRangeSelection(keys, 'mapillary/d', 'mapillary/b'), ['mapillary/b', 'mapillary/c', 'mapillary/d']);
  assert.deepEqual(buildRangeSelection(keys, 'mapillary/x', 'mapillary/d'), []);
});

test('photo-adjust-tools parses gps text and validates ranges', () => {
  const { parseGPSDataText } = __testing;

  assert.deepEqual(parseGPSDataText('latitude=35.1\nlongitude=139.7\ndirection=450'), {
    loc: [139.7, 35.1],
    ca: 90
  });

  assert.match(parseGPSDataText('latitude=91\nlongitude=139').error, /latitude/);
  assert.match(parseGPSDataText('latitude=35').error, /両方/);
});

test('photo-adjust-tools computes bearing degrees', () => {
  const { computeBearingDegrees } = __testing;

  const east = computeBearingDegrees([139.7, 35.6], [139.8, 35.6]);
  assert.equal(Math.round(east), 90);
});

test('photo-adjust-tools registers commands and toolbar safely', () => {
  const commands = [];
  const buttons = [];

  const api = {
    context: {
      systems: {
        gfx: {},
        photos: {}
      },
      services: {}
    },
    registerCommand: spec => commands.push(spec),
    registerToolbarButton: spec => buttons.push(spec),
    notify: () => {}
  };

  enable(api);

  assert.equal(commands.length, 2);
  assert.equal(buttons.length, 1);
  assert.equal(commands[0].id, 'toggle-photo-adjust-map-mode');
  assert.equal(commands[1].id, 'edit-photo-gps-data');
  assert.equal(buttons[0].id, 'toggle-photo-adjust-map-mode');

  assert.doesNotThrow(() => commands[0].run());
  assert.doesNotThrow(() => commands[1].run());
});
