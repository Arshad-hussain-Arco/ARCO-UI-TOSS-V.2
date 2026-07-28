import { useCallback, useState } from 'react';
import {
  AlignLeft,
  Calendar,
  CheckCircle2,
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
  { id: 'import-config', label: 'Import File Config', icon: UploadCloud },
  { id: 'cr-columns', label: 'CR File Matching Columns', icon: FileSpreadsheet },
  { id: 'wo-columns', label: 'WO File Matching Columns', icon: AlignLeft },
  { id: 'weekend-config', label: 'Weekend Configuration', icon: Calendar },
  { id: 'home-management', label: 'Home Management', icon: LayoutDashboard },
];

/**
 * Admin system configuration, one panel per tab.
 *
 * The page owns the loaded settings and the save action; each panel is a
 * controlled presentational component.
 */
export function SystemSettingsPage() {
  useDocumentTitle('System Configurations');

  const toast = useToast();

  const [activeTab, setActiveTab] = useState('env-config');
  const [draft, setDraft] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    const settings = await settingsService.getSettings();
    setDraft(settings);
    return settings;
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

  const toggleWeekendEod = useCallback(() => {
    setDraft((current) => ({
      ...current,
      weekend: { ...current.weekend, runEodOnWeekends: !current.weekend.runEodOnWeekends },
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
      toast.success('Configuration updated');
    } catch (caught) {
      toast.error('Configuration could not be saved', { description: caught.message });
    } finally {
      setIsSaving(false);
    }
  }, [draft, toast]);

  if (error) {
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
      <div className="ss-header">
        <div className="ss-header-titles">
          <h1>System Configurations</h1>
          <p>Manage and configure environment properties and system settings.</p>
        </div>
      </div>

      <div className="ss-tabs-container" role="tablist" aria-label="Configuration sections">
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

      <div className="ss-main-content">
        {activeTab === 'env-config' ? (
          <EnvironmentConfigPanel values={draft.environment} onChange={updateEnvironmentField} />
        ) : null}

        {activeTab === 'import-config' ? <ImportConfigPanel paths={draft.importPaths} /> : null}

        {activeTab === 'cr-columns' ? (
          <ColumnMappingPanel mappings={draft.columnMappings} title="CR file matching columns" />
        ) : null}

        {activeTab === 'wo-columns' ? (
          <ColumnMappingPanel mappings={draft.columnMappings} title="WO file matching columns" />
        ) : null}

        {activeTab === 'weekend-config' ? (
          <WeekendConfigPanel
            weekend={draft.weekend}
            onToggleDay={toggleWeekendDay}
            onToggleWeekendEod={toggleWeekendEod}
          />
        ) : null}

        {activeTab === 'home-management' ? (
          <HomeManagementPanel
            widgets={draft.dashboardWidgets}
            onToggleWidget={toggleWidget}
            onReset={resetWidgets}
          />
        ) : null}
      </div>

      <div className="ss-footer">
        <button type="button" className="ss-btn-update" onClick={handleUpdate} disabled={isSaving}>
          {isSaving ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Updating...
            </>
          ) : (
            <>
              <CheckCircle2 size={16} aria-hidden="true" />
              Update Configuration
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default SystemSettingsPage;
