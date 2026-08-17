const DAY_MAP_NUM_TO_NAME = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

const DAY_MAP_NAME_TO_NUM = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

// Which month within a quarter the job should run in. `offset` is added to
// each quarter's anchor month (Jan/Apr/Jul/Oct) to get the actual cron month.
const QUARTER_POSITION_OFFSETS = {
  first: 0,
  mid: 1,
  last: 2,
};

/** Resolves the actual cron month numbers for the selected quarters + position. */
function getQuarterMonths(selectedQuarters, quarterPosition) {
  const offset = QUARTER_POSITION_OFFSETS[quarterPosition] ?? 0;
  return (selectedQuarters || [1, 4, 7, 10])
    .map((anchor) => anchor + offset)
    .sort((a, b) => a - b);
}

/** Actual number of days in a given month (1-12), accounting for leap years. */
function daysInMonth(month, year = new Date().getFullYear()) {
  return new Date(year, month, 0).getDate();
}

/**
 * Resolves the 'L' (last day of month) sentinel to a concrete day number,
 * since standard cron day-of-month fields only accept digits/ranges/lists.
 * For multiple target months (Quarterly), a single field must be valid across
 * all of them, so the smallest day-count among the selected months is used
 * (e.g. Jan/Apr/Jul/Oct -> 30, since April only has 30 days).
 */
function resolveDayOfMonth(selectedDayOfMonth, months) {
  if (selectedDayOfMonth !== 'L') {
    return selectedDayOfMonth || 1;
  }
  const monthList = Array.isArray(months) ? months : [months];
  return Math.min(...monthList.map((m) => daysInMonth(m)));
}

/**
 * Converts form selection into standard 5-part cron expression string:
 * "MIN HOUR DOM MON DOW"
 * Example: "30 22 * * *" (Daily at 22:30)
 * Example: "0 18 * * 1,3" (Weekly on Mon,Wed at 18:00)
 * Example: "15 14 15 8 *" (Custom/One-time on Aug 15 at 14:15)
 */
export function formToCron(form) {
  const [hStr, mStr] = (form.time || '22:00').split(':');
  const min = parseInt(mStr || '0', 10);
  const hour = parseInt(hStr || '22', 10);

  if (form.recurrence === 'Daily') {
    return `${min} ${hour} * * *`;
  }

  if (form.recurrence === 'Weekly') {
    const selectedDays = form.selectedDays || ['Monday'];
    const nums = selectedDays
      .map((d) => DAY_MAP_NAME_TO_NUM[d])
      .filter((n) => n !== undefined)
      .sort((a, b) => a - b);
    const dowStr = nums.length > 0 ? nums.join(',') : '*';
    return `${min} ${hour} * * ${dowStr}`;
  }

  if (form.recurrence === 'Monthly') {
    // Run on a specific day of every month (default day 1; 'L' resolves to current month's last day)
    const currentMonth = new Date().getMonth() + 1;
    const dom = resolveDayOfMonth(form.selectedDayOfMonth, currentMonth);
    return `${min} ${hour} ${dom} * *`;
  }

  if (form.recurrence === 'Quarterly') {
    // Run on selected quarters (subset of {1,4,7,10}), shifted by quarterPosition
    // (first/mid/last month of quarter), on a specific day of month or 'L'
    const months = getQuarterMonths(form.selectedQuarters, form.quarterPosition);
    const dom = resolveDayOfMonth(form.selectedDayOfMonth, months);
    return `${min} ${hour} ${dom} ${months.join(',')} *`;
  }

  if (form.recurrence === 'Annually') {
    // Run once a year on a specific month and day (or 'L')
    const mon = form.selectedMonth || (form.selectedDate ? new Date(form.selectedDate).getMonth() + 1 : 1);
    const fallbackDom = form.selectedDate ? new Date(form.selectedDate).getDate() : 1;
    const dom = form.selectedDayOfMonth !== undefined
      ? resolveDayOfMonth(form.selectedDayOfMonth, mon)
      : fallbackDom;
    return `${min} ${hour} ${dom} ${mon} *`;
  }

  if (form.recurrence === 'Custom / One-time') {
    const dateObj = form.selectedDate ? new Date(form.selectedDate) : new Date();
    const dom = dateObj.getDate();
    const mon = dateObj.getMonth() + 1;
    return `${min} ${hour} ${dom} ${mon} *`;
  }

  return `${min} ${hour} * * *`;
}

/**
 * Parses cron expression string back into human readable format for UI components.
 */
export function cronToHuman(cronStr, defaultTime = '22:00') {
  if (!cronStr || typeof cronStr !== 'string') {
    return {
      recurrence: 'Daily',
      time: defaultTime,
      dateGroup: 'Daily Runs',
      selectedDays: ['Monday'],
      cronExpression: '0 22 * * *',
    };
  }

  const parts = cronStr.trim().split(/\s+/);
  if (parts.length < 5) {
    return {
      recurrence: 'Daily',
      time: defaultTime,
      dateGroup: 'Daily Runs',
      selectedDays: ['Monday'],
      cronExpression: cronStr,
    };
  }

  const [minStr, hourStr, domStr, monStr, dowStr] = parts;
  const min = String(minStr).padStart(2, '0');
  const hour = String(hourStr).padStart(2, '0');
  const time = `${hour}:${min}`;

  if (dowStr !== '*' && domStr === '*' && monStr === '*') {
    // Weekly
    const numList = dowStr.split(',').map((n) => parseInt(n, 10));
    const selectedDays = numList
      .map((n) => DAY_MAP_NUM_TO_NAME[n])
      .filter(Boolean);
    const dayNamesShort = selectedDays.map((d) => d.slice(0, 3)).join(', ');
    return {
      recurrence: 'Weekly',
      time,
      dateGroup: `Weekly (${dayNamesShort || 'Custom Days'})`,
      selectedDays,
      cronExpression: cronStr,
    };
  }

  const QUARTER_ANCHORS = [1, 4, 7, 10];
  const OFFSET_TO_POSITION = { 0: 'first', 1: 'mid', 2: 'last' };
  const POSITION_LABEL = { first: 'First Month', mid: 'Middle Month', last: 'Last Month' };

  /**
   * Checks whether monValues match a quarterly pattern shifted by a fixed
   * offset (0, 1, or 2) from the quarter anchor months. A single-month case
   * (offset 0 only) is kept ambiguous with Annually on purpose, matching
   * prior behavior; offset 1/2 is only inferred when 2+ months are present
   * to avoid misreading an intentional Annually schedule as Quarterly.
   */
  function detectQuarterlyOffset(monValues) {
    for (const offset of [0, 1, 2]) {
      const anchors = monValues.map((m) => m - offset);
      const matches = anchors.every((a) => QUARTER_ANCHORS.includes(a));
      if (matches && (offset === 0 || monValues.length >= 2)) {
        return { offset, anchors };
      }
    }
    return null;
  }

  // Detect Quarterly: dom is set or 'L', month values align to a quarterly pattern, no DOW
  if (domStr !== '*' && dowStr === '*') {
    const monValues = monStr.split(',').map((n) => parseInt(n, 10));
    const quarterlyMatch = monValues.length >= 1 ? detectQuarterlyOffset(monValues) : null;
    if (quarterlyMatch) {
      const { offset, anchors } = quarterlyMatch;
      const quarterPosition = OFFSET_TO_POSITION[offset];
      const quarterLabels = anchors.map((m) => {
        if (m === 1)  return 'Q1';
        if (m === 4)  return 'Q2';
        if (m === 7)  return 'Q3';
        if (m === 10) return 'Q4';
        return '';
      }).join(', ');
      const domLabel = domStr === 'L' ? 'Last Day' : `day ${domStr}`;
      const positionLabel = offset === 0 ? '' : `, ${POSITION_LABEL[quarterPosition]}`;
      return {
        recurrence: 'Quarterly',
        time,
        dateGroup: `Quarterly – ${quarterLabels} (${domLabel}${positionLabel})`,
        selectedDays: ['Monday'],
        selectedDayOfMonth: domStr === 'L' ? 'L' : parseInt(domStr, 10),
        selectedQuarters: anchors,
        quarterPosition,
        cronExpression: cronStr,
      };
    }
  }

  if (domStr !== '*' && monStr === '*') {
    // Monthly — dom set (numeric or 'L'), month is wildcard
    const domLabel = domStr === 'L' ? 'Last Day' : `day ${domStr}`;
    return {
      recurrence: 'Monthly',
      time,
      dateGroup: `Monthly (${domLabel})`,
      selectedDays: ['Monday'],
      selectedDayOfMonth: domStr === 'L' ? 'L' : parseInt(domStr, 10),
      cronExpression: cronStr,
    };
  }

  if (domStr !== '*' && monStr !== '*' && !monStr.includes(',')) {
    const monthNum = parseInt(monStr, 10);
    const dayNum = domStr === 'L' ? 'L' : parseInt(domStr, 10);
    const currentYear = new Date().getFullYear();
    const dateObj = domStr === 'L'
      ? new Date(currentYear, monthNum, 0)
      : new Date(currentYear, monthNum - 1, dayNum);
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const formatted = domStr === 'L'
      ? `Last Day of ${monthNames[monthNum - 1]}`
      : `${dayNames[dateObj.getDay()]} ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]}`;
    return {
      recurrence: 'Annually',
      time,
      dateGroup: formatted,
      selectedDays: ['Monday'],
      selectedDate: dateObj,
      selectedMonth: monthNum,
      selectedDayOfMonth: dayNum,
      cronExpression: cronStr,
    };
  }

  // Daily
  return {
    recurrence: 'Daily',
    time,
    dateGroup: 'Daily Runs',
    selectedDays: ['Monday'],
    cronExpression: cronStr,
  };
}