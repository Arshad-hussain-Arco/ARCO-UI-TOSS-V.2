import React, { useState, useEffect, useMemo } from 'react';
import { Edit, Trash, Clock } from 'lucide-react';
import { leaveService } from '@services/leaveService';
import { useAuth } from '@hooks/useAuth';
import LeaveRequestDrawer from '../../LeaveManagement/components/LeaveRequestDrawer';
import { fetchAndMapTeamLeaves, eachDay } from '../../LeaveManagement/TeamRequestsTab';
// Import TeamRequests CSS so the drawer styles apply correctly
import '../../LeaveManagement/TeamRequests.css';

/**
 * Section for managers to approve or reject pending leave requests in a highly compact, clean enterprise layout.
 */
export function PendingApprovalsActionSection({ pendingApprovals, onActionComplete }) {
  const { user } = useAuth();
  const [loadingId, setLoadingId] = useState(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerReq, setDrawerReq] = useState(null);
  const [drawerAction, setDrawerAction] = useState('view');
  const [teamLeaves, setTeamLeaves] = useState([]);

  // Internal drawer state passed down
  const [managerNote, setManagerNote] = useState('');
  const [rejectErr, setRejectErr] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Fetch full team leaves in background to populate drawer properly
  useEffect(() => {
    if (pendingApprovals && pendingApprovals.length > 0) {
      const managerId = user?.emp_id || user?.id || 1;
      fetchAndMapTeamLeaves(managerId)
        .then(data => setTeamLeaves(data))
        .catch(console.error);
    }
  }, [pendingApprovals, user]);

  const openDrawer = (dashboardReq, actionType) => {
    const fullReq = teamLeaves.find(r => r.id === dashboardReq.id.toString());

    const req = fullReq || {
      id: dashboardReq.id.toString(),
      empId: dashboardReq.emp_id,
      name: dashboardReq.emp_name,
      team: dashboardReq.designation,
      type: dashboardReq.leave_type,
      leaveType: dashboardReq.leave_type,
      startDate: dashboardReq.start_date || '',
      endDate: dashboardReq.end_date || '',
      duration: 'full',
      bizDays: dashboardReq.business_days || '?',
      requestedOn: '',
      status: 'pending',
      priority: 'normal',
      manager: dashboardReq.manager_name || 'N/A',
      designation: dashboardReq.designation || 'N/A',
      reason: dashboardReq.leave_reason || '',
      balance: null,
      conflicts: [],
    };

    req.approve_endpoint = dashboardReq.approve_endpoint;
    req.reject_endpoint = dashboardReq.reject_endpoint;

    setDrawerReq(req);
    setDrawerAction(actionType);
    setManagerNote('');
    setRejectErr(false);
    setShowConfirm(false);
    requestAnimationFrame(() => setDrawerOpen(true));
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => {
      setDrawerReq(null);
      setShowConfirm(false);
    }, 240);
  };

  const teamAvailability = useMemo(() => {
    if (!drawerReq || !teamLeaves || !drawerReq.startDate || !drawerReq.endDate) return null;
    const range = new Set(eachDay(drawerReq.startDate, drawerReq.endDate));
    const others = teamLeaves.filter(
      (r) =>
        r.id !== drawerReq.id &&
        r.status !== 'rejected' &&
        eachDay(r.startDate, r.endDate).some((d) => range.has(d))
    );
    return {
      total: others.length,
      onLeave: others.filter((r) => r.type === 'leave').length,
      onWfh: others.filter((r) => r.type === 'wfh').length,
      onOffshore: others.filter((r) => r.type === 'offshore').length,
      onCompoff: others.filter((r) => r.type === 'compoff').length,
      others,
    };
  }, [drawerReq, teamLeaves]);

  const handleApprove = async () => {
    if (!drawerReq) return;
    try {
      setLoadingId(drawerReq.id);
      const payload = {
        manager_id: user?.emp_id || user?.id || 1,
        reason: managerNote || 'Approved'
      };
      await leaveService.approveLeave(drawerReq.id, payload);
      if (onActionComplete) onActionComplete();
      closeDrawer();
    } catch (err) {
      console.error('Failed to approve request:', err);
      alert(`Failed to approve the leave request. ${err.response?.data?.error || err.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async () => {
    if (!drawerReq) return;
    if (!managerNote.trim()) {
      setRejectErr(true);
      return;
    }
    try {
      setLoadingId(drawerReq.id);
      const payload = {
        manager_id: user?.emp_id || user?.id || 1,
        reason: managerNote
      };
      await leaveService.rejectLeave(drawerReq.id, payload);
      if (onActionComplete) onActionComplete();
      closeDrawer();
    } catch (err) {
      console.error('Failed to reject request:', err);
      alert(`Failed to reject the leave request. ${err.response?.data?.error || err.message}`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div style={{ padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', marginBottom: '12px' }}>
        <Clock size={13} style={{ color: 'var(--c-primary)' }} />
        <h2 style={{ fontSize: '11px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Action Required
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {pendingApprovals.map((req) => {
          const isLoading = loadingId === req.id.toString();

          return (
            <div
              key={req.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '6px 10px',
                background: 'var(--surface-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '6px',
                height: '52px',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease'
              }}
              className="dc-action-row-hover"
            >
              {/* Employee Info - Left Column */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: '2px' }}>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={req.emp_name}
                >
                  {req.emp_name}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-tertiary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {req.designation || 'Team Member'} • {req.leave_type}
                  {req.sla_breached && (
                    <span style={{ color: 'var(--c-danger)', fontWeight: 600, marginLeft: '4px' }}>• Overdue</span>
                  )}
                </span>
              </div>

              {/* Action Buttons - Right Column */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                <button
                  type="button"
                  className="action-icon-btn edit"
                  onClick={() => openDrawer(req, 'approve')}
                  disabled={isLoading}
                  title="Approve"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check"><path d="M20 6 9 17l-5-5"></path></svg>
                </button>
                <button
                  type="button"
                  className="action-icon-btn delete"
                  onClick={() => openDrawer(req, 'reject')}
                  disabled={isLoading}
                  title="Reject"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <LeaveRequestDrawer
        open={drawerOpen}
        liveReq={drawerReq}
        drawerAction={drawerAction}
        teamAvailability={teamAvailability}
        managerNote={managerNote}
        setManagerNote={setManagerNote}
        rejectErr={rejectErr}
        setRejectErr={setRejectErr}
        showConfirm={showConfirm}
        setShowConfirm={setShowConfirm}
        isSubmittingAction={loadingId !== null}
        onClose={closeDrawer}
        onApprove={handleApprove}
        onReject={handleReject}
      />
    </div>
  );
}

export default PendingApprovalsActionSection;
