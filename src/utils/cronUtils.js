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
    // Run on a specific day of every month (default day 1 or 'L' for Last Day)
    const dom = form.selectedDayOfMonth === 'L' ? 'L' : (form.selectedDayOfMonth || 1);
    return `${min} ${hour} ${dom} * *`;
  }

  if (form.recurrence === 'Quarterly') {
    // Run on selected quarters (subset of {1,4,7,10}) on a specific day of month or 'L'
    const quarters = (form.selectedQuarters || [1, 4, 7, 10]).sort((a, b) => a - b);
    const dom = form.selectedDayOfMonth === 'L' ? 'L' : (form.selectedDayOfMonth || 1);
    return `${min} ${hour} ${dom} ${quarters.join(',')} *`;
  }

  if (form.recurrence === 'Annually') {
    // Run once a year on a specific month and day (or 'L')
    const mon = form.selectedMonth || (form.selectedDate ? new Date(form.selectedDate).getMonth() + 1 : 1);
    const dom = form.selectedDayOfMonth === 'L' ? 'L' : (form.selectedDayOfMonth || (form.selectedDate ? new Date(form.selectedDate).getDate() : 1));
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

  const QUARTER_MONTHS = new Set([1, 4, 7, 10]);

  // Detect Quarterly: dom is set or 'L', all month values are a subset of {1,4,7,10}, no DOW
  if (domStr !== '*' && dowStr === '*') {
    const monValues = monStr.split(',').map((n) => parseInt(n, 10));
    const isQuarterly = monValues.length >= 1 && monValues.every((m) => QUARTER_MONTHS.has(m));
    if (isQuarterly) {
      const quarterLabels = monValues.map((m) => {
        if (m === 1)  return 'Q1';
        if (m === 4)  return 'Q2';
        if (m === 7)  return 'Q3';
        if (m === 10) return 'Q4';
        return '';
      }).join(', ');
      const domLabel = domStr === 'L' ? 'Last Day' : `day ${domStr}`;
      return {
        recurrence: 'Quarterly',
        time,
        dateGroup: `Quarterly – ${quarterLabels} (${domLabel})`,
        selectedDays: ['Monday'],
        selectedDayOfMonth: domStr === 'L' ? 'L' : parseInt(domStr, 10),
        selectedQuarters: monValues,
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
