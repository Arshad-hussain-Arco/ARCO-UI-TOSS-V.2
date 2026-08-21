import { X, Mail, Phone, MapPin, Monitor, Building2, User, Calendar } from 'lucide-react';
import { useAsync } from '@hooks/useAsync';
import { consultantService } from '@services/consultantService';
import { Image } from '@components/common/Image/Image';
import { Loader } from '@components/feedback/Loader/Loader';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { dismissBackdrop } from '@utils/interactive';
import { useCallback } from 'react';
import { useAuth } from '@hooks/useAuth';
import './ConsultantProfileModal.css';

function getInitials(name) {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(dateString) {
  if (!dateString) return null;
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function ConsultantProfileModal({ consultantId, onClose }) {
  const { user } = useAuth();
  const fetchInfo = useCallback(async () => {
    const info = await consultantService.getConsultantInfo(consultantId);
    let photoUrl = info.photo || info.avatar || '';

    // Decode base64 if needed
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
      <div className="cp-modal-overlay cp-modal-backdrop" {...dismissBackdrop(onClose)}>
        <div className="cp-modal-content cp-profile-modal" role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
          <div className="cp-modal-header cp-profile-header">
            <div className="cp-modal-header-info">
              <div className="cp-title-wrap">
                <h3 className="cp-name" style={{ fontSize: 18 }}>Profile Error</h3>
              </div>
            </div>
            <button className="cp-close-btn cp-modal-close" onClick={onClose} aria-label="Close modal" title="Close">
              <X size={16} />
            </button>
          </div>
          <ErrorState
            title="Profile could not be loaded"
            description={error.message}
            onRetry={refetch}
          />
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="cp-modal-overlay cp-modal-backdrop" {...dismissBackdrop(onClose)}>
        <div className="cp-modal-content cp-profile-modal" role="dialog" aria-modal="true" style={{ maxWidth: 420 }}>
          <div className="cp-loader-container">
            <Loader message="Loading profile details…" />
          </div>
        </div>
      </div>
    );
  }

  const info = data;
  let leaveSummary = [];
  if (info.leave_summary && info.leave_summary.balances) {
    leaveSummary = Object.entries(info.leave_summary.balances).map(([type, stats]) => ({
      leave_type: type,
      ...stats,
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

  const formattedJoiningDate = formatDate(info.joining_date);
  const isPhysicalPcYes = info.physical_pc_available === 1 || info.physical_pc_available === true;

  const managerName = info.manager_name || info.reporting_manager || info.manager;
  const isManager =
    user?.emp_id === info.manager_id ||
    user?.userId === info.manager_id ||
    (user?.name && managerName && user.name.toLowerCase() === managerName.toLowerCase());

  return (
    <div className="cp-modal-overlay cp-modal-backdrop" {...dismissBackdrop(onClose)}>
      <div className="cp-modal-content cp-profile-modal" role="dialog" aria-modal="true">

        {/* Compact Profile Header */}
        <div className="cp-modal-header cp-profile-header">
          <div className="cp-modal-header-info">
            {info.avatar ? (
              <Image src={info.avatar} alt={info.name} className="cp-avatar" />
            ) : (
              <div className="cp-avatar-placeholder">{getInitials(info.name)}</div>
            )}
            <div className="cp-title-wrap">
              <h2 className="cp-name">{info.name || 'Unknown Consultant'}</h2>
              <div className="cp-badges">
                {(info.user_id || info.user_name) && (
                  <span className="cp-badge cp-badge-id">{info.user_id || info.user_name}</span>
                )}
                {(info.designation_name || info.designation) && (
                  <span className="cp-badge cp-badge-designation">
                    {info.designation_name || info.designation}
                  </span>
                )}
                {(info.team_name || info.team) && (
                  <span className="cp-badge cp-badge-team">
                    {info.team_name || info.team}
                  </span>
                )}
                <span className={`cp-badge cp-badge-status ${isActive ? 'is-active' : 'is-inactive'}`}>
                  <span className="cp-badge-dot" />
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="cp-close-btn cp-modal-close"
            onClick={onClose}
            aria-label="Close profile modal"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Profile Body Workspace */}
        <div className="cp-modal-body cp-profile-body">

          {/* Top Workspace Split (Left Hardware Sidebar 30% | Right General Info Details 70%) */}
          <div className="cp-profile-workspace">

            {/* LEFT SIDEBAR: Hardware & Assets */}
            <div className="cp-profile-sidebar">
              <div className="cp-hardware-panel">
                <div className="cp-panel-header">
                  <Monitor size={13} className="cp-panel-icon" />
                  <span>Hardware & Assets</span>
                </div>

                <div className="cp-asset-list">
                  <div className="cp-asset-item">
                    <span className="cp-asset-label">Physical PC Available</span>
                    <span className={`cp-asset-val ${isPhysicalPcYes ? 'is-yes' : 'is-no'}`}>
                      <span className="cp-asset-dot" />
                      {isPhysicalPcYes ? 'Yes' : 'No'}
                    </span>
                  </div>

                  <div className="cp-asset-divider" />

                  <div className="cp-asset-item">
                    <span className="cp-asset-label">Computer Name</span>
                    <span className="cp-asset-val">
                      {info.computer_name ? (
                        <code className="cp-code">{info.computer_name}</code>
                      ) : (
                        <span className="cp-muted">—</span>
                      )}
                    </span>
                  </div>

                  <div className="cp-asset-divider" />

                  <div className="cp-asset-item">
                    <span className="cp-asset-label">
                      <MapPin size={11} /> PC Location
                    </span>
                    <span className="cp-asset-val">
                      {info.computer_location || <span className="cp-muted">—</span>}
                    </span>
                  </div>

                  <div className="cp-asset-divider" />

                  <div className="cp-asset-item">
                    <span className="cp-asset-label">
                      <MapPin size={11} /> Location Reference
                    </span>
                    <span className="cp-asset-val">
                      {info.computer_location_ref || info.computer_location_reference || (
                        <span className="cp-muted">—</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT DETAILS: General Information List */}
            <div className="cp-profile-details">
              <div className="cp-general-info-panel">
                <div className="cp-panel-header">
                  <div className="cp-panel-header-left">
                    <User size={13} className="cp-panel-icon" />
                    <span>General Information</span>
                  </div>
                  <span className="cp-panel-count">7 fields</span>
                </div>

                <div className="cp-info-list">
                  <div className="cp-info-row">
                    <div className="cp-info-block">
                      <div className="cp-info-label">
                        <Mail size={12} /> Email
                      </div>
                      <div className="cp-info-value">
                        {info.email ? (
                          <a href={`mailto:${info.email}`} className="cp-link">
                            {info.email}
                          </a>
                        ) : (
                          <span className="cp-muted">—</span>
                        )}
                      </div>
                    </div>

                    <div className="cp-info-block">
                      <div className="cp-info-label">
                        <Phone size={12} /> Mobile
                      </div>
                      <div className="cp-info-value">
                        {info.mobile || <span className="cp-muted">—</span>}
                      </div>
                    </div>
                  </div>

                  <div className="cp-info-row-divider" />

                  <div className="cp-info-row">
                    <div className="cp-info-block">
                      <div className="cp-info-label">
                        <User size={12} /> Reporting Manager
                      </div>
                      <div className="cp-info-value">
                        {info.manager_name || info.reporting_manager || info.manager || (
                          <span className="cp-muted">—</span>
                        )}
                      </div>
                    </div>

                    <div className="cp-info-block">
                      <div className="cp-info-label">
                        <Calendar size={12} /> Joining Date
                      </div>
                      <div className="cp-info-value">
                        {formattedJoiningDate || <span className="cp-muted">—</span>}
                      </div>
                    </div>
                  </div>

                  <div className="cp-info-row-divider" />

                  <div className="cp-info-row">
                    <div className="cp-info-block">
                      <div className="cp-info-label">
                        <Building2 size={12} /> Location
                      </div>
                      <div className="cp-info-value">
                        {info.location || <span className="cp-muted">—</span>}
                      </div>
                    </div>

                    <div className="cp-info-block">
                      <div className="cp-info-label">
                        <Phone size={12} /> Landline (Ext)
                      </div>
                      <div className="cp-info-value">
                        {info.landline ? (
                          `${info.landline} ${info.extension ? `(Ext: ${info.extension})` : ''}`
                        ) : (
                          <span className="cp-muted">—</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="cp-info-row-divider" />

                  <div className="cp-info-row">
                    <div className="cp-info-block">
                      <div className="cp-info-label">
                        <Monitor size={12} /> Webex ID
                      </div>
                      <div className="cp-info-value">
                        {info.webex_id || <span className="cp-muted">—</span>}
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* BOTTOM PANEL: Compact Leave Summary Data Strip */}
          {isManager && leaveSummary.length > 0 && (
            <div className="cp-leave-summary-panel">
              <div className="cp-panel-header">
                <Calendar size={13} className="cp-panel-icon" />
                <span>Leave Summary</span>
                <span className="cp-panel-count">{leaveSummary.length} categories</span>
              </div>

              <div className="cp-leave-grid">
                {leaveSummary.map((leave, idx) => {
                  const total = (leave.entitled || 0) + (leave.carried_forward || 0);
                  const used = leave.used || 0;
                  const pending = leave.pending || 0;
                  const available = leave.available ?? 0;

                  const usedPct = total > 0 ? (used / total) * 100 : 0;
                  const pendingPct = total > 0 ? (pending / total) * 100 : 0;

                  return (
                    <div className="cp-leave-item" key={idx}>
                      <div className="cp-leave-item-top">
                        <span className="cp-leave-name">{leave.leave_type || 'Leave'}</span>
                        <div className="cp-leave-avail">
                          <span className="cp-leave-avail-num">{available}</span>
                          <span className="cp-leave-avail-lbl">Quota</span>
                        </div>
                      </div>

                      <div className="cp-leave-bar">
                        <div
                          className="cp-bar-used"
                          style={{ width: `${usedPct}%` }}
                          title={`Used: ${used}`}
                        />
                        <div
                          className="cp-bar-pending"
                          style={{ width: `${pendingPct}%` }}
                          title={`Pending: ${pending}`}
                        />
                      </div>

                      <div className="cp-leave-substats">
                        <span>Used: <strong>{used}</strong></span>
                        <span>Pending: <strong>{pending}</strong></span>
                      </div>
                        {/* outstanding_debt is the live borrowed-against-next-year
                            figure under the generic negative-balance model —
                            advance_taken is a legacy field no longer updated
                            by new leave requests. */}
                        {leave.outstanding_debt > 0 && (
                          <div className="cp-leave-substats" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
                            <span>Advance: <strong>{leave.outstanding_debt}</strong></span>
                          </div>
                        )}
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

export default ConsultantProfileModal;
