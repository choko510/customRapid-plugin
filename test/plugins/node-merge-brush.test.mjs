import test from 'node:test';
import assert from 'node:assert/strict';

import { __testing, enable } from '../../plugins/node-merge-brush/index.mjs';

const {
  areNodeTagsCompatible,
  buildMergeClusters,
  canMergeNodePair,
  normalizeSettings
} = __testing;

test('node-merge-brush registers command and toolbar button', () => {
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

  assert.equal(commands.length, 1);
  assert.equal(commands[0].id, 'toggle-node-merge-brush-mode');
  assert.equal(toolbarButtons.length, 1);
  assert.equal(toolbarButtons[0].id, 'toggle-node-merge-brush-mode');
});

test('node-merge-brush normalizes settings safely', () => {
  const settings = normalizeSettings({
    mergeDistancePx: 1000,
    minBrushRadiusPx: -1,
    maxCandidateNodes: 10.7,
    verticesOnly: false
  });

  assert.equal(settings.mergeDistancePx, 60);
  assert.equal(settings.minBrushRadiusPx, 2);
  assert.equal(settings.maxCandidateNodes, 50);
  assert.equal(settings.verticesOnly, false);
});

test('node-merge-brush tag compatibility blocks z-axis mismatch', () => {
  const nodeA = { tags: { layer: '1' }, hasInterestingTags: () => false };
  const nodeB = { tags: { layer: '2' }, hasInterestingTags: () => false };
  const nodeC = { tags: { layer: '1' }, hasInterestingTags: () => false };

  assert.equal(areNodeTagsCompatible(nodeA, nodeB), false);
  assert.equal(areNodeTagsCompatible(nodeA, nodeC), true);
});

test('node-merge-brush does not merge adjacent nodes in same way', () => {
  const nodeA = { id: 'n1', tags: {}, hasInterestingTags: () => false };
  const nodeB = { id: 'n2', tags: {}, hasInterestingTags: () => false };
  const sharedWay = { id: 'w1', areAdjacent: (a, b) => (a === 'n1' && b === 'n2') || (a === 'n2' && b === 'n1') };

  const graph = {
    parentWays: node => (node.id === 'n1' || node.id === 'n2') ? [sharedWay] : []
  };

  assert.equal(canMergeNodePair(nodeA, nodeB, graph), false);
});

test('node-merge-brush clusters close mergeable candidates', () => {
  const candidates = [
    { id: 'n1', screen: [10, 10], node: { id: 'n1' } },
    { id: 'n2', screen: [14, 12], node: { id: 'n2' } },
    { id: 'n3', screen: [90, 90], node: { id: 'n3' } }
  ];

  const clusters = buildMergeClusters(candidates, 8, () => true);
  assert.deepEqual(clusters, [['n1', 'n2']]);
});

test('node-merge-brush excludes non-mergeable pairs when clustering', () => {
  const candidates = [
    { id: 'n1', screen: [10, 10], node: { id: 'n1' } },
    { id: 'n2', screen: [13, 10], node: { id: 'n2' } },
    { id: 'n3', screen: [16, 10], node: { id: 'n3' } }
  ];

  const deniedPair = new Set(['n1:n2', 'n2:n1', 'n1:n3', 'n3:n1']);
  const canMergePair = (a, b) => !deniedPair.has(`${a.id}:${b.id}`);

  const clusters = buildMergeClusters(candidates, 7, canMergePair);
  assert.deepEqual(clusters, [['n2', 'n3']]);
});
