import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { useAuth } from '@hooks/useAuth';
import leaveService from '@services/leaveService';

export function CancelLeaveModal({ leave, onClose, onSuccess }) {
  const { user } = useAuth();
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');

  const isOnBehalf = leave.emp_id != null && user?.emp_id != null && leave.emp_id !== user.emp_id;
  const ownerLabel = isOnBehalf ? (leave.emp_name || `employee #${leave.emp_id}`) + "'s" : 'your';

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
          <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            Are you sure you want to cancel {ownerLabel} {leave.leave_type} request for {new Date(leave.start_date).toLocaleDateString()}?
          </p>
          
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
