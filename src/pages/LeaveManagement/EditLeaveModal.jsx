import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { useAuth } from '@hooks/useAuth';
import leaveService from '@services/leaveService';
// Aliased — this file has its own string-keyed isNonWorkingDay(d) below
// (checks calendarDayMap[dateStr]), while the shared one takes a Date
// object and dayMap directly; same name would silently shadow one or the
// other depending on declaration order.
import { InlineCalendar, dateStr, isNonWorkingDay as isNonWorkingDayCal, isOverlapBlocked } from '@components/leave/InlineCalendar';
import './EditLeaveModal.css';

// 'YYYY-MM-DD' string -> local-midnight Date, the shape InlineCalendar
// works in (never via `new Date('YYYY-MM-DD')`, which parses as UTC
// midnight and rolls back a day in any positive-UTC-offset timezone).
function parseIsoDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function EditLeaveModal({ leave, onClose, onSuccess }) {
  const { user } = useAuth();
  const toast = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form fields
  const [newStart, setNewStart] = useState(leave.start_date || '');
  const [newEnd, setNewEnd] = useState(leave.end_date || '');
  const [newReason, setNewReason] = useState(leave.leave_reason || '');
  const [newDuration, setNewDuration] = useState(leave.leave_duration || 'FULL_DAY');
  // Multi-day partial-day selection — one row per date in the range, mirroring
  // ApplyLeaveModal's per-day list. Only the From/To boundary rows can hold a
  // half-day value; every date strictly between them is locked to 'full'.
  // Keyed by ISO date string, e.g. { '2026-08-07': 'full' }. Seeded from the
  // leave's existing from/to values if present.
  const [dailyConfigs, setDailyConfigs] = useState(() => {
    const cfg = {};
    if (leave.start_date && leave.from_date_duration === 'SECOND_HALF') cfg[leave.start_date] = 'afternoon';
    if (leave.end_date && leave.to_date_duration === 'FIRST_HALF') cfg[leave.end_date] = 'morning';
    return cfg;
  });
  const [modReason, setModReason] = useState('');
  const [flexJustification, setFlexJustification] = useState('');

  // Policy + balance lookup for the leave type being modified — needed to
  // preview the balance impact of this edit (same fields ApplyLeaveModal's
  // buildLeaveTypeItem reads: isUnlimited/isFlexible gate whether exceeding
  // balance is even possible, allowNegative/maxNegativeDays gate whether
  // exceeding it borrows against next year or is a hard rejection).
  const [typeInfo, setTypeInfo] = useState(null);
  useEffect(() => {
    const empIdForLookup = leave.emp_id || user?.emp_id;
    if (!empIdForLookup) return;
    Promise.all([
      leaveService.getEligibleLeaveTypes(empIdForLookup).catch(() => []),
      leaveService.getLeaveBalance(empIdForLookup).catch(() => null),
    ]).then(([types, balanceData]) => {
      const arr = Array.isArray(types) ? types : types?.results || [];
      const match = arr.find((t) => t.code === leave.leave_type);
      const bal = balanceData?.balances?.[leave.leave_type];
      const isClaim = match?.category === 'CLAIM';
      const isUnlimited = !!(match?.is_unlimited || bal?.is_unlimited);
      setTypeInfo({
        isClaim,
        isUnlimited,
        isFlexible: !isUnlimited && !!match?.is_flexible,
        allowNegative: !isUnlimited && !match?.is_flexible && !!match?.allow_negative,
        maxNegativeDays: Number(match?.max_negative_days ?? 0),
        // Computed server-side (leaves.services._is_year_spanning_allowed).
        // Default true if missing so an older API response doesn't
        // spuriously block a year-spanning modification.
        yearSpanningAllowed: match?.year_spanning_allowed ?? true,
        // Preview of next year's real availability before it has actually
        // begun (raw next-year entitlement minus this year's still-
        // outstanding advance-leave debt) — see EligibleLeaveTypesView.
        nextYearAvailable: match?.next_year_available != null ? Number(match.next_year_available) : null,
        entitledDays: match?.entitled_days != null ? Number(match.entitled_days) : null,
        available: bal?.available != null ? Number(bal.available) : null,
        // Actual (any mode) and Nominal leave types may be self-logged/
        // edited into the past — mirrors the backend exemption in
        // leaves.services.LeaveApplyService.apply's is_backdatable_category
        // check. Category-driven, not mode-driven.
        allowPastDates: match?.category === 'ACTUAL' || match?.category === 'NOMINAL',
      });
    });
  }, [leave.emp_id, leave.leave_type, user?.emp_id]);
  // Back-compat alias — the flex-justification logic below only ever cared
  // about the Flexible case.
  const flexEntry = typeInfo?.isFlexible ? typeInfo : null;

  // The leave being edited is still PENDING (not yet approved) vs already
  // APPROVED — determines whether this edit applies immediately or creates
  // a modification request awaiting manager approval (surfaced in the
  // banner below and the submit button's label/behavior).
  const isPending = (leave.status_code || leave.status || '').toString().toUpperCase() === 'PENDING';

  // A manager/HR user modifying a report's leave (rather than their own)
  // goes through the on-behalf endpoint, which auto-approves the change
  // instead of creating a modification request awaiting approval.
  const isOnBehalf = leave.emp_id != null && user?.emp_id != null && leave.emp_id !== user.emp_id;

  // Calendar navigation + range-selection state — same InlineCalendar
  // ApplyLeaveModal uses, so editing a leave gets real weekend/holiday
  // highlighting and click-to-select instead of bare date inputs. Starts on
  // the month of the leave's current start date rather than today, so the
  // calendar opens already showing the dates being edited.
  const initialCalDate = parseIsoDate(leave.start_date) || new Date();
  const [calYear, setCalYear] = useState(initialCalDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initialCalDate.getMonth());
  const [hoverDate, setHoverDate] = useState(null);
  const startDateObj = parseIsoDate(newStart);
  const endDateObj = parseIsoDate(newEnd);
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
    // Rule 1 (Actual/Nominal Leave): the from/to boundary must be a working
    // day — Claims aren't edited through this modal, so no isClaim carve-out
    // is needed here (unlike ApplyLeaveModal's handleDayClick). Checked
    // against sanitizedDayMap (below) so this leave's own current dates
    // don't read as "blocked by itself".
    if (isNonWorkingDayCal(d, sanitizedDayMap) || isOverlapBlocked(d, sanitizedDayMap, leave.leave_type)) return;
    const clicked = dateStr(d);
    if (!startDateObj || endDateObj) {
      setNewStart(clicked);
      setNewEnd('');
    } else if (d < startDateObj) {
      setNewStart(clicked);
      setNewEnd('');
    } else if (clicked === newStart) {
      setNewEnd('');
    } else {
      setNewEnd(clicked);
    }
  }


  const effectiveEnd = newEnd || newStart;
  const isMultiDay = !!(newStart && effectiveEnd && newStart !== effectiveEnd);

  // Every date (as 'YYYY-MM-DD') from newStart to newEnd, inclusive.
  //
  // Built entirely with UTC-based Date methods (Date.UTC / getUTCDate /
  // setUTCDate / toISOString) — never local-time ones. Constructing a Date
  // from a bare 'YYYY-MM-DDT00:00:00' string parses it as LOCAL midnight;
  // toISOString() then converts to UTC, which in any timezone AHEAD of UTC
  // (e.g. IST, Gulf) rolls it back to the PREVIOUS calendar date. That
  // shifted string was used both to key dailyConfigs and to render each
  // row's label, while newStart/newEnd (read straight from the date
  // <input>, never round-tripped through Date) stayed unshifted — so
  // dailyConfigs[newStart]/[newEnd] never matched what the user actually
  // clicked, silently discarding their half-day pick as 'full' on submit.
  const rangeDays = (() => {
    if (!newStart || !effectiveEnd) return [];
    const [sy, sm, sd] = newStart.split('-').map(Number);
    const [ey, em, ed] = effectiveEnd.split('-').map(Number);
    const out = [];
    const cur = new Date(Date.UTC(sy, sm - 1, sd));
    const fin = new Date(Date.UTC(ey, em - 1, ed));
    while (cur <= fin) {
      out.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return out;
  })();

  // Re-evaluate whenever the date range changes: the option sets are
  // mutually exclusive per row-position, so a value that was valid under the
  // old shape must be reset to Full Day rather than silently submitted as
  // invalid — e.g. a middle row's half-day pick becomes invalid if the range
  // shrinks and that date is now the last (To) row.
  useEffect(() => {
    if (!isMultiDay) {
      setDailyConfigs({});
    } else {
      setNewDuration('FULL_DAY');
      setDailyConfigs((prev) => {
        const next = {};
        rangeDays.forEach((d, index) => {
          const isStartDay = index === 0;
          const isEndDay = index === rangeDays.length - 1;
          const isMiddleDay = !isStartDay && !isEndDay;
          let val = prev[d] || 'full';
          if (isMiddleDay) val = 'full';
          if (isStartDay && val === 'morning') val = 'full';
          if (isEndDay && val === 'afternoon') val = 'full';
          next[d] = val;
        });
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMultiDay, newStart, newEnd]);

  // For OW leaves, "Leave Reason" doubles as the excess-quota justification
  // if this edit pushes the leave over the 10-day OW quota — the backend
  // only actually requires it in that case, but there's no way to know that
  // in advance client-side, so just always ask for it on OW modifications.
  const isOW = leave.leave_type === 'OW';

  // Real weekend/holiday/own-request markers, same source ApplyLeaveModal
  // uses (leaveService.getCalendar) — covers the union of the visible
  // calendar month and the selected range, so both the grid display and
  // newDays below (which needs the backend's actual business-day exclusions
  // — weekends + company holidays, see leaves/utils.py
  // working_days_in_range) have data for whatever's on screen.
  const [calendarDayMap, setCalendarDayMap] = useState({});
  const [isCalendarLoading, setIsCalendarLoading] = useState(false);
  useEffect(() => {
    const empIdForLookup = leave.emp_id || user?.emp_id;
    if (!empIdForLookup) {
      setCalendarDayMap({});
      return;
    }
    let active = true;
    const monthStart = new Date(calYear, calMonth, 1);
    const monthEnd = new Date(calYear, calMonth + 1, 0);
    const effectiveEndObj = parseIsoDate(effectiveEnd);
    const rangeStart = startDateObj && startDateObj < monthStart ? startDateObj : monthStart;
    const rangeEndBound = effectiveEndObj && effectiveEndObj > monthEnd ? effectiveEndObj : monthEnd;
    setIsCalendarLoading(true);
    leaveService
      .getCalendar(empIdForLookup, { start: dateStr(rangeStart), end: dateStr(rangeEndBound) })
      .then((data) => {
        if (!active) return;
        const map = {};
        (data?.calendar || []).forEach((day) => { map[day.date] = day; });
        setCalendarDayMap(map);
        setIsCalendarLoading(false);
      })
      .catch(() => { 
        if (active) {
          setCalendarDayMap({}); 
          setIsCalendarLoading(false);
        }
      });
    return () => { active = false; };
  }, [leave.emp_id, user?.emp_id, calYear, calMonth, newStart, effectiveEnd]);
  // The calendar endpoint has no "exclude this leave" filter, so this
  // leave's own current dates come back as an own_request too — strip
  // those before checking/rendering overlap, or every one of its own days
  // would look "blocked by itself" (own_request.category 'LEAVE' always
  // blocks — see isOverlapBlockedForOwn).
  const sanitizedDayMap = (() => {
    const out = {};
    for (const [date, info] of Object.entries(calendarDayMap)) {
      out[date] = info?.own_request?.leave_id === leave.id
        ? { ...info, own_request: null }
        : info;
    }
    return out;
  })();
  const isNonWorkingDay = (d) => {
    const info = calendarDayMap[d];
    return !!(info?.is_weekend || info?.is_org_holiday);
  };

  // Day count for the newly requested range — excludes weekends/company
  // holidays (matching the backend's business-day count) and halves for a
  // same-day or boundary half-day duration.
  const newDays = (() => {
    if (!newStart || !effectiveEnd) return 0;
    if (newStart === effectiveEnd) {
      if (isNonWorkingDay(newStart)) return 0;
      return newDuration !== 'FULL_DAY' ? 0.5 : 1;
    }
    return rangeDays.reduce((sum, d) => {
      if (isNonWorkingDay(d)) return sum;
      return sum + ((dailyConfigs[d] || 'full') === 'full' ? 1 : 0.5);
    }, 0);
  })();
  // business_days/in_days are the actual field names the leave API returns
  // (see LeaveSerializer) — total_days/no_of_days never exist on the raw
  // leave object, which silently zeroed this out and broke the "release
  // this leave's own days before checking the new total" balance math.
  const originalDays = Number(leave.business_days ?? leave.in_days ?? 0);
  // Incremental days this edit adds beyond what's already booked — comparing
  // the delta (not the raw new total) against available balance, since the
  // original days are already reflected as "used" in that balance.
  const incrementalDays = newDays - originalDays;
  const needsFlexJustification =
    !!flexEntry && flexEntry.available != null && incrementalDays > flexEntry.available;

  // Balance-impact preview — mirrors the backend's actual check
  // (LeaveApplyService._check_balance / _create_mod_request's pre-check):
  // this leave's OWN original days are already counted as used/pending in
  // `available`, so releasing them back first (available + originalDays)
  // before comparing against the new day count is what makes this an
  // accurate preview of a same-leave edit, not a fresh second request.
  const effectiveAvailable =
    typeInfo && typeInfo.available != null ? typeInfo.available + originalDays : null;

  // Year-spanning shape computed up front — the balance check below must
  // only ever compare the CURRENT-year portion of newDays against this
  // year's available/cap, mirroring leaves.services._check_balance_year_spanning's
  // cy_days/ny_days split. Using the full cross-year newDays there would
  // check the wrong year's cap against the current year's balance.
  const startYear = newStart ? Number(newStart.slice(0, 4)) : null;
  const endYear = effectiveEnd ? Number(effectiveEnd.slice(0, 4)) : null;
  const crossesBoundary = !!(startYear && endYear) && endYear > startYear;
  const today = new Date();
  const entirelyFutureYear = !!startYear && !crossesBoundary && startYear > today.getFullYear();
  const nyBizDaysForCy = crossesBoundary
    ? rangeDays.filter((d) => Number(d.slice(0, 4)) > startYear && !isNonWorkingDay(d)).length
    : 0;
  const cyNewDays = entirelyFutureYear ? 0 : crossesBoundary ? Math.max(0, newDays - nyBizDaysForCy) : newDays;

  const balanceStatus = (() => {
    if (!typeInfo || typeInfo.isClaim) return null; // no balance concept for Claim types
    if (effectiveAvailable == null) return null; // still loading
    if (typeInfo.isUnlimited) {
      return { status: 'info', label: 'Unlimited — no balance deducted' };
    }
    if (cyNewDays <= effectiveAvailable) {
      return {
        status: 'ok',
        label: `Sufficient balance — ${(effectiveAvailable - cyNewDays).toFixed(1)} day(s) will remain`,
      };
    }
    if (typeInfo.isFlexible) {
      return { status: 'warn', label: 'Exceeds available balance — justification required' };
    }
    if (typeInfo.allowNegative) {
      const projectedDebt = cyNewDays - effectiveAvailable;
      if (projectedDebt <= typeInfo.maxNegativeDays) {
        return {
          status: 'warn',
          label: `Exceeds balance — ${projectedDebt.toFixed(1)} day(s) borrowed against next year (max ${typeInfo.maxNegativeDays})`,
        };
      }
      const remainingAdvance = Math.max(0, typeInfo.maxNegativeDays + Math.min(0, effectiveAvailable));
      const alreadyBorrowed = Math.max(0, -effectiveAvailable);
      return {
        status: 'error',
        label: alreadyBorrowed > 0
          ? `Exceeds remaining advance of ${remainingAdvance.toFixed(1)} day(s) (${alreadyBorrowed.toFixed(1)} of ${typeInfo.maxNegativeDays} already borrowed)`
          : `Exceeds max advance of ${typeInfo.maxNegativeDays} day(s)`,
      };
    }
    return { status: 'error', label: 'Insufficient leave balance' };
  })();
  const hasBalanceError = balanceStatus?.status === 'error';

  // Year-spanning: crossing into next year, or landing entirely within a
  // future year, only if this leave type's policy allows it (computed
  // server-side — see leaves.services._is_year_spanning_allowed).
  const yearSpanningStatus = (() => {
    if (!typeInfo || typeInfo.isClaim || !newStart || !effectiveEnd) return null;
    if (!crossesBoundary && !entirelyFutureYear) return null;
    if (!typeInfo.yearSpanningAllowed) {
      return {
        status: 'error',
        label: crossesBoundary
          ? `${leave.leave_type} does not allow requests spanning into next year`
          : `${leave.leave_type} does not allow requests made entirely within a future year`,
      };
    }
    if (typeInfo.nextYearAvailable == null) return null;
    // Preview against next year's REAL expected availability (raw
    // entitlement minus this year's still-outstanding advance-leave debt)
    // — the next-year portion can never itself borrow, regardless of
    // allowNegative. Mirrors the backend's _future_year_check_kwargs.
    const nyCharged = entirelyFutureYear ? newDays : nyBizDaysForCy;
    // typeInfo.nextYearAvailable is a static snapshot (this year's EXISTING
    // outstanding advance debt only) — it doesn't know about the additional
    // debt THIS edit's own current-year portion would create. Discount it
    // further, mirroring the backend's _check_balance_year_spanning
    // projected_cy_debt fix, so the preview simulates the post-approval
    // state. Only applies to crossesBoundary.
    const existingDebt = Math.max(0, -effectiveAvailable);
    const newDebt = Math.max(0, -(effectiveAvailable - cyNewDays));
    const additionalDebtCreated = crossesBoundary ? Math.max(0, newDebt - existingDebt) : 0;
    const effectiveNextYearAvailable = typeInfo.nextYearAvailable - additionalDebtCreated;
    if (nyCharged > effectiveNextYearAvailable) {
      return {
        status: 'error',
        label: `Next year's available balance is ${effectiveNextYearAvailable.toFixed(1)}d (after this year's outstanding advance) — requesting ${nyCharged.toFixed(1)}d`,
      };
    }
    if (crossesBoundary) {
      return {
        status: 'info',
        label: `${nyCharged.toFixed(1)}d next year, within the ${effectiveNextYearAvailable.toFixed(1)}d expected available`,
      };
    }
    return null;
  })();
  const hasYearSpanningError = yearSpanningStatus?.status === 'error';

  const handleSubmit = async () => {
    if (!newStart || !effectiveEnd) {
      toast.error('Start and end dates are required');
      return;
    }
    if (hasBalanceError) {
      toast.error(balanceStatus.label);
      return;
    }
    if (hasYearSpanningError) {
      toast.error(yearSpanningStatus.label);
      return;
    }
    if (isOW && !newReason.trim()) {
      toast.error('Leave Reason is required for Offshore Work — it doubles as the justification if this pushes you over quota.');
      return;
    }
    if (needsFlexJustification && !flexJustification.trim()) {
      toast.error('This request exceeds your available balance. Please provide a justification.');
      return;
    }

    try {
      setIsSubmitting(true);
      let res;

      const justificationField = needsFlexJustification && flexJustification.trim()
        ? { justification: flexJustification.trim() }
        : {};
      // Single-day: unchanged legacy `new_duration` field. Multi-day: the
      // two new boundary fields instead, read off the per-day list's first
      // and last row — intermediate dates are always full day and need no
      // field. Every edit/modify endpoint (on-behalf, OW modify, generic
      // modify) expects these prefixed as `new_from_date_duration`/
      // `new_to_date_duration` — NOT the unprefixed `from_date_duration`/
      // `to_date_duration` used by the apply endpoints. DRF silently drops
      // unrecognized fields, so sending the apply-style names here was
      // always discarded, silently defaulting to FULL_DAY on submit.
      const durationFields = isMultiDay
        ? {
            new_from_date_duration: (dailyConfigs[newStart] || 'full') === 'afternoon' ? 'SECOND_HALF' : 'FULL_DAY',
            new_to_date_duration: (dailyConfigs[effectiveEnd] || 'full') === 'morning' ? 'FIRST_HALF' : 'FULL_DAY',
          }
        : { new_duration: newDuration };

      if (isOnBehalf) {
        res = await leaveService.editLeaveOnBehalf(leave.id, {
          manager_id: user?.emp_id,
          new_start: newStart,
          new_end: effectiveEnd,
          new_reason: newReason,
          ...durationFields,
          ...justificationField,
        });
      } else if (isOW) {
        res = await leaveService.modifyOwLeave(leave.id, {
          emp_id: user?.emp_id || user?.empId || 1,
          new_start: newStart,
          new_end: effectiveEnd,
          new_reason: newReason,
          ...durationFields,
          mod_reason: modReason,
          ...justificationField,
        });
      } else {
        // The generic modify endpoint's serializer (ModifyLeaveSerializer)
        // uses different field names than the OW-specific and on-behalf
        // endpoints above (new_start_date/new_end_date/modification_reason,
        // not new_start/new_end/mod_reason) — do not "unify" these, they're
        // genuinely different backend contracts.
        res = await leaveService.modifyLeave(leave.id, {
          emp_id: user?.emp_id || user?.empId || 1,
          new_start_date: newStart,
          new_end_date: effectiveEnd,
          new_reason: newReason,
          ...durationFields,
          modification_reason: modReason,
          ...justificationField,
        });
      }

      if (res?.excess_request) {
        toast.success(
          `${res.excess_request.excess_days} excess day(s) will be billed as offshore. Pending SDM approval.`,
        );
      } else if (isOnBehalf) {
        toast.success('Leave modified and approved on behalf of the employee.');
      } else {
        toast.success('Leave modification request submitted successfully.');
      }
      onSuccess();
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.message || 'Failed to modify leave. Please try again.';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="al-overlay" onClick={() => onClose(false)}>
      <div className="al-modal" onClick={(e) => e.stopPropagation()}>
        <div className="al-header">
          <div className="al-header-left">
            <h2 className="al-title">
              Modify {leave.leave_type} Request{isOnBehalf ? ` (${leave.emp_name || `employee #${leave.emp_id}`})` : ''}
            </h2>
          </div>
          <button type="button" className="al-close-btn" onClick={() => onClose(false)}>
            <X size={15} />
          </button>
        </div>

        <div className="al-body" style={{ padding: '20px' }}>

          {/* Workflow banner — direct edit (still PENDING) vs a modification
              request awaiting manager approval (already APPROVED), and the
              on-behalf auto-approve exception to that. */}
          <div className="el-workflow-banner">
            <Info size={14} className="el-workflow-banner-icon" />
            <span>
              {isOnBehalf
                ? 'Editing on behalf of your report — this change is applied and approved immediately.'
                : isPending
                  ? 'This request is still pending — your change will be applied immediately, no re-approval needed.'
                  : 'This request is already approved — your change will be submitted as a modification request awaiting manager approval.'}
            </span>
          </div>

          <div className="al-form-group">
            <label className="al-label">Dates *</label>
            <InlineCalendar
              year={calYear}
              month={calMonth}
              startDate={startDateObj}
              endDate={effectiveEnd ? parseIsoDate(effectiveEnd) : null}
              hoverDate={hoverDate}
              onDayClick={handleDayClick}
              onDayHover={setHoverDate}
              onPrev={prevMonth}
              onNext={nextMonth}
              dateMode={typeInfo?.allowPastDates ? 'any' : 'future'}
              calendarDayMap={sanitizedDayMap}
              restrictToWorkingDays
              newLeaveTypeCode={leave.leave_type}
              isLoading={isCalendarLoading}
            />
          </div>

          <div className="al-form-group" style={{ marginTop: '10px' }}>
            <span className="al-label">Duration Selection</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '10px', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Customize leave hours for each day in the range:
              </div>
              {!isMultiDay ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--surface-primary)', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                  <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>
                    {newStart}
                    {isNonWorkingDay(newStart) && (
                      <span className="el-nonworking-tag">
                        {calendarDayMap[newStart]?.is_org_holiday ? 'holiday — not counted' : 'weekend — not counted'}
                      </span>
                    )}
                  </span>
                  <div className="al-duration-chips" style={{ margin: 0, gap: '4px' }}>
                    {[
                      ['FULL_DAY', 'Full Day'],
                      ['FIRST_HALF', '1st Half'],
                      ['SECOND_HALF', '2nd Half'],
                    ].map(([val, lbl]) => (
                      <button
                        key={val}
                        type="button"
                        className="al-duration-chip"
                        data-active={newDuration === val}
                        onClick={() => setNewDuration(val)}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                rangeDays.map((d, index) => {
                  const isStartDay = index === 0;
                  const isEndDay = index === rangeDays.length - 1;
                  const isMiddleDay = !isStartDay && !isEndDay;
                  const currentVal = dailyConfigs[d] || 'full';

                  const nonWorking = isNonWorkingDay(d);
                  return (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--surface-primary)', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {d}
                        {nonWorking && (
                          <span className="el-nonworking-tag">
                            {calendarDayMap[d]?.is_org_holiday ? 'holiday — not counted' : 'weekend — not counted'}
                          </span>
                        )}
                      </span>
                      <div className="al-duration-chips" style={{ margin: 0, gap: '4px' }}>
                        {[
                          ['full', 'Full Day'],
                          ['morning', '1st Half'],
                          ['afternoon', '2nd Half'],
                        ].map(([val, lbl]) => {
                          const isDisabled =
                            rangeDays.length > 1 &&
                            ((isMiddleDay && val !== 'full') ||
                              (isStartDay && val === 'morning') ||
                              (isEndDay && val === 'afternoon'));

                          return (
                            <button
                              key={val}
                              type="button"
                              className="al-duration-chip"
                              style={{
                                padding: '3px 8px',
                                fontSize: '11px',
                                opacity: isDisabled ? 0.4 : 1,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                              }}
                              data-active={currentVal === val}
                              disabled={isDisabled}
                              onClick={() => {
                                if (!isDisabled) {
                                  setDailyConfigs((prev) => ({ ...prev, [d]: val }));
                                }
                              }}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Balance impact — live preview of this edit's effect, same
              statuses ApplyLeaveModal's validation checklist uses. Not
              shown for Claim types (isOW/claims have no balance to check
              here) or while the policy/balance lookup is still loading. */}
          {newStart && newEnd && balanceStatus && (
            <div className={`el-balance-panel v-${balanceStatus.status}`}>
              {balanceStatus.status === 'error' && <AlertCircle size={14} className="el-balance-panel-icon" />}
              {balanceStatus.status === 'warn' && <AlertTriangle size={14} className="el-balance-panel-icon" />}
              {balanceStatus.status === 'ok' && <CheckCircle2 size={14} className="el-balance-panel-icon" />}
              {balanceStatus.status === 'info' && <Info size={14} className="el-balance-panel-icon" />}
              <span>
                {balanceStatus.label}
                {!typeInfo.isUnlimited && effectiveAvailable != null && (
                  <> — requesting {newDays.toFixed(1)}d of {effectiveAvailable.toFixed(1)}d available</>
                )}
              </span>
            </div>
          )}

          {yearSpanningStatus && (
            <div className={`el-balance-panel v-${yearSpanningStatus.status}`}>
              {yearSpanningStatus.status === 'error'
                ? <AlertCircle size={14} className="el-balance-panel-icon" />
                : <Info size={14} className="el-balance-panel-icon" />}
              <span>{yearSpanningStatus.label}</span>
            </div>
          )}

          <div className="al-form-group" style={{ marginTop: '15px' }}>
            <label className="al-label">Leave Reason{isOW ? ' *' : ''}</label>
            <textarea
              className="al-textarea"
              style={{ width: '100%', minHeight: '60px', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
            />
            {isOW && (
              <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                Doubles as the excess-quota justification if this pushes the leave over the 10-day OW quota.
              </p>
            )}
          </div>

          {needsFlexJustification && (
            <div className="al-form-group" style={{ marginTop: '15px' }}>
              <label className="al-label al-label-required">Justification</label>
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
                className="al-textarea"
                style={{ width: '100%', minHeight: '60px', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}
                placeholder="Explain why this request should be allowed despite exceeding your balance…"
                value={flexJustification}
                onChange={(e) => setFlexJustification(e.target.value)}
              />
              {!flexJustification.trim() && (
                <span style={{ fontSize: '12px', color: 'var(--c-danger)', marginTop: '4px', display: 'block' }}>
                  Justification is required to submit this request.
                </span>
              )}
            </div>
          )}

          <div className="al-form-group" style={{ marginTop: '15px' }}>
            <label className="al-label">Reason for Modification (Optional)</label>
            <textarea
              className="al-textarea"
              style={{ width: '100%', minHeight: '60px', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}
              placeholder="Why are you modifying this request?"
              value={modReason}
              onChange={(e) => setModReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              className="al-btn al-btn-ghost"
              onClick={() => onClose(false)}
            >
              Cancel
            </button>
            <button
              className="al-btn al-btn-primary"
              disabled={isSubmitting || hasBalanceError || hasYearSpanningError || (needsFlexJustification && !flexJustification.trim())}
              title={hasBalanceError ? balanceStatus.label : hasYearSpanningError ? yearSpanningStatus.label : undefined}
              onClick={handleSubmit}
            >
              {isSubmitting
                ? 'Submitting...'
                : isOnBehalf
                  ? 'Modify & Approve'
                  : isPending
                    ? 'Save Changes'
                    : 'Submit for Approval'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
