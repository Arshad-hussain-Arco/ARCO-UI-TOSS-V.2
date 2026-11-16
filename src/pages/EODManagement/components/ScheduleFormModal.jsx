import { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  Clock,
  FileCode,
  FolderTree,
  Layers,
  Repeat,
  Server,
  Target,
  X,
} from 'lucide-react';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import {
  KINDS,
  QUARTERS,
  QUARTER_POSITIONS,
  defaultForm,
  formToSpec,
  quarterMonthNames,
  sortedTimes,
  specToForm,
  validateForm,
} from '../scheduler/scheduleSpec';
import { CustomDropdown, InteractiveCalendarPicker, TargetJobPicker } from './ScheduleFormParts';
import './ScheduleForm.css';

const DAYS = [
  { index: 0, full: 'Sunday', short: 'Sun' },
  { index: 1, full: 'Monday', short: 'Mon' },
  { index: 2, full: 'Tuesday', short: 'Tue' },
  { index: 3, full: 'Wednesday', short: 'Wed' },
  { index: 4, full: 'Thursday', short: 'Thu' },
  { index: 5, full: 'Friday', short: 'Fri' },
  { index: 6, full: 'Saturday', short: 'Sat' },
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const KIND_ICON = {
  once: CalendarIcon,
  daily: Repeat,
  weekly: CalendarDays,
  monthly: CalendarRange,
  quarterly: CalendarRange,
  yearly: CalendarIcon,
  'every-days': Clock,
  'every-hours': Clock,
  'every-minutes': Clock,
};

const fmt = (iso) =>
  new Date(iso).toLocaleString([], { hour12: false, dateStyle: 'medium', timeStyle: 'short' });
const toIsoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIsoDay = (s) => (s ? new Date(`${s}T12:00:00`) : null);
const longDay = (s) =>
  s
    ? fromIsoDay(s).toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Select date...';

/** "A → B + C → D": jobs in one step have no dependency on each other. */
const orderText = (waves) => waves.map((w) => w.join(' + ')).join(' → ');

/**
 * Create or edit a schedule: run scope, XML file, workflow and (for a single job) the job, then when it repeats.
 * The server validates, computes the run times shown in the summary and works out a job's prerequisites.
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
  const [newTime, setNewTime] = useState(''); // the time typed in the field, not yet added to the list
  const [calendarOpen, setCalendarOpen] = useState(false);
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
    setCalendarOpen(false);
    setNewTime('');
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
  const folders = useMemo(() => xml?.folders || [], [xml]);
  const jobs = useMemo(() => folders.find((f) => f.name === folder)?.jobs || [], [folders, folder]);

  const xmlOptions = useMemo(
    () =>
      files.map((w) => ({
        value: String(w.id),
        label: w.filename,
        subtext: `${w.active ? 'Active · ' : ''}${w.folders.length} workflow${w.folders.length === 1 ? '' : 's'}`,
        icon: <FileCode size={12} />,
        color: w.active ? '#16a34a' : '#64748b',
      })),
    [files],
  );
  const workflowOptions = useMemo(
    () =>
      folders.map((f) => ({
        value: f.name,
        label: f.name,
        subtext: `${f.jobs.length} jobs`,
        icon: <FolderTree size={12} />,
        color: '#2563eb',
      })),
    [folders],
  );
  const jobChoices = useMemo(
    () =>
      jobs.map((j) => ({
        name: j.name,
        group: folder,
        description: j.predecessors.length
          ? `after ${j.predecessors.join(', ')}`
          : 'no prerequisites',
      })),
    [jobs, folder],
  );
  const kindOptions = useMemo(
    () =>
      KINDS.map((k) => {
        const Icon = KIND_ICON[k.id] || Repeat;
        return { value: k.id, label: k.label, icon: <Icon size={12} />, color: '#005a36' };
      }),
    [],
  );

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

  // A time that is typed but not yet added counts when no time has been added at all, so Save works without an extra click
  const effectiveRec = useMemo(
    () => ({ ...rec, times: rec.times.length ? rec.times : newTime ? [newTime] : [] }),
    [rec, newTime],
  );
  const errors = validateForm(effectiveRec);
  const spec = useMemo(() => formToSpec(effectiveRec), [effectiveRec]);
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
  // Built from the latest state, so two quick clicks never overwrite each other
  const toggleIn = (key, value) =>
    setRec((r) => ({
      ...r,
      [key]: r[key].includes(value) ? r[key].filter((v) => v !== value) : [...r[key], value],
    }));
  const addTime = () => {
    if (!newTime) return;
    set({ times: sortedTimes([...rec.times, newTime]) });
    setNewTime('');
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

  const everyKind = ['every-days', 'every-hours', 'every-minutes'].includes(rec.kind);
  const intervalKind = ['every-hours', 'every-minutes'].includes(rec.kind);
  const monthDay = ['monthly', 'quarterly', 'yearly'].includes(rec.kind);
  const dateKind = ['once', 'yearly'].includes(rec.kind); // the date is picked from the calendar
  const suggested =
    scope === 'job' && job
      ? `Job: ${job}`
      : folder
        ? `Workflow: ${folder}`
        : 'e.g. Nightly payments';

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Edit Schedule' : 'Add New Schedule'}
      size="md"
    >
      <form onSubmit={save} className="eod-schedule-modal-form">
        {loadError ? <div className="schf-error">{loadError}</div> : null}
        {!tree && !loadError ? (
          <p className="schf-muted">Loading the environment’s XML files…</p>
        ) : null}
        {tree && files.length === 0 ? (
          <div className="schf-error">
            No XML has been uploaded to {env} yet. Upload one in the Control Run Cockpit first.
          </div>
        ) : null}

        {files.length > 0 && (
          <div className="eod-modal-field-group">
            {/* Run scope */}
            <div className="eod-modal-field">
              <span className="eod-modal-label">RUN SCOPE</span>
              <div className="eod-segmented-control" role="radiogroup" aria-label="Run scope">
                <button
                  type="button"
                  role="radio"
                  aria-checked={scope === 'workflow'}
                  className={`eod-segmented-btn schf-seg ${scope === 'workflow' ? 'active' : ''}`}
                  onClick={() => setScope('workflow')}
                >
                  <Layers size={11} /> Entire workflow
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={scope === 'job'}
                  className={`eod-segmented-btn schf-seg ${scope === 'job' ? 'active' : ''}`}
                  onClick={() => setScope('job')}
                >
                  <Target size={11} /> Single job
                </button>
              </div>
            </div>

            {/* Environment (fixed by the tab) */}
            <div className="eod-modal-field">
              <span className="eod-modal-label">
                ENVIRONMENT <span className="req">*</span>
              </span>
              <div className="schf-static-field">
                <Server size={14} />
                <span>{String(env).toUpperCase()}</span>
              </div>
            </div>

            {/* XML file and workflow */}
            <div className="eod-modal-field">
              <label className="eod-modal-label" htmlFor="schf-xml">
                XML FILE <span className="req">*</span>
              </label>
              <CustomDropdown
                id="schf-xml"
                value={workflowId}
                options={xmlOptions}
                onChange={pickXml}
                placeholder="Select XML file..."
              />
              {xml && !xml.active ? (
                <div className="schf-warn" style={{ marginTop: 6 }}>
                  This XML is not the active one. A schedule only runs while its XML is the active
                  workflow.
                </div>
              ) : null}
            </div>

            <div className="eod-modal-field">
              <label className="eod-modal-label" htmlFor="schf-workflow">
                WORKFLOW <span className="req">*</span>
              </label>
              <CustomDropdown
                id="schf-workflow"
                value={folder}
                options={workflowOptions}
                onChange={(v) => {
                  setFolder(v);
                  setJob('');
                }}
                placeholder="Select workflow..."
              />
            </div>

            {scope === 'job' && (
              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="schf-job">
                  TARGET JOB <span className="req">*</span>
                </label>
                <TargetJobPicker
                  id="schf-job"
                  value={job}
                  onChange={setJob}
                  availableJobs={jobChoices}
                />
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

            <div className="eod-modal-field">
              <label className="eod-modal-label" htmlFor="schf-name">
                SCHEDULE NAME
              </label>
              <input
                id="schf-name"
                className="eod-modal-input"
                value={name}
                maxLength={255}
                placeholder={`${suggested} (suggested, or type your own)`}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* When it repeats */}
            <div className="eod-modal-field">
              <label className="eod-modal-label" htmlFor="schf-kind">
                RECURRENCE <span className="req">*</span>
              </label>
              <CustomDropdown
                id="schf-kind"
                value={rec.kind}
                options={kindOptions}
                onChange={(v) => set({ kind: v })}
                placeholder="Select recurrence..."
              />
            </div>

            {everyKind && (
              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="schf-every">
                  EVERY (
                  {rec.kind === 'every-days'
                    ? 'days'
                    : rec.kind === 'every-hours'
                      ? 'hours'
                      : 'minutes'}
                  ) <span className="req">*</span>
                </label>
                <input
                  id="schf-every"
                  className={`eod-modal-input ${errors.every ? 'error' : ''}`}
                  type="number"
                  min={1}
                  value={rec.every}
                  onChange={(e) => set({ every: e.target.value })}
                />
                {errors.every ? <span className="eod-field-error">{errors.every}</span> : null}
              </div>
            )}

            {rec.kind === 'weekly' && (
              <div className="eod-modal-field">
                <div className="eod-field-header-row">
                  <span className="eod-modal-label">
                    DAYS OF WEEK <span className="req">*</span>
                  </span>
                  <div className="eod-day-quick-presets">
                    <button
                      type="button"
                      className="eod-preset-mini-btn"
                      onClick={() => set({ daysOfWeek: [0, 1, 2, 3, 4, 5, 6] })}
                    >
                      All Days
                    </button>
                    <button
                      type="button"
                      className="eod-preset-mini-btn"
                      onClick={() => set({ daysOfWeek: [1, 2, 3, 4, 5] })}
                    >
                      Mon – Fri
                    </button>
                    <button
                      type="button"
                      className="eod-preset-mini-btn"
                      onClick={() => set({ daysOfWeek: [0, 6] })}
                    >
                      Weekends
                    </button>
                  </div>
                </div>
                <div className="eod-modal-days-grid">
                  {DAYS.map((d) => {
                    const on = rec.daysOfWeek.includes(d.index);
                    return (
                      <button
                        key={d.index}
                        type="button"
                        className={`eod-day-pill-btn ${on ? 'selected' : ''}`}
                        onClick={() => toggleIn('daysOfWeek', d.index)}
                        title={`Click to ${on ? 'deselect' : 'select'} ${d.full}`}
                        aria-pressed={on}
                      >
                        <span className="day-name-full">{d.full}</span>
                        <span className="day-name-short">{d.short}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.daysOfWeek ? (
                  <span className="eod-field-error">{errors.daysOfWeek}</span>
                ) : null}
              </div>
            )}

            {rec.kind === 'quarterly' && (
              <>
                <div className="eod-modal-field">
                  <span className="eod-modal-label">
                    QUARTER(S) <span className="req">*</span>
                  </span>
                  <div className="schf-quarters">
                    {QUARTERS.map((q) => {
                      const on = rec.quarters.includes(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          className={`eod-quarter-btn ${on ? 'selected' : ''}`}
                          aria-pressed={on}
                          onClick={() => toggleIn('quarters', q.id)}
                        >
                          <span>{q.label}</span>
                          <small>{q.span}</small>
                        </button>
                      );
                    })}
                  </div>
                  {errors.quarters ? (
                    <span className="eod-field-error">{errors.quarters}</span>
                  ) : null}
                </div>
                <div className="eod-modal-field">
                  <span className="eod-modal-label">
                    RUN IN <span className="req">*</span>
                  </span>
                  <div className="schf-quarters">
                    {QUARTER_POSITIONS.map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        className={`eod-quarter-pos-btn ${rec.quarterMonth === pos.id ? 'selected' : ''}`}
                        aria-pressed={rec.quarterMonth === pos.id}
                        onClick={() => set({ quarterMonth: pos.id })}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                  {rec.quarters.length ? (
                    <span className="schf-muted">
                      Runs in {quarterMonthNames(rec.quarters, rec.quarterMonth).join(', ')}
                    </span>
                  ) : null}
                </div>
              </>
            )}

            {monthDay && (
              <div className="eod-modal-field">
                <div className="eod-field-header-row">
                  <label className="eod-modal-label" htmlFor="schf-dom">
                    DAY OF MONTH <span className="req">*</span>
                  </label>
                  <label className="schf-inline">
                    <input
                      type="checkbox"
                      checked={rec.dayOfMonth === 'L'}
                      onChange={(e) => set({ dayOfMonth: e.target.checked ? 'L' : '1' })}
                    />
                    <span>Last Day of Month (L)</span>
                  </label>
                </div>
                {rec.dayOfMonth === 'L' ? (
                  <input
                    type="text"
                    className="eod-modal-input"
                    value="Last Day of Month (L)"
                    disabled
                    readOnly
                  />
                ) : (
                  <input
                    id="schf-dom"
                    type="number"
                    min={1}
                    max={31}
                    className="eod-modal-input"
                    value={Number(rec.dayOfMonth) || 1}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      set({
                        dayOfMonth: String(Number.isNaN(v) ? 1 : Math.min(31, Math.max(1, v))),
                      });
                    }}
                  />
                )}
                <span className="schf-muted">
                  A day the month does not have (for example 31 in April) runs on its last day.
                </span>
              </div>
            )}

            {rec.kind === 'monthly' && (
              <div className="eod-modal-field">
                <span className="eod-modal-label">ONLY IN THESE MONTHS (none = every month)</span>
                <div className="schf-pills">
                  {MONTHS.map((m, i) => (
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

            {dateKind && (
              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="schf-date">
                  {rec.kind === 'once' ? 'SCHEDULE DATE' : 'STARTS ON'}{' '}
                  <span className="req">*</span>
                </label>
                <div className="eod-modal-input-with-icon">
                  <input
                    id="schf-date"
                    type="text"
                    readOnly
                    className={`eod-modal-input ${errors.startDate ? 'error' : ''}`}
                    value={longDay(rec.startDate)}
                    onClick={() => setCalendarOpen(true)}
                    style={{ cursor: 'pointer' }}
                  />
                  <button
                    type="button"
                    className="eod-input-icon-btn"
                    onClick={() => setCalendarOpen(true)}
                    aria-label="Pick date from calendar"
                  >
                    <CalendarIcon size={15} />
                  </button>
                </div>
                {errors.startDate ? (
                  <span className="eod-field-error">{errors.startDate}</span>
                ) : null}
              </div>
            )}

            {/* Time of day: one or several */}
            <div className="eod-modal-field">
              <span className="eod-modal-label">
                {intervalKind ? 'FIRST TIME OF THE CYCLE' : 'SCHEDULE TIME'}{' '}
                <span className="req">*</span>
              </span>
              <div className="schf-pills" style={{ marginBottom: 6 }}>
                {rec.times.map((t) => (
                  <span key={t} className="schf-chip">
                    {t}
                    {rec.times.length > 1 && !intervalKind ? (
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
              </div>
              {intervalKind ? (
                <div className="schf-add-row">
                  <input
                    type="time"
                    className="eod-modal-input"
                    value={rec.times[0] || ''}
                    aria-label="First time"
                    onChange={(e) => set({ times: e.target.value ? [e.target.value] : [] })}
                  />
                </div>
              ) : (
                <div className="schf-add-row">
                  <input
                    type="time"
                    className="eod-modal-input"
                    value={newTime}
                    aria-label="Time to add"
                    onChange={(e) => setNewTime(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTime();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="eod-preset-mini-btn schf-add-btn"
                    onClick={addTime}
                    title="Add this time to the schedule"
                  >
                    <Clock size={12} /> Add time
                  </button>
                </div>
              )}
              <span className="schf-muted">
                {errors.times
                  ? intervalKind
                    ? 'Pick the time the cycle starts from.'
                    : 'Pick a time, then click Add time (add more than one to run several times a day).'
                  : intervalKind
                    ? 'The cycle counts from this time on the start date.'
                    : 'Add more than one time to run several times a day.'}
              </span>
            </div>

            {!dateKind && rec.kind !== 'once' && (
              <div className="schf-row">
                <label className="eod-modal-field">
                  <span className="eod-modal-label">
                    STARTS ON {intervalKind ? <span className="req">*</span> : '(optional)'}
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
              </div>
            )}

            {/* What will happen, from the server */}
            <div className="eod-cal-selected-summary" aria-live="polite">
              <Clock size={12} />
              <span>
                {!specOk
                  ? 'Complete the fields above to see when it runs.'
                  : preview?.error
                    ? preview.error
                    : preview?.summary
                      ? `${preview.summary}${preview.next?.length ? ` · next run ${fmt(preview.next[0])}` : ' · no future runs'}`
                      : 'Calculating…'}
              </span>
            </div>
            {preview?.next?.length > 1 ? (
              <ul className="schf-next">
                {preview.next.slice(1).map((n) => (
                  <li key={n}>{fmt(n)}</li>
                ))}
              </ul>
            ) : null}
            <span className="schf-muted">Times use the environment’s time zone setting.</span>

            {/* The same on / off switch as the schedule list */}
            <div className="schf-switch-row">
              <label
                className="switch"
                htmlFor="schf-enabled"
                title={enabled ? 'On: click to turn off' : 'Off: click to turn on'}
              >
                <input
                  id="schf-enabled"
                  type="checkbox"
                  role="switch"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  aria-label="Schedule is on"
                />
                <span />
              </label>
              <span className="schf-switch-text">
                {enabled
                  ? 'Schedule is on'
                  : 'Schedule is off: it will not run until you turn it on'}
              </span>
            </div>
          </div>
        )}

        {saveError ? (
          <div className="schf-error" role="alert">
            {saveError}
          </div>
        ) : null}

        {/* Floating calendar: opens in front of the form */}
        {calendarOpen && (
          <div className="eod-cal-modal-backdrop" role="presentation">
            <button
              type="button"
              className="eod-cal-backdrop-dismiss"
              onClick={() => setCalendarOpen(false)}
              aria-label="Dismiss calendar"
              tabIndex={-1}
            />
            <div
              className="eod-cal-floating-card"
              role="dialog"
              aria-modal="true"
              aria-label="Calendar Date Picker"
            >
              <div className="eod-cal-floating-header">
                <span className="eod-cal-floating-title">Choose Date</span>
                <button
                  type="button"
                  className="eod-cal-floating-close-btn"
                  onClick={() => setCalendarOpen(false)}
                  aria-label="Close calendar"
                >
                  <X size={15} />
                </button>
              </div>
              <InteractiveCalendarPicker
                selectedDate={fromIsoDay(rec.startDate) || new Date()}
                onSelectDate={(d) => set({ startDate: toIsoDay(d) })}
              />
              <div className="eod-cal-floating-actions">
                <button
                  type="button"
                  className="eod-cal-floating-done-btn"
                  onClick={() => setCalendarOpen(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="eod-modal-footer">
          <button
            type="button"
            className="eod-modal-btn cancel"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="eod-modal-btn primary-green"
            disabled={!canSave}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CalendarIcon size={13} />{' '}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Schedule'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

export default ScheduleFormModal;
