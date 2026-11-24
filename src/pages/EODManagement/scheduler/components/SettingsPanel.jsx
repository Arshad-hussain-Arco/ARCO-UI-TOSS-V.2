import { useEffect, useState } from 'react';
import { Button } from '@components/ui/Button/Button';
import { Toggle } from '@components/ui/Toggle/Toggle';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { parseVariables, settingsChanges } from '../schedulerModel';
import { useResource } from '../useResource';

const KEYS = [
  'max_parallel',
  'default_timeout',
  'missed_policy',
  'missed_grace_seconds',
  'assume_external_conditions',
  'ignore_calendars_on_force',
  'timezone',
  'ssh_execution_enabled',
  'variables',
];

/** The scheduler settings of one environment. Every setting here is part of the approval: saving a change cancels it. */
export function SettingsPanel({ env }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canEdit = hasPermission('EOD_SCHEDULER_SETTINGS');
  const stored = useResource(() => svc.getSettings(env), [env]);
  const [draft, setDraft] = useState(null);
  const [vars, setVars] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (stored.data) {
      setDraft(stored.data);
      setVars(JSON.stringify(stored.data.variables ?? {}, null, 2));
    }
  }, [stored.data]);

  if (stored.loading && !draft) return <p className="eodsch-muted">Loading settings…</p>;
  if (stored.error)
    return (
      <div className="eodsch-error" role="alert">
        {stored.error}
      </div>
    );
  if (!draft) return null;

  const parsed = parseVariables(vars);
  const next = {
    ...draft,
    variables: parsed.value ?? draft.variables,
    max_parallel: Number(draft.max_parallel),
    default_timeout: Number(draft.default_timeout),
    missed_grace_seconds: Number(draft.missed_grace_seconds),
  };
  const changes = settingsChanges(stored.data, next, KEYS);
  const numberProblem = [
    ['max_parallel', 1],
    ['default_timeout', 0],
    ['missed_grace_seconds', 0],
  ].find(([k, min]) => !Number.isInteger(next[k]) || next[k] < min);
  const problem =
    parsed.error ||
    (numberProblem
      ? `${numberProblem[0].replaceAll('_', ' ')} must be a whole number of at least ${numberProblem[1]}.`
      : '');
  const set = (k, v) => setDraft({ ...draft, [k]: v });

  const save = async () => {
    setBusy(true);
    try {
      await svc.updateSettings(env, changes);
      toast.success('Settings saved. If the workflow was approved, review and approve it again.');
      stored.reload(true);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="eodsch-card eodsch-form eodsch-settings">
      <p className="eodsch-muted">
        Settings of <strong>{env}</strong>. They are bound into the approval: saving a change means
        the workflow must be approved again.
      </p>
      <div className="eodsch-field-inline">
        <span>Run commands over SSH</span>
        <Toggle
          checked={Boolean(draft.ssh_execution_enabled)}
          disabled={!canEdit}
          onChange={(v) => set('ssh_execution_enabled', v)}
          ariaLabel="Run commands over SSH"
        />
      </div>
      <label className="eodsch-field">
        Jobs running at once per workflow
        <input
          type="number"
          min="1"
          disabled={!canEdit}
          value={draft.max_parallel}
          onChange={(e) => set('max_parallel', e.target.value)}
        />
      </label>
      <label className="eodsch-field">
        Default job timeout in seconds (0 = none)
        <input
          type="number"
          min="0"
          disabled={!canEdit}
          value={draft.default_timeout}
          onChange={(e) => set('default_timeout', e.target.value)}
        />
      </label>
      <label className="eodsch-field">
        Time zone of planned times
        <input
          type="text"
          disabled={!canEdit}
          value={draft.timezone}
          placeholder="e.g. Asia/Riyadh (blank = the server's local time)"
          onChange={(e) => set('timezone', e.target.value)}
        />
      </label>
      <label className="eodsch-field">
        A job whose time passed while the engine was down
        <select
          disabled={!canEdit}
          value={draft.missed_policy}
          onChange={(e) => set('missed_policy', e.target.value)}
        >
          <option value="skip">is skipped</option>
          <option value="run">runs late</option>
        </select>
      </label>
      <label className="eodsch-field">
        Grace period for missed jobs in seconds
        <input
          type="number"
          min="0"
          disabled={!canEdit}
          value={draft.missed_grace_seconds}
          onChange={(e) => set('missed_grace_seconds', e.target.value)}
        />
      </label>
      <div className="eodsch-field-inline">
        <span>Assume conditions no job creates are already present</span>
        <Toggle
          checked={Boolean(draft.assume_external_conditions)}
          disabled={!canEdit}
          onChange={(v) => set('assume_external_conditions', v)}
          ariaLabel="Assume external conditions"
        />
      </div>
      <div className="eodsch-field-inline">
        <span>A forced run ignores the day-of-week rules</span>
        <Toggle
          checked={Boolean(draft.ignore_calendars_on_force)}
          disabled={!canEdit}
          onChange={(v) => set('ignore_calendars_on_force', v)}
          ariaLabel="Forced run ignores calendars"
        />
      </div>
      <label className="eodsch-field">
        Extra variables available to every job (JSON)
        <textarea
          rows={5}
          spellCheck={false}
          disabled={!canEdit}
          value={vars}
          onChange={(e) => setVars(e.target.value)}
          className="eodsch-mono"
        />
      </label>
      {problem ? <small className="eodsch-bad">{problem}</small> : null}
      {canEdit ? (
        <div className="eodsch-actions">
          <Button
            onClick={save}
            isLoading={busy}
            disabled={!Object.keys(changes).length || Boolean(problem)}
          >
            Save changes
          </Button>
          <Button
            variant="outline"
            disabled={busy || !Object.keys(changes).length}
            onClick={() => {
              setDraft(stored.data);
              setVars(JSON.stringify(stored.data.variables ?? {}, null, 2));
            }}
          >
            Discard
          </Button>
        </div>
      ) : (
        <p className="eodsch-muted">You can view these settings but not change them.</p>
      )}
    </div>
  );
}

export default SettingsPanel;
