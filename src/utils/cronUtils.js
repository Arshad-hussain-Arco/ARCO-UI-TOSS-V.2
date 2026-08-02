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

  if (domStr !== '*' && monStr !== '*') {
    // Custom / One-time
    const currentYear = new Date().getFullYear();
    const dateObj = new Date(currentYear, parseInt(monStr, 10) - 1, parseInt(domStr, 10));
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const formatted = `${dayNames[dateObj.getDay()]} ${dateObj.getDate()} ${monthNames[dateObj.getMonth()]}`;
    return {
      recurrence: 'Custom / One-time',
      time,
      dateGroup: formatted,
      selectedDays: ['Monday'],
      selectedDate: dateObj,
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
