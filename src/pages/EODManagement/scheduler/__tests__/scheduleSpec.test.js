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
    timezone: '',
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
