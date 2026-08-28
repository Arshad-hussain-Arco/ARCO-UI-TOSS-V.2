import { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { useAuth } from '@hooks/useAuth';
import leaveService from '@services/leaveService';

const toDateStr = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const todayStr = () => toDateStr(new Date());

const DURATION_CHIPS = [
  ['FULL_DAY', 'Full Day'],
  ['FIRST_HALF', '1st Half'],
  ['SECOND_HALF', '2nd Half'],
];

export function PartialCancelLeaveModal({ leave, onClose, onSuccess }) {
  const { user } = useAuth();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');

  const minDate = todayStr() > leave.start_date ? todayStr() : leave.start_date;
  const maxDate = leave.end_date;

  const [cancelFrom, setCancelFrom] = useState(minDate);
  const [cancelTo, setCancelTo] = useState(minDate);
  const [cancelFromDuration, setCancelFromDuration] = useState('FULL_DAY');
  const [cancelToDuration, setCancelToDuration] = useState('FULL_DAY');

  const isSingleDay = cancelFrom === cancelTo;

  const isOnBehalf = leave.emp_id != null && user?.emp_id != null && leave.emp_id !== user.emp_id;
  const ownerLabel = isOnBehalf ? (leave.emp_name || `employee #${leave.emp_id}`) + "'s" : 'your';

  const handleFromChange = (val) => {
    setCancelFrom(val);
    if (val > cancelTo) setCancelTo(val);
  };

  const handleSubmit = async () => {
    if (!cancelFrom || !cancelTo) {
      toast.error('Please select a cancellation date range.');
      return;
    }
    if (cancelTo < cancelFrom) {
      toast.error('End date must be on or after start date.');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        emp_id: leave.emp_id ?? user?.emp_id ?? user?.empId ?? 1,
        cancel_from: cancelFrom,
        cancel_to: cancelTo,
        reason,
        cancel_from_duration: cancelFromDuration,
        cancel_to_duration: isSingleDay ? null : cancelToDuration,
      };

      await leaveService.partialCancelLeave(leave.id, payload);
      toast.success('Leave partially cancelled successfully.');
      onSuccess();
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.message || 'Failed to partially cancel leave. Please try again.';
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
            <h2 className="al-title">Partially Cancel Leave</h2>
          </div>
          <button type="button" className="al-close-btn" onClick={() => onClose(false)}>
            <X size={15} />
          </button>
        </div>
        <div className="al-body" style={{ padding: '20px' }}>
          <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Choose the date range you&apos;d like to cancel from {ownerLabel} {leave.leave_type} request
            ({new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}).
          </p>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div className="al-form-group" style={{ flex: 1 }}>
              <label className="al-label">Cancel from</label>
              <input
                type="date"
                className="al-input"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}
                min={minDate}
                max={maxDate}
                value={cancelFrom}
                onChange={(e) => handleFromChange(e.target.value)}
              />
            </div>
            <div className="al-form-group" style={{ flex: 1 }}>
              <label className="al-label">Cancel to</label>
              <input
                type="date"
                className="al-input"
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}
                min={cancelFrom}
                max={maxDate}
                value={cancelTo}
                onChange={(e) => setCancelTo(e.target.value)}
              />
            </div>
          </div>

          <div className="al-form-group" style={{ marginBottom: '16px' }}>
            <span className="al-label">
              {isSingleDay ? 'Which half to cancel' : 'Cancel-from-date portion'}
            </span>
            <div className="al-duration-chips">
              {DURATION_CHIPS.filter(([val]) => isSingleDay || val !== 'FIRST_HALF').map(([val, lbl]) => (
                <button
                  key={val}
                  type="button"
                  className="al-duration-chip"
                  data-active={cancelFromDuration === val}
                  onClick={() => setCancelFromDuration(val)}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {!isSingleDay && (
            <div className="al-form-group" style={{ marginBottom: '16px' }}>
              <span className="al-label">Cancel-to-date portion</span>
              <div className="al-duration-chips">
                {DURATION_CHIPS.filter(([val]) => val !== 'SECOND_HALF').map(([val, lbl]) => (
                  <button
                    key={val}
                    type="button"
                    className="al-duration-chip"
                    data-active={cancelToDuration === val}
                    onClick={() => setCancelToDuration(val)}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
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
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Cancelling...' : 'Confirm Partial Cancellation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
