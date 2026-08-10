import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { useAuth } from '@hooks/useAuth';
import leaveService from '@services/leaveService';

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

  // Flexible-entitlement lookup for the leave type being modified — needed to
  // proactively require a justification if this edit pushes the request
  // beyond the available balance, same as ApplyLeaveModal.
  const [flexEntry, setFlexEntry] = useState(null);
  useEffect(() => {
    const empIdForLookup = leave.emp_id || user?.emp_id;
    if (!empIdForLookup) return;
    Promise.all([
      leaveService.getEligibleLeaveTypes(empIdForLookup).catch(() => []),
      leaveService.getLeaveBalance(empIdForLookup).catch(() => null),
    ]).then(([types, balanceData]) => {
      const arr = Array.isArray(types) ? types : types?.results || [];
      const match = arr.find((t) => t.code === leave.leave_type);
      if (!match || !match.is_flexible) {
        setFlexEntry(null);
        return;
      }
      const bal = balanceData?.balances?.[leave.leave_type];
      setFlexEntry({
        entitledDays: match.entitled_days != null ? Number(match.entitled_days) : null,
        available: bal?.available != null ? Number(bal.available) : null,
      });
    });
  }, [leave.emp_id, leave.leave_type, user?.emp_id]);

  // A manager/HR user modifying a report's leave (rather than their own)
  // goes through the on-behalf endpoint, which auto-approves the change
  // instead of creating a modification request awaiting approval.
  const isOnBehalf = leave.emp_id != null && user?.emp_id != null && leave.emp_id !== user.emp_id;

  useEffect(() => {
    if (newStart && (!newEnd || newEnd < newStart)) {
      setNewEnd(newStart);
    }
  }, [newStart]);

  const isMultiDay = !!(newStart && newEnd && newStart !== newEnd);

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
    if (!newStart || !newEnd) return [];
    const [sy, sm, sd] = newStart.split('-').map(Number);
    const [ey, em, ed] = newEnd.split('-').map(Number);
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

  // Rough day count for the newly requested range (inclusive), halved for a
  // same-day half-day duration — good enough to compare against available
  // balance; the backend remains the source of truth for exact billing.
  const newDays = (() => {
    if (!newStart || !newEnd) return 0;
    if (newStart === newEnd) return newDuration !== 'FULL_DAY' ? 0.5 : 1;
    return rangeDays.reduce((sum, d) => sum + ((dailyConfigs[d] || 'full') === 'full' ? 1 : 0.5), 0);
  })();
  const originalDays = Number(leave.total_days ?? leave.no_of_days ?? 0);
  // Incremental days this edit adds beyond what's already booked — comparing
  // the delta (not the raw new total) against available balance, since the
  // original days are already reflected as "used" in that balance.
  const incrementalDays = newDays - originalDays;
  const needsFlexJustification =
    !!flexEntry && flexEntry.available != null && incrementalDays > flexEntry.available;

  const handleSubmit = async () => {
    if (!newStart || !newEnd) {
      toast.error('Start and end dates are required');
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
            new_to_date_duration: (dailyConfigs[newEnd] || 'full') === 'morning' ? 'FIRST_HALF' : 'FULL_DAY',
          }
        : { new_duration: newDuration };

      if (isOnBehalf) {
        res = await leaveService.editLeaveOnBehalf(leave.id, {
          manager_id: user?.emp_id,
          new_start: newStart,
          new_end: newEnd,
          new_reason: newReason,
          ...durationFields,
          ...justificationField,
        });
      } else if (isOW) {
        res = await leaveService.modifyOwLeave(leave.id, {
          emp_id: user?.emp_id || user?.empId || 1,
          new_start: newStart,
          new_end: newEnd,
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
          new_end_date: newEnd,
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

          <div className="al-form-row">
            <div className="al-form-group">
              <label className="al-label">Start Date *</label>
              <input
                type="date"
                className="al-input"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </div>
            <div className="al-form-group">
              <label className="al-label">End Date *</label>
              <input
                type="date"
                className="al-input"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
                min={newStart}
              />
            </div>
          </div>

          {!isMultiDay ? (
            <div className="al-form-group" style={{ marginTop: '10px' }}>
              <label className="al-label">Duration</label>
              <select
                className="al-input"
                value={newDuration}
                onChange={(e) => setNewDuration(e.target.value)}
              >
                <option value="FULL_DAY">Full Day</option>
                <option value="FIRST_HALF">First Half</option>
                <option value="SECOND_HALF">Second Half</option>
              </select>
            </div>
          ) : (
            <div className="al-form-group" style={{ marginTop: '10px' }}>
              <span className="al-label">Duration Selection</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', border: '1px solid var(--border-primary)', borderRadius: '6px', padding: '10px', backgroundColor: 'var(--bg-secondary)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Customize leave hours for each day in the range:
                </div>
                {rangeDays.map((d, index) => {
                  const isStartDay = index === 0;
                  const isEndDay = index === rangeDays.length - 1;
                  const isMiddleDay = !isStartDay && !isEndDay;
                  const currentVal = dailyConfigs[d] || 'full';

                  return (
                    <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--surface-primary)', borderRadius: '4px', border: '1px solid var(--border-primary)' }}>
                      <span style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)' }}>
                        {d}
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
                                if (!isDisabled) setDailyConfigs((prev) => ({ ...prev, [d]: val }));
                              }}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
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
                  background: 'var(--c-danger-light, #fef2f2)',
                  border: '1px solid var(--c-danger, #ef4444)',
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
              disabled={isSubmitting || (needsFlexJustification && !flexJustification.trim())}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Submitting...' : isOnBehalf ? 'Modify & Approve' : 'Modify Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
