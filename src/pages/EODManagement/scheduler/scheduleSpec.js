/**
 * Pure logic of the schedule form (no React, no network): the form <-> the API's recurrence object, quick validation and the weekday
 * test of the list's day tabs. The server is the authority (it validates and computes every run time); this only avoids obvious round trips.
 * Test with node: npm run test:scheduler
 */

export const KINDS = [
  { id: 'once', label: 'Once (one date)' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'every-days', label: 'Every N days' },
  { id: 'every-hours', label: 'Every N hours' },
  { id: 'every-minutes', label: 'Every N minutes' },
];

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // index = cron / Control-M day number

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const isoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const clientTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
};

export function defaultForm(today = new Date()) {
  return {
    kind: 'daily',
    times: [], // no time is pre-chosen: the user picks it
    startDate: isoDay(today),
    endDate: '',
    daysOfWeek: [1, 2, 3, 4, 5],
    dayOfMonth: '1',
    months: [],
    quarters: [1, 2, 3, 4],
    quarterMonth: 'first',
    every: 1,
    timezone: clientTimezone(),
  };
}

export const sortedTimes = (times) =>
  [...new Set((times || []).filter((t) => HHMM.test(t)))].sort();

/** The API's recurrence object for this form. */
export function formToSpec(form) {
  const base = {
    times: sortedTimes(form.times),
    start_date: form.startDate || '',
    end_date: form.endDate || '',
    timezone: form.timezone || clientTimezone(),
  };
  switch (form.kind) {
    case 'once':
      return { ...base, frequency: 'once', end_date: '' };
    case 'daily':
      return { ...base, frequency: 'daily', every: 1 };
    case 'every-days':
      return { ...base, frequency: 'daily', every: Number(form.every) || 1 };
    case 'weekly':
      return {
        ...base,
        frequency: 'weekly',
        days_of_week: [...form.daysOfWeek].sort((a, b) => a - b),
      };
    case 'monthly':
      return {
        ...base,
        frequency: 'monthly',
        day_of_month: form.dayOfMonth === 'L' ? 'L' : Number(form.dayOfMonth) || 1,
        months: form.months,
      };
    case 'quarterly':
      return {
        ...base,
        frequency: 'quarterly',
        day_of_month: form.dayOfMonth === 'L' ? 'L' : Number(form.dayOfMonth) || 1,
        quarters: [...form.quarters].sort((a, b) => a - b),
        quarter_month: form.quarterMonth,
      };
    case 'yearly':
      return {
        ...base,
        frequency: form.kind,
        day_of_month: form.dayOfMonth === 'L' ? 'L' : Number(form.dayOfMonth) || 1,
      };
    case 'every-hours':
    case 'every-minutes':
      return {
        ...base,
        frequency: 'interval',
        every: Number(form.every) || 1,
        unit: form.kind === 'every-hours' ? 'hours' : 'minutes',
      };
    default:
      return { ...base, frequency: form.kind };
  }
}

/** The form for a stored recurrence object (used when editing). */
export function specToForm(spec, today = new Date()) {
  const form = { ...defaultForm(today), times: spec.times?.length ? [...spec.times] : [] };
  form.startDate = spec.start_date || '';
  form.endDate = spec.end_date || '';
  form.timezone = spec.timezone || clientTimezone();
  form.every = spec.every || 1;
  if (spec.days_of_week) form.daysOfWeek = spec.days_of_week;
  if (spec.day_of_month !== undefined) form.dayOfMonth = String(spec.day_of_month);
  if (spec.months) form.months = spec.months;
  if (spec.quarters) form.quarters = spec.quarters;
  if (spec.quarter_month) form.quarterMonth = spec.quarter_month;
  if (spec.frequency === 'daily') form.kind = (spec.every || 1) > 1 ? 'every-days' : 'daily';
  else if (spec.frequency === 'interval')
    form.kind = spec.unit === 'hours' ? 'every-hours' : 'every-minutes';
  else form.kind = spec.frequency;
  return form;
}

/** Quick checks: {field: message}. Empty object = nothing obviously wrong. */
export function validateForm(form, today = new Date()) {
  const errs = {};
  if (!sortedTimes(form.times).length) errs.times = 'Add at least one time (HH:MM).';
  if (['once', 'yearly', 'every-hours', 'every-minutes'].includes(form.kind) && !form.startDate) {
    errs.startDate =
      form.kind === 'once' ? 'Choose the date.' : 'Choose the date the cycle starts from.';
  }
  if (
    form.kind === 'once' &&
    form.startDate &&
    form.startDate < isoDay(today) &&
    !(form.times || []).length
  )
    errs.startDate = 'The date is in the past.';
  if (form.kind === 'weekly' && !form.daysOfWeek.length)
    errs.daysOfWeek = 'Choose at least one day.';
  if (form.kind === 'quarterly' && !form.quarters.length)
    errs.quarters = 'Choose at least one quarter.';
  if (
    ['every-days', 'every-hours', 'every-minutes'].includes(form.kind) &&
    !(Number(form.every) >= 1)
  )
    errs.every = 'Enter a number of 1 or more.';
  if (form.endDate && form.startDate && form.endDate < form.startDate)
    errs.endDate = 'The end date is before the start date.';
  return errs;
}

/** Does this stored schedule fire on this weekday (0 = Sunday)? Month / quarter / year schedules answer through their next run. */
export function runsOnWeekday(schedule, dayIndex) {
  const spec = schedule?.recurrence || {};
  switch (spec.frequency) {
    case 'daily':
    case 'interval':
      return true;
    case 'weekly':
      return (spec.days_of_week || []).includes(dayIndex);
    case 'once':
      return spec.start_date
        ? new Date(`${spec.start_date}T12:00:00`).getDay() === dayIndex
        : false;
    default:
      return schedule?.next_fire_at ? new Date(schedule.next_fire_at).getDay() === dayIndex : false;
  }
}

export const QUARTERS = [
  { id: 1, label: 'Q1', span: 'Jan – Mar' },
  { id: 2, label: 'Q2', span: 'Apr – Jun' },
  { id: 3, label: 'Q3', span: 'Jul – Sep' },
  { id: 4, label: 'Q4', span: 'Oct – Dec' },
];
export const QUARTER_POSITIONS = [
  { id: 'first', label: 'First Month' },
  { id: 'mid', label: 'Middle Month' },
  { id: 'last', label: 'Last Month' },
];
const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** The months a quarterly schedule runs in, e.g. Q1 and Q3 in the last month -> ['Mar', 'Sep']. */
export function quarterMonthNames(quarters, position = 'first') {
  const offset = { first: 0, mid: 1, last: 2 }[position] ?? 0;
  return [...quarters].sort((a, b) => a - b).map((q) => MONTH_NAMES[(q - 1) * 3 + offset]);
}
