import test from 'node:test';
import assert from 'node:assert/strict';

import { enable } from '../../plugins/command-palette-tools/index.mjs';

test('command-palette-tools registers command and toolbar action', () => {
  const commands = [];
  const toolbarButtons = [];
  let showCount = 0;

  const api = {
    context: {
      systems: {
        ui: {
          CommandPalette: {
            show: () => {
              showCount++;
            }
          }
        }
      }
    },
    t: key => key,
    registerCommand: command => commands.push(command),
    registerToolbarButton: button => toolbarButtons.push(button)
  };

  enable(api);

  assert.equal(commands.length, 1);
  assert.equal(toolbarButtons.length, 1);
  assert.equal(commands[0].id, 'open-command-palette');
  assert.equal(toolbarButtons[0].id, 'open-command-palette');

  commands[0].run();
  toolbarButtons[0].run();
  assert.equal(showCount, 2);
});

test('command-palette-tools command is safe without UI subsystem', () => {
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
