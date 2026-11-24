import test from 'node:test';
import assert from 'node:assert/strict';
import {
  quarterMonthNames,
  defaultForm,
  formToSpec,
  specToForm,
  validateForm,
  runsOnWeekday,
  sortedTimes,
  clientTimezone,
  EOD_PROFILES,
  getScheduleProfile,
  IDLE_POLL_MS,
  FAST_POLL_MS,
  findFreshRun,
  isNearScheduledFire,
  getSmartPollInterval,
} from '../scheduleSpec.js';

const TODAY = new Date(2026, 2, 1);

test('times are de-duplicated, validated and sorted (several runs a day)', () => {
  assert.deepEqual(sortedTimes(['14:00', '09:00', '14:00', '25:00', 'x']), ['09:00', '14:00']);
});

test('every kind maps to the API recurrence', () => {
  const f = { ...defaultForm(TODAY), times: ['22:00', '06:00'] };
  assert.deepEqual(formToSpec({ ...f, kind: 'daily' }), {
    times: ['06:00', '22:00'],
    start_date: '2026-03-01',
    end_date: '',
    timezone: clientTimezone(),
    frequency: 'daily',
    every: 1,
  });
  assert.equal(formToSpec({ ...f, kind: 'every-days', every: 3 }).every, 3);
  assert.deepEqual(formToSpec({ ...f, kind: 'weekly', daysOfWeek: [3, 1] }).days_of_week, [1, 3]);
  assert.equal(formToSpec({ ...f, kind: 'monthly', dayOfMonth: 'L' }).day_of_month, 'L');
  assert.equal(formToSpec({ ...f, kind: 'quarterly', dayOfMonth: '15' }).day_of_month, 15);
  assert.equal(formToSpec({ ...f, kind: 'yearly' }).frequency, 'yearly');
  assert.deepEqual(
    (({ frequency, every, unit }) => ({ frequency, every, unit }))(
      formToSpec({ ...f, kind: 'every-hours', every: 4 }),
    ),
    { frequency: 'interval', every: 4, unit: 'hours' },
  );
  assert.equal(
    formToSpec({ ...f, kind: 'once', endDate: '2027-01-01' }).end_date,
    '',
    'a one-time schedule has no end date',
  );
});

test('a stored recurrence round-trips through the form', () => {
  for (const kind of [
    'daily',
    'every-days',
    'weekly',
    'monthly',
    'quarterly',
    'yearly',
    'every-hours',
    'every-minutes',
    'once',
  ]) {
    const form = {
      ...defaultForm(TODAY),
      kind,
      times: ['22:00'],
      every: 2,
      daysOfWeek: [0, 6],
      dayOfMonth: 'L',
    };
    const spec = formToSpec(form);
    assert.deepEqual(formToSpec(specToForm(spec, TODAY)), spec, kind);
  }
});

test('quick validation', () => {
  const f = { ...defaultForm(TODAY), times: ['22:00'] };
  assert.deepEqual(validateForm(f, TODAY), {});
  assert.deepEqual(defaultForm(TODAY).times, [], 'a new schedule has no time pre-chosen');
  assert.ok(validateForm(defaultForm(TODAY), TODAY).times, 'and needs one before it can be saved');
  assert.ok(validateForm({ ...f, times: [] }, TODAY).times);
  assert.ok(validateForm({ ...f, kind: 'weekly', daysOfWeek: [] }, TODAY).daysOfWeek);
  assert.ok(validateForm({ ...f, kind: 'every-hours', every: 0 }, TODAY).every);
  assert.ok(validateForm({ ...f, kind: 'once', startDate: '' }, TODAY).startDate);
  assert.ok(validateForm({ ...f, endDate: '2026-01-01' }, TODAY).endDate);
});

test('day tabs: daily and interval every day, weekly its days, once its date', () => {
  assert.equal(runsOnWeekday({ recurrence: { frequency: 'daily' } }, 4), true);
  assert.equal(runsOnWeekday({ recurrence: { frequency: 'weekly', days_of_week: [1] } }, 1), true);
  assert.equal(runsOnWeekday({ recurrence: { frequency: 'weekly', days_of_week: [1] } }, 2), false);
  assert.equal(
    runsOnWeekday({ recurrence: { frequency: 'once', start_date: '2026-03-01' } }, 0),
    true,
  );
});

test('quarterly carries the chosen quarters and the month of each quarter', () => {
  const f = {
    ...defaultForm(TODAY),
    kind: 'quarterly',
    quarters: [3, 1],
    quarterMonth: 'last',
    dayOfMonth: 'L',
  };
  const spec = formToSpec(f);
  assert.deepEqual(
    [spec.frequency, spec.quarters, spec.quarter_month, spec.day_of_month],
    ['quarterly', [1, 3], 'last', 'L'],
  );
  const back = specToForm(spec, TODAY);
  assert.deepEqual([back.kind, back.quarters, back.quarterMonth], ['quarterly', [1, 3], 'last']);
  assert.deepEqual(formToSpec(back), spec);
  assert.ok(validateForm({ ...f, quarters: [] }, TODAY).quarters, 'at least one quarter');
  assert.deepEqual(quarterMonthNames([1, 2, 3, 4], 'first'), ['Jan', 'Apr', 'Jul', 'Oct']);
  assert.deepEqual(quarterMonthNames([1, 3], 'last'), ['Mar', 'Sep']);
  assert.deepEqual(quarterMonthNames([2, 4], 'mid'), ['May', 'Nov']);
});

test('EOD profiles map directly to real schedule recurrences', () => {
  assert.equal(EOD_PROFILES.length, 7);
  assert.equal(getScheduleProfile({ recurrence: { frequency: 'daily', every: 1 } }), 'daily');
  assert.equal(getScheduleProfile({ recurrence: { frequency: 'daily', every: 3 } }), 'custom');
  assert.equal(getScheduleProfile({ recurrence: { frequency: 'weekly' } }), 'weekly');
  assert.equal(getScheduleProfile({ recurrence: { frequency: 'monthly' } }), 'monthly');
  assert.equal(getScheduleProfile({ recurrence: { frequency: 'quarterly' } }), 'quarterly');
  assert.equal(getScheduleProfile({ recurrence: { frequency: 'yearly' } }), 'yearly');
  assert.equal(getScheduleProfile({ recurrence: { frequency: 'once' } }), 'once');
  assert.equal(getScheduleProfile({ recurrence: { frequency: 'interval' } }), 'custom');
  assert.equal(getScheduleProfile({ eod_profile: 'monthly', recurrence: { frequency: 'daily' } }), 'monthly');
});

test('past once date, past end date, and narrow date-range weekday filtering', () => {
  const f = { ...defaultForm(TODAY), times: ['22:00'] };
  // Once with past date AND time is now caught in frontend validation
  assert.ok(validateForm({ ...f, kind: 'once', startDate: '2026-02-20' }, TODAY).startDate);
  // Empty startDate + past endDate is caught in frontend validation
  assert.ok(validateForm({ ...f, kind: 'daily', startDate: '', endDate: '2026-02-20' }, TODAY).endDate);
  // Daily restricted to 2026-12-01 (Tue=2) .. 2026-12-02 (Wed=3) only matches Tue & Wed
  const narrow = { recurrence: { frequency: 'daily', start_date: '2026-12-01', end_date: '2026-12-02' } };
  assert.equal(runsOnWeekday(narrow, 2), true);
  assert.equal(runsOnWeekday(narrow, 3), true);
  assert.equal(runsOnWeekday(narrow, 4), false);
  // Paused yearly schedule (next_fire_at null): its next run is worked out from the spec itself, not guessed
  const pausedYearly = { recurrence: { frequency: 'yearly', day_of_month: 18, start_date: '2026-11-18', times: ['09:00'] }, next_fire_at: null };
  assert.equal(runsOnWeekday(pausedYearly, 3, new Date(2026, 10, 10)), true); // 2026-11-18 is Wednesday (3)
  assert.equal(runsOnWeekday(pausedYearly, 3, new Date(2026, 10, 20)), false); // next is 2027-11-18, a Thursday (4)
  assert.equal(runsOnWeekday(pausedYearly, 4, new Date(2026, 10, 20)), true);
});

test('Smart / Anticipation Polling: 20s idle, 2s within ±60s of trigger, 90s post-save, or active run; drops back to 20s', () => {
  const now = Date.parse('2026-11-18T15:00:00Z');
  assert.equal(FAST_POLL_MS, 2000);
  assert.equal(IDLE_POLL_MS, 20000);

  // 1. Far schedule (5 min away, saved > 90s ago) -> 20s idle
  const far = [{
    enabled: true,
    next_fire_at: '2026-11-18T15:05:00Z',
    last_fire_at: null,
    updated_at: '2026-11-18T14:55:00Z',
  }];
  assert.equal(isNearScheduledFire(far, now), false);
  assert.equal(getSmartPollInterval({ schedules: far, nowMs: now }), IDLE_POLL_MS);

  // 2. Schedule due in 55s (inside ±60s window) -> ramps to 2s
  const soon = [{ enabled: true, next_fire_at: '2026-11-18T15:00:55Z', last_fire_at: null }];
  assert.equal(isNearScheduledFire(soon, now), true);
  assert.equal(getSmartPollInterval({ schedules: soon, nowMs: now }), FAST_POLL_MS);

  // 3. Schedule overdue by 45s (inside ±60s window) -> stays fast at 2s
  const overdue = [{ enabled: true, next_fire_at: '2026-11-18T14:59:15Z', last_fire_at: null }];
  assert.equal(isNearScheduledFire(overdue, now), true);
  assert.equal(getSmartPollInterval({ schedules: overdue, nowMs: now }), FAST_POLL_MS);

  // 4. Schedule fired 50s ago (<= 60s) -> stays fast at 2s
  const justFired = [{ enabled: true, next_fire_at: '2026-11-19T15:00:00Z', last_fire_at: '2026-11-18T14:59:10Z' }];
  assert.equal(isNearScheduledFire(justFired, now), true);
  assert.equal(getSmartPollInterval({ schedules: justFired, nowMs: now }), FAST_POLL_MS);

  // 5. Schedule created/updated 75s ago (<= 90s) -> holds fast 2s polling
  const recentlySaved = [{
    enabled: true,
    next_fire_at: '2026-11-19T15:00:00Z',
    last_fire_at: null,
    updated_at: '2026-11-18T14:58:45Z',
  }];
  assert.equal(isNearScheduledFire(recentlySaved, now), true);
  assert.equal(getSmartPollInterval({ schedules: recentlySaved, nowMs: now }), FAST_POLL_MS);

  // 6. Schedule fired 75s ago (> 60s) & saved > 90s ago & run finished -> drops back to 20s idle
  const settled = [{
    enabled: true,
    next_fire_at: '2026-11-19T15:00:00Z',
    last_fire_at: '2026-11-18T14:58:45Z',
    updated_at: '2026-11-18T14:55:00Z',
    last_status: 'SUCCESS',
  }];
  assert.equal(isNearScheduledFire(settled, now), false);
  assert.equal(getSmartPollInterval({ schedules: settled, anyRunActive: false, nowMs: now }), IDLE_POLL_MS);

  // 7. Active run overrides idle -> 2s
  assert.equal(getSmartPollInterval({ schedules: settled, anyRunActive: true, nowMs: now }), FAST_POLL_MS);

  // 8. Schedule created with < 30s remaining (e.g. 12s away) -> immediately 2s
  const under30s = [{
    enabled: true,
    next_fire_at: '2026-11-18T15:00:12Z',
    created_at: '2026-11-18T15:00:00Z',
  }];
  assert.equal(getSmartPollInterval({ schedules: under30s, nowMs: now }), FAST_POLL_MS);

  // 9. Slight server clock ahead (+5s skew) on fresh run & last_fire_at -> still 2s
  const clockSkew = [{
    enabled: true,
    next_fire_at: '2026-11-19T15:00:00Z',
    last_fire_at: '2026-11-18T15:00:05Z',
  }];
  assert.equal(isNearScheduledFire(clockSkew, now), true);
  assert.ok(findFreshRun([{ run_id: 'R1', started_at: '2026-11-18T15:00:05Z' }], now));
  assert.equal(findFreshRun([{ run_id: 'R2', started_at: '2026-11-18T14:58:00Z' }], now), undefined);
});
