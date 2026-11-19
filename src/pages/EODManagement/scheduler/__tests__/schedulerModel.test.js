import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NODE_HEIGHT,
  NODE_WIDTH,
  approvalState,
  edgeStyle,
  filterJobs,
  formatDuration,
  formatRunOptionTime,
  graphBounds,
  groupMessages,
  isEnvironmentCode,
  isFingerprint,
  isHHMM,
  jobTone,
  layeredLayout,
  nodeStates,
  parseVariables,
  runTone,
  secondsBetween,
  settingsChanges,
  targetLabel,
} from '../schedulerModel.js';

const nodes = (...ids) => ids.map((id) => ({ id, name: id, enabled: true }));
const edge = (source, target, extra = {}) => ({
  id: `${source}>${target}`,
  source,
  target,
  kind: 'CONDITION',
  branch: 'SUCCESS',
  ...extra,
});

test('layout puts every job one column right of its latest prerequisite', () => {
  const pos = layeredLayout(nodes('A', 'B', 'C', 'D'), [
    edge('A', 'B'),
    edge('B', 'C'),
    edge('A', 'C'),
    edge('A', 'D'),
  ]);
  assert.equal(pos.A.x, 0);
  assert.equal(pos.B.x, NODE_WIDTH + 80);
  assert.equal(pos.C.x, 2 * (NODE_WIDTH + 80));
  assert.equal(pos.D.x, pos.B.x);
  assert.notEqual(pos.B.y, pos.D.y, 'two jobs in one column never overlap');
});

test('layout is deterministic and keeps definition order for unrelated jobs', () => {
  const a = layeredLayout(nodes('X', 'Y', 'Z'), []);
  assert.deepEqual(a, layeredLayout(nodes('X', 'Y', 'Z'), []));
  assert.deepEqual([a.X.y, a.Y.y, a.Z.y], [0, NODE_HEIGHT + 30, 2 * (NODE_HEIGHT + 30)]);
});

test('layout survives cycles, self loops and edges to unknown jobs', () => {
  const pos = layeredLayout(nodes('A', 'B'), [
    edge('A', 'B'),
    edge('B', 'A'),
    edge('A', 'A'),
    edge('A', 'GHOST'),
  ]);
  assert.deepEqual(Object.keys(pos).sort(), ['A', 'B']);
  for (const p of Object.values(pos)) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
});

test('layout handles a few hundred jobs quickly', () => {
  const ids = Array.from({ length: 600 }, (_, i) => `J${i}`);
  const edges = ids.slice(1).map((id, i) => edge(ids[Math.floor(i / 3)], id));
  const t0 = Date.now();
  const pos = layeredLayout(nodes(...ids), edges);
  assert.equal(Object.keys(pos).length, 600);
  assert.ok(Date.now() - t0 < 2000, 'layout of 600 jobs must be fast');
});

test('graph bounds cover the drawing and an empty graph has none', () => {
  assert.deepEqual(graphBounds({}), { width: 0, height: 0 });
  assert.deepEqual(graphBounds({ A: { x: 0, y: 0 }, B: { x: 270, y: 84 } }), {
    width: 270 + NODE_WIDTH,
    height: 84 + NODE_HEIGHT,
  });
});

test('edges are encoded by meaning', () => {
  assert.deepEqual(edgeStyle({ kind: 'CONDITION', branch: 'SUCCESS' }), {
    tone: 'info',
    dashed: true,
  });
  assert.deepEqual(edgeStyle({ kind: 'CONDITION', branch: 'FAILURE' }), {
    tone: 'danger',
    dashed: true,
  });
  assert.deepEqual(edgeStyle({ kind: 'DEPENDENCY', branch: 'SUCCESS' }), {
    tone: 'muted',
    dashed: false,
  });
});

test('status tones', () => {
  assert.equal(jobTone('SUCCESS'), 'good');
  assert.equal(jobTone('TIMED_OUT'), 'bad');
  assert.equal(jobTone('SKIPPED'), 'off');
  assert.equal(jobTone('whatever'), 'idle');
  assert.equal(runTone('RECOVERED'), 'good');
  assert.equal(runTone('INTERRUPTED'), 'bad');
  assert.equal(runTone('RUNNING'), 'run');
});

test('node states come from a run detail and are empty without one', () => {
  assert.deepEqual(nodeStates(null), {});
  assert.deepEqual(
    nodeStates({
      jobs: [
        { job: 'A', status: 'SUCCESS' },
        { job: 'B', status: 'FAILED' },
      ],
    }),
    {
      A: { label: 'success', tone: 'good' },
      B: { label: 'failed', tone: 'bad' },
    },
  );
});

test('durations', () => {
  assert.equal(formatDuration(null), '—');
  assert.equal(formatDuration(42), '42s');
  assert.equal(formatDuration(125), '2m 05s');
  assert.equal(formatDuration(3725), '1h 02m');
  assert.equal(formatDuration(-5), '0s');
  assert.equal(secondsBetween('2026-01-01 10:00:00.000', '2026-01-01 10:01:30.500'), 90.5);
  assert.equal(secondsBetween(null, '2026-01-01 10:00:00'), null);
  assert.equal(secondsBetween('nonsense', 'nonsense'), null);
});

test('formatRunOptionTime handles today, previous days, and invalid inputs', () => {
  assert.equal(formatRunOptionTime(null), '—');
  assert.equal(formatRunOptionTime(''), '—');
  const now = new Date();
  const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 55, 17).toISOString();
  const timeStr = formatRunOptionTime(todayIso);
  assert.ok(timeStr.includes(':'), 'today displays clock time');

  const pastIso = '2025-11-18T16:52:30+03:00';
  const pastStr = formatRunOptionTime(pastIso);
  assert.ok(pastStr.includes('Nov 18') || pastStr.includes('·'), 'past date displays month and day');
});

test('the same problem on many jobs is shown once, with a count and a few examples', () => {
  const msgs = [];
  for (let i = 0; i < 17; i += 1) msgs.push(`Murex/JOB${i}: INCOND 'X-OK' is never created`);
  msgs.push('Murex/ODD: cannot be dispatched (UNMAPPED_NODEID): not mapped');
  msgs.push('FOLDER Murex: circular dependency: A -> B -> A');
  const groups = groupMessages(msgs);
  assert.equal(groups[0].count, 17);
  assert.equal(groups[0].text, "INCOND 'X-OK' is never created");
  assert.equal(groups[0].where.length, 5);
  assert.equal(groups.length, 3);
  assert.equal(
    groups.find((g) => g.text.startsWith('FOLDER Murex')).count,
    1,
    'a message without folder/job stays whole',
  );
});

test('grouping tolerates empty and odd input', () => {
  assert.deepEqual(groupMessages(undefined), []);
  assert.deepEqual(groupMessages([]), []);
  assert.equal(groupMessages([42, null])[0].count, 1);
});

const can =
  (...codes) =>
  (c) =>
    codes.includes(c);

test('approval bar states', () => {
  assert.equal(approvalState(null, can()).state, 'none');
  assert.equal(approvalState({ loaded: false }, can()).state, 'none');
  const blocked = approvalState(
    { loaded: true, errors: ['x'], approved: false },
    can('EOD_SCHEDULER_APPROVE'),
  );
  assert.deepEqual([blocked.state, blocked.canApprove, blocked.canRun], ['blocked', false, false]);
  const pending = approvalState(
    { loaded: true, errors: [], approved: false },
    can('EOD_SCHEDULER_APPROVE'),
  );
  assert.deepEqual([pending.state, pending.canApprove, pending.canRun], ['pending', true, false]);
  assert.equal(
    approvalState({ loaded: true, errors: [], approved: false }, can()).canApprove,
    false,
    'no permission, no button',
  );
  const ok = approvalState(
    { loaded: true, errors: [], approved: true },
    can('EOD_SCHEDULER_EXECUTE'),
  );
  assert.deepEqual([ok.state, ok.canApprove, ok.canRun], ['approved', false, true]);
  assert.equal(approvalState({ loaded: true, errors: [], approved: true }, can()).canRun, false);
});

test('target labels say where a job would run, or why it cannot', () => {
  assert.equal(targetLabel(null), '—');
  assert.equal(
    targetLabel({ ok: true, username: 'eod', host: '10.0.0.5', port: 22 }),
    'eod@10.0.0.5:22',
  );
  assert.equal(
    targetLabel({ ok: false, code: 'UNMAPPED_NODEID' }),
    'Not runnable (UNMAPPED_NODEID)',
  );
});

test('validators mirror the backend', () => {
  assert.ok(isHHMM('09:30') && isHHMM('23:59') && isHHMM('00:00'));
  assert.ok(!isHHMM('24:00') && !isHHMM('9:30') && !isHHMM('09:60') && !isHHMM(''));
  assert.ok(isFingerprint(`SHA256:${'A'.repeat(43)}`));
  assert.ok(
    !isFingerprint('SHA256:short') && !isFingerprint(`MD5:${'A'.repeat(43)}`) && !isFingerprint(''),
  );
  assert.ok(isEnvironmentCode('UAT') && isEnvironmentCode('sit-2') && isEnvironmentCode('a'));
  assert.ok(
    !isEnvironmentCode('') &&
      !isEnvironmentCode('../x') &&
      !isEnvironmentCode('a b') &&
      !isEnvironmentCode('x'.repeat(51)) &&
      !isEnvironmentCode('-a'),
  );
});

test('only changed settings are sent', () => {
  const original = {
    max_parallel: 8,
    timezone: '',
    variables: { A: '1' },
    ssh_execution_enabled: false,
  };
  const draft = {
    max_parallel: 8,
    timezone: 'Asia/Riyadh',
    variables: { A: '1' },
    ssh_execution_enabled: true,
  };
  assert.deepEqual(
    settingsChanges(original, draft, [
      'max_parallel',
      'timezone',
      'variables',
      'ssh_execution_enabled',
    ]),
    {
      timezone: 'Asia/Riyadh',
      ssh_execution_enabled: true,
    },
  );
  assert.deepEqual(settingsChanges(original, original, ['max_parallel']), {});
});

test('the variables box accepts a JSON object of text and explains anything else', () => {
  assert.deepEqual(parseVariables(''), { value: {} });
  assert.deepEqual(parseVariables('{"A": "1"}'), { value: { A: '1' } });
  assert.ok(parseVariables('[1]').error);
  assert.ok(parseVariables('{"A": 1}').error);
  assert.ok(parseVariables('{bad').error);
  assert.ok(parseVariables('null').error);
});

test('the job filter searches name, command, target and schedule', () => {
  const jobs = [
    {
      name: 'LOAD_RATES',
      command: '/opt/x/load.sh',
      schedule: '18:00',
      target: { ok: true, username: 'eod', host: 'app01', port: 22 },
    },
    {
      name: 'REPORT',
      command: '/opt/x/report.sh',
      schedule: 'no planned time',
      target: { ok: false, code: 'UNMAPPED_NODEID' },
    },
  ];
  assert.equal(filterJobs(jobs, '').length, 2);
  assert.deepEqual(
    filterJobs(jobs, 'load').map((j) => j.name),
    ['LOAD_RATES'],
  );
  assert.deepEqual(
    filterJobs(jobs, 'APP01').map((j) => j.name),
    ['LOAD_RATES'],
  );
  assert.deepEqual(
    filterJobs(jobs, 'unmapped').map((j) => j.name),
    ['REPORT'],
  );
  assert.deepEqual(
    filterJobs(jobs, '18:00').map((j) => j.name),
    ['LOAD_RATES'],
  );
  assert.equal(filterJobs(jobs, 'zzz').length, 0);
});

test('the engine notice says what is wrong, and stays quiet when all is well', async () => {
  const { engineNotice } = await import('../schedulerModel.js');
  assert.equal(engineNotice(null), null);
  assert.equal(
    engineNotice({ enabled: false, engine: null }),
    null,
    'a disabled environment needs no engine',
  );
  assert.equal(engineNotice({ enabled: true, engine: null }).tone, 'warn');
  assert.match(engineNotice({ enabled: true, engine: null }).text, /run_eod_engine/);
  const refusing = engineNotice({ enabled: true, engine: { mode: 'refusing' } });
  assert.equal(refusing.tone, 'bad');
  assert.match(refusing.text, /EOD_SCHEDULER_EXECUTION_MODE/);
  const broker = engineNotice({
    enabled: true,
    engine: { mode: 'queue', publish_error: 'ConnectionError: refused' },
  });
  assert.equal(broker.tone, 'bad');
  assert.match(broker.text, /ConnectionError: refused/);
  assert.equal(
    engineNotice({ enabled: true, engine: { mode: 'inline', publish_error: null } }).tone,
    'info',
  );
  assert.equal(
    engineNotice({ enabled: true, engine: { mode: 'queue', publish_error: null } }),
    null,
  );
  assert.equal(
    engineNotice({ enabled: true, engine: { mode: 'custom', publish_error: null } }),
    null,
  );
  assert.equal(
    engineNotice({ enabled: true, engine: { mode: 'refusing', publish_error: 'x' } }).tone,
    'bad',
  );
});

import { mergeFolderGraphs, graphFromJobs, cockpitNodeStates } from '../schedulerModel.js';

test('mergeFolderGraphs: every job once, every edge once, conditions connect workflows', () => {
  const folders = [
    {
      folder: 'A',
      jobs: [
        { name: 'A1', produces: ['a-ok'] },
        { name: 'A2', waits_for: ['a-ok'] },
      ],
      graph: { edges: [{ id: 'A1->A2', source: 'A1', target: 'A2' }] },
    },
    { folder: 'B', jobs: [{ name: 'B1', waits_for: ['a-ok'] }], graph: { edges: [] } },
  ];
  const g = mergeFolderGraphs(folders);
  assert.deepEqual(
    g.nodes.map((n) => n.id),
    ['A1', 'A2', 'B1'],
  );
  assert.equal(g.nodes.find((n) => n.id === 'B1').folder, 'B');
  const ids = g.edges.map((e) => e.id);
  assert.deepEqual(ids, ['A1->A2', 'cond:A1>A2:a-ok', 'cond:A1>B1:a-ok']);
  assert.deepEqual(mergeFolderGraphs([]), { nodes: [], edges: [] });
});

test('graphFromJobs builds edges from predecessors and ignores unknown ones', () => {
  const g = graphFromJobs([
    { name: 'X', folder: 'F' },
    { name: 'Y', predecessors: ['X', 'GHOST'] },
  ]);
  assert.deepEqual(
    g.nodes.map((n) => n.id),
    ['X', 'Y'],
  );
  assert.deepEqual(
    g.edges.map((e) => `${e.source}>${e.target}`),
    ['X>Y'],
  );
});

test('cockpitNodeStates maps the cockpit statuses to graph tones', () => {
  const s = cockpitNodeStates([
    { name: 'a', status: 'Done' },
    { name: 'b', status: 'Running' },
    { name: 'c', status: 'Failed' },
    { name: 'd', status: 'On hold' },
    { name: 'e', status: 'Waiting' },
    { name: 'f', status: 'Skipped' },
    { name: 'g', status: 'Idle' },
  ]);
  assert.deepEqual(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.tone])), {
    a: 'good',
    b: 'run',
    c: 'bad',
    d: 'wait',
    e: 'wait',
    f: 'off',
  });
  assert.equal(s.g, undefined, 'an idle job has no colour');
});

test('node labels use the words of the Play feature: Pending, Running, Success, Failed, Skipped', () => {
  const s = cockpitNodeStates([
    { name: 'a', status: 'Waiting' },
    { name: 'b', status: 'Queued' },
    { name: 'c', status: 'Running' },
    { name: 'd', status: 'Done' },
    { name: 'e', status: 'Failed' },
    { name: 'f', status: 'Skipped' },
  ]);
  assert.deepEqual(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.label])), {
    a: 'Pending',
    b: 'Pending',
    c: 'Running',
    d: 'Success',
    e: 'Failed',
    f: 'Skipped',
  });
});
