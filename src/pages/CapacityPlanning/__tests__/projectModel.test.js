import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectModel,
  filterProjectModel,
  buildGanttLayout,
  getZeroEffortReason,
} from '../projectModel.js';

const REF = new Date(2026, 9, 14); // 14-Oct-2026

// One employee per developer, assignments carry the CR-level fields.
function emp(id, name, assignments) {
  return { id, name, teamName: 'T', assignments };
}
function asg(o) {
  return {
    crId: null, summary: 'S', status: 'Open', startDate: '2026-10-14', endDate: '2026-12-31',
    effort: 10, project: '#1: P', isAssignedProgrammer: true, isUnmatchedDeveloper: false, ...o,
  };
}
const model = (consultants, extra = {}) =>
  buildProjectModel(consultants, { timeframe: 90, referenceDate: REF, ...extra });

test('1. one CR under a project', () => {
  const m = model([emp(1, 'A', [asg({ crId: 101 })])]);
  assert.equal(m.length, 1);
  assert.equal(m[0].crs.length, 1);
  assert.equal(m[0].crs[0].crId, 101);
});

test('2. multiple CRs keep their own summary, status and dates', () => {
  const m = model([emp(1, 'A', [
    asg({ crId: 101, summary: 'Core', startDate: '2026-01-01', endDate: '2026-03-31', status: 'Closed' }),
    asg({ crId: 205, summary: 'API', startDate: '2026-11-15', endDate: '2026-12-30', status: 'Open' }),
    asg({ crId: 310, summary: 'Support', startDate: '2027-01-01', endDate: '2027-06-30' }),
  ])]);
  assert.equal(m.length, 1);
  const byId = Object.fromEntries(m[0].crs.map(c => [c.crId, c]));
  assert.equal(byId[101].summary, 'Core');
  assert.equal(byId[205].startDate, '2026-11-15');
  assert.equal(byId[310].endDate, '2027-06-30');
  assert.equal(byId[101].status, 'Closed');
  // no project-level dates are invented
  assert.equal('startDate' in m[0], false);
  assert.equal('endDate' in m[0], false);
});

test('3. overlapping CRs get independent bars', () => {
  const m = model([emp(1, 'A', [
    asg({ crId: 1, startDate: '2026-11-01', endDate: '2026-12-31' }),
    asg({ crId: 2, startDate: '2026-11-15', endDate: '2027-01-31' }),
  ])]);
  const g = buildGanttLayout(filterProjectModel(m), REF);
  const [a, b] = g.projects[0].crs;
  assert.ok(a.bar && b.bar);
  assert.notEqual(a.bar.leftPct, b.bar.leftPct);
  assert.ok(b.bar.leftPct > a.bar.leftPct);
  assert.ok(a.bar.leftPct + a.bar.widthPct > b.bar.leftPct); // they overlap on the axis
});

test('4. missing / invalid dates are classified, not dropped', () => {
  const m = model([emp(1, 'A', [
    asg({ crId: 1, startDate: null }),
    asg({ crId: 2, endDate: null }),
    asg({ crId: 3, startDate: '2026-12-31', endDate: '2026-11-01' }),
    asg({ crId: 4 }),
  ])]);
  const st = Object.fromEntries(m[0].crs.map(c => [c.crId, c.scheduleState]));
  assert.deepEqual(st, { 1: 'unscheduled', 2: 'unscheduled', 3: 'invalid', 4: 'ok' });
  const g = buildGanttLayout(filterProjectModel(m), REF);
  assert.equal(g.projects[0].crs.length, 4);
  assert.equal(g.projects[0].crs.filter(c => c.bar).length, 1);
  // scheduled first, unscheduled last
  assert.equal(m[0].crs[0].crId, 4);
});

test('5. missing CR id / summary use a fallback key and stay separate', () => {
  const m = model([emp(1, 'A', [
    asg({ crId: null, summary: 'One' }),
    asg({ crId: null, summary: 'Two' }),
    asg({ crId: null, summary: null }),
  ])]);
  assert.equal(m[0].crs.length, 3);
  assert.ok(m[0].crs.every(c => c.crId === null));
});

test('6. several projects with different CR counts', () => {
  const m = model([
    emp(1, 'A', [asg({ project: '#1: A', crId: 1 }), asg({ project: '#1: A', crId: 2 }), asg({ project: '#2: B', crId: 3 })]),
  ]);
  const counts = Object.fromEntries(m.map(p => [p.project, p.crs.length]));
  assert.deepEqual(counts, { '#1: A': 2, '#2: B': 1 });
});

test('7. filtering by project and by CR id / summary / developer', () => {
  const m = model([
    emp(1, 'Alice', [asg({ project: '#1: Alpha', crId: 11, summary: 'Core' }), asg({ project: '#1: Alpha', crId: 12, summary: 'Reports' })]),
    emp(2, 'Bob', [asg({ project: '#2: Beta', crId: 21, summary: 'Core' })]),
  ]);
  // project match keeps ALL its CRs
  let r = filterProjectModel(m, { query: 'alpha' });
  assert.equal(r.length, 1);
  assert.equal(r[0].crs.length, 2);
  // CR id match keeps only that CR, with project context
  r = filterProjectModel(m, { query: '12' });
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].crs.map(c => c.crId), [12]);
  // summary matches across projects, only matching CRs
  r = filterProjectModel(m, { query: 'core' });
  assert.deepEqual(r.map(p => p.crs.length), [1, 1]);
  // developer match
  r = filterProjectModel(m, { query: 'bob' });
  assert.deepEqual(r.map(p => p.project), ['#2: Beta']);
  // CR predicate drops empty projects
  r = filterProjectModel(m, { crFilter: cr => cr.crId === 21 });
  assert.deepEqual(r.map(p => p.project), ['#2: Beta']);
});

test('8. CR ordering: by start date, unscheduled last', () => {
  const m = model([emp(1, 'A', [
    asg({ crId: 3, startDate: '2026-12-01' }),
    asg({ crId: 9, startDate: null }),
    asg({ crId: 1, startDate: '2026-11-01' }),
  ])]);
  assert.deepEqual(m[0].crs.map(c => c.crId), [1, 3, 9]);
});

test('9. gantt bar position/width come from the CR own dates', () => {
  const m = model([emp(1, 'A', [asg({ crId: 1, startDate: '2026-11-01', endDate: '2026-11-30' })])]);
  const g = buildGanttLayout(filterProjectModel(m), REF);
  const bar = g.projects[0].crs[0].bar;
  // axis = 1-Oct-2026 .. 30-Nov-2026 (today 14-Oct is inside; month bounds)
  const total = new Date(2026, 10, 30) - new Date(2026, 9, 1);
  const expLeft = ((new Date(2026, 10, 1) - new Date(2026, 9, 1)) / total) * 100;
  const expWidth = ((new Date(2026, 10, 30) - new Date(2026, 10, 1)) / total) * 100;
  assert.ok(Math.abs(bar.leftPct - expLeft) < 1e-9);
  assert.ok(Math.abs(bar.widthPct - expWidth) < 1e-9);
  assert.ok(g.todayPct > 0 && g.todayPct < bar.leftPct);
});

test('10. effort: sums per CR and per project, no double counting', () => {
  const m = model([
    emp(1, 'A', [asg({ crId: 1, effort: 6, isAssignedProgrammer: true }), asg({ crId: 2, effort: 4 })]),
    emp(2, 'B', [asg({ crId: 1, effort: 2, isAssignedProgrammer: false })]),
  ]);
  const cr1 = m[0].crs.find(c => c.crId === 1);
  const cr2 = m[0].crs.find(c => c.crId === 2);
  assert.equal(cr1.totalEffort, 8);
  assert.equal(cr2.totalEffort, 4);
  const [p] = filterProjectModel(m);
  assert.equal(p.totalEffort, 12);
  assert.equal(p.developerCount, 2); // A on two CRs counted once
  assert.ok(Math.abs(p.totalProratedEffort - (cr1.totalProratedEffort + cr2.totalProratedEffort)) < 1e-9);
});

test('10b. an exact duplicate developer row on a CR is not counted twice', () => {
  const dup = asg({ crId: 1, effort: 5 });
  const m = model([emp(1, 'A', [dup, { ...dup }])]);
  assert.equal(m[0].crs[0].developers.length, 1);
  assert.equal(m[0].crs[0].totalEffort, 5);
});

test('11. large dataset builds quickly', () => {
  const consultants = [];
  for (let e = 0; e < 200; e++) {
    const a = [];
    for (let p = 0; p < 50; p++) {
      for (let c = 0; c < 4; c++) {
        a.push(asg({ project: `#${p}: P${p}`, crId: p * 10 + c, startDate: '2026-11-01', endDate: '2027-02-01' }));
      }
    }
    consultants.push(emp(e, `E${e}`, a));
  }
  const t = Date.now();
  const m = model(consultants);
  const g = buildGanttLayout(filterProjectModel(m, { query: 'p4' }), REF);
  assert.equal(m.length, 50);
  assert.equal(m[0].crs.length, 4);
  assert.ok(g.projects.length > 0);
  assert.ok(Date.now() - t < 5000);
});

test('zero-effort reasons', () => {
  assert.equal(getZeroEffortReason(null, '2026-12-31', 0, REF, 30), "Planned Start Date Doesn't Exist");
  assert.equal(getZeroEffortReason('2026-01-01', '2026-02-01', 0, REF, 30), 'End Date Has Passed');
  assert.equal(getZeroEffortReason('2026-11-13', '2027-02-01', 0.02, REF, 30), 'Only a fraction of a day falls in this window');
  assert.equal(getZeroEffortReason('2027-03-01', '2027-04-01', 0, REF, 30), 'Project starts after the selected window');
  assert.equal(getZeroEffortReason('2026-10-14', '2026-12-31', 3, REF, 30), null);
  // never left unexplained
  assert.equal(getZeroEffortReason('2026-10-14', null, 0, REF, 30, 7), "Planned End Date Doesn't Exist");
  assert.equal(getZeroEffortReason('2026-12-31', '2026-11-01', 0, REF, 30, 7), 'End date is before the start date');
  assert.equal(getZeroEffortReason('2026-10-14', '2026-12-31', 0, REF, 30, 0), 'No effort is assigned');
  assert.equal(getZeroEffortReason('2026-10-14', '2026-12-31', 0, REF, 30, 7), 'No working days fall in this window (weekends or holidays only)');
});
