// Pure date helpers (no app/env imports so they can run under node --test).

export function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isWeekend(date, weekendDays = [5, 6]) {
  const day = date.getDay();
  return weekendDays.includes(day);
}

// holidaySet holds 'YYYY-MM-DD' strings (local calendar date, matching the
// dates returned by /leaves/holidays/) — a plain Set, not Date objects, so
// membership checks don't have to worry about time-of-day/timezone drift.
export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isHoliday(date, holidaySet) {
  return !!holidaySet && holidaySet.has(toDateKey(date));
}

export function countBusinessDays(start, end, weekendDays = [5, 6], holidaySet = null) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e || s > e) return 0;

  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (!isWeekend(cur, weekendDays) && !isHoliday(cur, holidaySet)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function calculateProratedEffort(start, end, effortMDs, windowDays, referenceDate = new Date(), weekendDays = [5, 6], holidaySet = null) {
  const s = parseDate(start);
  const e = parseDate(end);
  const ref = parseDate(referenceDate);
  if (!s || !e || !ref || effortMDs <= 0) return 0;

  const windowEnd = new Date(ref);
  windowEnd.setDate(windowEnd.getDate() + windowDays - 1);

  const overlapStart = new Date(Math.max(ref.getTime(), s.getTime()));
  const overlapEnd = new Date(Math.min(e.getTime(), windowEnd.getTime()));

  if (overlapStart > overlapEnd) return 0;

  const totalBiz = countBusinessDays(s, e, weekendDays, holidaySet);
  if (totalBiz === 0) return 0;

  const overlapBiz = countBusinessDays(overlapStart, overlapEnd, weekendDays, holidaySet);
  return effortMDs * (overlapBiz / totalBiz);
}

