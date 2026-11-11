import { useEffect, useMemo, useState } from 'react';
import { Activity, Settings, Calendar, Zap } from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { useDocumentTitle } from '@hooks/useDocumentTitle';

import { OverviewSection } from './components/OverviewSection';
import { ConfigSection } from './components/ConfigSection';
import { SchedulesSection } from './components/SchedulesSection';
import { ControlSection } from './components/ControlSection';
import { EodProvider } from './context/EodContext';

import './EODManagementPage.css';

const ALL_TABS = [
  { key: 'overview', label: 'Overview', Icon: Activity, permission: 'EOD_OVERVIEW_VIEW' },
  { key: 'configuration', label: 'Configuration', Icon: Settings, permission: 'EOD_CONFIG_VIEW' },
  { key: 'schedules', label: 'Schedules', Icon: Calendar, permission: 'EOD_SCHEDULE_VIEW' },
  { key: 'control', label: 'Control', Icon: Zap, permission: 'EOD_CONTROL_VIEW' },
];

/** End-of-day batch management: overview, configuration, schedules and controls. */
export function EODManagementPage() {
  useDocumentTitle('EOD Management');
  const { hasPermission } = useAuth();

  const tabs = useMemo(
    () => ALL_TABS.filter((tab) => hasPermission(tab.permission)),
    [hasPermission],
  );

  const [activeSection, setActiveSection] = useState(() => tabs[0]?.key ?? null);

  // Covers the case where `user`/permissions load in after this component's
  // first render (tabs starts empty, then becomes non-empty).
  useEffect(() => {
    if (!activeSection && tabs.length) {
      setActiveSection(tabs[0].key);
    } else if (activeSection && !tabs.some((tab) => tab.key === activeSection)) {
      // Active tab is no longer visible (e.g. permissions changed) — fall
      // back to the first tab still available, rather than showing a blank body.
      setActiveSection(tabs[0]?.key ?? null);
    }
  }, [tabs, activeSection]);

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
