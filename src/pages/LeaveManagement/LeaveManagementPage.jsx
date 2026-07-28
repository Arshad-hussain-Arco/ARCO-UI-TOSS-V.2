import { useState } from 'react';
import {
  Calendar,
  Users,
  BarChart3,
  Search,
  List,
  CalendarDays,
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  FileCheck,
  X,
  Edit,
  SlidersHorizontal,
} from 'lucide-react';
import { LeaveCard } from '@components/data-display/LeaveCard/LeaveCard';
import { LeaveCalendar } from '@components/data-display/LeaveCalendar/LeaveCalendar';
import { TeamLeaveSummary } from '@components/data-display/TeamLeaveSummary/TeamLeaveSummary';

import { ApplyLeaveModal } from './ApplyLeaveModal';
import { TeamRequestsTab } from './TeamRequestsTab';
import { LeaveConfigurationTab } from './LeaveConfigurationTab';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { MY_LEAVE_EVENTS } from '@mocks/data/leave';

import './LeaveManagementPage.css';
import './LeaveTable.css';
const tabs = [
  { id: 'my-leaves', label: 'Apply Leave', icon: Calendar },
  { id: 'team-requests', label: 'Team Leave Requests', icon: Users },
  { id: 'team-summary', label: 'Team Leave Summary', icon: BarChart3 },
  { id: 'leave-config', label: 'Leave Configuration', icon: SlidersHorizontal },
];
export function LeaveManagementPage() {
  useDocumentTitle('Leave Management');

  const [activeTab, setActiveTab] = useState('my-leaves');
  const [modalType, setModalType] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const currentDate = new Date();
  const [calendarYear, setCalendarYear] = useState(currentDate.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(currentDate.getMonth());
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
        <ApplyLeaveModal onClose={() => setModalType(null)} isAdmin={true} type={modalType} />
      )}
      <div className="leave-management-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="leave-management-tab"
              data-active={activeTab === tab.id}
            >
              <Icon className="leave-management-tab-icon" />
              <span className="leave-management-tab-label">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="leave-management-content">
        {activeTab === 'my-leaves' && (
          <>
            <div className="my-leaves-toolbar">
              <div className="my-leaves-search-wrapper">
                <Search className="my-leaves-search-icon" />
                <input type="text" placeholder="Search leaves..." className="my-leaves-search" />
              </div>
              <div className="my-leaves-actions">
                <button className="my-leaves-action-btn" onClick={() => setModalType('leave')}>
                  Apply Leave
                </button>
                <button className="my-leaves-action-btn" onClick={() => setModalType('wfh')}>
                  Apply WFH
                </button>
                <button className="my-leaves-action-btn" onClick={() => setModalType('offshore')}>
                  Apply Offshore Work
                </button>
                <button className="my-leaves-action-btn" onClick={() => setModalType('compoff')}>
                  Book Comp-off / Weekend Work
                </button>
              </div>
            </div>

            <div className="leave-cards-grid">
              <LeaveCard
                title="Leave Quota"
                centerCount={20}
                left={12}
                used={8}
                total={20}
                color="#006633"
              />
              <LeaveCard
                title="Carry Over"
                centerCount={5}
                left={5}
                used={0}
                total={5}
                color="#0891b2"
              />
              <LeaveCard
                title="Comp Off"
                centerCount={3}
                left={2}
                used={1}
                total={3}
                color="#8b5cf6"
              />
              <LeaveCard
                title="Sick Leaves"
                centerCount={10}
                left={7}
                used={3}
                total={10}
                color="#dc2626"
              />
              <LeaveCard
                title="Weekend Work"
                centerCount={4}
                left={4}
                used={0}
                total={4}
                color="#f59e0b"
              />
              <LeaveCard
                title="Booked Leave"
                centerCount={15}
                left={0}
                used={15}
                total={15}
                color="#059669"
              />
              <LeaveCard
                title="Upcoming"
                centerCount={6}
                left={6}
                used={0}
                total={6}
                color="#3b82f6"
              />
              <LeaveCard
                title="Completed"
                centerCount={12}
                left={0}
                used={12}
                total={12}
                color="#10b981"
              />
              <LeaveCard
                title="Offshore Work"
                centerCount={8}
                left={5}
                used={3}
                total={8}
                color="#6366f1"
              />
            </div>

            <div className="leave-content-split-section" style={{ display: 'block' }}>
              <div className="leave-content-left" style={{ width: '100%' }}>
                <div className="leave-filters-section">
                  <div className="leave-filters-row">
                    <div className="leave-filters-container">
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'all'}
                        onClick={() => setFilterStatus('all')}
                      >
                        <span className="leave-filter-label">All</span>
                        <span className="leave-filter-badge">1</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'pending'}
                        onClick={() => setFilterStatus('pending')}
                      >
                        <span className="leave-filter-label">Pending</span>
                        <span className="leave-filter-badge">0</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'approved'}
                        onClick={() => setFilterStatus('approved')}
                      >
                        <span className="leave-filter-label">Approved</span>
                        <span className="leave-filter-badge">1</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'rejected'}
                        onClick={() => setFilterStatus('rejected')}
                      >
                        <span className="leave-filter-label">Rejected</span>
                        <span className="leave-filter-badge">0</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'self-rejected'}
                        onClick={() => setFilterStatus('self-rejected')}
                      >
                        <span className="leave-filter-label">Self Rejected</span>
                        <span className="leave-filter-badge">0</span>
                      </button>
                      <button
                        className="leave-filter-chip"
                        data-active={filterStatus === 'offshore'}
                        onClick={() => setFilterStatus('offshore')}
                      >
                        <span className="leave-filter-label">Offshore work</span>
                        <span className="leave-filter-badge">1</span>
                      </button>
                    </div>

                    <div className="view-mode-segmented">
                      <button
                        className="view-mode-segment"
                        data-active={viewMode === 'list'}
                        onClick={() => setViewMode('list')}
                      >
                        <List className="view-mode-icon" />
                      </button>
                      <button
                        className="view-mode-segment"
                        data-active={viewMode === 'calendar'}
                        onClick={() => setViewMode('calendar')}
                      >
                        <CalendarDays className="view-mode-icon" />
                      </button>
                    </div>

                    <div className="export-button-wrapper">
                      <button
                        className="export-button font-[Helvetica]"
                        onClick={() => setShowExportDropdown(!showExportDropdown)}
                      >
                        <Download className="export-button-icon" />
                        <span className="export-button-label font-[Helvetica]">Export</span>
                        <ChevronDown className="export-button-chevron" />
                      </button>

                      {showExportDropdown && (
                        <div className="export-dropdown">
                          <button
                            className="export-dropdown-item"
                            onClick={() => {
                              setShowExportDropdown(false);
                            }}
                          >
                            <FileSpreadsheet className="export-dropdown-icon" />
                            <span className="export-dropdown-label">Excel</span>
                          </button>
                          <button
                            className="export-dropdown-item"
                            onClick={() => {
                              setShowExportDropdown(false);
                            }}
                          >
                            <FileText className="export-dropdown-icon" />
                            <span className="export-dropdown-label">PDF</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {viewMode === 'list' ? (
                  <div className="leave-table-container">
                    <table className="leave-table">
                      <colgroup>
                        <col style={{ width: '15%' }} />
                        <col style={{ width: '25%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '20%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                      </colgroup>
                      <thead className="leave-table-thead">
                        <tr className="leave-table-header-row">
                          <th className="leave-table-header">LEAVE TYPE</th>
                          <th className="leave-table-header">DATES</th>
                          <th className="leave-table-header">WORK DAYS</th>
                          <th className="leave-table-header">LEAVE REASON</th>
                          <th className="leave-table-header">STATUS</th>
                          <th className="leave-table-header">COMMENTS</th>
                          <th className="leave-table-header">ACTION</th>
                        </tr>
                      </thead>
                      <tbody className="leave-table-tbody">
                        <tr className="leave-table-row">
                          <td className="leave-table-cell" data-label="Leave Type">
                            Annual Leave
                          </td>
                          <td className="leave-table-cell" data-label="Dates">
                            <div className="leave-table-dates">
                              <span className="leave-table-date-text text-[14px]">
                                Fri, 05 Dec 2025
                              </span>
                              <span className="leave-table-date-duration">(1 day)</span>
                            </div>
                          </td>
                          <td className="leave-table-cell" data-label="Work Days">
                            1
                          </td>
                          <td className="leave-table-cell" data-label="Leave Reason">
                            End of Meet
                          </td>
                          <td className="leave-table-cell" data-label="Status">
                            <span className="leave-table-status" data-status="approved">
                              approved
                            </span>
                          </td>
                          <td className="leave-table-cell" data-label="Comments">
                            <button className="leave-table-icon-button" title="View Comments">
                              <FileCheck className="leave-table-icon" />
                            </button>
                          </td>
                          <td className="leave-table-cell" data-label="Action">
                            <div className="leave-table-actions">
                              <button className="leave-table-action-button" title="Cancel Request">
                                <X className="leave-table-action-icon" />
                              </button>
                              <button className="leave-table-action-button" title="Edit Request">
                                <Edit className="leave-table-action-icon" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        <tr className="leave-table-row">
                          <td className="leave-table-cell" data-label="Leave Type">
                            Annual Leave
                          </td>
                          <td className="leave-table-cell" data-label="Dates">
                            <div className="leave-table-dates">
                              <span className="leave-table-date-text text-[14px]">
                                Mon, 08 Dec 2025 - Tue, 09 Dec 2025
                              </span>
                              <span className="leave-table-date-duration">(2 days)</span>
                            </div>
                          </td>
                          <td className="leave-table-cell" data-label="Work Days">
                            2
                          </td>
                          <td className="leave-table-cell" data-label="Leave Reason">
                            Annual Leave
                          </td>
                          <td className="leave-table-cell" data-label="Status">
                            <span className="leave-table-status" data-status="approved">
                              approved
                            </span>
                          </td>
                          <td className="leave-table-cell" data-label="Comments">
                            <button className="leave-table-icon-button" title="View Comments">
                              <FileCheck className="leave-table-icon" />
                            </button>
                          </td>
                          <td className="leave-table-cell" data-label="Action">
                            <div className="leave-table-actions">
                              <button className="leave-table-action-button" title="Cancel Request">
                                <X className="leave-table-action-icon" />
                              </button>
                              <button className="leave-table-action-button" title="Edit Request">
                                <Edit className="leave-table-action-icon" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        <tr className="leave-table-row">
                          <td className="leave-table-cell" data-label="Leave Type">
                            Offshore Work
                          </td>
                          <td className="leave-table-cell" data-label="Dates">
                            <div className="leave-table-dates">
                              <span className="leave-table-date-text text-[14px]">
                                Tue, 04 Nov 2025 - Wed, 12 Nov 2025
                              </span>
                              <span className="leave-table-date-duration">(8 days)</span>
                            </div>
                          </td>
                          <td className="leave-table-cell" data-label="Work Days">
                            4
                          </td>
                          <td className="leave-table-cell" data-label="Leave Reason">
                            Offshore Work Request
                          </td>
                          <td className="leave-table-cell" data-label="Status">
                            <span className="leave-table-status" data-status="approved">
                              approved
                            </span>
                          </td>
                          <td className="leave-table-cell" data-label="Comments">
                            <button className="leave-table-icon-button" title="View Comments">
                              <FileCheck className="leave-table-icon" />
                            </button>
                          </td>
                          <td className="leave-table-cell" data-label="Action">
                            <div className="leave-table-actions">
                              <button className="leave-table-action-button" title="Cancel Request">
                                <X className="leave-table-action-icon" />
                              </button>
                              <button className="leave-table-action-button" title="Edit Request">
                                <Edit className="leave-table-action-icon" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <LeaveCalendar
                    year={calendarYear}
                    month={calendarMonth}
                    events={MY_LEAVE_EVENTS}
                    onPrevMonth={handlePrevMonth}
                    onNextMonth={handleNextMonth}
                  />
                )}
              </div>
            </div>
          </>
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
