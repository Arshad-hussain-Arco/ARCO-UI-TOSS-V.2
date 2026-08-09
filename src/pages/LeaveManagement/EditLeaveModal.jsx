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
    const s = new Date(newStart);
    const e = new Date(newEnd);
    const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    if (newStart === newEnd && newDuration !== 'FULL_DAY') return 0.5;
    return diff;
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

      if (isOnBehalf) {
        res = await leaveService.editLeaveOnBehalf(leave.id, {
          manager_id: user?.emp_id,
          new_start: newStart,
          new_end: newEnd,
          new_reason: newReason,
          new_duration: newDuration,
          ...justificationField,
        });
      } else if (isOW) {
        res = await leaveService.modifyOwLeave(leave.id, {
          emp_id: user?.emp_id || user?.empId || 1,
          new_start: newStart,
          new_end: newEnd,
          new_reason: newReason,
          new_duration: newDuration,
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
          new_duration: newDuration,
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

          {newStart === newEnd && (
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
