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
  EOD_PROFILES,
  KINDS,
  QUARTERS,
  QUARTER_POSITIONS,
  defaultForm,
  formToSpec,
  getScheduleProfile,
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

const STANDARD_PROFILE_CHOICES = [
  { value: 'kind:daily', kind: 'daily', profileId: 'daily', label: 'Daily EOD', icon: Repeat },
  { value: 'kind:weekly', kind: 'weekly', profileId: 'weekly', label: 'Weekly EOD', icon: CalendarDays },
  { value: 'kind:monthly', kind: 'monthly', profileId: 'monthly', label: 'Monthly EOD', icon: CalendarRange },
  { value: 'kind:quarterly', kind: 'quarterly', profileId: 'quarterly', label: 'Quarterly EOD', icon: CalendarRange },
  { value: 'kind:yearly', kind: 'yearly', profileId: 'yearly', label: 'Yearly EOD', icon: CalendarIcon },
  { value: 'kind:once', kind: 'once', profileId: 'once', label: 'Once', icon: CalendarIcon },
  { value: 'kind:every-days', kind: 'every-days', profileId: 'custom', label: 'Every N days', icon: Clock },
  { value: 'kind:every-hours', kind: 'every-hours', profileId: 'custom', label: 'Every N hours', icon: Clock },
  { value: 'kind:every-minutes', kind: 'every-minutes', profileId: 'custom', label: 'Every N minutes', icon: Clock },
];

const fmt = (iso) =>
  new Date(iso).toLocaleString([], { hour12: false, dateStyle: 'medium', timeStyle: 'short' });
const toIsoDay = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fromIsoDay = (s) => (s ? new Date(`${s}T12:00:00`) : null);
const dayFromIso = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
  return m ? String(parseInt(m[3], 10)) : null;
};
const shortDay = (s) =>
  s
    ? fromIsoDay(s).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Select date...';

/**
 * Create or edit a schedule in a compact 2-column modal that fits comfortably on screen without scrolling.
 * EOD Profile unifies both standard recurrence cycles and any custom profiles added by the user.
 */
export function ScheduleFormModal({
  isOpen,
  env,
  schedule,
  defaultKind = null,
  profiles = EOD_PROFILES,
  defaultProfileId = null,
  onClose,
  onSaved,
}) {
  const isEdit = Boolean(schedule?.id);
  const [tree, setTree] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [workflowId, setWorkflowId] = useState('');
  const [folder, setFolder] = useState('');
  const [scope, setScope] = useState('workflow');
  const [job, setJob] = useState('');
  const [name, setName] = useState('');
  const [selectedChoice, setSelectedChoice] = useState('kind:daily');
  const [customProfileId, setCustomProfileId] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [rec, setRec] = useState(() => defaultForm());
  const [newTime, setNewTime] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [closure, setClosure] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  const customProfiles = useMemo(() => profiles.filter((p) => p.custom), [profiles]);

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

    if (schedule?.recurrence) {
      const parsed = specToForm(schedule.recurrence);
      setRec(parsed);
      const pid = getScheduleProfile(schedule);
      const customMatch = customProfiles.find((p) => p.id === pid);
      if (customMatch) {
        setSelectedChoice(`custom:${customMatch.id}`);
        setCustomProfileId(customMatch.id);
      } else {
        setSelectedChoice(`kind:${parsed.kind}`);
        setCustomProfileId('');
      }
    } else {
      const customMatch =
        defaultProfileId && defaultProfileId !== 'all'
          ? customProfiles.find((p) => p.id === defaultProfileId)
          : null;
      if (customMatch) {
        const k = customMatch.defaultKind || customMatch.default_kind || 'daily';
        const base = defaultForm();
        const dom = k === 'yearly' ? dayFromIso(base.startDate) || base.dayOfMonth : base.dayOfMonth;
        setRec({ ...base, kind: k, dayOfMonth: dom });
        setSelectedChoice(`custom:${customMatch.id}`);
        setCustomProfileId(customMatch.id);
      } else {
        const initKind = defaultKind || 'daily';
        const base = defaultForm();
        const dom =
          initKind === 'yearly' ? dayFromIso(base.startDate) || base.dayOfMonth : base.dayOfMonth;
        setRec({ ...base, kind: initKind, dayOfMonth: dom });
        setSelectedChoice(`kind:${initKind}`);
        setCustomProfileId('');
      }
    }

    return () => {
      live = false;
    };
  }, [isOpen, env, schedule, defaultKind, defaultProfileId, customProfiles]);

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
          : 'initial job',
      })),
    [jobs, folder],
  );

  // Unified EOD Profile dropdown options (standard recurrence cycles + custom profiles)
  const eodProfileOptions = useMemo(() => {
    const std = STANDARD_PROFILE_CHOICES.map((c) => {
      const Icon = c.icon;
      return { value: c.value, label: c.label, icon: <Icon size={12} />, color: '#005a36' };
    });
    const custom = customProfiles.map((p) => ({
      value: `custom:${p.id}`,
      label: p.label,
      subtext: p.description || 'Custom profile',
      icon: <CalendarIcon size={12} />,
      color: '#005a36',
    }));
    return [...std, ...custom];
  }, [customProfiles]);

  const pickEodProfile = (val) => {
    setSelectedChoice(val);
    if (val.startsWith('custom:')) {
      const pid = val.slice('custom:'.length);
      const prof = customProfiles.find((p) => p.id === pid);
      setCustomProfileId(pid);
      const k = prof?.defaultKind || prof?.default_kind || 'daily';
      setRec((r) => ({
        ...r,
        kind: k,
        ...(k === 'yearly' && dayFromIso(r.startDate) ? { dayOfMonth: dayFromIso(r.startDate) } : {}),
      }));
    } else {
      const k = val.slice('kind:'.length);
      setCustomProfileId('');
      setRec((r) => ({
        ...r,
        kind: k,
        ...(k === 'yearly' && dayFromIso(r.startDate) ? { dayOfMonth: dayFromIso(r.startDate) } : {}),
      }));
    }
  };

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

  const isInterval = ['every-hours', 'every-minutes'].includes(rec.kind);
  const effectiveTimes = useMemo(() => {
    if (isInterval) return rec.times[0] ? [rec.times[0]] : newTime ? [newTime] : [];
    if (newTime && /^([01]\d|2[0-3]):[0-5]\d$/.test(newTime) && !rec.times.includes(newTime)) {
      return sortedTimes([...rec.times, newTime]);
    }
    return rec.times;
  }, [rec.times, newTime, isInterval]);

  const effectiveRec = useMemo(
    () => ({ ...rec, times: effectiveTimes }),
    [rec, effectiveTimes],
  );
  const errors = validateForm(effectiveRec);
  const spec = useMemo(() => formToSpec(effectiveRec), [effectiveRec]);
  const specKey = JSON.stringify(spec);
  const specOk = Object.keys(errors).length === 0;

  useEffect(() => {
    setPreview(null);
    if (!isOpen || !specOk) return undefined;
    let live = true;
    const t = setTimeout(() => {
      svc
        .previewRecurrence(env, spec, 3)
        .then((p) => live && setPreview(p))
        .catch((err) => live && setPreview({ error: errorText(err) }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, env, specKey, specOk]);

  const set = (patch) => setRec((r) => ({ ...r, ...patch }));
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
    const stdChoice = STANDARD_PROFILE_CHOICES.find((c) => c.kind === rec.kind);
    const resolvedProfile = customProfileId || stdChoice?.profileId || 'daily';
    const body = {
      workflow_id: Number(workflowId),
      folder,
      job: scope === 'job' ? job : '',
      name: name.trim(),
      eod_profile: resolvedProfile,
      enabled,
      recurrence: spec,
    };
    try {
      const saved = isEdit
        ? await svc.updateSchedule(env, schedule.id, body)
        : await svc.createSchedule(env, body);
      onSaved(saved);
      try {
        window.dispatchEvent(new CustomEvent('eod-schedules-updated', { detail: saved }));
      } catch {}
    } catch (err) {
      setSaveError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const everyKind = ['every-days', 'every-hours', 'every-minutes'].includes(rec.kind);
  const intervalKind = ['every-hours', 'every-minutes'].includes(rec.kind);
  const monthDay = ['monthly', 'quarterly', 'yearly'].includes(rec.kind);
  const dateKind = rec.kind === 'once';
  const suggested =
    scope === 'job' && job ? `Job: ${job}` : folder ? `Workflow: ${folder}` : 'Schedule name';

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={() => !saving && onClose()}
      title={isEdit ? 'Edit Schedule' : 'Add New Schedule'}
      size="lg"
    >
      <form onSubmit={save} className="eod-schedule-modal-form schf-compact">
        {loadError ? <div className="schf-error">{loadError}</div> : null}
        {!tree && !loadError ? <p className="schf-muted">Loading workflows…</p> : null}
        {tree && files.length === 0 ? (
          <div className="schf-error">
            No workflow uploaded to {env}. Upload one in the Control Run Cockpit first.
          </div>
        ) : null}

        {files.length > 0 && (
          <div className="schf-compact-body">
            {/* Row 1: Scope + Environment */}
            <div className="schf-row schf-row-scope">
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

              <div className="eod-modal-field">
                <span className="eod-modal-label">ENVIRONMENT</span>
                <div className="schf-static-field">
                  <Server size={13} />
                  <span>{String(env).toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Row 2: Workflow File + Workflow */}
            <div className="schf-row">
              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="schf-xml">
                  WORKFLOW FILE <span className="req">*</span>
                </label>
                <CustomDropdown
                  id="schf-xml"
                  value={workflowId}
                  options={xmlOptions}
                  onChange={pickXml}
                  placeholder="Select workflow file..."
                />
                {xml && !xml.active ? (
                  <span className="sc-warn-line">Inactive workflow — activate to run.</span>
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
              </div>
            )}

            {/* Row 3: Schedule Name + EOD Profile */}
            <div className="schf-row">
              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="schf-name">
                  SCHEDULE NAME
                </label>
                <input
                  id="schf-name"
                  className="eod-modal-input"
                  value={name}
                  maxLength={255}
                  placeholder={suggested}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="schf-profile">
                  EOD PROFILE <span className="req">*</span>
                </label>
                <CustomDropdown
                  id="schf-profile"
                  value={selectedChoice}
                  options={eodProfileOptions}
                  onChange={pickEodProfile}
                  placeholder="Select EOD profile..."
                />
              </div>
            </div>

            {customProfileId && (
              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="schf-custom-kind">
                  SCHEDULE FREQUENCY
                </label>
                <select
                  id="schf-custom-kind"
                  className="eod-modal-input"
                  value={rec.kind}
                  onChange={(e) => {
                    const k = e.target.value;
                    setRec((r) => ({
                      ...r,
                      kind: k,
                      ...(k === 'yearly' && dayFromIso(r.startDate)
                        ? { dayOfMonth: dayFromIso(r.startDate) }
                        : {}),
                    }));
                  }}
                >
                  {KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Profile-specific compact options */}
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
                      All
                    </button>
                    <button
                      type="button"
                      className="eod-preset-mini-btn"
                      onClick={() => set({ daysOfWeek: [1, 2, 3, 4, 5] })}
                    >
                      Mon–Fri
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
                <div className="schf-pills">
                  {DAYS.map((d) => {
                    const on = rec.daysOfWeek.includes(d.index);
                    return (
                      <button
                        key={d.index}
                        type="button"
                        className={`schf-pill ${on ? 'on' : ''}`}
                        onClick={() => toggleIn('daysOfWeek', d.index)}
                        aria-pressed={on}
                      >
                        {d.short}
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
              <div className="schf-row">
                <div className="eod-modal-field">
                  <span className="eod-modal-label">
                    QUARTERS <span className="req">*</span>
                  </span>
                  <div className="schf-pills">
                    {QUARTERS.map((q) => {
                      const on = rec.quarters.includes(q.id);
                      return (
                        <button
                          key={q.id}
                          type="button"
                          className={`schf-pill ${on ? 'on' : ''}`}
                          aria-pressed={on}
                          onClick={() => toggleIn('quarters', q.id)}
                        >
                          {q.label}
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
                    MONTH IN QUARTER <span className="req">*</span>
                  </span>
                  <div className="schf-pills">
                    {QUARTER_POSITIONS.map((pos) => (
                      <button
                        key={pos.id}
                        type="button"
                        className={`schf-pill ${rec.quarterMonth === pos.id ? 'on' : ''}`}
                        aria-pressed={rec.quarterMonth === pos.id}
                        onClick={() => set({ quarterMonth: pos.id })}
                      >
                        {pos.label.replace(' Month', '')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(monthDay || rec.kind === 'monthly') && (
              <div className={rec.kind === 'monthly' ? 'schf-row' : ''}>
                {monthDay && (
                  <div className="eod-modal-field">
                    <label className="eod-modal-label" htmlFor="schf-dom">
                      DAY OF MONTH <span className="req">*</span>
                    </label>
                    <input
                      id="schf-dom"
                      type="number"
                      min={1}
                      max={31}
                      className="eod-modal-input"
                      value={rec.dayOfMonth === 'L' ? 31 : Number(rec.dayOfMonth) || 1}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10);
                        set({
                          dayOfMonth: String(Number.isNaN(v) ? 1 : Math.min(31, Math.max(1, v))),
                        });
                      }}
                    />
                  </div>
                )}

                {rec.kind === 'monthly' && (
                  <div className="eod-modal-field">
                    <span className="eod-modal-label">MONTHS (blank = all)</span>
                    <div className="schf-pills schf-pills-tight">
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
              </div>
            )}

            {/* Row 4: Schedule Time + Start/End Dates */}
            <div className="schf-row">
              <div className="eod-modal-field">
                <span className="eod-modal-label">
                  {intervalKind ? 'START TIME' : 'SCHEDULE TIME'} <span className="req">*</span>
                </span>
                {intervalKind ? (
                  <input
                    type="time"
                    className="eod-modal-input"
                    value={rec.times[0] || ''}
                    aria-label="Start time"
                    onChange={(e) => set({ times: e.target.value ? [e.target.value] : [] })}
                  />
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
                    >
                      <Clock size={11} /> Add
                    </button>
                  </div>
                )}
                {rec.times.length > 0 && !intervalKind && (
                  <div className="schf-pills" style={{ marginTop: 4 }}>
                    {rec.times.map((t) => (
                      <span key={t} className="schf-chip">
                        {t}
                        {rec.times.length > 1 ? (
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
                )}
                {errors.times ? <span className="eod-field-error">{errors.times}</span> : null}
              </div>

              {dateKind ? (
                <div className="eod-modal-field">
                  <label className="eod-modal-label" htmlFor="schf-date">
                    SCHEDULE DATE <span className="req">*</span>
                  </label>
                  <div className="eod-modal-input-with-icon">
                    <input
                      id="schf-date"
                      type="text"
                      readOnly
                      className={`eod-modal-input ${errors.startDate ? 'error' : ''}`}
                      value={shortDay(rec.startDate)}
                      onClick={() => setCalendarOpen(true)}
                      style={{ cursor: 'pointer' }}
                    />
                    <button
                      type="button"
                      className="eod-input-icon-btn"
                      onClick={() => setCalendarOpen(true)}
                      aria-label="Pick date"
                    >
                      <CalendarIcon size={14} />
                    </button>
                  </div>
                  {errors.startDate ? (
                    <span className="eod-field-error">{errors.startDate}</span>
                  ) : null}
                </div>
              ) : (
                <div className="schf-row-dates">
                  <label className="eod-modal-field">
                    <span className="eod-modal-label">
                      STARTS ON {intervalKind || rec.kind === 'yearly' ? <span className="req">*</span> : ''}
                    </span>
                    <input
                      className={`eod-modal-input ${errors.startDate ? 'error' : ''}`}
                      type="date"
                      value={rec.startDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        const syncedDom =
                          rec.kind === 'yearly' && dayFromIso(val)
                            ? { dayOfMonth: dayFromIso(val) }
                            : {};
                        set({ startDate: val, ...syncedDom });
                      }}
                    />
                    {errors.startDate ? (
                      <span className="eod-field-error">{errors.startDate}</span>
                    ) : null}
                  </label>
                  <label className="eod-modal-field">
                    <span className="eod-modal-label">ENDS ON</span>
                    <input
                      className={`eod-modal-input ${errors.endDate ? 'error' : ''}`}
                      type="date"
                      value={rec.endDate}
                      onChange={(e) => set({ endDate: e.target.value })}
                    />
                  </label>
                </div>
              )}
            </div>

            {errors.endDate ? <span className="eod-field-error">{errors.endDate}</span> : null}

            {/* Compact 1-line summary */}
            <div className="eod-cal-selected-summary schf-summary-bar" aria-live="polite">
              <Clock size={12} />
              <span>
                {!specOk
                  ? 'Pick a time to preview next run.'
                  : preview?.error
                    ? preview.error
                    : preview?.summary
                      ? `${preview.summary}${preview.next?.length ? ` · Next: ${fmt(preview.next[0])}` : ' · No future runs'}`
                      : 'Calculating…'}
              </span>
            </div>
          </div>
        )}

        {saveError ? (
          <div className="schf-error" role="alert">
            {saveError}
          </div>
        ) : null}

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

        <div className="eod-modal-footer schf-footer-split">
          <div className="schf-switch-row">
            <label
              className="switch"
              htmlFor="schf-enabled"
              title={enabled ? 'Active' : 'Paused'}
            >
              <input
                id="schf-enabled"
                type="checkbox"
                role="switch"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                aria-label="Schedule is active"
              />
              <span />
            </label>
            <span className="schf-switch-text">{enabled ? 'Active' : 'Paused'}</span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
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
        </div>
      </form>
    </AdminModal>
  );
}

export default ScheduleFormModal;
