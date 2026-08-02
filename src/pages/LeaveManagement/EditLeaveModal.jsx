import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';
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
  
  // OW Justification
  const [requiresJustification, setRequiresJustification] = useState(false);
  const [justificationText, setJustificationText] = useState('');
  const [quotaInfo, setQuotaInfo] = useState(null);

  useEffect(() => {
    if (newStart && (!newEnd || newEnd < newStart)) {
      setNewEnd(newStart);
    }
  }, [newStart]);

  const handleSubmit = async () => {
    if (!newStart || !newEnd) {
      toast.error('Start and end dates are required');
      return;
    }
    
    try {
      setIsSubmitting(true);
      const payload = {
        emp_id: user?.emp_id || user?.empId || 1,
        new_start: newStart,
        new_end: newEnd,
        new_reason: newReason,
        new_duration: newDuration,
        mod_reason: modReason
      };
      
      if (leave.leave_type === 'OW' && requiresJustification) {
        payload.justification = justificationText;
      }

      if (leave.leave_type === 'OW') {
        const res = await leaveService.modifyOwLeave(leave.id, payload);
        if (res?.requires_justification && !payload.justification) {
          setRequiresJustification(true);
          setQuotaInfo(res.quota_info);
          setIsSubmitting(false);
          return;
        }
      } else {
        await leaveService.modifyLeave(leave.id, payload);
      }
      
      toast.success('Leave modification request submitted successfully.');
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
            <h2 className="al-title">Modify {leave.leave_type} Request</h2>
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
            <label className="al-label">Leave Reason</label>
            <textarea
              className="al-textarea"
              style={{ width: '100%', minHeight: '60px', padding: '10px', borderRadius: '4px', border: '1px solid var(--border-primary)' }}
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
            />
          </div>

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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              className="al-btn al-btn-ghost"
              onClick={() => onClose(false)}
            >
              Cancel
            </button>
            <button
              className="al-btn al-btn-primary"
              disabled={isSubmitting || (requiresJustification && !justificationText.trim())}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Submitting...' : 'Modify Request'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
