import { useEffect, useMemo, useState } from 'react';
import { Calendar, Layers, Target, X } from 'lucide-react';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import {
  KINDS,
  WEEKDAYS,
  defaultForm,
  formToSpec,
  sortedTimes,
  specToForm,
  validateForm,
} from '../scheduler/scheduleSpec';
import './ScheduleForm.css';

const fmt = (iso) =>
  new Date(iso).toLocaleString([], { hour12: false, dateStyle: 'medium', timeStyle: 'short' });

/** "A → B + C → D": jobs in one step have no dependency on each other. */
const orderText = (waves) => waves.map((w) => w.join(' + ')).join(' → ');

/**
 * Create or edit a schedule: environment (fixed by the tab) → XML file → workflow → (job), then the recurrence.
 * The server validates, computes the run times shown in the preview and the prerequisites of a job.
 */
export function ScheduleFormModal({ isOpen, env, schedule, onClose, onSaved }) {
  const isEdit = Boolean(schedule?.id);
  const [tree, setTree] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [folder, setFolder] = useState('');
  const [scope, setScope] = useState('workflow');
  const [job, setJob] = useState('');
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [rec, setRec] = useState(() => defaultForm());
  const [newTime, setNewTime] = useState('12:00');
  const [closure, setClosure] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  // Load the environment's XML files, workflows and jobs once per open; fill the form from the schedule being edited.
  useEffect(() => {
    if (!isOpen) return undefined;
    let live = true;
    setTree(null);
    setLoadError('');
    setSaveError('');
    svc
      .getXmlTree(env)
      .then((data) => {
        if (!live) return;
        setTree(data);
        const files = data.workflows || [];
        const wf =
          files.find((w) => w.id === schedule?.workflow_id) ||
          files.find((w) => w.active) ||
          files[0];
        setWorkflowId(wf ? String(wf.id) : '');
        setFolder(schedule?.folder || wf?.folders?.[0]?.name || '');
      })
      .catch((err) => live && setLoadError(errorText(err)));
    setScope(schedule?.job ? 'job' : 'workflow');
    setJob(schedule?.job || '');
    setName(schedule?.name || '');
    setEnabled(schedule ? schedule.enabled : true);
    setRec(schedule?.recurrence ? specToForm(schedule.recurrence) : defaultForm());
    return () => {
      live = false;
    };
  }, [isOpen, env, schedule]);

  const files = useMemo(() => tree?.workflows || [], [tree]);
  const xml = files.find((w) => String(w.id) === String(workflowId));
  const folders = xml?.folders || [];
  const jobs = folders.find((f) => f.name === folder)?.jobs || [];

  // The prerequisites a job schedule will run first (authoritative: the engine's own dependency graph).
  useEffect(() => {
    setClosure(null);
    if (!isOpen || scope !== 'job' || !job || !workflowId || !folder) return undefined;
    let live = true;
    svc
      .getJobClosure(env, { workflow: workflowId, folder, job })
      .then((c) => live && setClosure(c))
      .catch((err) => live && setClosure({ error: errorText(err) }));
    return () => {
      live = false;
    };
  }, [isOpen, env, scope, job, workflowId, folder]);

  const errors = validateForm(rec);
  const spec = useMemo(() => formToSpec(rec), [rec]);
  const specKey = JSON.stringify(spec);
  const specOk = Object.keys(errors).length === 0;

  // Next run times from the server (debounced), so what the user sees is exactly what the engine will do.
  useEffect(() => {
    setPreview(null);
    if (!isOpen || !specOk) return undefined;
    let live = true;
    const t = setTimeout(() => {
      svc
        .previewRecurrence(env, spec, 5)
        .then((p) => live && setPreview(p))
        .catch((err) => live && setPreview({ error: errorText(err) }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // specKey stands for spec
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, env, specKey, specOk]);

  const set = (patch) => setRec((r) => ({ ...r, ...patch }));
  const toggleIn = (key, value) =>
    set({
      [key]: rec[key].includes(value) ? rec[key].filter((v) => v !== value) : [...rec[key], value],
    });
  const addTime = () => {
    const next = sortedTimes([...rec.times, newTime]);
    set({ times: next });
  };

  const pickXml = (id) => {
    setWorkflowId(id);
    const f = files.find((w) => String(w.id) === id)?.folders || [];
    setFolder(f[0]?.name || '');
    setJob('');
  };

  const canSave =
    specOk && Boolean(workflowId && folder) && (scope === 'workflow' || Boolean(job)) && !saving;

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setSaveError('');
    const body = {
      workflow_id: Number(workflowId),
      folder,
      job: scope === 'job' ? job : '',
      name: name.trim(),
      enabled,
      recurrence: spec,
    };
    try {
      const saved = isEdit
        ? await svc.updateSchedule(env, schedule.id, body)
        : await svc.createSchedule(env, body);
      onSaved(saved);
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const needsStart = ['once', 'yearly', 'every-hours', 'every-minutes'].includes(rec.kind);
  const monthly = ['monthly', 'quarterly', 'yearly'].includes(rec.kind);
  const everyKind = ['every-days', 'every-hours', 'every-minutes'].includes(rec.kind);

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Edit Schedule' : 'Add New Schedule'}
      size="md"
    >
      <form onSubmit={save} className="eod-schedule-modal-form schf">
        {loadError ? <div className="schf-error">{loadError}</div> : null}
        {!tree && !loadError ? (
          <p className="schf-muted">Loading the environment’s XML files…</p>
        ) : null}
        {tree && files.length === 0 ? (
          <div className="schf-error">
            No XML has been uploaded to {env} yet. Upload one in the Workflow tab first.
          </div>
        ) : null}

        {files.length > 0 && (
          <div className="eod-modal-field-group">
            <div className="schf-row">
              <label className="eod-modal-field">
                <span className="eod-modal-label">ENVIRONMENT</span>
                <input className="eod-modal-input" value={env} disabled readOnly />
              </label>
              <label className="eod-modal-field">
                <span className="eod-modal-label">XML FILE</span>
                <select
                  className="eod-modal-input"
                  value={workflowId}
                  onChange={(e) => pickXml(e.target.value)}
                >
                  {files.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.filename}
                      {w.active ? ' (active)' : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {xml && !xml.active ? (
              <div className="schf-warn">
                This XML is not the active one. A schedule only runs while its XML is the active
                workflow.
              </div>
            ) : null}

            <label className="eod-modal-field">
              <span className="eod-modal-label">WORKFLOW</span>
              <select
                className="eod-modal-input"
                value={folder}
                onChange={(e) => {
                  setFolder(e.target.value);
                  setJob('');
                }}
              >
                {folders.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.name} ({f.jobs.length} jobs)
                  </option>
                ))}
              </select>
            </label>

            <div className="eod-modal-field">
              <span className="eod-modal-label">RUN SCOPE</span>
              <div className="eod-segmented-control" role="radiogroup" aria-label="Run scope">
                <button
                  type="button"
                  role="radio"
                  aria-checked={scope === 'workflow'}
                  className={`eod-segmented-btn ${scope === 'workflow' ? 'active' : ''}`}
                  onClick={() => setScope('workflow')}
                >
                  <Layers size={11} /> Entire workflow
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={scope === 'job'}
                  className={`eod-segmented-btn ${scope === 'job' ? 'active' : ''}`}
                  onClick={() => setScope('job')}
                >
                  <Target size={11} /> Single job
                </button>
              </div>
            </div>

            {scope === 'job' && (
              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="schf-job">
                  JOB <span className="req">*</span>
                </label>
                <select
                  id="schf-job"
                  className="eod-modal-input"
                  value={job}
                  onChange={(e) => setJob(e.target.value)}
                >
                  <option value="">Select a job…</option>
                  {jobs.map((j) => (
                    <option key={j.name} value={j.name}>
                      {j.name}
                      {j.predecessors.length ? ` (after ${j.predecessors.join(', ')})` : ''}
                    </option>
                  ))}
                </select>
                {closure?.error ? <span className="eod-field-error">{closure.error}</span> : null}
                {closure && !closure.error ? (
                  <div className="schf-note">
                    {closure.prerequisites.length ? (
                      <>
                        Its {closure.prerequisites.length} prerequisite job
                        {closure.prerequisites.length === 1 ? '' : 's'} run first, in dependency
                        order: <strong>{orderText(closure.waves)}</strong>
                      </>
                    ) : (
                      <>This job has no prerequisites, so only it runs.</>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            <label className="eod-modal-field">
              <span className="eod-modal-label">NAME (optional)</span>
              <input
                className="eod-modal-input"
                value={name}
                maxLength={255}
                placeholder={scope === 'job' && job ? `Job: ${job}` : 'e.g. Nightly payments'}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <div className="eod-modal-field">
              <label className="eod-modal-label" htmlFor="schf-kind">
                REPEATS
              </label>
              <select
                id="schf-kind"
                className="eod-modal-input"
                value={rec.kind}
                onChange={(e) => set({ kind: e.target.value })}
              >
                {KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>

            {everyKind && (
              <label className="eod-modal-field">
                <span className="eod-modal-label">
                  EVERY (
                  {rec.kind === 'every-days'
                    ? 'days'
                    : rec.kind === 'every-hours'
                      ? 'hours'
                      : 'minutes'}
                  )
                </span>
                <input
                  className={`eod-modal-input ${errors.every ? 'error' : ''}`}
                  type="number"
                  min={1}
                  value={rec.every}
                  onChange={(e) => set({ every: e.target.value })}
                />
                {errors.every ? <span className="eod-field-error">{errors.every}</span> : null}
              </label>
            )}

            {rec.kind === 'weekly' && (
              <div className="eod-modal-field">
                <span className="eod-modal-label">
                  DAYS OF WEEK <span className="req">*</span>
                </span>
                <div className="schf-pills">
                  {WEEKDAYS.map((d, i) => (
                    <button
                      type="button"
                      key={d}
                      className={`schf-pill ${rec.daysOfWeek.includes(i) ? 'on' : ''}`}
                      aria-pressed={rec.daysOfWeek.includes(i)}
                      onClick={() => toggleIn('daysOfWeek', i)}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                {errors.daysOfWeek ? (
                  <span className="eod-field-error">{errors.daysOfWeek}</span>
                ) : null}
              </div>
            )}

            {monthly && (
              <label className="eod-modal-field">
                <span className="eod-modal-label">DAY OF MONTH</span>
                <select
                  className="eod-modal-input"
                  value={rec.dayOfMonth}
                  onChange={(e) => set({ dayOfMonth: e.target.value })}
                >
                  {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                  <option value="L">Last day of the month</option>
                </select>
                <span className="schf-muted">
                  A day the month does not have (for example 31 in April) runs on its last day.
                </span>
              </label>
            )}

            {rec.kind === 'monthly' && (
              <div className="eod-modal-field">
                <span className="eod-modal-label">ONLY IN THESE MONTHS (none = every month)</span>
                <div className="schf-pills">
                  {[
                    'Jan',
                    'Feb',
                    'Mar',
                    'Apr',
                    'May',
                    'Jun',
                    'Jul',
                    'Aug',
                    'Sep',
                    'Oct',
                    'Nov',
                    'Dec',
                  ].map((m, i) => (
                    <button
                      type="button"
                      key={m}
                      className={`schf-pill ${rec.months.includes(i + 1) ? 'on' : ''}`}
                      aria-pressed={rec.months.includes(i + 1)}
                      onClick={() => toggleIn('months', i + 1)}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="eod-modal-field">
              <span className="eod-modal-label">
                {rec.kind === 'every-hours' || rec.kind === 'every-minutes'
                  ? 'FIRST TIME OF THE CYCLE'
                  : 'TIMES OF DAY'}{' '}
                <span className="req">*</span>
              </span>
              <div className="schf-pills">
                {rec.times.map((t) => (
                  <span key={t} className="schf-chip">
                    {t}
                    {rec.times.length > 1 &&
                    rec.kind !== 'every-hours' &&
                    rec.kind !== 'every-minutes' ? (
                      <button
                        type="button"
                        aria-label={`Remove ${t}`}
                        onClick={() => set({ times: rec.times.filter((x) => x !== t) })}
                      >
                        <X size={10} />
                      </button>
                    ) : null}
                  </span>
                ))}
                {rec.kind !== 'every-hours' && rec.kind !== 'every-minutes' ? (
                  <span className="schf-add">
                    <input
                      type="time"
                      className="eod-modal-input"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      aria-label="Time to add"
                    />
                    <button type="button" className="eod-preset-mini-btn" onClick={addTime}>
                      Add time
                    </button>
                  </span>
                ) : (
                  <span className="schf-add">
                    <input
                      type="time"
                      className="eod-modal-input"
                      value={rec.times[0] || '00:00'}
                      onChange={(e) => e.target.value && set({ times: [e.target.value] })}
                      aria-label="First time"
                    />
                  </span>
                )}
              </div>
              {errors.times ? <span className="eod-field-error">{errors.times}</span> : null}
            </div>

            <div className="schf-row">
              <label className="eod-modal-field">
                <span className="eod-modal-label">
                  {rec.kind === 'once' ? 'DATE' : needsStart ? 'STARTS ON' : 'STARTS ON (optional)'}
                  {needsStart ? <span className="req"> *</span> : null}
                </span>
                <input
                  className={`eod-modal-input ${errors.startDate ? 'error' : ''}`}
                  type="date"
                  value={rec.startDate}
                  onChange={(e) => set({ startDate: e.target.value })}
                />
                {errors.startDate ? (
                  <span className="eod-field-error">{errors.startDate}</span>
                ) : null}
              </label>
              {rec.kind !== 'once' && (
                <label className="eod-modal-field">
                  <span className="eod-modal-label">ENDS ON (optional)</span>
                  <input
                    className={`eod-modal-input ${errors.endDate ? 'error' : ''}`}
                    type="date"
                    value={rec.endDate}
                    onChange={(e) => set({ endDate: e.target.value })}
                  />
                  {errors.endDate ? (
                    <span className="eod-field-error">{errors.endDate}</span>
                  ) : null}
                </label>
              )}
            </div>

            <div className="schf-preview" aria-live="polite">
              <div className="schf-preview-title">
                <Calendar size={12} /> {preview?.summary || 'Next runs'}
              </div>
              {!specOk ? (
                <span className="schf-muted">Complete the fields above to see the next runs.</span>
              ) : null}
              {specOk && !preview ? <span className="schf-muted">Calculating…</span> : null}
              {preview?.error ? <span className="eod-field-error">{preview.error}</span> : null}
              {preview?.next?.length === 0 ? (
                <span className="schf-muted">No future runs.</span>
              ) : null}
              {preview?.next?.length ? (
                <ul>
                  {preview.next.map((n) => (
                    <li key={n}>{fmt(n)}</li>
                  ))}
                </ul>
              ) : null}
              <span className="schf-muted">Times use the environment’s time zone setting.</span>
            </div>

            <label className="schf-inline">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />{' '}
              Schedule is on
            </label>
          </div>
        )}

        {saveError ? (
          <div className="schf-error" role="alert">
            {saveError}
          </div>
        ) : null}

        <div className="eod-modal-footer">
          <button
            type="button"
            className="eod-modal-btn cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button type="submit" className="eod-modal-btn primary-green" disabled={!canSave}>
            <Calendar size={13} /> {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Schedule'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

export default ScheduleFormModal;
