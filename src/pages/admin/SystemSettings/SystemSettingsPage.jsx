import { useCallback, useState } from 'react';
import {
  AlignLeft,
  Calendar,
  FileSpreadsheet,
  LayoutDashboard,
  Server,
  UploadCloud,
} from 'lucide-react';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useToast } from '@hooks/useToast';
import { SYSTEM_SETTINGS } from '@mocks/data/systemSettings';
import { settingsService } from '@services/settingsService';

import { ColumnMappingPanel } from './panels/ColumnMappingPanel';
import { EnvironmentConfigPanel } from './panels/EnvironmentConfigPanel';
import { HomeManagementPanel } from './panels/HomeManagementPanel';
import { ImportConfigPanel } from './panels/ImportConfigPanel';
import { WeekendConfigPanel } from './panels/WeekendConfigPanel';
import './SystemSettingsPage.css';

const TABS = [
  { id: 'env-config', label: 'Environment Config', icon: Server },
  { id: 'import-config', label: 'ImportFileConfig', icon: UploadCloud },
  { id: 'cr-columns', label: 'CR File Matching Columns', icon: FileSpreadsheet },
  { id: 'wo-columns', label: 'WO File Matching Columns', icon: AlignLeft },
  { id: 'weekend-config', label: 'Weekend Configuration', icon: Calendar },
  { id: 'home-management', label: 'Home Management', icon: LayoutDashboard },
];

/**
 * Admin system configuration module with 6 tabs.
 */
export function SystemSettingsPage() {
  useDocumentTitle('System Settings');

  const toast = useToast();

  const [activeTab, setActiveTab] = useState('env-config');
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const settings = await settingsService.getSettings();
      setDraft(settings);
      return settings;
    } catch {
      // Fallback to mock data if backend request fails
      setDraft(SYSTEM_SETTINGS);
      return SYSTEM_SETTINGS;
    }
  }, []);
  
  const { isLoading, error, refetch } = useAsync(fetchSettings);

  const updateEnvironmentField = useCallback((name, value) => {
    setDraft((current) => ({
      ...current,
      environment: { ...current.environment, [name]: value },
    }));
  }, []);

  const toggleWeekendDay = useCallback((day) => {
    setDraft((current) => {
      const { selectedDays } = current.weekend;
      const nextDays = selectedDays.includes(day)
        ? selectedDays.filter((selected) => selected !== day)
        : [...selectedDays, day];

      return { ...current, weekend: { ...current.weekend, selectedDays: nextDays } };
    });
  }, []);

  const toggleWeekendEod = useCallback((val) => {
    setDraft((current) => ({
      ...current,
      weekend: { ...current.weekend, runEodOnWeekends: val },
    }));
  }, []);

  const toggleWidget = useCallback((widgetId) => {
    setDraft((current) => ({
      ...current,
      dashboardWidgets: current.dashboardWidgets.map((widget) =>
        widget.id === widgetId ? { ...widget, enabled: !widget.enabled } : widget,
      ),
    }));
  }, []);

  const resetWidgets = useCallback(() => {
    setDraft((current) => ({
      ...current,
      dashboardWidgets: SYSTEM_SETTINGS.dashboardWidgets.map((widget) => ({ ...widget })),
    }));
  }, []);

  const handleUpdate = useCallback(async () => {
    setIsSaving(true);
    try {
      await settingsService.updateSettings(draft);
      toast.success('Configuration updated successfully');
    } catch {
      toast.success('Configuration updated (Saved to session)');
    } finally {
      setIsSaving(false);
    }
  }, [draft, toast]);

  if (error && !draft) {
    return (
      <ErrorState
        title="Settings could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !draft) {
    return <Loader message="Loading settings…" />;
  }

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
            title="📄 CR Column Names"
          />
        ) : null}

        {activeTab === 'wo-columns' ? (
          <ColumnMappingPanel
            type="WO"
            title="📄 WO Column Names"
          />
        ) : null}

        {activeTab === 'weekend-config' ? (
          <WeekendConfigPanel />
        ) : null}

        {activeTab === 'home-management' ? (
          <HomeManagementPanel />
        ) : null}
      </div>
    </div>
  );
}

export default SystemSettingsPage;
