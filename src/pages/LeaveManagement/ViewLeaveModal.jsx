import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, AlignLeft, Info } from 'lucide-react';
import leaveService from '@services/leaveService';

export function ViewLeaveModal({ leave, onClose }) {
  // Not currently passed a shared leaveTypeMap by a parent, so this fetches
  // its own code -> name lookup from the all-leave-types API (available to
  // any logged-in employee) rather than hardcoding it.
  const [leaveTypeMap, setLeaveTypeMap] = useState({});

  useEffect(() => {
    leaveService.getAllLeaveTypes()
      .then((response) => {
        const list = Array.isArray(response) ? response : (response?.results || []);
        const map = {};
        list.forEach((t) => {
          if (t.code) map[t.code] = t.leave_type || t.name || t.code;
        });
        setLeaveTypeMap(map);
      })
      .catch((e) => console.error('Failed to fetch leave types', e));
  }, []);

  if (!leave) return null;

  const startDate = new Date(leave.start_date || leave.date || new Date()).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
  const endDate = new Date(leave.end_date || leave.date || new Date()).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

  const displayType = leave.leave_name || leaveTypeMap[leave.leave_type] || leave.leave_type || leave.type || 'Leave Request';
  const statusStr = leave.status_code?.toLowerCase().replace('_', '-') || 'pending';

  return (
    <div className="al-overlay" onClick={() => onClose()}>
      <div className="al-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="al-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-primary)' }}>
          <div className="al-header-left">
            <h2 className="al-title" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Info size={18} style={{ color: 'var(--c-primary)' }}/>
              Leave Details
            </h2>
          </div>
          <button type="button" className="al-close-btn" onClick={() => onClose()}>
            <X size={18} />
          </button>
        </div>
        <div className="al-body" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
             <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{displayType}</span>
             <span className="leave-table-status" data-status={statusStr} style={{ textTransform: 'capitalize' }}>
                {statusStr === 'self-rejected' ? 'Self Rejected' : statusStr.replace('-', ' ')}
             </span>
          </div>

          {leave.is_mod_request && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              padding: '10px 12px', borderRadius: '6px',
              background: 'var(--c-info-light, #eff6ff)', border: '1px solid var(--c-info, #3b82f6)',
              fontSize: '13px', color: 'var(--text-primary)',
            }}>
              <Info size={15} style={{ color: 'var(--c-info, #3b82f6)', flexShrink: 0, marginTop: 1 }} />
              <span>
                This is a requested change to an already-approved leave, awaiting manager
                re-approval — the dates/duration below are what&apos;s being requested, not yet in effect.
                {leave.orig_start_date && (
                  <> Originally: {new Date(leave.orig_start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  {leave.orig_end_date && leave.orig_end_date !== leave.orig_start_date
                    ? ` – ${new Date(leave.orig_end_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                    : ''}.</>
                )}
              </span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
             <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <Calendar size={14}/> Start Date
                </div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{startDate}</div>
             </div>
             <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <Calendar size={14}/> End Date
                </div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>{endDate}</div>
             </div>
             <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <Clock size={14}/> Requested Days
                </div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                   {leave.in_days || leave.business_days || 0} Day(s)
                </div>
             </div>
             <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                   <Clock size={14}/> Work Days
                </div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)' }}>
                   {leave.business_days || 0} Day(s)
                </div>
             </div>
          </div>

          <div>
             <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                 <AlignLeft size={16}/> Leave Reason
             </div>
             <div style={{ fontSize: '14px', color: 'var(--text-primary)', background: 'var(--surface-primary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-primary)', minHeight: '60px' }}>
                 {leave.leave_reason || leave.reason || 'No reason provided.'}
             </div>
          </div>

          {(leave.approval_reason || leave.rejected_reason) && (
            <div>
               <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <AlignLeft size={16}/> Comments (Approval / Rejection)
               </div>
               <div style={{ fontSize: '14px', color: 'var(--text-primary)', background: 'var(--surface-primary)', padding: '12px', borderRadius: '6px', border: '1px solid var(--border-primary)', minHeight: '60px' }}>
                   {leave.approval_reason || leave.rejected_reason}
               </div>
            </div>
          )}
          
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-tertiary)', borderRadius: '0 0 8px 8px' }}>
           <button className="al-btn al-btn-ghost" onClick={() => onClose()}>Close</button>
        </div>
      </div>
    </div>
  );
}
