import { useState } from 'react';
import { Activity, Settings, Calendar, Zap } from 'lucide-react';
import { useDocumentTitle } from '@hooks/useDocumentTitle';

import { OverviewSection } from './components/OverviewSection';
import { ConfigSection } from './components/ConfigSection';
import { SchedulesSection } from './components/SchedulesSection';
import { ControlSection } from './components/ControlSection';
import { EodProvider } from './context/EodContext';

import './EODManagementPage.css';

/** End-of-day batch management: overview, configuration, schedules and controls. */
export function EODManagementPage() {
  useDocumentTitle('EOD Management');

  const [activeSection, setActiveSection] = useState('overview');

  const tabs = [
    { key: 'overview', label: 'Overview', Icon: Activity },
    { key: 'configuration', label: 'Configuration', Icon: Settings },
    { key: 'schedules', label: 'Schedules', Icon: Calendar },
    { key: 'control', label: 'Control', Icon: Zap },
  ];

  return (
    <EodProvider>
      <div className="eod-page">
        {/* ── Tabs (matching Leave Management page) ── */}
        <div className="eod-tabs">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              className="eod-tab"
              data-active={activeSection === key}
              onClick={() => setActiveSection(key)}
            >
              <Icon className="eod-tab-icon" />
              <span className="eod-tab-label">{label}</span>
            </button>
          ))}
        </div>

        {/* Body — shared state provided across all sections */}
        <div className="eod-body">
          {activeSection === 'overview' && <OverviewSection />}
          {activeSection === 'configuration' && <ConfigSection />}
          {activeSection === 'schedules' && <SchedulesSection />}
          {activeSection === 'control' && <ControlSection />}
        </div>
      </div>
    </EodProvider>
  );
}

export default EODManagementPage;
