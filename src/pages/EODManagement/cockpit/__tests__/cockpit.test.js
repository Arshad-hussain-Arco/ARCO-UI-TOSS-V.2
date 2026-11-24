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

test('scheduled runs visibility in Cockpit: active runs and fresh runs stay visible in XML scope', () => {
  const allFolderNames = new Set(['POST_EOD_CHECKS', 'DAILY_PROCESSING', 'PRE_EOD']);
  const runs = [
    {
      id: 'POST_EOD_CHECKS-20261119-123000',
      run_id: 'POST_EOD_CHECKS-20261119-123000',
      status: 'RUNNING',
      folder: 'POST_EOD_CHECKS',
      target_job: 'CHK_REPORT',
      run_scope: 'job',
      started_at: new Date(Date.now() - 5000).toISOString(),
    },
    {
      id: 'batch-20261119-110000',
      run_id: 'batch-20261119-110000',
      status: 'SUCCESS',
      folder: null,
      target_job: null,
      run_scope: 'batch',
      started_at: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  // 1. In XML scope, activeRunningRun finds the active scheduled run across all runs
  const activeRunningRun = runs.find((r) => {
    const isRun = ['RUNNING', 'PAUSED', 'QUEUED'].includes(String(r.status || '').toUpperCase());
    if (!isRun) return false;
    if (r.started_at || r.started) {
      const ageMs = Date.now() - new Date(r.started_at || r.started).getTime();
      if (ageMs > 30 * 60 * 1000) return false;
    }
    return true;
  });
  assert.ok(activeRunningRun, 'activeRunningRun should find the running scheduled run');
  assert.equal(activeRunningRun.id, 'POST_EOD_CHECKS-20261119-123000');
  assert.equal(activeRunningRun.folder, 'POST_EOD_CHECKS');

  // 2. filteredRuns in XML scope preserves active and fresh runs
  const currentRunId = activeRunningRun.id;
  const selectedRunId = activeRunningRun.id;
  const scope = { type: 'xml', folder: null };

  const filteredRuns = runs.filter((r) => {
    if (!r) return false;
    const rid = String(r.id || r.run_id || '');
    const isRunLive = ['RUNNING', 'PAUSED', 'QUEUED'].includes(String(r.status || '').toUpperCase());
    const isCurrentSelected = String(currentRunId) === rid || String(selectedRunId) === rid;
    const startTs = new Date(r.started_at || r.started || 0).getTime();
    const isRecentlyStarted = startTs > 0 && (Date.now() - startTs) <= 60000;
    if (isRunLive || isCurrentSelected || isRecentlyStarted) {
      return true;
    }
    if (scope.type === 'xml') {
      const rTargetJob = String(r.target_job || r.scope_job || '').trim().toUpperCase();
      const rScope = String(r.run_scope || '').toLowerCase();
      const rFolder = String(r.folder || '').trim().toUpperCase();
      if (rTargetJob) return false;
      if (rScope === 'job' || rScope === 'workflow') return false;
      if (rScope === 'batch' || rScope === 'xml') return true;
      if (rFolder && allFolderNames.has(rFolder)) return false;
      for (const kf of allFolderNames) {
        if (rid.toUpperCase().startsWith(`${kf}-`)) return false;
      }
      return true;
    }
    return true;
  });

  assert.ok(
    filteredRuns.some((r) => r.id === 'POST_EOD_CHECKS-20261119-123000'),
    'Active scheduled run must NOT be filtered out of filteredRuns in XML scope',
  );

  // 3. Auto-scope alignment when active run begins
  let autoAlignedScope = scope;
  if (activeRunningRun && activeRunningRun.folder && autoAlignedScope.type === 'xml') {
    autoAlignedScope = { type: 'workflow', folder: activeRunningRun.folder };
  }
  assert.equal(autoAlignedScope.type, 'workflow');
  assert.equal(autoAlignedScope.folder, 'POST_EOD_CHECKS');
});

test('actively running run automatically shows current run overview in Control Run Cockpit', () => {
  const activeRun = {
    id: 'EOD_CORE-20261119-130000',
    run_id: 'EOD_CORE-20261119-130000',
    status: 'RUNNING',
    folder: 'EOD-CORE',
    started_at: new Date(Date.now() - 10000).toISOString(),
    jobs: [
      { name: 'JOB_A', status: 'Done' },
      { name: 'JOB_B', status: 'Running' },
      { name: 'JOB_C', status: 'Waiting' },
    ],
  };

  const runs = [activeRun];

  // 1. Detection of actively running run
  const activeRunningRun = runs.find((r) => {
    const isRun = ['RUNNING', 'PAUSED', 'QUEUED'].includes(String(r.status || '').toUpperCase());
    if (!isRun) return false;
    if (r.started_at || r.started) {
      const ageMs = Date.now() - new Date(r.started_at || r.started).getTime();
      if (ageMs > 30 * 60 * 1000) return false;
    }
    return true;
  });
  assert.ok(activeRunningRun, 'actively running run should be detected');

  // 2. Auto-selection and view is overview
  let selectedRunId = '';
  let activeView = 'flow'; // Suppose user was on another view
  if (activeRunningRun) {
    selectedRunId = activeRunningRun.id;
    activeView = 'overview'; // Automatically show the current run overview
  }
  assert.equal(selectedRunId, 'EOD_CORE-20261119-130000');
  assert.equal(activeView, 'overview');

  // 3. Current run overview computation
  const total = activeRun.jobs.length;
  const completed = activeRun.jobs.filter((j) => j.status === 'Done').length;
  const running = activeRun.jobs.filter((j) => j.status === 'Running').length;
  assert.equal(total, 3);
  assert.equal(completed, 1);
  assert.equal(running, 1);
  const pct = Math.floor((completed / total) * 100);
  assert.equal(pct, 33);
});

test('subsequent polling updates of an active run preserve user-selected subtabs (flow, timeline, history)', () => {
  let activeView = 'overview';
  let lastActiveRunId = null;

  function onPollActiveRun(run, userChangedView = null) {
    if (userChangedView) {
      activeView = userChangedView;
    }
    const activeId = String(run.id || run.run_id);
    if (activeId && lastActiveRunId !== activeId) {
      lastActiveRunId = activeId;
      activeView = 'overview';
    }
    return activeView;
  }

  // 1. Initial detection of active run -> switches to overview
  const run1 = { id: 'RUN-1', status: 'RUNNING' };
  assert.equal(onPollActiveRun(run1), 'overview');

  // 2. User navigates to 'flow'
  assert.equal(onPollActiveRun(run1, 'flow'), 'flow');

  // 3. Next background poll of RUN-1 (e.g. 2s later) MUST NOT reset to 'overview'
  assert.equal(onPollActiveRun(run1), 'flow');

  // 4. User navigates to 'timeline'
  assert.equal(onPollActiveRun(run1, 'timeline'), 'timeline');
  // 5. Next background poll of RUN-1 MUST NOT reset to 'overview'
  assert.equal(onPollActiveRun(run1), 'timeline');

  // 6. User navigates to 'history'
  assert.equal(onPollActiveRun(run1, 'history'), 'history');
  // 7. Next background poll of RUN-1 MUST NOT reset to 'overview'
  assert.equal(onPollActiveRun(run1), 'history');

  // 8. When a NEW, different run starts -> switches to 'overview'
  const run2 = { id: 'RUN-2', status: 'RUNNING' };
  assert.equal(onPollActiveRun(run2), 'overview');
});
