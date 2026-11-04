import { Component, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Toggle } from '@components/ui/Toggle/Toggle';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { engineNotice, isEnvironmentCode } from './schedulerModel';
import { usePolling, useResource } from './useResource';
import { RunsPanel } from './components/RunsPanel';
import { SchedulePanel } from './components/SchedulePanel';
import { SettingsPanel } from './components/SettingsPanel';
import { TargetsPanel } from './components/TargetsPanel';
import { WorkflowPanel } from './components/WorkflowPanel';

import './SchedulerTab.css';

const SECTIONS = [
  { key: 'workflow', label: 'Workflow' },
  { key: 'runs', label: 'Runs' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'targets', label: 'Target servers' },
  { key: 'settings', label: 'Settings' },
];
const STORAGE_KEY = 'toss.eodScheduler.environment';

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

class TabBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
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
  const [section, setSection] = useState('workflow');
  const [focusRun, setFocusRun] = useState('');
  const [creating, setCreating] = useState(null);
  const [busy, setBusy] = useState(false);
  const canAdmin = hasPermission('EOD_SCHEDULER_SETTINGS');

  const list = useMemo(() => envs.data ?? [], [envs.data]);
  const current = list.find((e) => e.code === env) ?? null;

  useEffect(() => {
    if (!envs.data) return;
    if (!list.some((e) => e.code === env)) setEnv(list[0]?.code ?? '');
  }, [envs.data, list, env]);

  const choose = (code) => {
    setEnv(code);
    remember(code);
    setFocusRun('');
  };

  const create = async () => {
    setBusy(true);
    try {
      const made = await svc.createEnvironment(creating.code.trim(), creating.name.trim());
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

  if (envs.loading && !envs.data)
    return <p className="eodsch-muted eodsch-pad">Loading environments…</p>;
  if (envs.error) {
    return (
      <div className="eodsch-pad">
        <div className="eodsch-error" role="alert">
          {envs.error}
        </div>
      </div>
    );
  }

  const codeProblem =
    creating && creating.code && !isEnvironmentCode(creating.code)
      ? 'Letters, digits, - and _ only, starting with a letter or digit.'
      : '';

  return (
    <div className="eodsch">
      <div className="eodsch-envbar">
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
        {current ? (
          <span className="eodsch-muted">
            {current.engine
              ? `Engine ${current.engine.host || ''} serving it`
              : 'No engine is serving it right now'}
          </span>
        ) : null}
        <div className="eodsch-actions">
          {current && canAdmin ? (
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
              New environment
            </Button>
          ) : null}
        </div>
      </div>

      {engineNotice(current) ? (
        <div className={`eodsch-notice eodsch-notice-${engineNotice(current).tone}`} role="status">
          {engineNotice(current).text}
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
        <>
          <div className="eodsch-subtabs" role="tablist" aria-label="Scheduler sections">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={section === s.key}
                className="eodsch-subtab"
                data-active={section === s.key}
                onClick={() => setSection(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <TabBoundary key={`${env}-${section}`}>
            <div className="eodsch-section">
              {section === 'workflow' ? (
                <WorkflowPanel
                  env={env}
                  onRunStarted={(id) => {
                    setFocusRun(id || '');
                    setSection('runs');
                  }}
                />
              ) : null}
              {section === 'runs' ? <RunsPanel env={env} focusRun={focusRun} /> : null}
              {section === 'schedule' ? <SchedulePanel env={env} /> : null}
              {section === 'targets' ? <TargetsPanel env={env} /> : null}
              {section === 'settings' ? <SettingsPanel env={env} /> : null}
            </div>
          </TabBoundary>
        </>
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
  );
}

export default SchedulerTab;
