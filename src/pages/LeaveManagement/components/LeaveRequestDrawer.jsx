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
  pendingModForLeave,
  managerNote,
  setManagerNote,
  rejectErr,
  setRejectErr,
  showConfirm,
  setShowConfirm,
  isSubmittingAction,
  onClose,
  onApprove,
  onReject,
  isReadOnly
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

  // Same normalization the inline "Duration" row below already does —
  // shared here so "Original Duration" can reuse it instead of repeating
  // the ternary chain.
  function durationLabel(d) {
    if (d === 'full' || d === 'Full Day' || !d) return 'Full Day';
    if (d === 'morning' || d === 'First Half' || d === 'FIRST_HALF') return 'First Half';
    if (d === 'afternoon' || d === 'Second Half' || d === 'SECOND_HALF') return 'Second Half';
    return d;
  }

  // Shared by the New/Original Duration rows below: a multi-day request's
  // duration isn't one value, it's a per-boundary FROM/TO pair (mid-range
  // days are always full day) — fromD/toD are only set at all when at
  // least one boundary is a half day. Falls back to the plain single-value
  // label (fallbackDuration) for a single-day request.
  function boundaryDurationLabel(fromD, toD, start, end, fallbackDuration) {
    if (fromD || toD) {
      return `${fmtDate(start)} (${
        fromD === 'SECOND_HALF' ? 'Second Half' : 'Full Day'
      }) → ${fmtDate(end)} (${
        toD === 'FIRST_HALF' ? 'First Half' : 'Full Day'
      })`;
    }
    return durationLabel(fallbackDuration);
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
              {/* employeeUsername (Employee.user_name) is shown here instead
                  of the emp_id — employeeId is kept around only for internal
                  lookups (e.g. LeaveManagementPage's employeeDirectory),
                  not meant to be a user-facing identifier. */}
              <span className="tr-emp-meta-item">{liveReq.employeeUsername || liveReq.employeeId}</span>
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
            <span className="tr-drow-value">
              {liveReq.leaveType ?? TYPE_CONFIG[liveReq.type]?.label}
            </span>
          </div>
          {liveReq.type === 'compoff' && !liveReq.isModRequest && (
            <div className="tr-drow">
              <span className="tr-drow-label">Claim Type</span>
              <span className="tr-drow-value">
                {liveReq.claimType === 'weekend' ? 'Weekend Work' : 'Compensatory Off'}
              </span>
            </div>
          )}
          {/* Only meaningful for a single-date mod request — origStartDate/
              origEndDate are just the FIRST row's own before-state, so for
              a grouped multi-date claim (see the Claimed Dates list below,
              which already shows each date's own before/after) this range
              would misrepresent the batch as if only its first date had
              ever changed. */}
          {liveReq.isModRequest && !(liveReq.claimDates && liveReq.claimDates.length > 1) && (
            <div className="tr-drow" style={{ alignItems: 'flex-start' }}>
              <span className="tr-drow-label">Original Dates</span>
              <span className="tr-drow-value" style={{ textDecoration: 'line-through', color: 'var(--text-tertiary)' }}>
                {fmtDate(liveReq.origStartDate)} → {fmtDate(liveReq.origEndDate)}
              </span>
            </div>
          )}
          {liveReq.claimDates && liveReq.claimDates.length > 1 ? (
            // Grouped multi-date claim submission (see groupClaimRows in
            // TeamRequestsTab) — the dates aren't a contiguous range, so
            // list each claimed date + duration instead of a single
            // From/To Date pair that would misrepresent the gap between them.
            <div className="tr-drow" style={{ alignItems: 'flex-start' }}>
              <span className="tr-drow-label">Claimed Dates</span>
              <span className="tr-drow-value">
                {liveReq.claimDates.map((cd) => {
                  // claimDates comes from two different grouping functions
                  // depending on which tab opened this drawer —
                  // TeamRequestsTab's groupClaimRows stores the short
                  // display form ('morning'/'afternoon'), while
                  // LeaveManagementPage's groupClaimLeaves stores the raw
                  // backend enum ('FIRST_HALF'/'SECOND_HALF') straight off
                  // leave_duration. Handle both instead of only one.
                  const halfLabel = cd.duration === 'morning' || cd.duration === 'FIRST_HALF'
                    ? 'First Half'
                    : cd.duration === 'afternoon' || cd.duration === 'SECOND_HALF'
                      ? 'Second Half'
                      : null;
                  // A grouped Modification Request row includes a 0-day
                  // entry for every date being REMOVED from the claim, and
                  // — for a brand-new date — one whose ORIGINAL in_days was
                  // 0 (see the matching table-cell treatment in
                  // TeamRequestsTab/LeaveManagementPage). Flag both instead
                  // of silently showing either as a plain claimed date.
                  const inDays = cd.inDays ?? cd.in_days;
                  const origInDays = cd.origInDays ?? cd.orig_in_days;
                  const origDuration = cd.origDuration ?? cd.orig_duration;
                  const isRemoval = liveReq.isModRequest && Number(inDays) === 0;
                  const isAddition = liveReq.isModRequest && Number(origInDays) === 0 && Number(inDays) > 0;
                  // A pure duration change (Full Day -> First Half, say) on
                  // an otherwise unchanged date has neither marker above —
                  // without this, only the NEW duration ever showed, with
                  // no hint it changed at all.
                  const isDurationChange = liveReq.isModRequest && !isRemoval && !isAddition
                    && origDuration && durationLabel(origDuration) !== (halfLabel || 'Full Day');
                  return (
                    <div key={cd.id} style={isRemoval ? { textDecoration: 'line-through', opacity: 0.7 } : undefined}>
                      {fmtDate(cd.date)}
                      {isRemoval ? (
                        <span style={{ color: 'var(--c-danger)', textDecoration: 'none' }}> (Removed)</span>
                      ) : (
                        <>
                          {halfLabel && <> ({halfLabel})</>}
                          {isAddition && <span style={{ color: 'var(--c-success, #16a34a)' }}> (Added)</span>}
                          {isDurationChange && (
                            <span style={{ color: 'var(--text-tertiary)', textDecoration: 'line-through' }}> (was {durationLabel(origDuration)})</span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </span>
            </div>
          ) : (
            <>
              <div className="tr-drow">
                <span className="tr-drow-label">
                  {liveReq.isModRequest ? 'New Start Date' : liveReq.type === 'compoff' ? 'From Date' : 'Start Date'}
                </span>
                <span className="tr-drow-value">{fmtDate(liveReq.startDate)}</span>
              </div>
              <div className="tr-drow">
                <span className="tr-drow-label">
                  {liveReq.isModRequest ? 'New End Date' : liveReq.type === 'compoff' ? 'To Date' : 'End Date'}
                </span>
                <span className="tr-drow-value">{fmtDate(liveReq.endDate)}</span>
              </div>
            </>
          )}
          {liveReq.isModRequest && liveReq.origReason && (
            <div className="tr-drow" style={{ alignItems: 'flex-start' }}>
              <span className="tr-drow-label">Original Reason</span>
              <span className="tr-drow-value" style={{ color: 'var(--text-tertiary)' }}>{liveReq.origReason}</span>
            </div>
          )}
          {(() => {
            if (!liveReq.isModRequest || (liveReq.claimDates && liveReq.claimDates.length > 1)) return null;
            const origLabel = boundaryDurationLabel(
              liveReq.origFromDateDuration, liveReq.origToDateDuration,
              liveReq.origStartDate, liveReq.origEndDate, liveReq.origDuration,
            );
            const newLabel = boundaryDurationLabel(
              liveReq.fromDateDuration, liveReq.toDateDuration,
              liveReq.startDate, liveReq.endDate, liveReq.duration,
            );
            // Compare the actual rendered labels (which fold in the
            // per-boundary FROM/TO halves for a multi-day request), not
            // just origDuration/duration — those two are only ever the
            // generic FULL_DAY flag on a multi-day request, so comparing
            // them directly would hide a real From/To half-day change
            // (e.g. Second Half → First Half edited to Second Half → Full
            // Day) behind an unchanged-looking "Full Day" on both sides.
            if (origLabel === newLabel) return null;
            return (
              <div className="tr-drow">
                <span className="tr-drow-label">Original Duration</span>
                <span className="tr-drow-value" style={{ textDecoration: 'line-through', color: 'var(--text-tertiary)' }}>
                  {origLabel}
                </span>
              </div>
            );
          })()}
          {liveReq.type !== 'offshore' && !(liveReq.claimDates && liveReq.claimDates.length > 1) && (
            <div className="tr-drow">
              <span className="tr-drow-label">{liveReq.isModRequest ? 'New Duration' : 'Duration'}</span>
              <span className="tr-drow-value">
                {boundaryDurationLabel(liveReq.fromDateDuration, liveReq.toDateDuration, liveReq.startDate, liveReq.endDate, liveReq.duration)}
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
                {liveReq.isModRequest
                  ? 'Modification Reason'
                  : liveReq.type === 'compoff'
                    ? 'Claim Reason'
                    : liveReq.type === 'wfh'
                      ? 'Reason for WFH'
                      : 'Reason'}
              </span>
              <span className="tr-drow-value" style={{ maxWidth: 220 }}>
                {liveReq.reason}
              </span>
            </div>
          )}
          {liveReq.cancellationReason && (
            <div className="tr-drow" style={{ alignItems: 'flex-start' }}>
              <span className="tr-drow-label">
                {liveReq.status === 'rejected' ? 'Rejection Reason' : 'Cancellation Reason'}
              </span>
              <span className="tr-drow-value" style={{ maxWidth: 220 }}>
                {liveReq.cancellationReason}
              </span>
            </div>
          )}
          {liveReq.justification && (
            <div className="tr-drow" style={{ alignItems: 'flex-start' }}>
              <span className="tr-drow-label">Justification</span>
              <span
                className="tr-drow-value"
                style={{
                  maxWidth: 220,
                  color: 'var(--c-danger)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                }}
                title="Exceeds available entitlement — employee-provided justification"
              >
                <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                {liveReq.justification}
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

        {/* Team Availability — not meaningful for a Claim (Weekend Work /
            Comp Off): a claim is always for a date the employee already
            worked in the past, so "who else is on leave that day" isn't a
            capacity signal the way it is for a regular leave request. */}
        {liveReq.type !== 'compoff' && teamAvailability && teamAvailability.total > 0 && (
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
            <div className="tr-avail-names" style={{ marginTop: '12px' }}>
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
            </div>
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
                state: 'active',
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

        {/* Rejecting an already-APPROVED leave that has a pending
            modification request auto-rejects that request too (see
            LeaveApprovalService.reject's cascade) — the manager should
            know that before confirming, not discover it afterwards. */}
        {drawerAction === 'reject' && pendingModForLeave && (
          <div className="tr-dsec">
            <div
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '10px 12px', borderRadius: 6,
                background: 'var(--c-warning-light, #fffbeb)',
                border: '1px solid var(--c-warning, #f59e0b)',
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1, color: 'var(--c-warning, #f59e0b)' }} />
              <span>
                This leave has a pending modification request (new dates:{' '}
                {fmtShort(pendingModForLeave.startDate)} → {fmtShort(pendingModForLeave.endDate)}
                ). Rejecting this leave will also reject that modification request.
              </span>
            </div>
          </div>
        )}

        {/* Manager Notes */}
        {!isReadOnly && drawerAction !== 'view' && (
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
          {!isReadOnly && rejectErr && (
            <span className="tr-footer-left-label">
              <AlertCircle size={11} />
              Comments required to reject
            </span>
          )}
        </div>
        <button className="tr-btn tr-btn-ghost" onClick={onClose}>
          {isReadOnly ? 'Close' : 'Cancel'}
        </button>
        {!isReadOnly && drawerAction !== 'view' && (liveReq.status === 'pending' || liveReq.status === 'approved' || liveReq.status === 'rejected') && (
          <>
            {drawerAction === 'reject' && liveReq.status !== 'rejected' && (
              <button 
                className="tr-btn tr-btn-danger" 
                onClick={onReject}
                disabled={isSubmittingAction}
              >
                <X size={11} />
                {isSubmittingAction ? 'Rejecting...' : 'Reject'}
              </button>
            )}
            {drawerAction === 'approve' && liveReq.status !== 'approved' && (
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
