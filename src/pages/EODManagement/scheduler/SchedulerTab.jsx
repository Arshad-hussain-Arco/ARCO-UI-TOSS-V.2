import { Component, useEffect, useMemo, useState, useRef } from 'react';
import { Calendar, Gauge, Plus, Server, Settings, Layers } from 'lucide-react';
import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Toggle } from '@components/ui/Toggle/Toggle';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { engineNotice, isEnvironmentCode } from './schedulerModel';
import { usePolling, useResource } from './useResource';
import { RunsPanel } from './components/RunsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { TargetsPanel } from './components/TargetsPanel';
import { CockpitTab } from '../cockpit/CockpitTab';
import { ServersQueueTab } from '../cockpit/ServersQueueTab';
import { WorkflowPanel } from './components/WorkflowPanel';
import { SchedulesNewSection } from '../components/SchedulesNewSection';

import './SchedulerTab.css';

// The old "Schedule" section (SchedulePanel) is intentionally removed: it was
// commented out of this list, so it could never render. Restore the import,
// the entry below and the render line if it is needed again.
const SECTIONS = [
  { key: 'cockpit', label: 'Control Run Cockpit', Icon: Gauge },
  { key: 'schedule', label: 'Schedule', Icon: Calendar },
  { key: 'targets', label: 'Target Server', Icon: Server },
  { key: 'settings', label: 'Settings', Icon: Settings },
  { key: 'serversQueue', label: 'Servers & Queue', Icon: Layers },
];
const STORAGE_KEY = 'toss.eodScheduler.environment';
const SECTION_STORAGE_KEY = 'toss.eodScheduler.section';

const remembered = () => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
};
const remember = (code) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* storage can be blocked: the choice simply is not remembered */
  }
};

const rememberedSection = () => {
  try {
    const s = window.localStorage.getItem(SECTION_STORAGE_KEY);
    return SECTIONS.some((sec) => sec.key === s) ? s : 'cockpit';
  } catch {
    return 'cockpit';
  }
};
const rememberSection = (sec) => {
  try {
    window.localStorage.setItem(SECTION_STORAGE_KEY, sec);
  } catch {
    /* ignore storage errors */
  }
};

class TabBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('EOD scheduler section crashed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="eodsch-pad">
        <div className="eodsch-error" role="alert">
          Something went wrong while showing this section:{' '}
          {String(this.state.error?.message || this.state.error)}
          <div>
            <Button size="sm" variant="outline" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * The Control-M style scheduler. Everything in it belongs to ONE environment (Dev, SIT, UAT ...): its own workflow, approval, settings, target
 * servers, runs and schedule. Switching environment never mixes data.
 */
export function SchedulerTab() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const envs = useResource(() => svc.listEnvironments(), []);
  usePolling(() => envs.reload(true), 15000); // who serves which environment changes without any click
  const [env, setEnv] = useState(remembered);
  const [section, setSectionState] = useState(rememberedSection);
  const setSection = (sec) => {
    setSectionState(sec);
    rememberSection(sec);
  };
  const [focusRun, setFocusRun] = useState('');
  const [creating, setCreating] = useState(null);
  const [busy, setBusy] = useState(false);
  const canAdmin = hasPermission('EOD_SCHEDULER_SETTINGS');

  const knownRunIdsRef = useRef(new Set());
  const initialRunsLoadedRef = useRef(false);

  // Monitor environment runs to auto-switch to Control Run Cockpit whenever any run triggers
  const envRuns = useResource(
    () => (env ? svc.getCockpitRuns(env).catch(() => svc.listRuns(env)) : Promise.resolve([])),
    [env],
  );

  const hasLiveRun = (envRuns.data || []).some((r) =>
    ['RUNNING', 'PAUSED', 'QUEUED'].includes(String(r.status || '').toUpperCase()),
  );
  usePolling(() => envRuns.reload(true), hasLiveRun ? 2000 : 15000);

  // Listen for explicit run trigger events across any subcomponent
  useEffect(() => {
    const onRunTriggered = (e) => {
      const { runId } = e.detail || {};
      if (runId) {
        knownRunIdsRef.current.add(String(runId));
        setFocusRun(String(runId));
        setSection('cockpit');
      }
    };
    window.addEventListener('eod-run-triggered', onRunTriggered);
    return () => window.removeEventListener('eod-run-triggered', onRunTriggered);
  }, []);

  // When env changes, reset run tracking
  useEffect(() => {
    knownRunIdsRef.current.clear();
    initialRunsLoadedRef.current = false;
    setFocusRun('');
  }, [env]);

  // Automatically switch to Control Run Cockpit when any new run is triggered
  useEffect(() => {
    const runs = envRuns.data || [];
    if (!runs.length) return;

    if (!initialRunsLoadedRef.current) {
      runs.forEach((r) => {
        const id = r.id || r.run_id;
        if (id) knownRunIdsRef.current.add(String(id));
      });
      initialRunsLoadedRef.current = true;
      // If any run is actively running right now on initial load, auto-show it in Control Run Cockpit
      const currentlyActiveRun = runs.find((r) =>
        ['RUNNING', 'PAUSED', 'QUEUED'].includes(String(r.status || '').toUpperCase()),
      );
      if (currentlyActiveRun) {
        const activeId = String(currentlyActiveRun.id || currentlyActiveRun.run_id);
        setFocusRun(activeId);
        setSection('cockpit');
      }
      return;
    }

    const newlyTriggeredRun = runs.find((r) => {
      const id = String(r.id || r.run_id || '');
      if (!id || knownRunIdsRef.current.has(id)) return false;
      const st = String(r.status || '').toUpperCase();
      const isLive = ['RUNNING', 'PAUSED', 'QUEUED'].includes(st);
      const startTs = new Date(r.started_at || r.started || 0).getTime();
      const isRecent = startTs > 0 && (Date.now() - startTs) < 45000;
      return isLive || isRecent;
    });

    if (newlyTriggeredRun) {
      const newId = String(newlyTriggeredRun.id || newlyTriggeredRun.run_id);
      knownRunIdsRef.current.add(newId);
      setFocusRun(newId);
      setSection('cockpit');
    }
  }, [envRuns.data]);

  const list = useMemo(() => envs.data ?? [], [envs.data]);
  const current = list.find((e) => e.code === env) ?? null;

  useEffect(() => {
    if (!envs.data) return;
    if (!list.some((e) => e.code === env)) {
      const next = list[0]?.code ?? '';
      setEnv(next);
      if (next) remember(next);
    }
  }, [envs.data, list, env]);

  const choose = (code) => {
    setEnv(code);
    remember(code);
    setFocusRun('');
  };

  const create = async () => {
    setBusy(true);
    try {
      // creating.code is already trimmed in the input's onChange
      const made = await svc.createEnvironment(creating.code, creating.name.trim());
      toast.success(`Environment ${made.code} created.`);
      setCreating(null);
      await envs.reload(true);
      choose(made.code);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const setEnabled = async (enabled) => {
    try {
      await svc.updateEnvironment(env, { enabled });
      toast.success(
        enabled
          ? 'Environment enabled.'
          : 'Environment disabled: its engine stops serving it and uploads are refused.',
      );
      envs.reload(true);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  // Only block the page when there is nothing to show. A failed background
  // poll must not replace the section the user is working in.
  if (envs.loading && !envs.data)
    return <p className="eodsch-muted eodsch-pad">Loading environments…</p>;
  if (envs.error && !envs.data) {
    return (
      <div className="eodsch-pad">
        <div className="eodsch-error" role="alert">
          {envs.error}
        </div>
      </div>
    );
  }

  const notice = current ? engineNotice(current) : null;

  const codeProblem =
    creating && creating.code && !isEnvironmentCode(creating.code)
      ? 'Letters, digits, - and _ only, starting with a letter or digit.'
      : '';

  return (
    <>
      {/* Same tab bar as the EOD Management page; environment controls sit on its right */}
      <div className="eod-tabs" role="tablist">
        <div className="eod-tabs-nav">
          {current
            ? SECTIONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={section === key}
                  className="eod-tab"
                  data-active={section === key}
                  onClick={() => setSection(key)}
                >
                  <Icon className="eod-tab-icon" />
                  <span className="eod-tab-label">{label}</span>
                </button>
              ))
            : null}
        </div>

        {/* Environment controls (hidden on global Servers & Queue tab) */}
        {section !== 'serversQueue' ? (
          <div className="eodsch-topbar-right">
            <label className="eodsch-field-inline">
              Environment
              <select
                value={env}
                onChange={(e) => choose(e.target.value)}
                disabled={!list.length}
                aria-label="Environment"
              >
                {list.map((e) => (
                  <option key={e.code} value={e.code}>
                    {e.code} — {e.name}
                    {e.enabled ? '' : ' (disabled)'}
                  </option>
                ))}
              </select>
            </label>
            {canAdmin && current ? (
              <div className="eodsch-field-inline">
                <span>Enabled</span>
                <Toggle
                  checked={current.enabled}
                  onChange={setEnabled}
                  ariaLabel="Environment enabled"
                />
              </div>
            ) : null}
            {canAdmin ? (
              <Button
                size="sm"
                variant="outline"
                leadingIcon={Plus}
                onClick={() => setCreating({ code: '', name: '' })}
              >
                New Environment
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="eod-body">
        <div className="eodsch">
          {envs.error && envs.data ? (
            <div className="eodsch-notice eodsch-notice-warn" role="status">
              Couldn&apos;t refresh environments: {envs.error}
            </div>
          ) : null}

          {notice ? (
            <div className={`eodsch-notice eodsch-notice-${notice.tone}`} role="status">
              {notice.text}
            </div>
          ) : null}

          {!current ? (
            <div className="eodsch-empty">
              <strong>No environment yet.</strong>
              <p className="eodsch-muted">
                {canAdmin
                  ? 'Create one (for example UAT) to upload a workflow and add its target servers.'
                  : 'Ask an administrator to create an environment for the scheduler.'}
              </p>
            </div>
          ) : (
            <TabBoundary key={`${env}-${section}`}>
              <div className="eodsch-section">
                {section === 'workflow' ? (
                  <WorkflowPanel
                    env={env}
                    onRunStarted={(id) => {
                      setFocusRun(id || '');
                      setSection('cockpit');
                    }}
                  />
                ) : null}
                {section === 'runs' ? <RunsPanel env={env} focusRun={focusRun} /> : null}
                {section === 'cockpit' ? (
                  <CockpitTab
                    key={env}
                    env={env}
                    focusRunId={focusRun}
                    onNavigateSection={setSection}
                  />
                ) : null}
                {section === 'schedule' ? <SchedulesNewSection selectedEnv={env} /> : null}
                {section === 'targets' ? (
                  <TargetsPanel env={env} onReturnToSchedule={() => setSection('schedule')} />
                ) : null}
                {section === 'serversQueue' ? (
                  <ServersQueueTab
                    env={env}
                    onNavigateEnv={(envCode) => {
                      choose(envCode);
                      setSection('cockpit');
                    }}
                  />
                ) : null}
                {section === 'settings' ? <SettingsPanel env={env} /> : null}
              </div>
            </TabBoundary>
          )}

          <AdminModal
            title="New environment"
            isOpen={Boolean(creating)}
            onClose={() => !busy && setCreating(null)}
            size="sm"
            footer={
              <>
                <Button variant="outline" onClick={() => setCreating(null)} disabled={busy}>
                  Cancel
                </Button>
                <Button
                  onClick={create}
                  isLoading={busy}
                  disabled={!creating?.code || !creating?.name.trim() || Boolean(codeProblem)}
                >
                  Create
                </Button>
              </>
            }
          >
            {creating ? (
              <div className="eodsch-form">
                <label className="eodsch-field">
                  Code (also the queue name, cannot be changed)
                  <input
                    type="text"
                    value={creating.code}
                    maxLength={50}
                    onChange={(e) => setCreating({ ...creating, code: e.target.value.trim() })}
                    placeholder="UAT"
                  />
                  {codeProblem ? <small className="eodsch-bad">{codeProblem}</small> : null}
                </label>
                <label className="eodsch-field">
                  Name
                  <input
                    type="text"
                    value={creating.name}
                    maxLength={255}
                    onChange={(e) => setCreating({ ...creating, name: e.target.value })}
                    placeholder="User acceptance testing"
                  />
                </label>
              </div>
            ) : null}
          </AdminModal>
        </div>
      </div>
    </>
  );
}

export default SchedulerTab;
