import test from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, fitTransform, closure } from '../layout.js';
import { runBars, criticalChain, tickStep, clock, dur } from '../timelineUtils.js';
import { tiles, distribution, trend, groupRows } from '../rundashUtils.js';
import { generateBatchDefinition, getRun10Data, getRun1Data } from '../cockpitData.js';

test('cockpit layout computes 40 levels with 309 jobs', () => {
  const def = generateBatchDefinition();
  assert.equal(def.job_count, 309);
  assert.equal(def.level_count, 40);

  const L = computeLayout(def.jobs);
  assert.ok(L.width > 0);
  assert.ok(L.height > 0);
  assert.equal(L.nodes.size, 309);
  assert.equal(L.rows.length, 40);

  const box = { w: 1000, h: 600 };
  const tf = fitTransform(L, box);
  assert.ok(tf.k > 0);
});

test('closure traces predecessors and successors for a job', () => {
  const jobs = [
    { name: 'A', predecessors: [], successors: ['B'] },
    { name: 'B', predecessors: ['A'], successors: ['C'] },
    { name: 'C', predecessors: ['B'], successors: [] },
  ];
  const idx = new Map(jobs.map((j) => [j.name, j]));
  const up = closure('C', idx, 'predecessors');
  assert.deepEqual([...up].sort(), ['A', 'B']);

  const down = closure('A', idx, 'successors');
  assert.deepEqual([...down].sort(), ['B', 'C']);
});

test('runBars generates Gantt bars and criticalChain resolves dependencies', () => {
  const run1 = getRun1Data();
  const bars = runBars(run1.jobs);
  assert.ok(bars.length >= 292);

  const def = generateBatchDefinition();
  const defIndex = new Map(def.jobs.map((j) => [j.name, j]));
  const chain = criticalChain(defIndex, run1.jobs);
  assert.ok(chain.names.length > 0);
  assert.ok(chain.busyMs >= 0);
});

test('rundashUtils calculates tiles and distribution matching Run #10', () => {
  const run10 = getRun10Data();
  const t = tiles(run10.counts, run10.status);
  assert.equal(t.find((x) => x.key === 'total').value, 309);
  assert.equal(t.find((x) => x.key === 'completed').value, 309);
  assert.equal(t.find((x) => x.key === 'failed').value, 0);

  const dist = distribution(run10.counts);
  assert.equal(dist.find((x) => x.label === 'Done').value, 309);

  const tr = trend(run10.jobs, run10);
  assert.ok(tr.buckets.length > 0);
});

test('groupRows partitions jobs into application groups', () => {
  const def = generateBatchDefinition();
  const groups = groupRows(def.jobs);
  assert.ok(groups.length >= 5);
  const names = groups.map((g) => g.name);
  assert.ok(names.includes('INTRADAY'));
  assert.ok(names.includes('PRE-EOD'));
  assert.ok(names.includes('MARKET-DATA'));
  assert.ok(names.includes('TRADE-FEEDS'));
  assert.ok(names.includes('EOD-CORE'));

  // Test dynamic calculation with real runs
  const run10 = getRun10Data();
  const g10 = groupRows(run10.jobs);
  const total10 = g10.reduce((sum, g) => sum + g.total, 0);
  assert.equal(total10, 309);
  g10.forEach((g) => {
    assert.equal(g.state, 'good');
    assert.equal(g.pct, 100);
    assert.equal(g.failed, 0);
    assert.equal(g.running, 0);
  });

  const run1 = getRun1Data();
  const g1 = groupRows(run1.jobs);
  const eodCore = g1.find((g) => g.group === 'EOD-CORE');
  assert.ok(eodCore);
  assert.equal(eodCore.state, 'hold');
  assert.equal(eodCore.on_hold, 1);
  assert.equal(eodCore.ok, 179);
});

test('time utilities format durations correctly', () => {
  assert.equal(dur(800), '<1s');
  assert.equal(dur(6000), '6s');
  assert.equal(clock(179000), '2:59');
  assert.equal(clock(248000), '4:08');
  assert.ok(tickStep(240000) > 0);
});
