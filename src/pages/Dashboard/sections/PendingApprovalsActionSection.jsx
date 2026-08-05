import React, { useState, useEffect, useMemo } from 'react';
import { Check, X, Clock } from 'lucide-react';
import httpClient from '@api/httpClient';
import { leaveService } from '@services/leaveService';
import { useAuth } from '@hooks/useAuth';
import './PendingApprovalsActionSection.css';
import LeaveRequestDrawer from '../../LeaveManagement/components/LeaveRequestDrawer';
import { fetchAndMapTeamLeaves, eachDay } from '../../LeaveManagement/TeamRequestsTab';
// Import TeamRequests CSS so the drawer styles apply correctly
import '../../LeaveManagement/TeamRequests.css';

/**
 * Section for managers to approve or reject pending leave requests.
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

  // Fetch full team leaves in background to populate drawer properly (team availability etc)
  useEffect(() => {
    if (pendingApprovals && pendingApprovals.length > 0) {
      const managerId = user?.emp_id || user?.id || 1;
      fetchAndMapTeamLeaves(managerId)
        .then(data => setTeamLeaves(data))
        .catch(console.error);
    }
  }, [pendingApprovals, user]);

  const openDrawer = (dashboardReq, actionType) => {
    // Try to find the full mapped request from teamLeaves array
    const fullReq = teamLeaves.find(r => r.id === dashboardReq.id.toString());
    
    // If not found, create a fallback mapped object based on dashboard data
    const req = fullReq || {
      id: dashboardReq.id.toString(),
      empId: dashboardReq.emp_id,
      name: dashboardReq.emp_name,
      team: dashboardReq.designation,
      type: dashboardReq.leave_type, // Guessing since it's not strongly typed in dashboard
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
    
    // Ensure endpoints are present
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
    <div className="dc-pa-section">
      <div className="dc-pa-header">
        <Clock size={14} />
        <span className="dc-pa-title">Action Required</span>
      </div>

      <div className="dc-pa-list">
        {pendingApprovals.map((req) => {
          const isLoading = loadingId === req.id.toString();
          
          return (
            <div key={req.id} className="dc-pa-card">
              <div className="dc-pa-info">
                <span className="dc-pa-name">{req.emp_name}</span>
                <span className="dc-pa-dept">{req.designation || 'N/A'}</span>
                
                <div className="dc-pa-details">
                <span className="dc-pa-type">{req.leave_type}</span>
                <span className="dc-pa-dates">
                  {req.start_date} - {req.end_date}
                </span>
                
                {req.sla_breached && (
                  <span className="dc-pa-sla-warning">
                    Overdue ({req.age_days}d)
                  </span>
                )}
              </div>
              </div>
              
              <div className="dc-pa-actions">
                <button 
                  className="dc-pa-btn dc-pa-approve" 
                  onClick={() => openDrawer(req, 'approve')}
                  disabled={isLoading}
                  title="Approve"
                >
                  <Check size={14} />
                </button>
                <button 
                  className="dc-pa-btn dc-pa-reject" 
                  onClick={() => openDrawer(req, 'reject')}
                  disabled={isLoading}
                  title="Reject"
                >
                  <X size={14} />
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
