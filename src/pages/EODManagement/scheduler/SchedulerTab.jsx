import { Component, useEffect, useMemo, useState } from 'react';
import { Calendar, Network, PlayCircle, Gauge, Plus, Server, Settings } from 'lucide-react';
import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Toggle } from '@components/ui/Toggle/Toggle';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { eodService } from '@services/eodService';
import { engineNotice, isEnvironmentCode } from './schedulerModel';
import { usePolling, useResource } from './useResource';
import { RunsPanel } from './components/RunsPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { TargetsPanel } from './components/TargetsPanel';
import { CockpitTab } from '../cockpit/CockpitTab';
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
  } catch {}
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

  const list = useMemo(() => envs.data ?? [], [envs.data]);
  const current = list.find((e) => e.code === env) ?? null;

  // Preload schedules in the background so switching to the Schedule tab is instantaneous
  useEffect(() => {
    const timer = setTimeout(() => {
      eodService.getEodSchedules().catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, []);

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
      </div>

      <div className="eod-body">
        <div className="eodsch">
          {envs.error && envs.data ? (
            <div className="eodsch-notice eodsch-notice-warn" role="status">
              Couldn't refresh environments: {envs.error}
            </div>
          ) : null}

          {current ? (
            <div className="eodsch-statusbar">
              <span className="eodsch-muted">
                {current.engine ? 'Engine is serving it' : 'No engine is serving it right now'}
              </span>
              {canAdmin ? (
                <div className="eodsch-field-inline">
                  <span>Enabled</span>
                  <Toggle
                    checked={current.enabled}
                    onChange={setEnabled}
                    ariaLabel="Environment enabled"
                  />
                </div>
              ) : null}
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
                      setSection('runs'); // RunsPanel is the consumer of focusRun
                    }}
                  />
                ) : null}
                {section === 'runs' ? <RunsPanel env={env} focusRun={focusRun} /> : null}
                {section === 'cockpit' ? <CockpitTab key={env} env={env} /> : null}
                {section === 'schedule' ? (
                  <SchedulesNewSection
                    selectedEnv={env}
                    initialEnvironments={list}
                    onNavigateSection={(sec) => setSection(sec)}
                    onSelectEnv={(code) => choose(code)}
                  />
                ) : null}
                {section === 'targets' ? (
                  <TargetsPanel
                    env={env}
                    onReturnToSchedule={() => setSection('schedule')}
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