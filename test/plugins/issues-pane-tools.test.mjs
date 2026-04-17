import test from 'node:test';
import assert from 'node:assert/strict';

import { enable } from '../../plugins/issues-pane-tools/index.mjs';

test('issues-pane-tools registers command and toggles issues pane', () => {
  const commands = [];
  let toggleCount = 0;

  const api = {
    context: {
      systems: {
        ui: {
          Overmap: {
            MapPanes: {
              Issues: {
                togglePane: () => {
                  toggleCount++;
                }
              }
            }
          }
        }
      }
    },
    t: key => key,
    registerCommand: command => commands.push(command)
  };

  enable(api);

  assert.equal(commands.length, 1);
  assert.equal(commands[0].id, 'open-issues-pane');

  commands[0].run();
  assert.equal(toggleCount, 1);
});

test('issues-pane-tools command is safe without issues pane', () => {
  const commands = [];

  const api = {
    context: { systems: {} },
    t: key => key,
    registerCommand: command => commands.push(command)
  };

  enable(api);

  assert.doesNotThrow(() => commands[0].run());
});
