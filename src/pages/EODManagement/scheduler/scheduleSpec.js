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
  if (form.kind === 'once' && form.startDate && form.startDate < isoDay(today)) {
    errs.startDate = 'The date is in the past.';
  }
  if (form.kind === 'weekly' && !form.daysOfWeek.length)
    errs.daysOfWeek = 'Choose at least one day.';
  if (form.kind === 'quarterly' && !form.quarters.length)
    errs.quarters = 'Choose at least one quarter.';
  if (
    ['every-days', 'every-hours', 'every-minutes'].includes(form.kind) &&
    !(Number(form.every) >= 1)
  )
    errs.every = 'Enter a number of 1 or more.';
  if (form.endDate && form.endDate < isoDay(today)) {
    errs.endDate = 'The end date is in the past.';
  } else if (form.endDate && form.startDate && form.endDate < form.startDate) {
    errs.endDate = 'The end date is before the start date.';
  }
  return errs;
}

/** Does this stored schedule fire on this weekday (0 = Sunday)? Respects narrow start..end ranges and paused fallbacks. */
export function runsOnWeekday(schedule, dayIndex, now = new Date()) {
  const spec = schedule?.recurrence || {};
  switch (spec.frequency) {
    case 'daily':
    case 'interval': {
      if (spec.start_date && spec.end_date) {
        const s = new Date(`${spec.start_date}T12:00:00`);
        const e = new Date(`${spec.end_date}T12:00:00`);
        if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s) {
          const spanDays = Math.round((e - s) / 86400000);
          if (spanDays < 7) {
            for (let i = 0; i <= spanDays; i++) {
              const d = new Date(s);
              d.setDate(s.getDate() + i);
              if (d.getDay() === dayIndex) return true;
            }
            return false;
          }
        }
      }
      return true;
    }
    case 'weekly':
      return (spec.days_of_week || []).includes(dayIndex);
    case 'once':
      return spec.start_date
        ? new Date(`${spec.start_date}T12:00:00`).getDay() === dayIndex
        : false;
    case 'monthly':
    case 'quarterly':
    case 'yearly': {
      // These fire on a different weekday every cycle, so "runs on <day>" means its NEXT run lands on that weekday.
      // The server's next_fire_at is exact while the schedule is on; otherwise (paused / ended) work it out from the spec.
      if (schedule?.next_fire_at) return new Date(schedule.next_fire_at).getDay() === dayIndex;
      const next = nextRunDate(spec, now);
      return next ? next.getDay() === dayIndex : false;
    }
    default:
      if (schedule?.next_fire_at) {
        return new Date(schedule.next_fire_at).getDay() === dayIndex;
      }
      return spec.start_date
        ? new Date(`${spec.start_date}T12:00:00`).getDay() === dayIndex
        : false;
  }
}

const parseDay = (iso) => {
  const d = iso ? new Date(`${iso}T00:00:00`) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/**
 * The date (local midnight) of the next run of a monthly / quarterly / yearly recurrence, worked out from the spec itself the way the
 * server does (day_of_month, 'L' = last day, months, quarters + position, yearly = month of start_date), or null when it has ended.
 */
export function nextRunDate(spec, now = new Date()) {
  const freq = spec?.frequency;
  if (!['monthly', 'quarterly', 'yearly'].includes(freq)) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = parseDay(spec.start_date);
  const end = parseDay(spec.end_date);
  const from = start && start > today ? start : today;
  const anchorMonth = start ? start.getMonth() + 1 : 1;
  const offset = { first: 0, mid: 1, last: 2 }[spec.quarter_month] ?? 0;
  const quarterMonths = (spec.quarters || []).length
    ? new Set(spec.quarters.map((q) => (q - 1) * 3 + offset + 1))
    : null;
  const times = (spec.times || []).slice().sort();
  const nowHm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  for (let i = 0; i < 40; i++) {
    const first = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const month = first.getMonth() + 1;
    let ok = true;
    if (freq === 'monthly') ok = !(spec.months || []).length || spec.months.includes(month);
    else if (freq === 'quarterly')
      ok = quarterMonths ? quarterMonths.has(month) : (month - anchorMonth + 12) % 3 === 0;
    else ok = month === anchorMonth;
    if (!ok) continue;
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const wanted = spec.day_of_month ?? (start ? start.getDate() : 1);
    const dom = wanted === 'L' ? last : Math.min(Number(wanted) || 1, last);
    const d = new Date(first.getFullYear(), first.getMonth(), dom);
    if (d < from) continue;
    if (end && d > end) return null;
    if (d.getTime() === today.getTime() && times.length && times[times.length - 1] <= nowHm) continue; // today's runs are over
    return d;
  }
  return null;
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

export const EOD_PROFILES = [
  { id: 'daily', label: 'Daily EOD', description: 'Every day schedules', defaultKind: 'daily' },
  { id: 'weekly', label: 'Weekly EOD', description: 'Weekly day schedules', defaultKind: 'weekly' },
  { id: 'monthly', label: 'Monthly EOD', description: 'Monthly date schedules', defaultKind: 'monthly' },
  { id: 'quarterly', label: 'Quarterly EOD', description: 'Quarterly cycle schedules', defaultKind: 'quarterly' },
  { id: 'yearly', label: 'Yearly EOD', description: 'Annual closing schedules', defaultKind: 'yearly' },
  { id: 'once', label: 'Once', description: 'One-time scheduled runs', defaultKind: 'once' },
  { id: 'custom', label: 'Custom Interval', description: 'Every N days, hours, or mins', defaultKind: 'every-days' },
];

/** Map a schedule row to its EOD Profile id (explicit custom/selected profile or real recurrence). */
export function getScheduleProfile(schedule) {
  const explicit = String(schedule?.eod_profile || schedule?.recurrence?.eod_profile || '').trim();
  if (explicit && explicit !== 'all') return explicit;
  const r = schedule?.recurrence || {};
  const freq = String(r.frequency || '').toLowerCase();
  if (freq === 'daily') return (r.every || 1) > 1 ? 'custom' : 'daily';
  if (freq === 'interval') return 'custom';
  if (['once', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(freq)) return freq;
  return 'custom';
}

export const IDLE_POLL_MS = 20000;
export const FAST_POLL_MS = 2000;
export const ANTICIPATION_WINDOW_MS = 60000;
export const RECENT_SAVE_WINDOW_MS = 90000;
const CLOCK_SKEW_MS = 15000;

/**
 * Smart / Anticipation Polling check (Expanded ±60s window + 90s post-save window):
 * True if any schedule is:
 * 1) Actively running (run_active or RUNNING/PAUSED/QUEUED)
 * 2) Due in the next 60s (covers <30s & 30-60s) or up to 60s overdue (-60000 <= diff <= 60000)
 * 3) Fired within the last 60s (tolerates slight server/client clock skew up to 15s)
 * 4) Created or updated within the last 90s (tolerates slight server/client clock skew up to 15s)
 */
export function isNearScheduledFire(
  schedules,
  nowMs = Date.now(),
  windowMs = ANTICIPATION_WINDOW_MS,
  recentSaveMs = RECENT_SAVE_WINDOW_MS,
) {
  return (schedules || []).some((s) => {
    if (!s) return false;
    const status = String(s.last_status || '').toUpperCase();
    if (s.run_active || status === 'RUNNING' || status === 'PAUSED' || status === 'QUEUED') {
      return true;
    }
    if (s.last_fire_at) {
      const since = nowMs - Date.parse(s.last_fire_at);
      if (!Number.isNaN(since) && since >= -CLOCK_SKEW_MS && since <= windowMs) return true;
    }
    if (s.enabled && s.next_fire_at) {
      const diff = Date.parse(s.next_fire_at) - nowMs;
      if (!Number.isNaN(diff) && diff >= -windowMs && diff <= windowMs) return true;
    }
    const savedIso = s.updated_at || s.created_at;
    if (s.enabled && savedIso) {
      const sinceSaved = nowMs - Date.parse(savedIso);
      if (!Number.isNaN(sinceSaved) && sinceSaved >= -CLOCK_SKEW_MS && sinceSaved <= recentSaveMs) {
        return true;
      }
    }
    return false;
  });
}

/** Find a run that started within the last `windowMs` (default 60s), tolerating minor server/client clock skew. */
export function findFreshRun(runs, nowMs = Date.now(), windowMs = ANTICIPATION_WINDOW_MS) {
  return (runs || []).find((r) => {
    const started = r?.started_at || r?.started;
    if (!started) return false;
    const diffMs = nowMs - Date.parse(started);
    return !Number.isNaN(diffMs) && diffMs >= -CLOCK_SKEW_MS && diffMs <= windowMs;
  });
}

/** 2s fast poll when active, within ±60s of a scheduled fire, or saved within 90s; 20s idle poll otherwise. */
export function getSmartPollInterval({ schedules = [], anyRunActive = false, nowMs = Date.now() } = {}) {
  return anyRunActive || isNearScheduledFire(schedules, nowMs) ? FAST_POLL_MS : IDLE_POLL_MS;
}
