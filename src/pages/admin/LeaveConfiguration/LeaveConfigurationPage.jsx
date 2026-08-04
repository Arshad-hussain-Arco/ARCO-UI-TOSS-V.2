import { useState } from 'react';
import { Calendar, ListChecks } from 'lucide-react';

import { useDocumentTitle } from '@hooks/useDocumentTitle';

import { HolidaysTab } from './components/HolidaysTab';
import { LeaveTypesPoliciesTab } from './components/LeaveTypesPoliciesTab';
import { WorkScheduleTab } from './components/WorkScheduleTab';
import './LeaveConfigurationPage.css';

/**
 * Admin Panel Leave Configurations Page.
 */
export function LeaveConfigurationPage() {
  useDocumentTitle('Leave Configurations - Admin Panel');

  // Navigation tab state: 'holidays' | 'leave-types-policies' | 'work-schedule'
  const [activeTab, setActiveTab] = useState('holidays');
  const [holidaysCount, setHolidaysCount] = useState(0);
  const [leaveTypesCount, setLeaveTypesCount] = useState(0);

  return (
    <div className="lc-redesign-container">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="lc-page-header">
        <h1 className="lc-page-title">Leaves Configurations</h1>
      </div>

      {/* ── Tabbed Navigation Bar ─────────────────────────────────────────── */}
      <div className="lc-nav-tabs" role="tablist" aria-label="Leave configurations sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'holidays'}
          className={`lc-tab-btn ${activeTab === 'holidays' ? 'active' : ''}`}
          onClick={() => setActiveTab('holidays')}
        >
          <Calendar size={16} />
          <span>Holidays</span>
          <span className="lc-tab-count">{holidaysCount}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'leave-types-policies'}
          className={`lc-tab-btn ${activeTab === 'leave-types-policies' ? 'active' : ''}`}
          onClick={() => setActiveTab('leave-types-policies')}
        >
          <ListChecks size={16} />
          <span>Leave Types &amp; Policies</span>
          <span className="lc-tab-count">{leaveTypesCount}</span>
        </button>

        <button
          type="button"
          className={`lc-tab-btn ${activeTab === 'work-schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('work-schedule')}
        >
          <Calendar size={16} />
          <span>Work Schedule</span>
        </button>
      </div>

      {/* ── Mobile Tab Navigation (Dropdown) ── */}
      <div className="lc-nav-tabs-mobile">
        <select
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value)}
          className="lc-tab-select"
        >
          <option value="holidays">Holidays ({holidaysCount})</option>
          <option value="leave-types-policies">Leave Types &amp; Policies ({leaveTypesCount})</option>
          <option value="work-schedule">Work Schedule</option>
        </select>
      </div>

      {/* ── Main Tab Content ──────────────────────────────────────────────── */}
      <div className="lc-tab-content">
        {activeTab === 'holidays' && <HolidaysTab onCountChange={setHolidaysCount} />}
        {activeTab === 'leave-types-policies' && <LeaveTypesPoliciesTab onCountChange={setLeaveTypesCount} />}
        {activeTab === 'work-schedule' && <WorkScheduleTab />}
      </div>
    </div>
  );
}

export default LeaveConfigurationPage;
