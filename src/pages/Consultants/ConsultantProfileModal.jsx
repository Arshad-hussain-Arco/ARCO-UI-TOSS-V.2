import { X, Mail, Phone, MapPin, Monitor, Building2, User, RefreshCw, AlertCircle } from 'lucide-react';
import { useAsync } from '@hooks/useAsync';
import { consultantService } from '@services/consultantService';
import { Image } from '@components/common/Image/Image';
import { Loader } from '@components/feedback/Loader/Loader';
import { dismissBackdrop } from '@utils/interactive';
import { useCallback } from 'react';
import './ConsultantProfileModal.css';

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ConsultantProfileModal({ consultantId, onClose }) {
  const fetchInfo = useCallback(async () => {
    const info = await consultantService.getConsultantInfo(consultantId);
    let photoUrl = info.photo || info.avatar || '';
    
    // Decode base64 if needed just like in utils.js
    if (photoUrl.startsWith('ZGF0Y')) {
      try {
        photoUrl = atob(photoUrl);
      } catch (e) {
        console.warn('Failed to decode base64 avatar');
      }
    }
    if (photoUrl && !photoUrl.startsWith('data:image')) {
      photoUrl = `data:image/jpeg;base64,${photoUrl}`;
    }
    
    return { ...info, avatar: photoUrl };
  }, [consultantId]);
  
  const { data, isLoading, error, refetch } = useAsync(fetchInfo);

  if (error) {
    return (
      <div className="cp-modal-overlay" {...dismissBackdrop(onClose)}>
        <div className="cp-modal-content" role="dialog" aria-modal="true" style={{ maxWidth: 400 }}>
          <div className="cp-modal-header">
            <h3 className="cp-name" style={{ fontSize: 18 }}>Profile Error</h3>
            <button className="cp-close-btn" onClick={onClose}><X size={16} /></button>
          </div>
          <div className="cp-error-container">
            <AlertCircle size={32} color="var(--c-danger)" />
            <h4 className="cp-error-title">Failed to load profile</h4>
            <p className="cp-error-desc">{error.message}</p>
            <button className="al-btn al-btn-primary" onClick={refetch}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="cp-modal-overlay" {...dismissBackdrop(onClose)}>
        <div className="cp-modal-content" role="dialog" aria-modal="true" style={{ maxWidth: 400 }}>
          <div className="cp-loader-container">
            <Loader message="Loading profile..." />
          </div>
        </div>
      </div>
    );
  }

  // The backend might return data differently, assuming standard flat object or nested leave summary
  const info = data;
  let leaveSummary = [];
  if (info.leave_summary && info.leave_summary.balances) {
    leaveSummary = Object.entries(info.leave_summary.balances).map(([type, stats]) => ({
      leave_type: type,
      ...stats
    }));
  } else if (Array.isArray(info.leave_summary)) {
    leaveSummary = info.leave_summary;
  } else if (Array.isArray(info.leaveSummary)) {
    leaveSummary = info.leaveSummary;
  }

  const isActive = 
    info.active === true ||
    info.account_status?.toLowerCase() === 'active' || 
    Number(info.status_id) === 1 || 
    info.status?.toLowerCase() === 'active' || 
    info.is_active || 
    info.status_name?.toLowerCase() === 'active' ||
    info.account_status === 1 ||
    info.status === 1;

  return (
    <div className="cp-modal-overlay" {...dismissBackdrop(onClose)}>
      <div className="cp-modal-content" role="dialog" aria-modal="true">
        
        {/* Header */}
        <div className="cp-modal-header">
          <div className="cp-modal-header-info">
            {info.avatar ? (
              <Image src={info.avatar} alt={info.name} className="cp-avatar" />
            ) : (
              <div className="cp-avatar-placeholder">{getInitials(info.name)}</div>
            )}
            <div className="cp-title-wrap">
              <h2 className="cp-name">{info.name || 'Unknown Consultant'}</h2>
              <div className="cp-badges">
                {(info.user_id || info.user_name) && <span className="cp-badge">{info.user_id || info.user_name}</span>}
                {(info.designation_name || info.designation) && <span className="cp-badge" style={{ background: 'var(--c-info-light)', color: 'var(--c-info)' }}>{info.designation_name || info.designation}</span>}
                {(info.team_name || info.team) && <span className="cp-badge" style={{ background: 'var(--c-warning-light)', color: 'var(--c-warning)' }}>{info.team_name || info.team}</span>}
                <span className="cp-badge" style={{ 
                  background: isActive ? 'var(--c-success-light)' : 'var(--c-danger-light)', 
                  color: isActive ? 'var(--c-success)' : 'var(--c-danger)' 
                }}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <button className="cp-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="cp-modal-body">
          
          <div className="cp-section">
            <h4 className="cp-section-title"><User size={14} /> General Information</h4>
            <div className="cp-grid">
              <div className="cp-field">
                <span className="cp-label"><Mail size={12} /> Email</span>
                <span className="cp-value">{info.email || '—'}</span>
              </div>
              <div className="cp-field">
                <span className="cp-label"><Phone size={12} /> Mobile</span>
                <span className="cp-value">{info.mobile || '—'}</span>
              </div>
              <div className="cp-field">
                <span className="cp-label"><Phone size={12} /> Landline (Ext)</span>
                <span className="cp-value">{info.landline ? `${info.landline} ${info.extension ? `(Ext: ${info.extension})` : ''}` : '—'}</span>
              </div>
              <div className="cp-field">
                <span className="cp-label"><User size={12} /> Reporting Manager</span>
                <span className="cp-value">{info.manager_name || info.reporting_manager || info.manager || '—'}</span>
              </div>
              <div className="cp-field">
                <span className="cp-label"><Building2 size={12} /> Location</span>
                <span className="cp-value">{info.location || '—'}</span>
              </div>
              <div className="cp-field">
                <span className="cp-label"><User size={12} /> Joining Date</span>
                <span className="cp-value">{formatDate(info.joining_date)}</span>
              </div>
              <div className="cp-field">
                <span className="cp-label"><Monitor size={12} /> Webex ID</span>
                <span className="cp-value">{info.webex_id || '—'}</span>
              </div>
            </div>
          </div>

          <div className="cp-section">
            <h4 className="cp-section-title"><Monitor size={14} /> Hardware & Assets</h4>
            <div className="cp-grid">
              <div className="cp-field">
                <span className="cp-label">Physical PC Available</span>
                <span className="cp-value">{(info.physical_pc_available === 1 || info.physical_pc_available === true) ? 'Yes' : 'No'}</span>
              </div>
              <div className="cp-field">
                <span className="cp-label">Computer Name</span>
                <span className="cp-value">{info.computer_name || '—'}</span>
              </div>
              <div className="cp-field">
                <span className="cp-label"><MapPin size={12} /> PC Location</span>
                <span className="cp-value">{info.computer_location || '—'}</span>
              </div>
              <div className="cp-field">
                <span className="cp-label"><MapPin size={12} /> Location Reference</span>
                <span className="cp-value">{info.computer_location_ref || info.computer_location_reference || '—'}</span>
              </div>
            </div>
          </div>

          {leaveSummary.length > 0 && (
            <div className="cp-section">
              <h4 className="cp-section-title">Leave Summary</h4>
              <div className="cp-leave-grid">
                {leaveSummary.map((leave, idx) => {
                  const total = (leave.entitled || 0) + (leave.carried_forward || 0);
                  const used = (leave.used || 0);
                  const pending = (leave.pending || 0);
                  const available = leave.available ?? 0;
                  
                  const usedPct = total > 0 ? (used / total) * 100 : 0;
                  const pendingPct = total > 0 ? (pending / total) * 100 : 0;
                  
                  return (
                    <div className="cp-leave-card" key={idx}>
                      <div className="cp-leave-header">
                        <span className="cp-leave-name">{leave.leave_type || 'Leave'}</span>
                        <span className="cp-leave-available">{available}</span>
                      </div>
                      
                      <div className="cp-leave-progress">
                        <div className="cp-progress-used" style={{ width: `${usedPct}%` }} title={`Used: ${used}`} />
                        <div className="cp-progress-pending" style={{ width: `${pendingPct}%` }} title={`Pending: ${pending}`} />
                      </div>
                      
                      <div className="cp-leave-stats">
                        <div className="cp-leave-stat-col">
                          <span className="cp-leave-stat-label">Total</span>
                          <span className="cp-leave-stat-val">{total}</span>
                        </div>
                        <div className="cp-leave-stat-col">
                          <span className="cp-leave-stat-label">Used</span>
                          <span className="cp-leave-stat-val">{used}</span>
                        </div>
                        <div className="cp-leave-stat-col">
                          <span className="cp-leave-stat-label">Pending</span>
                          <span className="cp-leave-stat-val">{pending}</span>
                        </div>
                        {leave.advance_taken > 0 && (
                          <div className="cp-leave-stat-col">
                            <span className="cp-leave-stat-label">Advance</span>
                            <span className="cp-leave-stat-val">{leave.advance_taken}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
