import { useState } from 'react';
import {
  FileSpreadsheet,
  LayoutDashboard,
  Server,
  UploadCloud,
} from 'lucide-react';

import { useDocumentTitle } from '@hooks/useDocumentTitle';

import { ColumnMappingPanel } from './panels/ColumnMappingPanel';
import { EnvironmentConfigPanel } from './panels/EnvironmentConfigPanel';
import { HomeManagementPanel } from './panels/HomeManagementPanel';
import { ImportConfigPanel } from './panels/ImportConfigPanel';
import './SystemSettingsPage.css';

const TABS = [
  { id: 'env-config', label: 'Environment Config', icon: Server },
  { id: 'import-config', label: 'Import File Config', icon: UploadCloud },
  { id: 'cr-columns', label: 'CR File Matching Columns', icon: FileSpreadsheet },
  { id: 'wo-columns', label: 'WO File Matching Columns', icon: FileSpreadsheet },
  { id: 'runtime-columns', label: 'Runtime Trends Matching Columns', icon: FileSpreadsheet },
  { id: 'home-management', label: 'Home Management', icon: LayoutDashboard },
];

/**
 * Admin system configuration module with 6 tabs. Each panel fetches and
 * saves its own data via settingsService — this page only owns tab
 * navigation.
 */
export function SystemSettingsPage() {
  useDocumentTitle('System Settings');

  const [activeTab, setActiveTab] = useState('env-config');

  return (
    <div className="ss-container">
      {/* ── Navigation Tabs ── */}
      <div className="ss-tabs-container" role="tablist" aria-label="System Settings Navigation">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`ss-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon className="ss-tab-icon" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Main Content ── */}
      <div className="ss-main-content">
        {activeTab === 'env-config' ? (
          <EnvironmentConfigPanel />
        ) : null}

        {activeTab === 'import-config' ? (
          <ImportConfigPanel />
        ) : null}

        {activeTab === 'cr-columns' ? (
          <ColumnMappingPanel
            type="CR"
            title="CR Column Names"
          />
        ) : null}

        {activeTab === 'wo-columns' ? (
          <ColumnMappingPanel
            type="WO"
            title="WO Column Names"
          />
        ) : null}

        {activeTab === 'runtime-columns' ? (
          <ColumnMappingPanel
            type="Runtime"
            title="Runtime Trends Column Names"
          />
        ) : null}

        {activeTab === 'home-management' ? (
          <HomeManagementPanel />
        ) : null}
      </div>
    </div>
  );
}

export default SystemSettingsPage;
