import { useState, useEffect } from 'react';
import {
  Calendar,
  Users,
  BarChart3,
  SlidersHorizontal,
} from 'lucide-react';
import { TeamLeaveSummary } from '@components/data-display/TeamLeaveSummary/TeamLeaveSummary';
import { Tabs } from '@components/common';

import { ApplyLeaveModal } from './ApplyLeaveModal';
import { EditLeaveModal } from './EditLeaveModal';
import { CancelLeaveModal } from './CancelLeaveModal';
import { TeamRequestsTab } from './TeamRequestsTab';
import { LeaveConfigurationTab } from './LeaveConfigurationTab';
import { MyLeavesTab } from './components/MyLeavesTab';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useAuth } from '@hooks/useAuth';
import leaveService from '@services/leaveService';
import { MY_LEAVE_EVENTS } from '@mocks/data/leave';

import './LeaveManagementPage.css';
import './LeaveTable.css';
const ALL_TABS = [
  { id: 'my-leaves', label: 'Apply Leave', icon: Calendar },
  { id: 'team-requests', label: 'Team Leave Requests', icon: Users },
  { id: 'team-summary', label: 'Team Leave Summary', icon: BarChart3 },
  { id: 'leave-config', label: 'Leave Configuration', icon: SlidersHorizontal, adminOnly: true },
];

export function LeaveManagementPage() {
  useDocumentTitle('Leave Management');

  const [activeTab, setActiveTab] = useState('my-leaves');
  const [modalType, setModalType] = useState(null);
  const [editModalLeave, setEditModalLeave] = useState(null);
  const [cancelModalLeave, setCancelModalLeave] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const currentDate = new Date();
  const [calendarYear, setCalendarYear] = useState(currentDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(currentDate.getMonth());

  const { user } = useAuth();
  const [leaveBalances, setLeaveBalances] = useState(null);
  const [leaves, setLeaves] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState(MY_LEAVE_EVENTS);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch only if we're on the relevant tab that needs this data
      if (activeTab !== 'my-leaves') return;

      setIsLoading(true);
      try {
        let targetEmpId = user?.emp_id;

        // Fetch explicitly from user-info if emp_id is missing
        if (!targetEmpId) {
          try {
            const { default: httpClient } = await import('@api/httpClient');
            const { default: endpoints } = await import('@api/endpoints');
            const res = await httpClient.get(endpoints.auth.userInfo);
            const info = res.data?.userInformation || res.data;
            targetEmpId = info?.empId || info?.emp_id || info?.employee_id;
          } catch (err) {
            console.error("Failed to fetch user-info", err);
          }
        }

        // If STILL no targetEmpId, we must abort instead of falling back to 1
        // to avoid "You can only access your own profile" error.
        if (!targetEmpId) {
          console.error("No valid emp_id found for logged-in user.");
          setIsLoading(false);
          return;
        }

        console.log("Fetching data for targetEmpId:", targetEmpId, "User:", user);

        try {
          const response = await leaveService.getLeaveBalance(targetEmpId);
          setLeaveBalances(response?.balances);
        } catch (e) {
          console.error("Failed to fetch leave balances", e);
        }

        try {
          const leavesResponse = await leaveService.getMyLeaves(targetEmpId);
          const userLeaves = Array.isArray(leavesResponse) ? leavesResponse : (leavesResponse?.results || []);
          setLeaves(userLeaves);
          setCalendarEvents(userLeaves);
        } catch (e) {
          console.error("Failed to fetch leaves", e);
        }

      } catch (error) {
        console.error("Failed to fetch leave data", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user, calendarYear, calendarMonth, activeTab, refreshKey]);

  const handlePrevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };
  const handleNextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };
  return (
    <div className="leave-management">
      {modalType && (
        <ApplyLeaveModal 
          onClose={(shouldRefresh) => {
            setModalType(null);
            if (shouldRefresh === true) {
              setRefreshKey(k => k + 1);
            }
          }} 
          isAdmin={true} 
          type={modalType} 
        />
      )}

      {editModalLeave && (
        <EditLeaveModal
          leave={editModalLeave}
          onClose={() => setEditModalLeave(null)}
          onSuccess={() => {
            setEditModalLeave(null);
            setRefreshKey(k => k + 1);
          }}
        />
      )}

      {cancelModalLeave && (
        <CancelLeaveModal
          leave={cancelModalLeave}
          onClose={() => setCancelModalLeave(null)}
          onSuccess={() => {
            setCancelModalLeave(null);
            setRefreshKey(k => k + 1);
          }}
        />
      )}
      <Tabs
        tabs={ALL_TABS.filter(tab => !tab.adminOnly || user?.isAdmin === 1 || user?.isAdmin === true || user?.role === 'admin' || user?.roleName?.includes('HR') || user?.role?.toLowerCase()?.includes('admin'))}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="leave-management-content">
        {activeTab === 'my-leaves' && (
          <MyLeavesTab
            isLoading={isLoading}
            leaveBalances={leaveBalances}
            leaves={leaves}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            viewMode={viewMode}
            setViewMode={setViewMode}
            showExportDropdown={showExportDropdown}
            setShowExportDropdown={setShowExportDropdown}
            calendarYear={calendarYear}
            calendarMonth={calendarMonth}
            calendarEvents={calendarEvents}
            handlePrevMonth={handlePrevMonth}
            handleNextMonth={handleNextMonth}
            setModalType={setModalType}
            setCancelModalLeave={setCancelModalLeave}
            setEditModalLeave={setEditModalLeave}
          />
        )}

        {activeTab === 'team-requests' && <TeamRequestsTab />}

        {false}

        {activeTab === 'team-summary' && <TeamLeaveSummary />}

        {activeTab === 'leave-config' && <LeaveConfigurationTab />}


      </div>
    </div>
  );
}
export default LeaveManagementPage;
