import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { leaveService } from '@services/leaveService';
import {
  X,
  Plus,
  Upload,
  Check,
  AlertTriangle,
  Info,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  Clock,
  RotateCcw,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { Select } from '@components/forms/Select/Select';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { calculateLeaveDuration } from '@utils/leaveCalculations';
import {
  CURRENT_EMPLOYEE as SELF,
  EXISTING_LEAVES,
} from '@mocks/data/leaveApplication';
import { activatable, dismissBackdrop } from '@utils/interactive';

import './ApplyLeaveModal.css';
function dateStr(d) {
  // Local date components, NOT toISOString() — that converts to UTC first,
  // which rolls local midnight back to the previous day for any user in a
  // positive UTC-offset timezone, shifting every calendar/dayMap lookup
  // (weekend/holiday/own_request) back by one day.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// Real per-day info, sourced from GET /api/me/<id>/calendar/ (leaveService.getCalendar)
// — dayMap is { 'YYYY-MM-DD': { status, is_weekend, is_org_holiday, claim_types, leave_type } }.
// Replaces the old isSaudiWeekend()/PUBLIC_HOLIDAYS mocks with the employee's
// actual configured work schedule, the org's real Holiday records, and every
// active Claim type's custom dates — all resolved server-side (build_day_info,
// leaves/utils.py) so the frontend never reimplements that logic. A day
// missing from dayMap (not yet loaded, or outside the fetched range) is
// treated as a working day — acceptable loading-state fallback.
function isRealWeekend(d, dayMap) {
  return !!dayMap?.[dateStr(d)]?.is_weekend;
}
function isRealHoliday(d, dayMap) {
  return !!dayMap?.[dateStr(d)]?.is_org_holiday;
}
function getClaimTypesForDate(d, dayMap) {
  return dayMap?.[dateStr(d)]?.claim_types || [];
}
// Non-working day = weekend OR org holiday OR registered under any Claim
// type's custom dates — the "from"/"to" boundary of an Actual/Nominal leave
// (Leave/WFH/OW) must never land on one of these (mid-range days aren't
// restricted — see InlineCalendar's handleDayClick, which only ever sets a
// boundary, never a mid-range day, in this UI).
function isNonWorkingDay(d, dayMap) {
  return isRealWeekend(d, dayMap) || isRealHoliday(d, dayMap) || getClaimTypesForDate(d, dayMap).length > 0;
}
// Rule 3 (cross-type overlap prevention): a date already covered by the
// employee's own PENDING/APPROVED Actual/Nominal request (Leave/WFH/OW) —
// sourced from calendar `own_request` (leaveService.getCalendar). Claims
// never populate this and never block/are blocked (see backend
// _is_claim_leave_type exclusion). Unlike a skipped non-working day, this
// is a genuine conflict — it must be unselectable at any position in a
// range, not just at the from/to boundary.
function getOwnRequest(d, dayMap) {
  return dayMap?.[dateStr(d)]?.own_request || null;
}
function isOverlapBlocked(d, dayMap) {
  return !!getOwnRequest(d, dayMap);
}
const OWN_REQUEST_LABELS = { LEAVE: 'Leave', WFH: 'WFH', OFFSHORE: 'Offshore Work' };
function ownRequestTooltip(own) {
  if (!own) return '';
  const label = OWN_REQUEST_LABELS[own.category] || own.category;
  const status = own.status === 'APPROVED' ? 'Approved' : 'Pending';
  return `Blocked — ${status} ${label} request (#${own.leave_id}) already covers this date`;
}
function eachDay(s, e) {
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
function countBiz(s, e, dayMap) {
  return eachDay(s, e).filter((d) => !isRealWeekend(d, dayMap) && !isRealHoliday(d, dayMap))
    .length;
}
function countHols(s, e, dayMap) {
  return eachDay(s, e).filter((d) => isRealHoliday(d, dayMap)).length;
}
function countWknd(s, e, dayMap) {
  return eachDay(s, e).filter((d) => isRealWeekend(d, dayMap)).length;
}
function existingLeaveStatus(d) {
  const s = dateStr(d);
  for (const l of EXISTING_LEAVES) {
    if (s >= l.start && s <= l.end) return l.status;
  }
  return null;
}
function initials(name) {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtShort(d) {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function InlineCalendar({
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
  // drives the weekend/holiday highlighting, replacing the old
  // isSaudiWeekend()/PUBLIC_HOLIDAYS mocks.
  calendarDayMap = null,
  // Rule 1 (Actual/Nominal Leave): when true, non-working days
  // (weekend/holiday/Claim custom date) are greyed out and unclickable as
  // boundary selections — not used for Claims, which target non-working
  // days by design.
  restrictToWorkingDays = false,
}) {
  const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
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
    // Rule 3 — own pending/approved Leave/WFH/OW always blocks selection,
    // regardless of restrictToWorkingDays (which only governs Rule 1).
    if (isOverlapBlocked(d, calendarDayMap)) return true;
    return false;
  }
  function dayClass(d) {
    const cls = ['al-cal-day'];
    const isIneligible = (dateMode === 'past' ? d > today : d < today) || isRuleIneligible(d);
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
    const ex = existingLeaveStatus(d);
    if (ex === 'approved') cls.push('al-cal-day-approved-leave');
    else if (ex === 'pending') cls.push('al-cal-day-pending-leave');
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
              data-tooltip={ownRequestTooltip(getOwnRequest(d, calendarDayMap)) || undefined}
              {...activatable(
                () => {
                  const eligible = (dateMode === 'past' ? d < today : d >= today) && !isRuleIneligible(d);
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
                {existingLeaveStatus(d) === 'approved' && (
                  <div className="al-cal-dot" style={{ background: 'var(--c-success)' }} />
                )}
                {existingLeaveStatus(d) === 'pending' && (
                  <div className="al-cal-dot" style={{ background: 'var(--c-warning)' }} />
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
            : `${fmtShort(startDate)} \u2192 ${fmtShort(endDate)}`}
      </div>
    </div>
  );
}
function getValidations(startDate, end, lt, charged, isClaim = false, dayMap = null) {
  if (!startDate || !lt) return [];
  const e = end ?? startDate;
  const rows = [];
  if (isClaim) {
    // Comp-off / Weekend Work is a claim (credits balance) rather than a
    // debit, so any date is claimable — no balance check applies.
    rows.push({ key: 'balance', label: 'Claim \u2014 any date can be selected', status: 'info' });
  } else if (lt.isUnlimited) {
    rows.push({ key: 'balance', label: 'Unlimited \u2014 no balance deducted', status: 'info' });
  } else if (charged <= lt.balance) {
    rows.push({ key: 'balance', label: 'Sufficient balance available', status: 'ok' });
  } else if (lt.isFlexible) {
    // Flexible leave types are allowed to exceed their balance as long as
    // a justification is provided (handled separately via
    // needsFlexJustification/flexJustification) — so this is a warning to
    // surface in the panel, not a hard submit-blocking error.
    rows.push({ key: 'balance', label: 'Exceeds available balance — justification required', status: 'warn' });
  } else {
    rows.push({ key: 'balance', label: 'Insufficient leave balance', status: 'error' });
  }
  // Rule 3 — full-range check against the employee's own pending/approved
  // Leave/WFH/OW requests (calendarDayMap own_request). Boundary gating
  // (isDateDisabled/handleDayClick) can't catch a mid-range conflict since
  // clicks only ever set a from/to boundary in this UI, so this walks
  // every day in the selected range. Backend _check_overlap is
  // authoritative regardless.
  const conflictDays = isClaim ? [] : eachDay(startDate, e).filter((d) => isOverlapBlocked(d, dayMap));
  rows.push({
    key: 'overlap',
    label: conflictDays.length
      ? `Conflicts with your existing request on ${conflictDays.length} day${conflictDays.length > 1 ? 's' : ''}`
      : 'No leave overlap',
    status: conflictDays.length ? 'error' : 'ok',
  });
  const wknd = countWknd(startDate, e, dayMap);
  if (wknd > 0)
    rows.push({
      key: 'weekend',
      label: `${wknd} weekend day${wknd > 1 ? 's' : ''} included`,
      status: 'info',
    });
  const hols = countHols(startDate, e, dayMap);
  if (hols > 0)
    rows.push({
      key: 'holiday',
      label: `${hols} public holiday${hols > 1 ? 's' : ''} included`,
      status: 'info',
    });
  const total = eachDay(startDate, e).length;
  if (total > lt.maxConsecutive) {
    rows.push({
      key: 'maxcons',
      label: `Exceeds max ${lt.maxConsecutive} consecutive days`,
      status: 'warn',
    });
  }
  const today = /* @__PURE__ */ new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((startDate.getTime() - today.getTime()) / 864e5);
  if (!isClaim && (lt.minNoticeDays ?? 0) > 0 && diff < lt.minNoticeDays) {
    rows.push({ key: 'notice', label: `Notice period: ${lt.noticePeriod}`, status: 'warn' });
  }
  rows.push({ key: 'blackout', label: 'No blackout period conflict', status: 'ok' });
  return rows;
}
// Maps one eligible-leave-types API entry (+ matching balance entry, if any)
// into the shape the form/summary/policy panels read from.
function buildLeaveTypeItem(entry, balances) {
  const bal = balances?.[entry.code];
  const isUnlimited = !!(entry.is_unlimited || bal?.is_unlimited);
  // Guard against an unprovisioned/stale balance record: if the balances
  // service reports a 0 entitlement (with nothing used or pending — i.e.
  // this isn't "used it all up", it's "never synced") while the
  // eligible-types entry says the employee is actually entitled to more,
  // trust the eligible-types entitlement instead of the stale 0.
  const balLooksUnprovisioned =
    bal &&
    Number(bal.entitled ?? 0) === 0 &&
    Number(bal.used ?? 0) === 0 &&
    Number(bal.pending ?? 0) === 0 &&
    Number(entry.entitled_days ?? 0) > 0;
  const available = isUnlimited
    ? null
    : balLooksUnprovisioned
      ? Number(entry.entitled_days)
      : Number(bal?.available ?? entry.entitled_days ?? 0);
  const minNoticeDays = Number(entry.min_notice_days ?? 0);
  return {
    id: entry.code,
    code: entry.code,
    label: entry.leave_type,
    balance: available,
    isUnlimited,
    isFlexible: !isUnlimited && !!entry.is_flexible,
    entitledDays: entry.entitled_days != null ? Number(entry.entitled_days) : null,
    requiresAttachment: false,
    maxConsecutive: entry.max_consecutive ?? Infinity,
    carryForward: !!entry.is_carry_forward_allowed,
    advanceLeave: false,
    minNoticeDays,
    noticePeriod:
      minNoticeDays === 0 ? 'Same day' : `${minNoticeDays} day${minNoticeDays !== 1 ? 's' : ''}`,
    policy: entry.requires_approval
      ? 'Requires manager approval per organization policy.'
      : 'Does not require manager approval.',
    gender: entry.gender_restriction || undefined,
  };
}
function ApplyLeaveModal({ onClose, isAdmin = true, type = 'leave' }) {
  const MODAL_TITLES = {
    leave: 'Apply Leave',
    wfh: 'Apply WFH',
    offshore: 'Apply Offshore Work',
    compoff: 'Submit Claim',
  };
  const SUBMIT_LABELS = {
    leave: 'Submit Leave',
    wfh: 'Submit WFH Request',
    offshore: 'Submit Offshore Work Request',
    compoff: 'Submit Claim',
  };
  const SUCCESS_TITLES = {
    leave: 'Leave Applied Successfully',
    wfh: 'WFH Request Submitted',
    offshore: 'Offshore Work Request Submitted',
    compoff: 'Claim Submitted',
  };
  const showLeaveType = type === 'leave';
  const showDuration = type === 'leave' || type === 'wfh';
  // Offshore has its own Reason field too — distinct from the excess-quota
  // justification (only shown when the request pushes OW over its quota).
  const showReason = true;
  const showClaimType = type === 'compoff';
  const reasonLabel =
    type === 'compoff' ? 'Claim Reason' : type === 'wfh' ? 'Reason for WFH' : type === 'offshore' ? 'Reason for Offshore Work' : 'Reason';
  const { user } = useAuth();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyFor, setApplyFor] = useState('self');
  const [behalfEmp, setBehalfEmp] = useState(null);
  const [requiresJustification, setRequiresJustification] = useState(false);
  const [justificationText, setJustificationText] = useState('');
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [flexJustification, setFlexJustification] = useState('');
  const [leaveType, setLeaveType] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [duration, setDuration] = useState('full');
  // Holds the selected Claim leave type's actual code (e.g. 'CWW',
  // 'CCompOff', or any custom Claim type HR created) — no longer a fixed
  // 'compoff'/'weekend' choice, see claimTypeItems below.
  const [claimType, setClaimType] = useState(null);
  const [claimEligibleDates, setClaimEligibleDates] = useState(null); // null = not yet loaded/not applicable
  // Explicit multi-select of individual dates for the Claim flow — a range
  // doesn't fit since eligible dates for a Claim type aren't necessarily
  // contiguous (e.g. two unrelated declared-working Sundays weeks apart).
  const [selectedClaimDates, setSelectedClaimDates] = useState([]); // array of Date
  const [pendingClaimDate, setPendingClaimDate] = useState(null);
  const [reason, setReason] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [empItems, setEmpItems] = useState([]);
  const fileInputRef = useRef(null);
  const today = useMemo(() => {
    const d = /* @__PURE__ */ new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [hoverDate, setHoverDate] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Server's authoritative day-by-day breakdown (Rule 1 response contract) —
  // which requested days were counted vs. skipped and why, shown after a
  // successful Leave/WFH/OW submission.
  const [lastDayBreakdown, setLastDayBreakdown] = useState(null);
  const [refNum] = useState(`LV-${Date.now().toString().slice(-6)}`);
  const [dailyConfigs, setDailyConfigs] = useState({}); // { '2026-08-07': 'full' }

  // Sync dailyConfigs when dates change
  useEffect(() => {
    if (startDate) {
      const targetEnd = endDate ?? startDate;
      const days = eachDay(startDate, targetEnd);
      const newConfigs = {};
      days.forEach((d) => {
        const dStr = dateStr(d);
        newConfigs[dStr] = dailyConfigs[dStr] || 'full';
      });
      setDailyConfigs(newConfigs);
    } else {
      setDailyConfigs({});
    }
  }, [startDate, endDate]);

  const activeEmp = applyFor === 'behalf' && behalfEmp ? behalfEmp : SELF;
  const effectiveEmpId = applyFor === 'behalf' && behalfEmp ? behalfEmp.id : user?.emp_id;
  const [eligibleTypes, setEligibleTypes] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState({});
  // Real per-day status ('WEEKEND' | 'ON_HOLIDAY' | ...) for whatever range
  // the calendar/summary currently need — see the fetch effect below.
  const [calendarDayMap, setCalendarDayMap] = useState({});
  useEffect(() => {
    if (!effectiveEmpId) {
      setEligibleTypes([]);
      setLeaveBalances({});
      return;
    }
    leaveService
      .getEligibleLeaveTypes(effectiveEmpId)
      .then((data) => setEligibleTypes(Array.isArray(data) ? data : data?.results || []))
      .catch((err) => {
        console.error('Failed to fetch eligible leave types', err);
        setEligibleTypes([]);
      });
    leaveService
      .getLeaveBalance(effectiveEmpId)
      .then((data) => setLeaveBalances(data?.balances || {}))
      .catch((err) => {
        console.error('Failed to fetch leave balance', err);
        setLeaveBalances({});
      });
  }, [effectiveEmpId]);
  useEffect(() => {
    // Eligible types/balances differ per employee — drop a stale selection
    // when switching who the request is being applied for.
    setLeaveType(null);
  }, [effectiveEmpId]);
  const ltItems = useMemo(
    () =>
      eligibleTypes
        .filter((t) => t.active)
        .map((t) => buildLeaveTypeItem(t, leaveBalances)),
    [eligibleTypes, leaveBalances],
  );
  // Every active Claim-category leave type the employee is eligible for
  // (CWW, CCompOff, and any custom Claim type HR created) — replaces the
  // old fixed 'compoff'/'weekend' choice with a generic, data-driven list.
  const claimTypeItems = useMemo(
    () => eligibleTypes.filter((t) => t.active && t.category === 'CLAIM'),
    [eligibleTypes],
  );
  useEffect(() => {
    // Drop a stale claim-type selection if it's no longer in the eligible
    // list (e.g. employee switched, or the type was deactivated).
    if (claimType && !claimTypeItems.some((t) => t.code === claimType)) {
      setClaimType(null);
    }
  }, [claimTypeItems, claimType]);
  // WFH / Offshore Work / Claim flows have an implicit leave type (no
  // dropdown, or a claim-specific one) — resolve it from the same
  // eligible-types + balances data. For Claims, fixedCode IS the selected
  // claim's own code (e.g. 'CWW') — Claims don't have their own balance
  // (see isClaimType below), so this is only used for label/notice display.
  const fixedCode =
    type === 'wfh' ? 'WFH' : type === 'offshore' ? 'OW' : type === 'compoff' ? claimType : null;
  const fixedTypeEntry = useMemo(() => {
    if (!fixedCode) return null;
    const match = eligibleTypes.find((t) => t.code === fixedCode);
    if (match) return buildLeaveTypeItem(match, leaveBalances);
    const bal = leaveBalances[fixedCode];
    if (!bal) return null;
    return {
      id: fixedCode,
      code: fixedCode,
      label: fixedCode,
      balance: bal.is_unlimited ? null : Number(bal.available ?? 0),
      isUnlimited: !!bal.is_unlimited,
      requiresAttachment: false,
      maxConsecutive: Infinity,
      carryForward: false,
      minNoticeDays: 0,
      noticePeriod: 'Same day',
      policy: '',
    };
  }, [fixedCode, eligibleTypes, leaveBalances]);
  const effectiveLeaveType = showLeaveType ? leaveType : fixedTypeEntry;
  const isUnlimitedSel = !!effectiveLeaveType?.isUnlimited;
  const isFlexibleSel = !!effectiveLeaveType?.isFlexible;
  const end = endDate ?? startDate;
  const isMultiDay = !!(startDate && end && dateStr(startDate) !== dateStr(end));
  const reqDays = startDate && end ? eachDay(startDate, end).length : 0;
  const bizDays = startDate && end ? countBiz(startDate, end, calendarDayMap) : 0;
  const wkndDays = startDate && end ? countWknd(startDate, end, calendarDayMap) : 0;
  const holCount = startDate && end ? countHols(startDate, end, calendarDayMap) : 0;
  const isClaimType = type === 'compoff';
  const charged = isClaimType
    ? selectedClaimDates.length
    : isMultiDay ? bizDays : duration === 'full' ? bizDays || 0 : 0.5;
  const avail = effectiveLeaveType ? (isUnlimitedSel ? null : Number(effectiveLeaveType.balance ?? 0)) : 0;
  const remaining =
    effectiveLeaveType && !isUnlimitedSel ? Math.max(0, avail - charged) : null;
  // Flexible-mode entitlements allow exceeding the available balance, but the
  // backend requires a justification in that case — compute proactively on
  // the client since the balance data is already available here.
  const needsFlexJustification = !isClaimType && isFlexibleSel && !isUnlimitedSel && charged > avail;
  const barPct = !isUnlimitedSel && avail > 0 ? Math.max(0, (remaining ?? 0) / avail) * 100 : 100;
  const validations = useMemo(() => {
    if (isClaimType) {
      // Claims have their own selection flow (selectedClaimDates), not
      // startDate/endDate — no balance to check, the date picker itself
      // already restricts selection to eligible dates.
      return selectedClaimDates.length > 0
        ? [{ key: 'balance', label: 'Claim — no balance deducted', status: 'info' }]
        : [];
    }
    return getValidations(startDate, end ?? null, effectiveLeaveType, charged, isClaimType, calendarDayMap);
  }, [isClaimType, selectedClaimDates, startDate, end, effectiveLeaveType, charged, calendarDayMap]);
  const hasError = validations.some((v) => v.status === 'error');
  const canSubmit =
    (isClaimType ? selectedClaimDates.length > 0 : !!startDate) &&
    !hasError &&
    (applyFor === 'self' || !!behalfEmp) &&
    (!showLeaveType || !!leaveType) &&
    (!showClaimType || !!claimType) &&
    (!showReason || reason.trim().length > 5) &&
    (leaveType?.requiresAttachment ? attachments.length > 0 : true) &&
    (!needsFlexJustification || flexJustification.trim().length > 0);
  useEffect(() => {
    if (applyFor === 'self') setBehalfEmp(null);
  }, [applyFor]);
  useEffect(() => {
    if (isMultiDay) setDuration('full');
  }, [isMultiDay]);
  // Real weekend/holiday markers for the calendar grid + duration/holiday/
  // weekend counts — covers the union of the visible month and the
  // selected range so both the grid display and the summary panel have
  // data, in a single call to the employee's real calendar
  // (leaveService.getCalendar / MyCalendarView), which resolves weekends
  // against the employee's actual work schedule and holidays against the
  // real Holiday records — replaces the old isSaudiWeekend()/
  // PUBLIC_HOLIDAYS mocks entirely.
  useEffect(() => {
    if (!effectiveEmpId) {
      setCalendarDayMap({});
      return;
    }
    let active = true;
    const monthStart = new Date(calYear, calMonth, 1);
    const monthEnd = new Date(calYear, calMonth + 1, 0);
    const rangeStart = startDate && startDate < monthStart ? startDate : monthStart;
    const rangeEndBound = end && end > monthEnd ? end : monthEnd;
    leaveService
      .getCalendar(effectiveEmpId, { start: dateStr(rangeStart), end: dateStr(rangeEndBound) })
      .then((data) => {
        if (!active) return;
        const map = {};
        (data?.calendar || []).forEach((day) => {
          map[day.date] = day;
        });
        setCalendarDayMap(map);
      })
      .catch((err) => {
        console.error('Failed to fetch calendar data', err);
        if (active) setCalendarDayMap({});
      });
    return () => {
      active = false;
    };
  }, [effectiveEmpId, calYear, calMonth, startDate, end]);
  // Claims are retroactive — once a Claim type is selected, fetch which
  // dates in the last 12 months actually qualify under its configured
  // rule (Weekend/Company Holiday/Custom Dates), so the date picker can
  // disable everything else instead of letting the user pick a date
  // that'll just be rejected on submit. A fixed lookback window (rather
  // than tracking the date picker's internal month navigation, which
  // isn't exposed to this component) keeps this simple — 12 months covers
  // any realistic retroactive claim.
  useEffect(() => {
    if (!isClaimType || !claimType || !effectiveEmpId) {
      setClaimEligibleDates(null);
      return;
    }
    let active = true;
    const queryStart = new Date(today);
    queryStart.setDate(queryStart.getDate() - 365);
    const queryEnd = new Date(today.getTime() - 864e5); // yesterday — claims never include today
    leaveService
      .getClaimEligibleDates({
        emp_id: effectiveEmpId,
        leave_type_code: claimType,
        start: dateStr(queryStart),
        end: dateStr(queryEnd),
      })
      .then((data) => {
        if (active) setClaimEligibleDates(data?.eligible_dates || []);
      })
      .catch((err) => {
        console.error('Failed to fetch claim-eligible dates', err);
        if (active) setClaimEligibleDates([]);
      });
    return () => {
      active = false;
    };
  }, [isClaimType, claimType, effectiveEmpId, today]);
  useEffect(() => {
    if (user?.mySubordinates?.length > 0 && user?.emp_id) {
      import('@services/consultantService').then(({ default: consultantService }) => {
        consultantService.getMyTeam(user.emp_id).then((data) => {
          const arr = Array.isArray(data) ? data : (data?.results || []);
          setEmpItems(arr.map((e) => ({ ...e, id: e.emp_id || e.id, name: e.name || e.emp_name, label: e.name || e.emp_name })));
        }).catch(err => {
          console.error("Failed to fetch subordinates", err);
        });
      });
    }
  }, [user]);
  function prevMonth() {
    if (calMonth === 0) {
      setCalMonth(11);
      setCalYear((y) => y - 1);
    } else setCalMonth((m) => m - 1);
  }
  function nextMonth() {
    if (calMonth === 11) {
      setCalMonth(0);
      setCalYear((y) => y + 1);
    } else setCalMonth((m) => m + 1);
  }
  function handleDayClick(d) {
    // Rule 1 (Actual/Nominal Leave): the from/to boundary must be a
    // working day — every click here sets one or the other (there's no
    // separate "mid-range click" in this UI), so gating the click itself
    // is sufficient. Doesn't apply to Claims, which target non-working
    // days by design.
    if (!isClaimType && (isNonWorkingDay(d, calendarDayMap) || isOverlapBlocked(d, calendarDayMap))) return;
    if (!startDate || endDate) {
      setStartDate(d);
      setEndDate(null);
    } else if (d < startDate) {
      setStartDate(d);
      setEndDate(null);
    } else if (dateStr(d) === dateStr(startDate)) {
      setEndDate(null);
    } else {
      setEndDate(d);
    }
  }
  function handleReset() {
    setLeaveType(null);
    setStartDate(null);
    setEndDate(null);
    setDuration('full');
    setClaimType(null);
    setClaimEligibleDates(null);
    setSelectedClaimDates([]);
    setPendingClaimDate(null);
    setLastDayBreakdown(null);
    setReason('');
    setAttachments([]);
    setBehalfEmp(null);
    setApplyFor('self');
    setRequiresJustification(false);
    setJustificationText('');
    setQuotaInfo(null);
    setFlexJustification('');
  }
  function barClass() {
    const pct = avail > 0 ? (remaining ?? 0) / avail : 1;
    if (pct <= 0.1) return 'bar-danger';
    if (pct <= 0.3) return 'bar-warn';
    return '';
  }
  if (submitted)
    return (
      <div className="al-overlay" {...dismissBackdrop(() => onClose(true))}>
        <div className="al-modal" role="dialog" aria-modal="true">
          <div className="al-header">
            <div className="al-header-left">
              <h2 className="al-title">Leave Application</h2>
            </div>
            <button type="button" className="al-close-btn" onClick={() => onClose(true)}>
              <X size={15} />
            </button>
          </div>
          <div className="al-success-body">
            <div className="al-success-icon-wrap">
              <CheckCircle2 className="al-success-icon" />
            </div>
            <h3 className="al-success-title">{SUCCESS_TITLES[type]}</h3>
            <p className="al-success-sub">
              Your request has been submitted and is pending approval from your reporting manager.
            </p>

            <div className="al-success-badge">
              <Clock size={10} />
              Pending Approval
            </div>
            {/* Rule 1 response contract: which requested days were counted
                vs. skipped, and why — server-authoritative, from the apply
                response's day_breakdown. */}
            {lastDayBreakdown?.some((d) => !d.counted) && (
              <div style={{ textAlign: 'left', margin: '16px 0', padding: '10px 12px', background: 'var(--c-info-light, #eff6ff)', border: '1px solid var(--c-info)', borderRadius: 6, fontSize: 12 }}>
                <strong>Some days weren&apos;t counted:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                  {lastDayBreakdown.filter((d) => !d.counted).map((d) => (
                    <li key={d.date}>
                      {d.date} — {d.reason === 'WEEKEND' ? 'weekend' : d.reason === 'ON_HOLIDAY' ? 'company holiday' : d.hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="al-success-actions">
              <button type="button" className="al-btn al-btn-outline" onClick={() => onClose(true)}>
                View My Leaves
              </button>
              <button
                type="button"
                className="al-btn al-btn-primary"
                onClick={() => {
                  setSubmitted(false);
                  handleReset();
                }}
              >
                Submit Another Request
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  return (
    <div className="al-overlay" {...dismissBackdrop(() => onClose(false))}>
      <div className="al-modal" role="dialog" aria-modal="true">
        {/* Confirmation overlay */}
        {showConfirm && (
          <div className="al-confirm-panel">
            <div className="al-confirm-card">
              <h3 className="al-confirm-title">Confirm {MODAL_TITLES[type]}</h3>
              {showLeaveType && (
                <div className="al-confirm-row">
                  <span className="al-confirm-row-label">Leave Type</span>
                  <span className="al-confirm-row-value">{leaveType?.label}</span>
                </div>
              )}
              {showClaimType && (
                <div className="al-confirm-row">
                  <span className="al-confirm-row-label">Claim Type</span>
                  <span className="al-confirm-row-value">
                    {claimTypeItems.find((t) => t.code === claimType)?.leave_type || claimType}
                  </span>
                </div>
              )}
              <div className="al-confirm-row">
                <span className="al-confirm-row-label">Dates</span>
                <span className="al-confirm-row-value">
                  {isClaimType
                    ? selectedClaimDates.map((d) => fmtShort(d)).join(', ') || '\u2014'
                    : startDate ? fmtDate(startDate) : '\u2014'}
                  {!isClaimType && end && dateStr(end) !== dateStr(startDate) ? ` \u2192 ${fmtDate(end)}` : ''}
                </span>
              </div>
              {!isClaimType && (
              <div className="al-confirm-row">
                <span className="al-confirm-row-label">Duration</span>
                <span className="al-confirm-row-value">
                  {isMultiDay
                    ? `${bizDays} business day${bizDays !== 1 ? 's' : ''}`
                    : duration === 'full'
                      ? 'Full Day'
                      : duration === 'morning'
                        ? 'Morning (First Half)'
                        : 'Afternoon (Second Half)'}
                </span>
              </div>
              )}
              <div className="al-confirm-row">
                <span className="al-confirm-row-label">Requested Days</span>
                <span className="al-confirm-row-value">
                  {charged} day{charged !== 1 ? 's' : ''}
                </span>
              </div>
              {showLeaveType && (
                <div className="al-confirm-row">
                  <span className="al-confirm-row-label">Remaining Balance</span>
                  <span
                    className="al-confirm-row-value"
                    style={{
                      color:
                        !isUnlimitedSel && remaining <= 0
                          ? 'var(--c-danger)'
                          : 'var(--c-success)',
                    }}
                  >
                    {isUnlimitedSel ? 'Unlimited' : `${remaining} day${remaining !== 1 ? 's' : ''}`}
                  </span>
                </div>
              )}
              {requiresJustification && quotaInfo && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--c-danger-light)', border: '1px solid var(--c-danger)', borderRadius: '6px' }}>
                  <div className="al-confirm-row-label" style={{ marginBottom: 8, color: 'var(--c-danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} />
                    {quotaInfo.billing_note}
                  </div>
                  <textarea
                    className="al-textarea"
                    style={{ width: '100%', minHeight: '60px', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)', fontSize: '13px' }}
                    placeholder="Please provide a justification for this excess offshore work..."
                    value={justificationText}
                    onChange={(e) => setJustificationText(e.target.value)}
                  />
                </div>
              )}
              <div className="al-confirm-actions">
                <button
                  type="button"
                  className="al-btn al-btn-ghost"
                  onClick={() => {
                    setShowConfirm(false);
                    setRequiresJustification(false);
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  className="al-btn al-btn-primary"
                  disabled={isSubmitting || (requiresJustification && !justificationText.trim())}
                  onClick={async () => {
                    try {
                      setIsSubmitting(true);
                      
                      let backendLeaveType = '';
                      if (type === 'wfh') backendLeaveType = 'WFH';
                      else if (type === 'offshore') backendLeaveType = 'OW';
                      // claimType already holds the real leave_type_code
                      // (e.g. 'CWW', 'CCompOff', or any custom Claim type
                      // HR created) — sourced straight from the
                      // eligible-leave-types API, same as leaveType.code
                      // below.
                      else if (type === 'compoff') backendLeaveType = claimType;
                      else if (showLeaveType && leaveType) {
                        // leaveType.code/id is the real backend leave-type code
                        // (sourced from the eligible-leave-types API), so it can
                        // be used directly.
                        backendLeaveType = leaveType.code || leaveType.id || 'AL';
                      }

                      const basePayload = {
                        emp_id: applyFor === 'behalf' && behalfEmp ? behalfEmp.id : user?.emp_id,
                        leave_type: backendLeaveType,
                        // Claims use `dates` (an explicit list) instead of
                        // a range — see ClaimSubmitSerializer on the
                        // backend for why a range doesn't fit.
                        ...(isClaimType
                          ? { dates: selectedClaimDates.map(dateStr) }
                          : {
                              start_date: dateStr(startDate),
                              end_date: end ? dateStr(end) : dateStr(startDate),
                            }),
                        reason: reason || (type === 'compoff' ? 'Claim' : ''),
                        duration: duration === 'morning' ? 'FIRST_HALF' : duration === 'afternoon' ? 'SECOND_HALF' : 'FULL_DAY'
                      };
                      if (type === 'offshore' && requiresJustification) {
                        basePayload.justification = justificationText;
                      }
                      if (needsFlexJustification && flexJustification.trim()) {
                        basePayload.justification = flexJustification.trim();
                      }

                      if (applyFor === 'behalf') {
                        basePayload.manager_id = user?.emp_id;
                      }
                      
                      if (applyFor === 'behalf') {
                        const res = await leaveService.applyLeaveOnBehalf(basePayload);
                        setLastDayBreakdown(res?.day_breakdown || null);
                      } else {
                        if (type === 'offshore') {
                          const res = await leaveService.applyOwLeave(basePayload);
                          if (res?.requires_justification && !basePayload.justification) {
                            setRequiresJustification(true);
                            setQuotaInfo(res.quota_info);
                            setIsSubmitting(false);
                            return;
                          }
                          setLastDayBreakdown(res?.day_breakdown || null);
                        } else if (type === 'wfh') {
                          // WFH now goes through the same generic apply
                          // endpoint as regular leave (leave_type: 'WFH'
                          // in the payload already carries this) instead
                          // of its own dedicated request-wfh endpoint.
                          const res = await leaveService.applyLeave(basePayload);
                          setLastDayBreakdown(res?.day_breakdown || null);
                        } else if (type === 'compoff') {
                          // Generic claim submission — works for any
                          // Claim-category leave type, not just CWW/CCompOff.
                          await leaveService.claimSubmit({
                            emp_id: basePayload.emp_id,
                            leave_type_code: backendLeaveType,
                            dates: basePayload.dates,
                            reason: basePayload.reason,
                          });
                        } else {
                          const res = await leaveService.applyLeave(basePayload);
                          setLastDayBreakdown(res?.day_breakdown || null);
                        }
                      }

                      setShowConfirm(false);
                      setSubmitted(true);
                      toast.success(SUCCESS_TITLES[type]);
                      // On-behalf leaves: the backend sends a notification to the
                      // employee's WS channel, not the manager's. Refresh our
                      // notifications list via REST so the manager sees it too.
                      if (applyFor === 'behalf') {
                        window.dispatchEvent(new Event('notification:refresh'));
                      }
                      setRequiresJustification(false);
                      setJustificationText('');
                      setQuotaInfo(null);
                      setFlexJustification('');
                    } catch (error) {
                      const msg = error.response?.data?.error || error.response?.data?.message || 'Failed to submit request. Please try again.';
                      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                >
                  <Check className="al-btn-icon" /> {isSubmitting ? 'Submitting...' : 'Confirm & Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="al-header">
          <div className="al-header-left">
            <h2 className="al-title">{MODAL_TITLES[type]}</h2>
          </div>
          <button type="button" className="al-close-btn" onClick={() => onClose(false)}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="al-body">
          <div className="al-body-inner">
            {/* ── Form ──────────────────────────────────────────────────── */}
            <div className="al-form-col">
              {/* Apply For + Employee row */}
              {isAdmin ? (
                <>
                  <div className="al-apply-for-row">
                    <span className="al-apply-for-label">Apply for</span>
                    <div className="al-segmented">
                      {['self', 'behalf'].map((v) => (
                        <button
                          key={v}
                          type="button"
                          className="al-seg-btn"
                          data-active={applyFor === v}
                          onClick={() => setApplyFor(v)}
                        >
                          {v === 'self' ? 'Myself' : 'On Behalf'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {applyFor === 'behalf' && (
                    <div className="al-employee-row">
                      <span className="al-employee-row-label">Employee</span>
                      {behalfEmp ? (
                        <div className="al-emp-pill" style={{ flex: 1 }}>
                          <div className="al-emp-pill-avatar">{initials(behalfEmp.name)}</div>
                          <span className="al-emp-pill-name">{behalfEmp.name}</span>
                          <span className="al-emp-pill-dept">· {behalfEmp.department}</span>
                          <button
                            type="button"
                            className="al-emp-pill-clear"
                            onClick={() => setBehalfEmp(null)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ flex: 1 }}>
                          <Select
                            value={behalfEmp ? behalfEmp.id : ''}
                            onChange={(val) =>
                              setBehalfEmp(empItems.find((e) => e.id === val) ?? null)
                            }
                            placeholder="Select employee…"
                            options={empItems.map((e) => ({ value: e.id, label: e.name }))}
                            width="manager"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : null}

              {/* Leave Type — only for 'leave' */}
              {showLeaveType && (
                <div className="al-form-group">
                  <span className="al-label al-label-required">Leave Type</span>
                  <Select
                    value={leaveType ? leaveType.id : ''}
                    onChange={(val) => {
                      const matched = ltItems.find((item) => item.id === val);
                      setLeaveType(matched || null);
                      setAttachments([]);
                    }}
                    placeholder="Select leave type…"
                    options={ltItems.map((item) => ({ value: item.id, label: item.label }))}
                    width="leaveType"
                  />
                </div>
              )}

              {/* Claim Type — generic, lists every active Claim-category
                  leave type the employee is eligible for (not just
                  CWW/CCompOff) */}
              {showClaimType && (
                <div className="al-form-group">
                  <span className="al-label al-label-required">Claim Type</span>
                  <Select
                    value={claimType ?? ''}
                    onChange={(v) => {
                      setClaimType(v);
                      // Previously-selected dates may not qualify under
                      // the newly-chosen type's rule — clear them rather
                      // than silently submit a mismatch.
                      setSelectedClaimDates([]);
                      setPendingClaimDate(null);
                    }}
                    placeholder={
                      claimTypeItems.length === 0
                        ? 'No claim types available'
                        : 'Select claim type…'
                    }
                    options={claimTypeItems.map((t) => ({ value: t.code, label: t.leave_type }))}
                    width="leaveType"
                  />
                </div>
              )}

              {/* Dates — a range for Leave/WFH/OW, an explicit multi-select
                  of individual dates for Claims (see selectedClaimDates) */}
              {!isClaimType ? (
                <div className="al-row-2">
                  <div className="al-form-group">
                    <span className="al-label al-label-required">Start Date</span>
                    <DatePicker
                      value={startDate}
                      onChange={(d) => {
                        setStartDate(d);
                        if (d && endDate && endDate < d) setEndDate(null);
                      }}
                      minDate={today}
                      isDateDisabled={(d) => isNonWorkingDay(d, calendarDayMap) || isOverlapBlocked(d, calendarDayMap)}
                      placeholder="Select start date"
                      width="100%"
                    />
                  </div>
                  <div className="al-form-group">
                    <label className="al-label">
                      End Date{' '}
                      <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>(optional)</span>
                    </label>
                    <DatePicker
                      value={endDate}
                      onChange={(d) => setEndDate(d)}
                      minDate={startDate || today}
                      isDateDisabled={(d) => isNonWorkingDay(d, calendarDayMap) || isOverlapBlocked(d, calendarDayMap)}
                      placeholder="Select end date"
                      width="100%"
                    />
                  </div>
                </div>
              ) : (
                <div className="al-form-group">
                  <span className="al-label al-label-required">Claim Date(s)</span>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <DatePicker
                      value={pendingClaimDate}
                      onChange={setPendingClaimDate}
                      maxDate={new Date(today.getTime() - 864e5)}
                      isDateDisabled={
                        claimType && claimEligibleDates
                          ? (d) => !claimEligibleDates.includes(dateStr(d))
                          : undefined
                      }
                      placeholder={claimType ? 'Select a date' : 'Select a claim type first'}
                      disabled={!claimType}
                      width="220px"
                    />
                    <button
                      type="button"
                      className="al-btn al-btn-outline"
                      disabled={!pendingClaimDate}
                      onClick={() => {
                        if (!pendingClaimDate) return;
                        const key = dateStr(pendingClaimDate);
                        setSelectedClaimDates((prev) =>
                          prev.some((d) => dateStr(d) === key)
                            ? prev
                            : [...prev, pendingClaimDate].sort((a, b) => a - b),
                        );
                        setPendingClaimDate(null);
                      }}
                    >
                      <Plus className="al-btn-icon" /> Add
                    </button>
                  </div>
                  {claimType && claimEligibleDates && claimEligibleDates.length === 0 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-tertiary)' }}>
                      No claimable dates found for this type in the last 12 months.
                    </div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                    {selectedClaimDates.length === 0 ? (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        No dates added yet.
                      </span>
                    ) : (
                      selectedClaimDates.map((d) => (
                        <span
                          key={dateStr(d)}
                          className="al-sum-type-badge"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                        >
                          {fmtShort(d)}
                          <button
                            type="button"
                            aria-label={`Remove ${dateStr(d)}`}
                            onClick={() =>
                              setSelectedClaimDates((prev) => prev.filter((x) => dateStr(x) !== dateStr(d)))
                            }
                            style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'inline-flex', padding: 0 }}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Duration — only for leave/wfh */}
              {showDuration && startDate && (
                <div className="al-form-group">
                  <span className="al-label">Duration Selection</span>
                  {isMultiDay ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '10px', backgroundColor: 'var(--bg-secondary)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Customize leave hours for each business day in the range:
                      </div>
                      {(() => {
                        const bizDaysArr = eachDay(startDate, end).filter(day => {
                          return !isRealWeekend(day, calendarDayMap) && !isRealHoliday(day, calendarDayMap);
                        });

                        return bizDaysArr.map((day, index) => {
                          const dStr = dateStr(day);
                          const isStartDay = index === 0;
                          const isEndDay = index === bizDaysArr.length - 1;
                          const isMiddleDay = !isStartDay && !isEndDay;
                          const currentVal = dailyConfigs[dStr] || 'full';

                          return (
                            <div key={dStr} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--surface-primary)', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                              <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>
                                {fmtShort(day)}
                              </span>
                              <div className="al-duration-chips" style={{ margin: 0, gap: '4px' }}>
                                {[
                                  ['full', 'Full Day'],
                                  ['morning', '1st Half'],
                                  ['afternoon', '2nd Half'],
                                ].map(([val, lbl]) => {
                                  let isDisabled = false;
                                  if (bizDaysArr.length > 1) {
                                    isDisabled = 
                                      (isMiddleDay && val !== 'full') ||
                                      (isStartDay && val === 'morning') ||
                                      (isEndDay && val === 'afternoon');
                                  }
                                  
                                  return (
                                    <button
                                      key={val}
                                      type="button"
                                      className="al-duration-chip"
                                      style={{ 
                                        padding: '3px 8px', 
                                        fontSize: '11px', 
                                        opacity: isDisabled ? 0.4 : 1, 
                                        cursor: isDisabled ? 'not-allowed' : 'pointer' 
                                      }}
                                      data-active={currentVal === val}
                                      disabled={isDisabled}
                                      onClick={() => {
                                        if (!isDisabled) setDailyConfigs(prev => ({ ...prev, [dStr]: val }));
                                      }}
                                    >
                                      {lbl}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className="al-duration-chips">
                      {[
                        ['full', 'Full Day'],
                        ['morning', 'Morning'],
                        ['afternoon', 'Afternoon'],
                      ].map(([val, lbl]) => (
                        <button
                          key={val}
                          type="button"
                          className="al-duration-chip"
                          data-active={duration === val}
                          onClick={() => {
                            setDuration(val);
                            const dStr = dateStr(startDate);
                            setDailyConfigs({ [dStr]: val });
                          }}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reason */}
              {showReason && (
                <div className="al-form-group">
                  <span className="al-label al-label-required">{reasonLabel}</span>
                  <textarea
                    className="al-textarea"
                    placeholder={
                      type === 'compoff'
                        ? 'Briefly describe the reason for this claim\u2026'
                        : type === 'wfh'
                          ? 'Briefly describe the reason for working from home\u2026'
                          : type === 'offshore'
                            ? 'Briefly describe the reason for this offshore work request\u2026'
                            : 'Briefly describe the reason for this leave request\u2026'
                    }
                    maxLength={400}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ minHeight: 66 }}
                  />
                  <span className={`al-char-counter${reason.length > 360 ? ' al-char-warn' : ''}`}>
                    {reason.length}/400
                  </span>
                </div>
              )}

              {/* Flexible-entitlement justification — required when this
                  request exceeds the available balance for a Flexible-mode
                  leave type. */}
              {needsFlexJustification && (
                <div className="al-form-group">
                  <span className="al-label al-label-required">Justification</span>
                  <div
                    style={{
                      marginBottom: 6,
                      padding: '8px 10px',
                      background: 'var(--c-danger-light)',
                      border: '1px solid var(--c-danger)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: 'var(--c-danger)',
                      fontSize: 12,
                    }}
                  >
                    <AlertTriangle size={14} />
                    This request exceeds your available balance. Please provide a reason.
                  </div>
                  <textarea
                    className={`al-textarea${!flexJustification.trim() ? ' has-error' : ''}`}
                    placeholder="Explain why this request should be allowed despite exceeding your balance…"
                    maxLength={400}
                    value={flexJustification}
                    onChange={(e) => setFlexJustification(e.target.value)}
                    style={{ minHeight: 66 }}
                  />
                  {!flexJustification.trim() && (
                    <span className="al-field-error" style={{ color: 'var(--c-danger)', fontSize: 11 }}>
                      Justification is required to submit this request.
                    </span>
                  )}
                </div>
              )}

              {/* Attachment — conditional */}
              {leaveType?.requiresAttachment && (
                <div className="al-form-group">
                  <span className="al-label">
                    Supporting Document
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'var(--c-warning)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.4px',
                      }}
                    >
                      Required
                    </span>
                  </span>
                  <div
                    className="al-upload-zone"
                    {...activatable(() => fileInputRef.current?.click(), {
                      label: 'Choose files to attach',
                    })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      setAttachments((p) => [...p, ...Array.from(e.dataTransfer.files)]);
                    }}
                  >
                    <Upload className="al-upload-icon" />
                    <div className="al-upload-text-wrap">
                      <p className="al-upload-text">
                        <strong>Click to upload</strong> or drag & drop
                      </p>
                      <p className="al-upload-hint">PDF, PNG, JPG — max 10 MB</p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      if (e.target.files)
                        setAttachments((p) => [...p, ...Array.from(e.target.files)]);
                    }}
                  />
                  {attachments.length > 0 && (
                    <div className="al-upload-files">
                      {attachments.map((f, i) => (
                        <div key={i} className="al-upload-file">
                          <FileText className="al-upload-file-icon" />
                          <span
                            style={{
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {f.name}
                          </span>
                          <span style={{ color: 'var(--text-tertiary)', fontSize: 10 }}>
                            {(f.size / 1024).toFixed(0)} KB
                          </span>
                          <button
                            type="button"
                            className="al-upload-file-remove"
                            onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Calendar — Claims use the multi-select date list above
                  instead (a grid isn't a great fit for non-contiguous
                  date selection) */}
              {!isClaimType && (
                <div>
                  <InlineCalendar
                    year={calYear}
                    month={calMonth}
                    startDate={startDate}
                    endDate={endDate}
                    hoverDate={hoverDate}
                    onDayClick={handleDayClick}
                    onDayHover={setHoverDate}
                    onPrev={prevMonth}
                    onNext={nextMonth}
                    dateMode="future"
                    calendarDayMap={calendarDayMap}
                    restrictToWorkingDays
                  />
                </div>
              )}
            </div>

            {/* ── Summary ────────────────────────────────────────────────── */}
            <div className="al-summary-col">
              <div className="al-sum-header">
                <Calendar className="al-sum-header-icon" />
                <h4 className="al-sum-header-title">
                  {type === 'leave'
                    ? 'Leave Summary'
                    : type === 'wfh'
                      ? 'WFH Summary'
                      : type === 'offshore'
                        ? 'Offshore Summary'
                        : 'Claim Summary'}
                </h4>
              </div>

              <div className="al-sum-body">
                {/* Leave type + dates */}
                <div className="al-sum-section">
                  {showClaimType ? (
                    claimType ? (
                      <div className="al-sum-type-badge">
                        {claimTypeItems.find((t) => t.code === claimType)?.leave_type || claimType}
                      </div>
                    ) : (
                      <div className="al-sum-type-empty">No claim type selected</div>
                    )
                  ) : !showLeaveType ? (
                    <div className="al-sum-type-badge">{MODAL_TITLES[type]}</div>
                  ) : leaveType ? (
                    <div className="al-sum-type-badge">{leaveType.label}</div>
                  ) : (
                    <div className="al-sum-type-empty">No leave type selected</div>
                  )}
                  {startDate && (
                    <div className="al-sum-dates">
                      {fmtShort(startDate)}
                      {end && dateStr(end) !== dateStr(startDate) ? (
                        <>
                          <span className="al-sum-dates-arrow">→</span>
                          {fmtShort(end)}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}> (single day)</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Duration breakdown */}
                <div className="al-sum-section">
                  <p className="al-sum-section-title">Duration</p>
                  {[
                    ['Requested', reqDays > 0 ? `${reqDays}d` : '\u2014', ''],
                    ['Business', bizDays > 0 ? `${bizDays}d` : '\u2014', ''],
                    ['Weekends', wkndDays > 0 ? `${wkndDays}d` : '\u2014', 'v-muted'],
                    [
                      'Holidays',
                      holCount > 0 ? `${holCount}d` : 'None',
                      holCount > 0 ? 'v-warn' : 'v-muted',
                    ],
                    [
                      'Charged',
                      charged > 0
                        ? `${charged}d`
                        : '\u2014',
                      '',
                    ],
                  ].map(([l, v, c]) => (
                    <div key={l} className="al-sum-row">
                      <span className="al-sum-label">{l}</span>
                      <span className={`al-sum-value ${c}`}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Claims don't carry their own balance — approval credits
                    a separate entitlement instead (see Credits To in the
                    leave type's policy), so a numeric balance here would
                    just be a misleading always-zero. */}
                {isClaimType && (
                  <div className="al-sum-section">
                    <p className="al-sum-section-title">Balance</p>
                    <p className="al-policy-hint">
                      Claims don&apos;t carry their own balance — approval credits a
                      separate leave type&apos;s entitlement instead.
                    </p>
                  </div>
                )}

                {/* Balance — for the selected/implicit leave type */}
                {(showLeaveType || !!effectiveLeaveType) && !isClaimType && (
                  <div className="al-sum-section">
                    <p className="al-sum-section-title">Balance</p>
                    <div className="al-sum-row">
                      <span className="al-sum-label">Available</span>
                      <span className="al-sum-value">
                        {effectiveLeaveType ? (isUnlimitedSel ? 'Unlimited' : `${avail}d`) : '\u2014'}
                      </span>
                    </div>
                    <div className="al-sum-row">
                      <span className="al-sum-label">Requested</span>
                      <span className="al-sum-value">{charged > 0 ? `${charged}d` : '\u2014'}</span>
                    </div>
                    <div className="al-sum-row">
                      <span className="al-sum-label">Remaining</span>
                      <span
                        className={`al-sum-value ${effectiveLeaveType && charged > 0 && !isUnlimitedSel && remaining <= 0 ? 'v-danger' : effectiveLeaveType && charged > 0 ? 'v-success' : ''}`}
                      >
                        {effectiveLeaveType && charged > 0
                          ? isUnlimitedSel
                            ? 'Unlimited'
                            : `${remaining}d`
                          : '\u2014'}
                      </span>
                    </div>
                    {effectiveLeaveType && !isUnlimitedSel && (
                      <div className="al-bal-bar-track">
                        <div
                          className={`al-bal-bar-fill ${barClass()}`}
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Validations */}
                {validations.length > 0 && (
                  <div className="al-sum-section">
                    <p className="al-sum-section-title">Validation</p>
                    <div className="al-val-list">
                      {validations.map((v) => (
                        <div key={v.key} className={`al-val-row v-${v.status}`}>
                          {v.status === 'ok' && <Check className="al-val-icon" />}
                          {v.status === 'warn' && <AlertTriangle className="al-val-icon" />}
                          {v.status === 'error' && <AlertCircle className="al-val-icon" />}
                          {v.status === 'info' && <Info className="al-val-icon" />}
                          {v.label}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approval flow */}
                {startDate && (
                  <div className="al-sum-section">
                    <p className="al-sum-section-title">Approval Flow</p>
                    <div className="al-approval-steps">
                      {[
                        { label: activeEmp.name, role: 'Applicant', done: true },
                        { label: activeEmp.manager, role: 'Reporting Manager', done: false },
                        { label: 'HR Department', role: 'Final Approval', done: false },
                      ].map((s, i) => (
                        <div key={i} className="al-approval-step">
                          <div className={`al-approval-dot ${s.done ? 'done' : 'pending'}`}>
                            {s.done ? <Check size={9} /> : i + 1}
                          </div>
                          <div className="al-approval-info">
                            <span className="al-approval-name">{s.label}</span>
                            <span className="al-approval-role">{s.role}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Policy note — skipped for Claims: notice/max-consecutive/
                    carry-forward are configured on the claim type's own
                    policy record but aren't actually enforced for claims
                    (approval-gated by the manager instead), so showing
                    them here would be misleading. */}
                {!!effectiveLeaveType && !isClaimType && (
                  <div className="al-sum-section">
                    <p className="al-sum-section-title">Policy</p>
                    {[
                      ['Notice', effectiveLeaveType.noticePeriod],
                      [
                        'Max consec.',
                        Number.isFinite(effectiveLeaveType.maxConsecutive)
                          ? `${effectiveLeaveType.maxConsecutive}d`
                          : 'No limit',
                      ],
                      ['Carry fwd', effectiveLeaveType.carryForward ? 'Yes' : 'No'],
                    ].map(([l, v]) => (
                      <div key={l} className="al-sum-row">
                        <span className="al-sum-label">{l}</span>
                        <span className="al-sum-value" style={{ fontWeight: 500 }}>
                          {v}
                        </span>
                      </div>
                    ))}
                    {effectiveLeaveType.policy && (
                      <p className="al-policy-hint">{effectiveLeaveType.policy}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="al-footer">
          <div className="al-footer-left">
            {hasError && (
              <span className="al-footer-status error">
                <AlertCircle size={12} /> Resolve errors to continue
              </span>
            )}
            {!hasError && canSubmit && (
              <span className="al-footer-status ok">
                <Check size={12} /> Ready to submit
              </span>
            )}
          </div>
          <div className="al-footer-right">
            <button type="button" className="al-btn al-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="al-btn al-btn-outline" onClick={handleReset}>
              <RotateCcw className="al-btn-icon" /> Reset
            </button>
            <button
              type="button"
              className="al-btn al-btn-primary"
              onClick={() => setShowConfirm(true)}
            >
              <Check className="al-btn-icon" /> {SUBMIT_LABELS[type]}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
export { ApplyLeaveModal };
export default ApplyLeaveModal;