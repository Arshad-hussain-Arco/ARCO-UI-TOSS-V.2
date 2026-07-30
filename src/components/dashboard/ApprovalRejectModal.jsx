import React, { useState } from 'react';
import { Pill } from '../ui';
import './ApprovalRow.css';

export function ApprovalRejectModal({ row, isOpen, onClose, onConfirm, isSubmitting, errorMsg }) {
  if (!isOpen || !row) return null;

  const [text, setText] = useState('');
  const [validationError, setValidationError] = useState('');

  const isReasonRequired = Boolean(row.reject_reason_required);
  const payloadKey = row.row_type === 'LEAVE' ? 'reason' : 'comment';

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isReasonRequired && !text.trim()) {
      setValidationError(`A rejection ${payloadKey} is required for this request.`);
      return;
    }
    setValidationError('');
    onConfirm({ [payloadKey]: text.trim() });
  };

  return (
    <div className="approval-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="approval-modal-content">
        <div className="approval-modal-header">
          <h3 id="modal-title">Reject Approval Request #{row.id}</h3>
          <button type="button" className="approval-modal-close" onClick={onClose} disabled={isSubmitting}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="approval-modal-body">
            <p className="approval-modal-info">
              Rejecting request for <strong>{row.emp_name}</strong> ({row.leave_type || row.row_type}).
            </p>

            <label className="approval-modal-label">
              Rejection {payloadKey === 'reason' ? 'Reason' : 'Comment'}{' '}
              {isReasonRequired ? <span className="required-star">*</span> : <span className="optional-text">(Optional)</span>}
            </label>

            <textarea
              className="approval-modal-textarea"
              rows={4}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (e.target.value.trim()) setValidationError('');
              }}
              placeholder={`Enter rejection ${payloadKey}...`}
              disabled={isSubmitting}
            />

            {validationError && <div className="approval-modal-error">{validationError}</div>}
            {errorMsg && <div className="approval-modal-error">{errorMsg}</div>}
          </div>

          <div className="approval-modal-footer">
            <button type="button" className="lms-btn lms-btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="lms-btn lms-btn-danger" disabled={isSubmitting}>
              {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ApprovalRejectModal;
