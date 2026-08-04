import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { leaveService } from '@services/leaveService';
import {
  X,
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
  LEAVE_APPLICATION_EMPLOYEES as EMPLOYEES,
  LEAVE_TYPES,
  PUBLIC_HOLIDAYS,
} from '@mocks/data/leaveApplication';
import { activatable, dismissBackdrop } from '@utils/interactive';

import './ApplyLeaveModal.css';
function dateStr(d) {
  return d.toISOString().slice(0, 10);
}
function isSaudiWeekend(d) {
  const w = d.getDay();
  return w === 5 || w === 6;
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
function countBiz(s, e) {
  return eachDay(s, e).filter((d) => !isSaudiWeekend(d) && !PUBLIC_HOLIDAYS.includes(dateStr(d)))
    .length;
}
function countHols(s, e, holidays = PUBLIC_HOLIDAYS) {
  return eachDay(s, e).filter((d) => holidays.includes(dateStr(d)) && !isSaudiWeekend(d)).length;
}
function countWknd(s, e) {
  return eachDay(s, e).filter((d) => isSaudiWeekend(d)).length;
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
  function dayClass(d) {
    const cls = ['al-cal-day'];
    if (d < today) cls.push('al-cal-day-past');
    if (dateStr(d) === dateStr(today)) cls.push('al-cal-day-today');
    if (isSaudiWeekend(d)) cls.push('al-cal-day-weekend');
    if (PUBLIC_HOLIDAYS.includes(dateStr(d))) cls.push('al-cal-day-holiday');
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
              {...activatable(
                () => {
                  if (d >= today) onDayClick(d);
                },
                { label: d.toDateString() },
              )}
              onMouseEnter={() => onDayHover(d)}
              onMouseLeave={() => onDayHover(null)}
            >
              <span className="al-cal-day-num">{d.getDate()}</span>
              <div className="al-cal-dots">
                {PUBLIC_HOLIDAYS.includes(dateStr(d)) && (
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
          ? 'Click a date to start selection'
          : !endDate
            ? 'Click end date or click same date for single day'
            : `${fmtShort(startDate)} \u2192 ${fmtShort(endDate)}`}
      </div>
    </div>
  );
}
function getValidations(startDate, end, lt, charged) {
  if (!startDate || !lt) return [];
  const e = end ?? startDate;
  const rows = [];
  if (lt.balance === 999) {
    rows.push({ key: 'balance', label: 'Unpaid \u2014 no balance deducted', status: 'info' });
  } else if (charged <= lt.balance) {
    rows.push({ key: 'balance', label: 'Sufficient balance available', status: 'ok' });
  } else {
    rows.push({ key: 'balance', label: 'Insufficient leave balance', status: 'error' });
  }
  const conflict = EXISTING_LEAVES.some((l) => {
    const s = dateStr(startDate);
    const ev = dateStr(e);
    return !(ev < l.start || s > l.end);
  });
  rows.push({
    key: 'overlap',
    label: conflict ? 'Overlaps existing leave' : 'No leave overlap',
    status: conflict ? 'error' : 'ok',
  });
  const wknd = countWknd(startDate, e);
  if (wknd > 0)
    rows.push({
      key: 'weekend',
      label: `${wknd} weekend day${wknd > 1 ? 's' : ''} included`,
      status: 'info',
    });
  const hols = countHols(startDate, e);
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
  if (lt.noticePeriod !== 'None' && lt.noticePeriod !== 'Same day' && diff < 3) {
    rows.push({ key: 'notice', label: `Notice period: ${lt.noticePeriod}`, status: 'warn' });
  }
  rows.push({ key: 'blackout', label: 'No blackout period conflict', status: 'ok' });
  return rows;
}
function ApplyLeaveModal({ onClose, isAdmin = true, type = 'leave' }) {
  const MODAL_TITLES = {
    leave: 'Apply Leave',
    wfh: 'Apply WFH',
    offshore: 'Apply Offshore Work',
    compoff: 'Book Comp-off / Weekend Work',
  };
  const SUBMIT_LABELS = {
    leave: 'Submit Leave',
    wfh: 'Submit WFH Request',
    offshore: 'Submit Offshore Work Request',
    compoff: 'Claim Request',
  };
  const SUCCESS_TITLES = {
    leave: 'Leave Applied Successfully',
    wfh: 'WFH Request Submitted',
    offshore: 'Offshore Work Request Submitted',
    compoff: 'Comp-off / Weekend Work Claimed',
  };
  const showLeaveType = type === 'leave';
  const showDuration = type === 'leave' || type === 'wfh';
  const showReason = type !== 'offshore';
  const showClaimType = type === 'compoff';
  const reasonLabel =
    type === 'compoff' ? 'Claim Reason' : type === 'wfh' ? 'Reason for WFH' : 'Reason';
  const { user } = useAuth();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applyFor, setApplyFor] = useState('self');
  const [behalfEmp, setBehalfEmp] = useState(null);
  const [requiresJustification, setRequiresJustification] = useState(false);
  const [justificationText, setJustificationText] = useState('');
  const [quotaInfo, setQuotaInfo] = useState(null);
  const [leaveType, setLeaveType] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [duration, setDuration] = useState('full');
  const [claimType, setClaimType] = useState('compoff');
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
  const [refNum] = useState(`LV-${Date.now().toString().slice(-6)}`);
  const activeEmp = applyFor === 'behalf' && behalfEmp ? behalfEmp : SELF;
  const end = endDate ?? startDate;
  const isMultiDay = !!(startDate && end && dateStr(startDate) !== dateStr(end));
  const reqDays = startDate && end ? eachDay(startDate, end).length : 0;
  const bizDays = startDate && end ? countBiz(startDate, end) : 0;
  const wkndDays = startDate && end ? countWknd(startDate, end) : 0;
  const holCount = startDate && end ? countHols(startDate, end) : 0;
  const charged = isMultiDay ? bizDays : duration === 'full' ? bizDays || 0 : 0.5;
  const avail = leaveType?.balance ?? 0;
  const remaining = leaveType ? Math.max(0, avail - charged) : 0;
  const barPct = avail > 0 ? Math.max(0, remaining / avail) * 100 : 100;
  const validations = useMemo(
    () => getValidations(startDate, end ?? null, leaveType, charged),
    [startDate, end, leaveType, charged],
  );
  const hasError = validations.some((v) => v.status === 'error');
  const canSubmit =
    !!startDate &&
    !hasError &&
    (applyFor === 'self' || !!behalfEmp) &&
    (!showLeaveType || !!leaveType) &&
    (!showReason || reason.trim().length > 5) &&
    (leaveType?.requiresAttachment ? attachments.length > 0 : true);
  useEffect(() => {
    if (applyFor === 'self') setBehalfEmp(null);
  }, [applyFor]);
  useEffect(() => {
    if (isMultiDay) setDuration('full');
  }, [isMultiDay]);
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
    setClaimType('compoff');
    setReason('');
    setAttachments([]);
    setBehalfEmp(null);
    setApplyFor('self');
    setRequiresJustification(false);
    setJustificationText('');
    setQuotaInfo(null);
  }
  function barClass() {
    const pct = avail > 0 ? remaining / avail : 1;
    if (pct <= 0.1) return 'bar-danger';
    if (pct <= 0.3) return 'bar-warn';
    return '';
  }
  const ltItems = LEAVE_TYPES.map((lt) => ({ ...lt }));
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
                    {claimType === 'compoff' ? 'Compensatory Off' : 'Weekend Work'}
                  </span>
                </div>
              )}
              <div className="al-confirm-row">
                <span className="al-confirm-row-label">Dates</span>
                <span className="al-confirm-row-value">
                  {startDate ? fmtDate(startDate) : '\u2014'}
                  {end && dateStr(end) !== dateStr(startDate) ? ` \u2192 ${fmtDate(end)}` : ''}
                </span>
              </div>
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
                    style={{ color: remaining <= 0 ? 'var(--c-danger)' : 'var(--c-success)' }}
                  >
                    {avail === 999 ? 'N/A' : `${remaining} day${remaining !== 1 ? 's' : ''}`}
                  </span>
                </div>
              )}
              {requiresJustification && quotaInfo && (
                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--c-danger-light, #fef2f2)', border: '1px solid var(--c-danger, #ef4444)', borderRadius: '6px' }}>
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
                      else if (type === 'compoff') backendLeaveType = claimType === 'compoff' ? 'CompOff' : 'WW';
                      else if (showLeaveType && leaveType) {
                        const m = { annual: 'AL', sick: 'SL', compoff: 'CompOff', emergency: 'AL', maternity: 'ML' };
                        backendLeaveType = m[leaveType.id] || 'AL';
                      }

                      const payload = {
                        emp_id: applyFor === 'behalf' && behalfEmp ? behalfEmp.id : user?.emp_id,
                        leave_type: backendLeaveType,
                        start_date: dateStr(startDate),
                        end_date: end ? dateStr(end) : dateStr(startDate),
                        reason: reason || (type === 'compoff' ? 'Comp-off / Weekend Work' : (type === 'offshore' ? 'Offshore Work' : '')),
                        duration: duration === 'morning' ? 'FIRST_HALF' : duration === 'afternoon' ? 'SECOND_HALF' : 'FULL_DAY'
                      };

                      if (type === 'offshore' && requiresJustification) {
                        payload.justification = justificationText;
                      }
                      
                      if (applyFor === 'behalf') {
                        payload.manager_id = user?.emp_id;
                      }
                      
                      if (applyFor === 'behalf') {
                        await leaveService.applyLeaveOnBehalf(payload);
                      } else {
                        if (type === 'offshore') {
                          const res = await leaveService.applyOwLeave(payload);
                          if (res?.requires_justification && !payload.justification) {
                            setRequiresJustification(true);
                            setQuotaInfo(res.quota_info);
                            setIsSubmitting(false);
                            return;
                          }
                        } else if (type === 'wfh') {
                          await leaveService.requestWfh(payload);
                        } else if (type === 'compoff' && claimType === 'compoff') {
                          await leaveService.claimCompOff(payload);
                        } else if (type === 'compoff' && claimType === 'weekend') {
                          await leaveService.claimWeekend(payload);
                        } else {
                          await leaveService.applyLeave(payload);
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

              {/* Claim Type — only for 'compoff' */}
              {showClaimType && (
                <div className="al-form-group">
                  <span className="al-label al-label-required">Leave Claim Type</span>
                  <Select
                    value={claimType}
                    onChange={(v) => setClaimType(v)}
                    options={[
                      { value: 'compoff', label: 'Compensatory Off' },
                      { value: 'weekend', label: 'Weekend Work' },
                    ]}
                    width="leaveType"
                  />
                </div>
              )}

              {/* Dates row */}
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
                    placeholder="Select end date"
                    width="100%"
                  />
                </div>
              </div>

              {/* Duration — only for leave/wfh */}
              {showDuration && startDate && (
                <div className="al-form-group">
                  <span className="al-label">Duration</span>
                  {isMultiDay ? (
                    <div className="al-duration-locked">
                      <div className="al-duration-locked-badge">Full Day</div>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 11 }}>
                        — applied to all selected days
                      </span>
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
                          onClick={() => setDuration(val)}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Reason — hidden for offshore */}
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

              {/* Calendar */}
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
                />
              </div>
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
                  {!showLeaveType ? (
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
                        ? duration !== 'full' && !isMultiDay
                          ? '0.5d'
                          : `${charged}d`
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

                {/* Balance — only for leave type */}
                {showLeaveType && (
                  <div className="al-sum-section">
                    <p className="al-sum-section-title">Balance</p>
                    <div className="al-sum-row">
                      <span className="al-sum-label">Available</span>
                      <span className="al-sum-value">
                        {leaveType ? (avail === 999 ? 'Unpaid' : `${avail}d`) : '\u2014'}
                      </span>
                    </div>
                    <div className="al-sum-row">
                      <span className="al-sum-label">Requested</span>
                      <span className="al-sum-value">{charged > 0 ? `${charged}d` : '\u2014'}</span>
                    </div>
                    <div className="al-sum-row">
                      <span className="al-sum-label">Remaining</span>
                      <span
                        className={`al-sum-value ${leaveType && charged > 0 && remaining <= 0 ? 'v-danger' : leaveType && charged > 0 ? 'v-success' : ''}`}
                      >
                        {leaveType && charged > 0
                          ? avail === 999
                            ? 'N/A'
                            : `${remaining}d`
                          : '\u2014'}
                      </span>
                    </div>
                    {leaveType && avail !== 999 && (
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

                {/* Policy note */}
                {showLeaveType && leaveType && (
                  <div className="al-sum-section">
                    <p className="al-sum-section-title">Policy</p>
                    {[
                      ['Notice', leaveType.noticePeriod],
                      ['Max consec.', `${leaveType.maxConsecutive}d`],
                      ['Carry fwd', leaveType.carryForward ? 'Yes' : 'No'],
                    ].map(([l, v]) => (
                      <div key={l} className="al-sum-row">
                        <span className="al-sum-label">{l}</span>
                        <span className="al-sum-value" style={{ fontWeight: 500 }}>
                          {v}
                        </span>
                      </div>
                    ))}
                    <p className="al-policy-hint">{leaveType.policy}</p>
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
              disabled={!canSubmit}
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
