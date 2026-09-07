import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { useAuth } from '@hooks/useAuth';
import leaveService from '@services/leaveService';

// 'YYYY-MM-DD' (or a Date/ISO string) -> "21 Sep 2026" — matches the format
// used elsewhere in the leave tables (fmtShort/fmtDate in TeamRequestsTab).
function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDurationStr(duration) {
  const map = {
    FULL_DAY: 'Full Day',
    FIRST_HALF: 'First Half',
    SECOND_HALF: 'Second Half',
  };
  return map[duration] || 'Full Day';
}

// The requested date range, with each boundary's own half-day duration —
// mirrors LeaveManagementPage's getDurationDisplay, but folded into the
// date range itself (e.g. "21 Sep 2026 (Full Day) to 23 Sep 2026 (First
// Half)") instead of a separate duration-only line, since this confirmation
// only shows one range, not a table row with its own Duration column.
function formatRangeWithDuration(leave) {
  const start = fmtDate(leave.start_date);
  // A boundary is only ever a half day via from_date_duration/
  // to_date_duration (multi-day) — a single-day request's duration is
  // carried on the generic leave_duration flag instead, since it has no
  // "boundary" to speak of, just the one day.
  const hasBoundaryDurations = !!(leave.from_date_duration || leave.to_date_duration);
  const startLabel = hasBoundaryDurations
    ? formatDurationStr(leave.from_date_duration)
    : formatDurationStr(leave.leave_duration);
  if (!leave.end_date || leave.end_date === leave.start_date) {
    return `${start} (${startLabel})`;
  }
  const end = fmtDate(leave.end_date);
  const endLabel = hasBoundaryDurations
    ? formatDurationStr(leave.to_date_duration)
    : formatDurationStr(leave.leave_duration);
  return `${start} (${startLabel}) to ${end} (${endLabel})`;
}

export function CancelLeaveModal({ leave, pendingModRequest, leaveTypeMap = {}, onClose, onSuccess }) {
  const { user } = useAuth();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');

  const isOnBehalf = leave.emp_id != null && user?.emp_id != null && leave.emp_id !== user.emp_id;
  const ownerLabel = isOnBehalf ? (leave.emp_name || `employee #${leave.emp_id}`) + "'s" : 'your';
  // The real leave type name (e.g. "Weekend Work"), not its raw code
  // ("WW") — leave_name comes straight from LeaveSerializer when present;
  // leaveTypeMap (code -> name) is the same fallback used elsewhere on this
  // page (see LeaveManagementPage's displayType computations).
  const leaveTypeLabel = leave.leave_name || leaveTypeMap[leave.leave_type] || leave.leave_type;

  // A grouped multi-date claim (see groupClaimLeaves/groupClaimRows) carries
  // one entry per claimed date under `claimDates` — cancelling it cascades
  // to every sibling row of that same submission on the backend (see
  // LeaveModifyService.cancel), so the confirmation must list every date
  // being cancelled, not just the single leave.start_date it defaults to.
  const claimDates = leave.claimDates && leave.claimDates.length > 1 ? leave.claimDates : null;

  const handleCancel = async () => {
    try {
      setIsSubmitting(true);
      
      // emp_id must be the LEAVE OWNER, not whoever's clicking cancel — the
      // backend checks the caller is either that owner or an authorized
      // manager/HR for the owner, so this works unchanged whether the
      // logged-in user is cancelling their own leave or a report's.
      const payload = {
        emp_id: leave.emp_id ?? user?.emp_id ?? user?.empId ?? 1,
        reason: reason
      };

      await leaveService.cancelLeave(leave.id, payload);
      toast.success('Leave request cancelled successfully.');
      onSuccess();
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.message || 'Failed to cancel leave. Please try again.';
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
            <h2 className="al-title">Cancel Leave Request</h2>
          </div>
          <button type="button" className="al-close-btn" onClick={() => onClose(false)}>
            <X size={15} />
          </button>
        </div>
        <div className="al-body" style={{ padding: '20px' }}>
          {claimDates ? (
            <>
              <p style={{ marginBottom: '10px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Are you sure you want to cancel {ownerLabel} {leaveTypeLabel} request covering these {claimDates.length} dates?
              </p>
              <ul style={{ margin: '0 0 16px', paddingLeft: '20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {claimDates.map((cd) => (
                  <li key={cd.id ?? cd.date}>
                    {fmtDate(cd.date)} ({formatDurationStr(cd.duration)})
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Are you sure you want to cancel {ownerLabel} {leaveTypeLabel} request for{' '}
              {formatRangeWithDuration(leave)}?
            </p>
          )}

          {/* Cancelling an APPROVED leave with a pending modification
              request auto-withdraws that request too (see
              LeaveModifyService.cancel's matching cascade) — worth knowing
              before confirming, not discovering after the fact. */}
          {pendingModRequest && (
            <div
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '10px 12px', borderRadius: 6, marginBottom: 16,
                background: 'var(--c-warning-light, #fffbeb)',
                border: '1px solid var(--c-warning, #f59e0b)',
                fontSize: 13,
              }}
            >
              <span>
                You have a pending modification request on this leave (new dates:{' '}
                {new Date(pendingModRequest.new_start_date).toLocaleDateString()} →{' '}
                {new Date(pendingModRequest.new_end_date).toLocaleDateString()}). Cancelling this
                leave will also withdraw that modification request.
              </span>
            </div>
          )}

          <div className="al-form-group">
            <label className="al-label">Reason for cancellation (optional)</label>
            <textarea
              className="al-textarea"
              style={{ width: '100%', minHeight: '80px', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}
              placeholder="Enter reason..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              className="al-btn al-btn-ghost"
              onClick={() => onClose(false)}
            >
              Back
            </button>
            <button
              className="al-btn"
              style={{ backgroundColor: 'var(--c-danger)', color: 'white' }}
              disabled={isSubmitting}
              onClick={handleCancel}
            >
              {isSubmitting ? 'Cancelling...' : 'Confirm Cancellation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
