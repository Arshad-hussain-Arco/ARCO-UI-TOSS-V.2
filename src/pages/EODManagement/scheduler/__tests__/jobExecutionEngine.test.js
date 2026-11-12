import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePrerequisites,
  buildExecutionPlan,
  isJobSuccess,
} from '../components/jobExecutionEngine.js';

test('resolvePrerequisites: correctly resolves all upstream dependencies in a linear chain', () => {
  const predsMap = new Map([
    ['Job A', []],
    ['Job B', ['Job A']],
    ['Job C', ['Job B']],
    ['Job D', ['Job C']],
    ['Job E', ['Job D']],
  ]);

  const prereqsC = resolvePrerequisites('Job C', predsMap);
  assert.deepEqual(Array.from(prereqsC).sort(), ['Job A', 'Job B']);

  const prereqsE = resolvePrerequisites('Job E', predsMap);
  assert.deepEqual(Array.from(prereqsE).sort(), ['Job A', 'Job B', 'Job C', 'Job D']);

  const prereqsA = resolvePrerequisites('Job A', predsMap);
  assert.deepEqual(Array.from(prereqsA), []);
});

test('resolvePrerequisites: resolves multi-parent branching dependencies', () => {
  const predsMap = new Map([
    ['Job A', []],
    ['Job B1', ['Job A']],
    ['Job B2', ['Job A']],
    ['Job C', ['Job B1', 'Job B2']],
  ]);

  const prereqsC = resolvePrerequisites('Job C', predsMap);
  assert.deepEqual(Array.from(prereqsC).sort(), ['Job A', 'Job B1', 'Job B2']);
});

test('buildExecutionPlan: linear chain execution waves', () => {
  const predsMap = new Map([
    ['Job A', []],
    ['Job B', ['Job A']],
    ['Job C', ['Job B']],
    ['Job D', ['Job C']],
    ['Job E', ['Job D']],
  ]);

  // Clicking Play on Job C executes Job A -> Job B -> Job C
  const planC = buildExecutionPlan('Job C', predsMap);
  assert.deepEqual(planC.waves, [['Job A'], ['Job B'], ['Job C']]);
  assert.deepEqual(planC.toRun.sort(), ['Job A', 'Job B', 'Job C']);

  // Clicking Play on Job E executes Job A -> Job B -> Job C -> Job D -> Job E
  const planE = buildExecutionPlan('Job E', predsMap);
  assert.deepEqual(planE.waves, [['Job A'], ['Job B'], ['Job C'], ['Job D'], ['Job E']]);

  // Clicking Play on Job A executes only Job A
  const planA = buildExecutionPlan('Job A', predsMap);
  assert.deepEqual(planA.waves, [['Job A']]);
});

test('buildExecutionPlan: skips already successfully completed dependencies', () => {
  const predsMap = new Map([
    ['Job A', []],
    ['Job B', ['Job A']],
    ['Job C', ['Job B']],
  ]);

  const currentStates = {
    'Job A': { tone: 'good', label: 'Success' },
  };

  const plan = buildExecutionPlan('Job C', predsMap, currentStates);
  assert.deepEqual(plan.alreadySatisfied, ['Job A']);
  assert.deepEqual(plan.waves, [['Job B'], ['Job C']]);
});

test('buildExecutionPlan: supports branching and parallel execution', () => {
  const predsMap = new Map([
    ['Job A', []],
    ['Job B1', ['Job A']],
    ['Job B2', ['Job A']],
    ['Job C', ['Job B1', 'Job B2']],
  ]);

  const plan = buildExecutionPlan('Job C', predsMap);
  assert.deepEqual(plan.waves[0], ['Job A']);
  // Job B1 and Job B2 can execute concurrently in parallel wave 1
  assert.deepEqual(plan.waves[1].sort(), ['Job B1', 'Job B2']);
  assert.deepEqual(plan.waves[2], ['Job C']);
});

test('isJobSuccess: correctly identifies success states', () => {
  assert.equal(isJobSuccess('A', { A: { tone: 'good' } }), true);
  assert.equal(isJobSuccess('A', { A: { label: 'Success' } }), true);
  assert.equal(isJobSuccess('A', { A: { label: 'Done' } }), true);
  assert.equal(isJobSuccess('A', { A: { tone: 'bad', label: 'Failed' } }), false);
  assert.equal(isJobSuccess('A', { A: { tone: 'wait', label: 'Pending' } }), false);
  assert.equal(isJobSuccess('A', {}), false);
});

