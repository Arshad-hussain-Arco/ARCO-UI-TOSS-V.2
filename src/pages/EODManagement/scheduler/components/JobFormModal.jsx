import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';

const EMPTY = {
  name: '',
  command: '',
  nodeid: '',
  start_time: '',
  days: '',
  weekdays: '',
  retries: '0',
  description: '',
  waits_for: [],
  logic: 'AND',
  produces: [],
};

// Control-M keeps the time as HHMM; the time input wants HH:MM
const toInputTime = (hhmm) =>
  /^\d{4}$/.test(hhmm || '') ? `${hhmm.slice(0, 2)}:${hhmm.slice(2)}` : '';

const fromFields = (f) => ({
  name: f.name ?? '',
  command: f.command ?? '',
  nodeid: f.nodeid ?? '',
  start_time: toInputTime(f.start_time),
  days: f.days ?? '',
  weekdays: f.weekdays ?? '',
  retries: String(f.retries ?? '0'),
  description: f.description ?? '',
  waits_for: f.waits_for ?? [],
  logic: f.logic ?? 'AND',
  produces: f.produces ?? [],
});

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** A list of condition names: type one and press Enter (or Add); suggestions come from the conditions already in the workflow. */
function ConditionList({ label, hint, items, onChange, suggestions, listId }) {
  const [text, setText] = useState('');
  const add = () => {
    const name = text.trim();
    if (!name || items.some((i) => i.name === name)) {
      setText('');
      return;
    }
    onChange([...items, { name, odate: 'ODAT' }]);
    setText('');
  };
  return (
    <div className="eodsch-field">
      <span>{label}</span>
      <div className="eodsch-chips">
        {items.map((c) => (
          <span key={c.name} className="eodsch-chip eodsch-tone-idle">
            {c.name}
            {c.odate && c.odate !== 'ODAT' ? ` (${c.odate})` : ''}
            <button
              type="button"
              className="eodsch-chip-x"
              aria-label={`Remove ${c.name}`}
              onClick={() => onChange(items.filter((i) => i.name !== c.name))}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {!items.length ? <span className="eodsch-muted">none</span> : null}
      </div>
      <div className="eodsch-actions">
        <input
          type="text"
          list={listId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder="condition name"
          aria-label={`${label}: condition name`}
        />
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <Button size="sm" variant="outline" onClick={add} disabled={!text.trim()}>
          Add
        </Button>
      </div>
      {hint ? <small className="eodsch-muted">{hint}</small> : null}
    </div>
  );
}

/**
 * Add a job to a workflow, or edit one. Editing loads the job's current values from the server and sends back only what was changed, so
 * everything else in the exported XML stays exactly as it was. The server checks every value and answers with a readable message.
 */
export function JobFormModal({
  isOpen,
  onClose,
  mode,
  env,
  workflowId,
  folder,
  job,
  baseSha256,
  nodeids,
  conditions,
  onSave,
}) {
  const [form, setForm] = useState(EMPTY);
  const [initial, setInitial] = useState(EMPTY);
  const [base, setBase] = useState(baseSha256);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const editing = mode === 'edit';

  useEffect(() => {
    if (!isOpen) return undefined;
    setError('');
    setBase(baseSha256);
    if (!editing) {
      setForm(EMPTY);
      setInitial(EMPTY);
      return undefined;
    }
    let alive = true;
    setLoading(true);
    svc
      .getJobFields(env, workflowId, folder, job)
      .then((fields) => {
        if (!alive) return;
        const loaded = fromFields(fields);
        setForm(loaded);
        setInitial(loaded);
        setBase(fields.base_sha256);
      })
      .catch((err) => alive && setError(errorText(err)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editing, env, workflowId, folder, job]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const retriesOk = /^\d{1,2}$/.test(form.retries.trim());
  const valid = form.name.trim() && form.command.trim() && retriesOk;

  const changed = useMemo(
    () => Object.keys(EMPTY).filter((k) => !same(form[k], initial[k])),
    [form, initial],
  );

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const keys = editing ? changed : Object.keys(EMPTY);
      const payload = {};
      keys.forEach((k) => {
        if (!editing && k === 'logic' && form.waits_for.length < 2) return;
        payload[k] = k === 'retries' ? Number(form.retries) : form[k];
      });
      if (payload.waits_for === undefined && payload.logic !== undefined && !form.waits_for.length)
        delete payload.logic;
      await onSave({ ...payload, base_sha256: base });
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const nothingChanged = editing && !changed.length;

  return (
    <AdminModal
      title={editing ? `Edit job ${job}` : `Add job to ${folder}`}
      isOpen={isOpen}
      onClose={() => !busy && onClose()}
      size="lg"
      isLoading={loading}
      loadingMessage="Loading the job…"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={busy} disabled={!valid || nothingChanged || loading}>
            {editing ? 'Save changes' : 'Add job'}
          </Button>
        </>
      }
    >
      <div className="eodsch-form eodsch-jobform">
        <label className="eodsch-field">
          Job name
          <input type="text" value={form.name} maxLength={255} onChange={set('name')} />
        </label>
        <label className="eodsch-field eodsch-span-2">
          Command
          <input
            type="text"
            value={form.command}
            onChange={set('command')}
            placeholder="/opt/app/scripts/run_eod.sh --date %%ODATE"
            spellCheck={false}
          />
          <small className="eodsch-muted">
            Runs over SSH on the target server. It is checked again when the workflow is reviewed.
          </small>
        </label>
        <label className="eodsch-field">
          NODEID (which target server)
          <input type="text" list="eodsch-nodeids" value={form.nodeid} onChange={set('nodeid')} />
          <datalist id="eodsch-nodeids">
            {nodeids.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <small className="eodsch-muted">Must be mapped to a target server before approval.</small>
        </label>
        <label className="eodsch-field">
          Start time
          <input type="time" value={form.start_time} onChange={set('start_time')} />
          <small className="eodsch-muted">Leave empty for no planned time.</small>
        </label>
        <label className="eodsch-field">
          Days
          <input
            type="text"
            value={form.days}
            onChange={set('days')}
            placeholder="ALL or 1,15,31"
            maxLength={100}
          />
        </label>
        <label className="eodsch-field">
          Weekdays
          <input
            type="text"
            value={form.weekdays}
            onChange={set('weekdays')}
            placeholder="0 = Sunday … 6 = Saturday"
            maxLength={100}
          />
        </label>
        <label className="eodsch-field">
          Retries (0–99)
          <input type="number" min={0} max={99} value={form.retries} onChange={set('retries')} />
          {!retriesOk ? <small className="eodsch-bad">A whole number from 0 to 99.</small> : null}
        </label>
        <label className="eodsch-field eodsch-span-2">
          Description (optional)
          <input
            type="text"
            value={form.description}
            maxLength={1000}
            onChange={set('description')}
          />
        </label>
        <div className="eodsch-span-2">
          <ConditionList
            label="Waits for"
            hint="The job starts when these conditions exist."
            items={form.waits_for}
            onChange={(items) => setForm((f) => ({ ...f, waits_for: items }))}
            suggestions={conditions}
            listId="eodsch-conds-in"
          />
          {form.waits_for.length > 1 ? (
            <label className="eodsch-field-inline">
              Start when
              <select value={form.logic} onChange={set('logic')}>
                <option value="AND">all of them exist (AND)</option>
                <option value="OR">any one of them exists (OR)</option>
              </select>
            </label>
          ) : null}
        </div>
        <div className="eodsch-span-2">
          <ConditionList
            label="Produces"
            hint="Conditions this job adds when it finishes OK."
            items={form.produces}
            onChange={(items) => setForm((f) => ({ ...f, produces: items }))}
            suggestions={conditions}
            listId="eodsch-conds-out"
          />
        </div>
        {error ? (
          <div className="eodsch-error eodsch-span-2" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </AdminModal>
  );
}

export default JobFormModal;
