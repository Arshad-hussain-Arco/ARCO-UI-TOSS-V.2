export function generateDates(startDate, days) {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function getMonthDates(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return generateDates(start, end.getDate());
}

export function formatDateKey(date) {
  return date.toISOString().split('T')[0];
}

export function calcStats(dates) {
  const values = Object.values(dates);
  const presentDays = values.filter(v => v === 'P').length;
  const totalWorkingDays = values.filter(v => v !== 'WE' && v !== 'HO').length;
  const absentDays = values.filter(v => v === 'A').length;
  return { presentDays, absentDays, totalWorkingDays };
}

/** Generate mock per-day attendance for a consultant over the given dates. */
export function generateAttendanceForDates(dates) {
  const result = {};
  for (const date of dates) {
    const key = formatDateKey(date);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) {
      result[key] = 'WE';
    } else {
      const r = Math.random();
      if (r < 0.78) result[key] = 'P';
      else if (r < 0.85) result[key] = 'AL';
      else if (r < 0.90) result[key] = 'SL';
      else if (r < 0.93) result[key] = 'WFH';
      else if (r < 0.96) result[key] = 'CL';
      else result[key] = 'A';
    }
  }
  return result;
}

/** Export filtered data to CSV. */
export function exportToCSV(rows, dates, filename = 'attendance.csv') {
  const headers = ['Consultant', 'Team', ...dates.map(d => formatDateKey(d)), 'Present', 'Absent', 'Total'];
  const lines = [
    headers.join(','),
    ...rows.map(({ consultant, record, stats }) =>
      [
        `"${consultant.name}"`,
        `"${consultant.team}"`,
        ...dates.map(d => record.dates[formatDateKey(d)] || ''),
        stats.presentDays,
        stats.absentDays,
        stats.totalWorkingDays,
      ].join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
