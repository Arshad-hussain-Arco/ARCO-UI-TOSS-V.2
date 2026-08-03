import React from 'react';
import {
  Check,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { avatarColor, initials, fmtDate, fmtShort, TYPE_CONFIG } from '../TeamRequestsTab';

export function LeaveRequestDrawer({
  open,
  liveReq,
  drawerAction,
  teamAvailability,
  managerNote,
  setManagerNote,
  rejectErr,
  setRejectErr,
  showConfirm,
  setShowConfirm,
  isSubmittingAction,
  onClose,
  onApprove,
  onReject
}) {
  if (!liveReq) return null;

  function balClass(r) {
    if (!r.balance) return 'tr-bal-green';
    const rem = r.balance.available - r.balance.used - r.bizDays;
    return rem < 0 ? 'tr-bal-red' : rem <= 2 ? 'tr-bal-amber' : 'tr-bal-green';
  }

  function balPct(r) {
    if (!r.balance) return 100;
    return r.balance.available > 0
      ? (Math.max(0, r.balance.available - r.balance.used) / r.balance.available) * 100
      : 0;
  }

  return (
    <div className={`tr-drawer${open ? ' open' : ''}`}>
      {showConfirm && (
        <div className="tr-confirm-overlay">
          <div className="tr-confirm-card">
            <h3 className="tr-confirm-title">Confirm Approval</h3>
            <p className="tr-confirm-sub">
              Approve <strong>{liveReq.employeeName}</strong>&apos;s{' '}
              {liveReq.leaveType ?? TYPE_CONFIG[liveReq.type]?.label} request (
              {fmtShort(liveReq.startDate)} → {fmtShort(liveReq.endDate)}, {liveReq.bizDays}
              d)?
            </p>
            <div className="tr-confirm-actions">
              <button className="tr-btn tr-btn-ghost" onClick={() => setShowConfirm(false)}>
                Back
              </button>
              <button 
                className="tr-btn tr-btn-primary" 
                onClick={onApprove}
                disabled={isSubmittingAction}
              >
                <Check size={12} />
                {isSubmittingAction ? 'Approving...' : 'Confirm Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="tr-drawer-header">
        <span className="tr-drawer-title">
          {drawerAction === 'approve'
            ? 'Approve Request'
            : drawerAction === 'reject'
              ? 'Reject Request'
              : 'Request Details'}
        </span>
        <button className="tr-drawer-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <div className="tr-drawer-body">
        {/* Employee Summary */}
        <div className="tr-emp-summary">
          <div
            className="tr-emp-avatar"
            style={{ background: avatarColor(liveReq.employeeName) }}
          >
            {initials(liveReq.employeeName)}
          </div>
          <div>
            <div className="tr-emp-name">{liveReq.employeeName}</div>
            <div className="tr-emp-meta">
              <span className="tr-emp-meta-item">{liveReq.employeeId}</span>
              {liveReq.designation && <span className="tr-emp-meta-item">· {liveReq.designation}</span>}
              <span className="tr-emp-meta-item">· {liveReq.team}</span>
            </div>
            {liveReq.manager && (
              <div className="tr-emp-meta" style={{ marginTop: 2 }}>
                <span className="tr-emp-meta-item">Reports to: {liveReq.manager}</span>
              </div>
            )}
          </div>
        </div>

        {/* Request Info */}
        <div className="tr-dsec">
          <div className="tr-dsec-title">Request Information</div>
          <div className="tr-drow">
            <span className="tr-drow-label">Request Type</span>
            <span className={`tr-type-badge ${TYPE_CONFIG[liveReq.type]?.css}`}>
              {TYPE_CONFIG[liveReq.type]?.Icon && React.createElement(TYPE_CONFIG[liveReq.type].Icon, { size: 10 })}
              {liveReq.leaveType ?? TYPE_CONFIG[liveReq.type]?.label}
            </span>
          </div>
          {liveReq.type === 'compoff' && (
            <div className="tr-drow">
              <span className="tr-drow-label">Claim Type</span>
              <span className="tr-drow-value">
                {liveReq.claimType === 'weekend' ? 'Weekend Work' : 'Compensatory Off'}
              </span>
            </div>
          )}
          <div className="tr-drow">
            <span className="tr-drow-label">
              {liveReq.type === 'compoff' ? 'From Date' : 'Start Date'}
            </span>
            <span className="tr-drow-value">{fmtDate(liveReq.startDate)}</span>
          </div>
          <div className="tr-drow">
            <span className="tr-drow-label">
              {liveReq.type === 'compoff' ? 'To Date' : 'End Date'}
            </span>
            <span className="tr-drow-value">{fmtDate(liveReq.endDate)}</span>
          </div>
          {liveReq.type !== 'offshore' && (
            <div className="tr-drow">
              <span className="tr-drow-label">Duration</span>
              <span className="tr-drow-value">
                {liveReq.duration === 'full'
                  ? 'Full Day'
                  : liveReq.duration === 'morning'
                    ? 'First Half'
                    : 'Second Half'}
              </span>
            </div>
          )}
          <div className="tr-drow">
            <span className="tr-drow-label">Business Days</span>
            <span className="tr-drow-value">{liveReq.bizDays}d</span>
          </div>
          <div className="tr-drow">
            <span className="tr-drow-label">Applied On</span>
            <span className="tr-drow-value">{fmtDate(liveReq.requestedOn)}</span>
          </div>
          {liveReq.reason && liveReq.type !== 'offshore' && (
            <div className="tr-drow" style={{ alignItems: 'flex-start' }}>
              <span className="tr-drow-label">
                {liveReq.type === 'compoff'
                  ? 'Claim Reason'
                  : liveReq.type === 'wfh'
                    ? 'Reason for WFH'
                    : 'Reason'}
              </span>
              <span className={`tr-type-badge ${TYPE_CONFIG[liveReq.type]?.css}`} style={{ maxWidth: 220 }}>
                {TYPE_CONFIG[liveReq.type]?.Icon && React.createElement(TYPE_CONFIG[liveReq.type].Icon, { size: 10 })}
                {liveReq.reason}
              </span>
            </div>
          )}
          <div className="tr-drow">
            <span className="tr-drow-label">Status</span>
            <span className={`tr-status-badge tr-status-${liveReq.status}`}>
              {liveReq.status === 'pending' && <Clock size={9} />}
              {liveReq.status === 'approved' && <CheckCircle2 size={9} />}
              {liveReq.status === 'rejected' && <XCircle size={9} />}
              {liveReq.status.charAt(0).toUpperCase() + liveReq.status.slice(1)}
            </span>
          </div>
        </div>

        {/* Leave Balance */}
        {liveReq.balance && (
          <div className="tr-dsec">
            <div className="tr-dsec-title">
              Leave Balance — {liveReq.leaveType ?? 'Comp-off'}
            </div>
            <div className="tr-bal-wrap">
              {[
                ['Available', liveReq.balance.available],
                ['Used', liveReq.balance.used],
                ['Requested', liveReq.bizDays],
                [
                  'Remaining',
                  Math.max(
                    0,
                    liveReq.balance.available - liveReq.balance.used - liveReq.bizDays,
                  ),
                ],
              ].map(([l, v]) => (
                <div key={l} className="tr-bal-row">
                  <span className="tr-bal-label">{l}</span>
                  <span className="tr-bal-val">{v}d</span>
                </div>
              ))}
              <div className="tr-bal-track">
                <div
                  className={`tr-bal-fill ${balClass(liveReq)}`}
                  style={{ width: `${balPct(liveReq)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Team Availability */}
        {teamAvailability && teamAvailability.total > 0 && (
          <div className="tr-dsec">
            <div className="tr-dsec-title">Team Availability — Same Dates</div>
            <div className="tr-avail-grid">
              {[
                {
                  label: 'On Leave',
                  count: teamAvailability.onLeave,
                  color: '#1d4ed8',
                  bg: '#dbeafe',
                },
                {
                  label: 'WFH',
                  count: teamAvailability.onWfh,
                  color: '#065f46',
                  bg: '#d1fae5',
                },
                {
                  label: 'Offshore',
                  count: teamAvailability.onOffshore,
                  color: '#5b21b6',
                  bg: '#ede9fe',
                },
                {
                  label: 'Comp-off',
                  count: teamAvailability.onCompoff,
                  color: '#92400e',
                  bg: '#fef3c7',
                },
              ].map(({ label, count, color, bg }) => (
                <div key={label} className="tr-avail-card">
                  <div className="tr-avail-count" style={{ color }}>
                    {count}
                  </div>
                  <div className="tr-avail-label" style={{ background: bg, color }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
            {teamAvailability.others.slice(0, 4).map((r) => (
              <div key={r.id} className="tr-avail-name-row">
                <div
                  className="tr-avatar"
                  style={{
                    width: 20,
                    height: 20,
                    fontSize: 8,
                    background: avatarColor(r.employeeName),
                  }}
                >
                  {initials(r.employeeName)}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text-primary)', flex: 1 }}>
                  {r.employeeName}
                </span>
                <span
                  className={`tr-type-badge ${TYPE_CONFIG[r.type]?.css}`}
                  style={{ fontSize: 9.5, padding: '1px 5px' }}
                >
                  {r.leaveType ?? TYPE_CONFIG[r.type]?.label}
                </span>
              </div>
            ))}
            {teamAvailability.total >= 3 && (
              <div className="tr-conflict-card" style={{ marginTop: 8 }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  {teamAvailability.total} team members unavailable on the same dates. Review
                  capacity before approving.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Conflicts */}
        {liveReq.conflicts && liveReq.conflicts.length > 0 && (
          <div className="tr-dsec">
            <div className="tr-dsec-title">Conflicts & Notices</div>
            {liveReq.conflicts.map((c, i) => (
              <div key={i} className="tr-conflict-card">
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{c}</span>
              </div>
            ))}
          </div>
        )}

        {/* Approval Timeline */}
        <div className="tr-dsec">
          <div className="tr-dsec-title">Approval Timeline</div>
          <div className="tr-timeline">
            {[
              {
                label: 'Submitted',
                sub: `by ${liveReq.employeeName} on ${fmtDate(liveReq.requestedOn)}`,
                state: 'done',
              },
              {
                label: 'Pending Manager Approval',
                sub: liveReq.manager ? `Reporting to ${liveReq.manager}` : 'Awaiting action',
                state:
                  liveReq.status === 'pending'
                    ? 'active'
                    : liveReq.status === 'approved'
                      ? 'done'
                      : 'rejected',
              },
              {
                label:
                  liveReq.status === 'rejected'
                    ? 'Rejected'
                    : liveReq.status === 'approved'
                      ? 'Approved'
                      : 'Awaiting Decision',
                sub:
                  liveReq.status === 'pending'
                    ? 'Pending manager action'
                    : `Status: ${liveReq.status}`,
                state:
                  liveReq.status === 'pending'
                    ? 'waiting'
                    : liveReq.status === 'approved'
                      ? 'approved'
                      : 'rejected',
              },
            ].map((step, i, arr) => (
              <div key={i} className="tr-tl-step">
                <div className="tr-tl-track">
                  <div className={`tr-tl-dot ${step.state}`}>
                    {step.state === 'done' || step.state === 'approved' ? (
                      <Check size={9} />
                    ) : step.state === 'rejected' ? (
                      <X size={9} />
                    ) : step.state === 'active' ? (
                      <Clock size={9} />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < arr.length - 1 && <div className="tr-tl-line" />}
                </div>
                <div className="tr-tl-content">
                  <div className="tr-tl-label">{step.label}</div>
                  <div className="tr-tl-sub">{step.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manager Notes */}
        {(drawerAction !== 'view' || liveReq.status === 'pending') && (
          <div className="tr-dsec">
            <div className="tr-dsec-title">Manager Notes</div>
            <textarea
              className="tr-notes"
              placeholder="Enter approval or rejection comments…"
              value={managerNote}
              onChange={(e) => {
                setManagerNote(e.target.value);
                if (e.target.value.trim()) setRejectErr(false);
              }}
            />
            {rejectErr && (
              <p className="tr-notes-hint">
                <AlertCircle size={10} style={{ display: 'inline', marginRight: 3 }} />
                Comments are required to reject a request.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="tr-drawer-footer">
        <div className="tr-footer-left">
          {rejectErr && (
            <span className="tr-footer-left-label">
              <AlertCircle size={11} />
              Comments required to reject
            </span>
          )}
        </div>
        <button className="tr-btn tr-btn-ghost" onClick={onClose}>
          Cancel
        </button>
        {liveReq.status === 'pending' && (
          <>
            {(drawerAction === 'view' || drawerAction === 'reject') && (
              <button 
                className="tr-btn tr-btn-danger" 
                onClick={onReject}
                disabled={isSubmittingAction}
              >
                <X size={11} />
                {isSubmittingAction ? 'Rejecting...' : 'Reject'}
              </button>
            )}
            {(drawerAction === 'view' || drawerAction === 'approve') && (
              <button 
                className="tr-btn tr-btn-primary" 
                onClick={() => setShowConfirm(true)}
                disabled={isSubmittingAction}
              >
                <Check size={11} />
                Approve
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default LeaveRequestDrawer;
