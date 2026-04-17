import test from 'node:test';
import assert from 'node:assert/strict';

import { enable } from '../../plugins/rapid-layer-tools/index.mjs';

test('rapid-layer-tools toggles rapid layer on/off', () => {
  const commands = [];
  const toolbarButtons = [];
  let isRapidEnabled = false;
  let enableCalls = 0;
  let disableCalls = 0;

  const scene = {
    layers: {
      get: id => (id === 'rapid' ? { enabled: isRapidEnabled } : undefined)
    },
    enableLayers: id => {
      if (id === 'rapid') {
        isRapidEnabled = true;
        enableCalls++;
      }
    },
    disableLayers: id => {
      if (id === 'rapid') {
        isRapidEnabled = false;
        disableCalls++;
      }
    }
  };

  const api = {
    context: {
      systems: {
        gfx: { scene }
      }
    },
    t: key => key,
    registerCommand: command => commands.push(command),
    registerToolbarButton: button => toolbarButtons.push(button)
  };

  enable(api);

  assert.equal(commands.length, 1);
  assert.equal(toolbarButtons.length, 1);
  assert.equal(commands[0].id, 'toggle-rapid-layer');
  assert.equal(toolbarButtons[0].id, 'toggle-rapid-layer');

  commands[0].run();
  assert.equal(enableCalls, 1);
  assert.equal(disableCalls, 0);

  toolbarButtons[0].run();
  assert.equal(enableCalls, 1);
  assert.equal(disableCalls, 1);
});

test('rapid-layer-tools command is safe without gfx scene', () => {
  const commands = [];
  const toolbarButtons = [];

  const api = {
    context: { systems: {} },
    t: key => key,
    registerCommand: command => commands.push(command),
    registerToolbarButton: button => toolbarButtons.push(button)
  };

  enable(api);

  assert.doesNotThrow(() => commands[0].run());
  assert.doesNotThrow(() => toolbarButtons[0].run());
});
