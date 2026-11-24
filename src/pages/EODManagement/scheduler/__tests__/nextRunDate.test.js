import test from 'node:test';
import assert from 'node:assert/strict';
import { nextRunDate, runsOnWeekday } from '../scheduleSpec.js';

const NOW = new Date(2026, 10, 24, 12, 0); // Tue 24 Nov 2026, 12:00
const ymd = (d) => d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const base = { times: ['09:00'], start_date: '2026-11-01', end_date: '' };

test('monthly day 1 -> next 1st (Tue 1 Dec 2026)', () => {
  const spec = { ...base, frequency: 'monthly', day_of_month: 1, months: [] };
  assert.equal(ymd(nextRunDate(spec, NOW)), '2026-12-01');
  assert.equal(runsOnWeekday({ recurrence: spec }, 2), true);
  assert.equal(runsOnWeekday({ recurrence: spec }, 1), false);
});

test('monthly last day, and day 31 clamps to short months', () => {
  assert.equal(ymd(nextRunDate({ ...base, frequency: 'monthly', day_of_month: 'L', months: [] }, NOW)), '2026-11-30');
  assert.equal(ymd(nextRunDate({ ...base, frequency: 'monthly', day_of_month: 31, months: [2] }, NOW)), '2027-02-28');
});

test("today's run counts only while a time is still ahead", () => {
  const spec = { ...base, frequency: 'monthly', day_of_month: 24, months: [] };
  assert.equal(ymd(nextRunDate(spec, NOW)), '2026-12-24'); // 09:00 already passed
  assert.equal(ymd(nextRunDate({ ...spec, times: ['18:00'] }, NOW)), '2026-11-24');
});

test('quarterly honours quarters and position; yearly uses the start month', () => {
  const q = { ...base, frequency: 'quarterly', day_of_month: 'L', quarters: [1, 3], quarter_month: 'last' };
  assert.equal(ymd(nextRunDate(q, NOW)), '2027-03-31');
  const y = { ...base, frequency: 'yearly', day_of_month: 24, start_date: '2026-11-24', times: ['23:00'] };
  assert.equal(ymd(nextRunDate(y, NOW)), '2026-11-24');
});

test('start in the future, end in the past', () => {
  assert.equal(ymd(nextRunDate({ ...base, frequency: 'monthly', day_of_month: 5, months: [], start_date: '2027-03-01' }, NOW)), '2027-03-05');
  assert.equal(nextRunDate({ ...base, frequency: 'monthly', day_of_month: 5, months: [], end_date: '2026-11-30' }, NOW), null);
});
