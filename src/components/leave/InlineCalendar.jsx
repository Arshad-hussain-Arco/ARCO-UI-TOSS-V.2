import { ChevronLeft, ChevronRight } from 'lucide-react';
import { activatable } from '@utils/interactive';
import './InlineCalendar.css';

// Local date components, NOT toISOString() — that converts to UTC first,
// which rolls local midnight back to the previous day for any user in a
// positive UTC-offset timezone, shifting every calendar/dayMap lookup
// (weekend/holiday/own_request) back by one day.
export function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Real per-day info, sourced from GET /api/me/<id>/calendar/ (leaveService.getCalendar)
// — dayMap is { 'YYYY-MM-DD': { status, is_weekend, is_org_holiday, claim_types, leave_type, own_request } }.
// A day missing from dayMap (not yet loaded, or outside the fetched range)
// is treated as a working day — acceptable loading-state fallback.
export function isRealWeekend(d, dayMap) {
  return !!dayMap?.[dateStr(d)]?.is_weekend;
}
export function isRealHoliday(d, dayMap) {
  return !!dayMap?.[dateStr(d)]?.is_org_holiday;
}
export function getClaimTypesForDate(d, dayMap) {
  return dayMap?.[dateStr(d)]?.claim_types || [];
}
// Non-working day = weekend OR org holiday OR registered under any Claim
// type's custom dates — the "from"/"to" boundary of an Actual/Nominal leave
// (Leave/WFH/OW) must never land on one of these (mid-range days aren't
// restricted — see InlineCalendar's handleDayClick, which only ever sets a
// boundary, never a mid-range day, in this UI).
export function isNonWorkingDay(d, dayMap) {
  return isRealWeekend(d, dayMap) || isRealHoliday(d, dayMap) || getClaimTypesForDate(d, dayMap).length > 0;
}
// Rule 3 (cross-type overlap prevention): a date already covered by the
// employee's own PENDING/APPROVED Actual/Nominal request (Leave/WFH/OW) —
// sourced from calendar `own_request` (leaveService.getCalendar).
//
// WFH/Offshore records are the exception: the backend's overlap-adjustment
// policy (LeaveApplyService._handle_overlap_adjustments) auto-pushes/pulls/
// splits/rejects an employee's own overlapping WFH/OW records whenever a
// different leave type is applied over them (e.g. Annual Leave over an
// existing WFH request) — so those dates must stay selectable here. Only a
// same-category conflict (WFH-over-WFH, Offshore-over-Offshore) or an
// Actual "Leave" record (never policy-adjusted) still hard-blocks selection.
export function getOwnRequest(d, dayMap) {
  return dayMap?.[dateStr(d)]?.own_request || null;
}
const OWN_REQUEST_CATEGORY_CODES = { WFH: 'WFH', OFFSHORE: 'OW' };
// Does this own_request actually block selection for the leave type
// currently being applied/edited? Leave-vs-Leave always blocks; a WFH/OW
// record only blocks a same-type re-application — a different type is
// allowed to override it (backend auto-adjusts). No target type known yet
// blocks conservatively.
export function isOverlapBlockedForOwn(own, newLeaveTypeCode) {
  if (!own) return false;
  if (own.category === 'LEAVE') return true;
  const ownCode = OWN_REQUEST_CATEGORY_CODES[own.category] || own.category;
  if (!newLeaveTypeCode) return true;
  return ownCode === newLeaveTypeCode;
}
export function isOverlapBlocked(d, dayMap, newLeaveTypeCode = null) {
  return isOverlapBlockedForOwn(getOwnRequest(d, dayMap), newLeaveTypeCode);
}
const OWN_REQUEST_LABELS = { LEAVE: 'Leave', WFH: 'WFH', OFFSHORE: 'Offshore Work' };
export function ownRequestTooltip(own, newLeaveTypeCode = null) {
  if (!own) return '';
  const label = OWN_REQUEST_LABELS[own.category] || own.category;
  const status = own.status === 'APPROVED' ? 'Approved' : 'Pending';
  if (!isOverlapBlockedForOwn(own, newLeaveTypeCode)) {
    return `${status} ${label} request (#${own.leave_id}) covers this date — it will be automatically adjusted if you apply here`;
  }
  return `Blocked — ${status} ${label} request (#${own.leave_id}) already covers this date`;
}
export function eachDay(s, e) {
  const days = [];
  const cur = new Date(s);
  cur.setHours(0, 0, 0, 0);
  const fin = new Date(e);
  fin.setHours(0, 0, 0, 0);
  while (cur <= fin) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}
export function bizDaysArray(s, e, dayMap) {
  return eachDay(s, e).filter((d) => !isRealWeekend(d, dayMap) && !isRealHoliday(d, dayMap));
}
export function countBiz(s, e, dayMap) {
  return bizDaysArray(s, e, dayMap).length;
}
export function countHols(s, e, dayMap) {
  return eachDay(s, e).filter((d) => isRealHoliday(d, dayMap)).length;
}
export function countWknd(s, e, dayMap) {
  return eachDay(s, e).filter((d) => isRealWeekend(d, dayMap)).length;
}
export function fmtShort(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Shared date-range calendar for applying for / editing a leave — weekend
 * and company-holiday highlighting, an employee's own pending/approved
 * Leave/WFH/Offshore markers, and range selection. Originally built inside
 * ApplyLeaveModal; extracted here so EditLeaveModal (and any other
 * date-range picker) gets the same real calendar instead of bare
 * `<input type="date">` fields.
 */
export function InlineCalendar({
  year,
  month,
  startDate,
  endDate,
  hoverDate,
  onDayClick,
  onDayHover,
  onPrev,
  onNext,
  dateMode = 'future',
  // Set of 'YYYY-MM-DD' strings this leave type actually qualifies for —
  // e.g. a Claim type's Weekend/Company Holiday/Custom Dates rule. null
  // means "no extra restriction beyond dateMode" (not loaded, or not a
  // rule-restricted flow).
  eligibleDateSet = null,
  // Real per-day status map (see isRealWeekend/isRealHoliday above) —
  // drives the weekend/holiday highlighting.
  calendarDayMap = null,
  // Rule 1 (Actual/Nominal Leave): when true, non-working days
  // (weekend/holiday/Claim custom date) are greyed out and unclickable as
  // boundary selections — not used for Claims, which target non-working
  // days by design.
  restrictToWorkingDays = false,
  // The leave type code currently being applied for/edited (e.g. 'AL',
  // 'WFH', 'OW') — see isOverlapBlocked: a different type can be selected
  // over an existing own WFH/OW date since the backend auto-adjusts those.
  newLeaveTypeCode = null,
}) {
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  const rangeEnd = endDate ?? (startDate && hoverDate && hoverDate > startDate ? hoverDate : null);
  function isRuleIneligible(d) {
    // Claims are retroactive — today itself never qualifies, only strictly
    // past dates do. Beyond that, if a specific eligible-dates set was
    // resolved for the selected Claim type (Weekend/Company Holiday/Custom
    // Dates), a date must also appear in it.
    if (dateMode === 'past' && dateStr(d) === dateStr(today)) return true;
    if (eligibleDateSet && !eligibleDateSet.has(dateStr(d))) return true;
    if (restrictToWorkingDays && isNonWorkingDay(d, calendarDayMap)) return true;
    // Rule 3 — own pending/approved same-category request always blocks
    // selection, regardless of restrictToWorkingDays (which only governs
    // Rule 1). Cross-type WFH/OW overlaps are allowed — see isOverlapBlocked.
    if (isOverlapBlocked(d, calendarDayMap, newLeaveTypeCode)) return true;
    return false;
  }
  // 'any' mode (Actual + Unlimited leave types — no balance to protect, so
  // past dates can be self-logged retroactively same as future ones) skips
  // the past/future direction check entirely; only isRuleIneligible applies.
  function isPastOrFutureIneligible(d) {
    if (dateMode === 'any') return false;
    return dateMode === 'past' ? d > today : d < today;
  }
  function dayClass(d) {
    const cls = ['al-cal-day'];
    const isIneligible = isPastOrFutureIneligible(d) || isRuleIneligible(d);
    if (isIneligible) cls.push('al-cal-day-past');
    if (dateStr(d) === dateStr(today)) cls.push('al-cal-day-today');
    if (isRealWeekend(d, calendarDayMap)) cls.push('al-cal-day-weekend');
    if (isRealHoliday(d, calendarDayMap)) cls.push('al-cal-day-holiday');
    const own = getOwnRequest(d, calendarDayMap);
    if (own) {
      const categoryClass = { LEAVE: 'leave', WFH: 'wfh', OFFSHORE: 'offshore' }[own.category] || 'leave';
      const statusClass = own.status === 'APPROVED' ? 'approved' : 'pending';
      cls.push(`al-cal-day-own-${categoryClass}-${statusClass}`);
    }
    const t = d.getTime();
    if (startDate && rangeEnd) {
      const lo = Math.min(startDate.getTime(), rangeEnd.getTime());
      const hi = Math.max(startDate.getTime(), rangeEnd.getTime());
      if (t > lo && t < hi) cls.push('al-cal-day-in-range');
      if (t === lo) cls.push('al-cal-day-sel-start');
      if (t === hi) cls.push('al-cal-day-sel-end');
    } else if (startDate && t === startDate.getTime()) {
      cls.push('al-cal-day-sel-start');
    }
    return cls.join(' ');
  }
  return (
    <div className="al-cal-wrap">
      <div className="al-cal-top">
        <button type="button" className="al-cal-nav-btn" onClick={onPrev}>
          <ChevronLeft size={13} />
        </button>
        <h4 className="al-cal-title">
          {MONTHS[month]} {year}
        </h4>
        <button type="button" className="al-cal-nav-btn" onClick={onNext}>
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="al-cal-legend">
        {[
          ['var(--c-primary)', 'Selected'],
          ['var(--c-primary-light)', 'Range'],
          ['var(--c-warning-light)', 'Weekend'],
          ['var(--c-info-light)', 'Holiday'],
          ['var(--c-success-light)', 'Approved'],
        ].map(([bg, lbl]) => (
          <div key={lbl} className="al-cal-legend-item">
            <div
              className="al-cal-legend-dot"
              style={{ background: bg, border: `1px solid ${bg}` }}
            />
            {lbl}
          </div>
        ))}
      </div>
      {/* Rule 3 — legend for the employee's own blocked Leave/WFH/Offshore
          dates: colour = type, solid vs. striped = approved vs. pending. */}
      <div className="al-cal-legend al-cal-legend-own">
        {[
          ['#fb923c', 'Leave'],
          ['#60a5fa', 'WFH'],
          ['#a78bfa', 'Offshore'],
        ].map(([bg, lbl]) => (
          <div key={lbl} className="al-cal-legend-item">
            <div className="al-cal-legend-dot" style={{ background: `${bg}66`, border: `1px solid ${bg}` }} />
            {lbl}
          </div>
        ))}
        <div className="al-cal-legend-item">
          <div className="al-cal-legend-dot al-cal-legend-dot-striped" />
          Pending
        </div>
        <div className="al-cal-legend-item">
          <div className="al-cal-legend-dot" style={{ background: '#94a3b866', border: '1px solid var(--text-tertiary)' }} />
          Approved (solid)
        </div>
      </div>
      <div className="al-cal-grid">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="al-cal-day-header">
            {d}
          </div>
        ))}
        {cells.map((d, i) =>
          d === null ? (
            <div key={i} className="al-cal-day al-cal-day-empty" />
          ) : (
            <div
              key={i}
              className={dayClass(d)}
              data-tooltip={ownRequestTooltip(getOwnRequest(d, calendarDayMap), newLeaveTypeCode) || undefined}
              {...activatable(
                () => {
                  const eligible = !isPastOrFutureIneligible(d) && !isRuleIneligible(d);
                  if (eligible) onDayClick(d);
                },
                { label: d.toDateString() },
              )}
              onMouseEnter={() => onDayHover(d)}
              onMouseLeave={() => onDayHover(null)}
            >
              <span className="al-cal-day-num">{d.getDate()}</span>
              <div className="al-cal-dots">
                {isRealHoliday(d, calendarDayMap) && (
                  <div className="al-cal-dot" style={{ background: 'var(--c-info)' }} />
                )}
              </div>
            </div>
          ),
        )}
      </div>
      <div className="al-cal-hint">
        {!startDate
          ? dateMode === 'past'
            ? eligibleDateSet
              ? 'Click a highlighted past date to start selection'
              : 'Click a past date to start selection'
            : 'Click a date to start selection'
          : !endDate
            ? 'Click end date or click same date for single day'
            : `${fmtShort(startDate)} → ${fmtShort(endDate)}`}
      </div>
    </div>
  );
}
