import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Clock,
  RefreshCw,
  Edit,
  Trash,
  AlertTriangle,
  Loader2,
  Play,
  Pause,
  Square,
  Target,
  Layers,
  Repeat,
} from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { EmptyState } from '@components/feedback/EmptyState/EmptyState';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useAuth } from '@hooks/useAuth';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { runsOnWeekday } from '../scheduler/scheduleSpec';
import { ScheduleFormModal } from './ScheduleFormModal';
import Skeleton from '@/components/feedback/Skeleton/Skeleton';

const DAYS_OF_WEEK = [
  { id: 'sunday', name: 'Sunday', dayIndex: 0 },
  { id: 'monday', name: 'Monday', dayIndex: 1 },
  { id: 'tuesday', name: 'Tuesday', dayIndex: 2 },
  { id: 'wednesday', name: 'Wednesday', dayIndex: 3 },
  { id: 'thursday', name: 'Thursday', dayIndex: 4 },
  { id: 'friday', name: 'Friday', dayIndex: 5 },
  { id: 'saturday', name: 'Saturday', dayIndex: 6 },
];

/** Countdown format: "05:22:11" or "2d 03:10:00" */
function countdown(iso) {
  if (!iso) return '–';
  const s = Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 1000));
  if (s <= 0) return 'Starting…';
  const p = (n) => String(n).padStart(2, '0');
  const d = Math.floor(s / 86400);
  return `${d ? `${d}d ` : ''}${p(Math.floor((s % 86400) / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

function span(ms) {
  const m = Math.round(Math.abs(ms) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
  const d = Math.floor(m / 1440);
  return `${d} day${d === 1 ? '' : 's'}`;
}

const agoText = (iso) => {
  if (!iso) return 'Never';
  const ms = Date.now() - Date.parse(iso);
  return ms < 60000 ? 'Just now' : `${span(ms)} ago`;
};

const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString([], { hour12: false, dateStyle: 'medium', timeStyle: 'short' })
    : '–';

const displayName = (s) => s.name || (s.job ? `Job: ${s.job}` : `Workflow: ${s.folder}`);

// The list is grouped by how a schedule repeats. "Custom interval" holds every-N-days/hours/minutes.
const REPEAT_ORDER = [
  'Once',
  'Daily',
  'Weekly',
  'Monthly',
  'Quarterly',
  'Yearly',
  'Custom interval',
];
const repeatKind = (s) => {
  const r = s.recurrence || {};
  if (r.frequency === 'daily') return (r.every || 1) > 1 ? 'Custom interval' : 'Daily';
  if (r.frequency === 'interval') return 'Custom interval';
  const label = r.frequency ? r.frequency[0].toUpperCase() + r.frequency.slice(1) : 'Daily';
  return REPEAT_ORDER.includes(label) ? label : 'Custom interval';
};

/**
 * Schedules (New): workflow-level and job-level schedules of ONE environment, kept in the database and fired by the scheduler engine.
 * The list, the form's XML/workflow/job choices, every run time and a job's prerequisites all come from the API.
 */
export function SchedulesNewSection({ selectedEnv }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canCreate = hasPermission('EOD_SCHEDULE_CREATE');
  const canEdit = hasPermission('EOD_SCHEDULE_EDIT');
  const canDelete = hasPermission('EOD_SCHEDULE_DELETE');
  const canRun = hasPermission('EOD_SCHEDULER_EXECUTE');

  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setTick] = useState(0);
  const [dayIndex, setDayIndex] = useState(null);
  const [scope, setScope] = useState('all'); // all | workflow | job
  const [form, setForm] = useState({ open: false, schedule: null });
  const [deleting, setDeleting] = useState(null);
  const [stopping, setStopping] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setSchedules(await svc.listSchedules(selectedEnv));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedEnv]);

  useEffect(() => {
    load();
  }, [load]);

  // While a schedule's run is going, keep its status fresh without flashing the list (a failed refresh is ignored).
  const refresh = useCallback(async () => {
    try {
      setSchedules(await svc.listSchedules(selectedEnv));
    } catch {
      /* the next refresh tries again */
    }
  }, [selectedEnv]);
  const anyActive = schedules.some((s) => s.run_active);
  useEffect(() => {
    if (!anyActive) return undefined;
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [anyActive, refresh]);

  const today = new Date().getDay();

  // Pause / resume / stop act on the run the schedule last started (the same run controls as the Runs tab).
  const controlRun = async (s, action, doneText) => {
    setBusyId(s.id);
    try {
      await svc[action](selectedEnv, s.last_run_id);
      toast.success(doneText);
      await refresh();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
      setStopping(null);
    }
  };

  const toggle = async (s, enabled) => {
    setBusyId(s.id);
    try {
      const saved = await svc.updateSchedule(selectedEnv, s.id, { enabled });
      setSchedules((list) => list.map((x) => (x.id === s.id ? saved : x)));
      toast.success(enabled ? 'Schedule turned on.' : 'Schedule turned off.');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async () => {
    setIsSaving(true);
    try {
      await svc.deleteSchedule(selectedEnv, deleting.id);
      setDeleting(null);
      toast.success('Schedule deleted.');
      await load();
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setIsSaving(false);
    }
  };

  const saved = async (result) => {
    setForm({ open: false, schedule: null });
    toast.success(form.schedule ? 'Schedule updated.' : 'Schedule added.');
    (result.warnings || []).forEach((w) => toast.warning(w));
    await load();
  };

  const byDay = useMemo(
    () => (dayIndex === null ? schedules : schedules.filter((s) => runsOnWeekday(s, dayIndex))),
    [schedules, dayIndex],
  );
  const visible = useMemo(
    () => byDay.filter((s) => scope === 'all' || s.scope === scope),
    [byDay, scope],
  );
  const counts = useMemo(
    () => ({
      all: byDay.length,
      workflow: byDay.filter((s) => s.scope === 'workflow').length,
      job: byDay.filter((s) => s.scope === 'job').length,
    }),
    [byDay],
  );
  // one card per kind of repetition (Once, Daily, Weekly ...); inside a card the soonest run comes first
  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach((s) => {
      const key = repeatKind(s);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    const soonest = (s) => (s.next_fire_at ? Date.parse(s.next_fire_at) : Infinity);
    return REPEAT_ORDER.filter((k) => map.has(k)).map((k) => [
      k,
      map.get(k).sort((a, b) => soonest(a) - soonest(b) || a.id - b.id),
    ]);
  }, [visible]);

  if (error) {
    return <ErrorState title="Schedules could not be loaded" description={error} onRetry={load} />;
  }

  const addButton = canCreate && (
    <button
      type="button"
      className="eod-add-btn primary-green"
      onClick={() => setForm({ open: true, schedule: null })}
    >
      <Calendar size={13} /> Add Schedule
    </button>
  );

  return (
    <div className="eod-section">
      <div className="eod-section-bar">
        <div>
          <p className="eod-section-title">SCHEDULED RUNS · {selectedEnv}</p>
          <span className="eod-section-subtitle">
            Schedule a whole workflow or a single job (its prerequisites run first) from any
            uploaded XML
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="eod-add-btn"
            onClick={load}
            style={{
              background: 'transparent',
              color: 'var(--c-primary, #005a36)',
              border: '1px solid var(--c-primary, #005a36)',
            }}
          >
            <RefreshCw size={11} /> Refresh
          </button>
          {addButton}
        </div>
      </div>

      <div className="eod-day-nav-bar" role="tablist" aria-label="Filter schedules by day">
        <button
          type="button"
          role="tab"
          aria-selected={dayIndex === null}
          className={`eod-day-nav-btn ${dayIndex === null ? 'active' : ''}`}
          onClick={() => setDayIndex(null)}
        >
          <span>All Days</span>
          <span className="eod-day-nav-count">{schedules.length}</span>
        </button>
        {DAYS_OF_WEEK.map((d) => {
          const selected = dayIndex === d.dayIndex;
          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`eod-day-nav-btn ${selected ? 'active' : ''}`}
              onClick={() => setDayIndex(selected ? null : d.dayIndex)}
            >
              <span>{d.name}</span>
              {today === d.dayIndex && <span className="eod-day-today-indicator">TODAY</span>}
              <span className="eod-day-nav-count">
                {schedules.filter((s) => runsOnWeekday(s, d.dayIndex)).length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="eod-sch-controls-row">
        <div className="eod-scope-filter-bar" role="tablist" aria-label="Filter schedules by scope">
          {[
            ['all', `All schedules (${counts.all})`, null],
            ['workflow', `Workflow runs (${counts.workflow})`, Layers],
            ['job', `Single job runs (${counts.job})`, Target],
          ].map(([key, text, Icon]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={scope === key}
              className={`eod-scope-filter-btn ${scope === key ? 'active' : ''}`}
              onClick={() => setScope(key)}
            >
              {Icon ? (
                <Icon size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
              ) : null}
              {text}
            </button>
          ))}
        </div>
      </div>

      {!isLoading && schedules.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No schedules yet"
          description={`Nothing is scheduled in ${selectedEnv}. Add a schedule for a workflow or a job.`}
          action={addButton}
        />
      ) : (
        <div className="eod-schedules-container">
          {isLoading && schedules.length === 0 ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="eod-schedule-card" style={{ padding: 20 }}>
                <Skeleton height={20} width={180} />
                <Skeleton height={44} width="100%" style={{ marginTop: 12 }} />
              </div>
            ))
          ) : groups.length === 0 ? (
            <div className="eod-schedule-card">
              <div className="eod-schedule-empty">
                <Clock size={18} className="eod-empty-clock" />
                <span>No schedules match this filter.</span>
                <button
                  type="button"
                  className="eod-week-clear-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    setDayIndex(null);
                    setScope('all');
                  }}
                >
                  Show all schedules
                </button>
              </div>
            </div>
          ) : (
            groups.map(([title, rows]) => (
              <div key={title} className="eod-schedule-card">
                <div className="eod-schedule-header">
                  <div className="eod-schedule-header-title">
                    <Calendar size={14} className="eod-cal-icon" />
                    <span>{title}</span>
                  </div>
                  <span className="eod-schedule-count-pill">{rows.length} scheduled</span>
                </div>
                <div className="sc-grid sc-slim" role="list">
                  <div className="sc-cols" aria-hidden="true">
                    <span className="sc-col-on">On</span>
                    <span className="sc-col-name">Name</span>
                    <span className="sc-col-freq">Frequency</span>
                    <span className="sc-col-next">Next start</span>
                    <span className="sc-col-result">Last result</span>
                    <span className="sc-col-actions">Actions</span>
                  </div>
                  {rows.map((s) => (
                    <article
                      key={s.id}
                      className={`sc-card ${!s.enabled ? 'sched-off' : ''}`}
                      role="listitem"
                    >
                      <div className="sc-cell-on">
                        <label
                          className="switch"
                          title={s.enabled ? 'On: click to turn off' : 'Off: click to turn on'}
                          htmlFor={`sch-toggle-${s.id}`}
                        >
                          <input
                            id={`sch-toggle-${s.id}`}
                            type="checkbox"
                            role="switch"
                            checked={s.enabled}
                            disabled={!canEdit || busyId === s.id}
                            onChange={(e) => toggle(s, e.target.checked)}
                            aria-label={`${displayName(s)} is ${s.enabled ? 'on' : 'off'}`}
                          />
                          <span />
                        </label>
                      </div>
                      <div className="sc-name-col">
                        <div className="sc-name-row">
                          <span className="sc-name-text">{displayName(s)}</span>
                        </div>
                        <div className="sc-name-sub">
                          {s.job ? (
                            <span className="sc-scope-badge scope-target">
                              <Target size={10} /> Single job + prerequisites
                            </span>
                          ) : (
                            <span className="sc-scope-badge scope-batch">
                              <Layers size={10} /> Entire workflow
                            </span>
                          )}
                          <span
                            className="sc-warn-line"
                            style={{ marginLeft: 6, color: 'inherit', opacity: 0.7 }}
                          >
                            {s.filename || `XML #${s.workflow_id}`} · {s.folder}
                          </span>
                        </div>
                      </div>
                      <div className="sc-freq-col">
                        <span className="sc-freq-pill" title={s.summary}>
                          <Repeat size={11} className="sc-freq-icon" />
                          <span>{s.summary}</span>
                        </span>
                      </div>
                      <div
                        className="sc-next-start-col"
                        title={
                          s.enabled
                            ? `${fmtDateTime(s.next_fire_at)} (in ${countdown(s.next_fire_at)})`
                            : 'Off'
                        }
                      >
                        <span className="sc-fact-text">
                          {s.enabled ? fmtDateTime(s.next_fire_at) : 'Off'}
                        </span>
                        {s.enabled && s.next_fire_at ? (
                          <span className="sc-countdown-sub">in {countdown(s.next_fire_at)}</span>
                        ) : null}
                      </div>
                      <div
                        className="sc-last-result-col"
                        title={s.last_fire_at ? `Last run: ${fmtDateTime(s.last_fire_at)}` : ''}
                      >
                        <span className="sc-fact-text">
                          {s.last_status
                            ? `${s.last_status}${s.last_fire_at ? ` · ${agoText(s.last_fire_at)}` : ''}`
                            : 'Never started'}
                        </span>
                      </div>
                      <div className="sched-actions">
                        {canRun && s.last_run_id && s.last_status === 'RUNNING' && (
                          <button
                            type="button"
                            className="btn sm btn-ctl btn-ctl-pause"
                            onClick={() =>
                              controlRun(
                                s,
                                'pauseRun',
                                'Run paused: running jobs finish, no new job starts.',
                              )
                            }
                            disabled={busyId === s.id}
                            title="Pause the run: jobs already running finish, no new job starts"
                            aria-label="Pause the run"
                          >
                            <Pause size={13} />
                          </button>
                        )}
                        {canRun && s.last_run_id && s.last_status === 'PAUSED' && (
                          <button
                            type="button"
                            className="btn sm btn-ctl btn-ctl-resume"
                            onClick={() => controlRun(s, 'resumeRun', 'Run resumed.')}
                            disabled={busyId === s.id}
                            title="Resume the paused run"
                            aria-label="Resume the run"
                          >
                            <Play size={13} />
                          </button>
                        )}
                        {canRun &&
                          s.last_run_id &&
                          (s.last_status === 'RUNNING' || s.last_status === 'PAUSED') && (
                            <button
                              type="button"
                              className="btn sm btn-ctl btn-ctl-stop"
                              onClick={() => setStopping(s)}
                              disabled={busyId === s.id}
                              title="Stop the run"
                              aria-label="Stop the run"
                            >
                              <Square size={12} />
                            </button>
                          )}
                        {canEdit && (
                          <button
                            type="button"
                            className="btn sm btn-edit-icon"
                            onClick={() => setForm({ open: true, schedule: s })}
                            title="Edit schedule"
                            aria-label="Edit schedule"
                          >
                            <Edit size={12} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            type="button"
                            className="btn sm danger"
                            onClick={() => setDeleting(s)}
                            title="Delete schedule"
                            aria-label="Delete schedule"
                          >
                            <Trash size={12} />
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <ScheduleFormModal
        isOpen={form.open}
        env={selectedEnv}
        schedule={form.schedule}
        onClose={() => setForm({ open: false, schedule: null })}
        onSaved={saved}
      />

      {stopping && (
        <AdminModal isOpen onClose={() => setStopping(null)} title="Stop the run" size="sm">
          <div className="eod-delete-modal-body">
            <AlertTriangle size={24} className="eod-danger-icon" />
            <p>
              Stop the run of <strong>{displayName(stopping)}</strong>? Jobs not started yet are
              cancelled. A command already running on the target server may keep running there until
              it ends; check the server if it must stop at once.
            </p>
          </div>
          <div className="eod-modal-footer">
            <button
              type="button"
              className="eod-modal-btn cancel"
              onClick={() => setStopping(null)}
              disabled={busyId === stopping.id}
            >
              Keep running
            </button>
            <button
              type="button"
              className="eod-modal-btn danger"
              onClick={() => controlRun(stopping, 'cancelRun', 'Stop requested for the run.')}
              disabled={busyId === stopping.id}
            >
              Stop run
            </button>
          </div>
        </AdminModal>
      )}

      {deleting && (
        <AdminModal isOpen onClose={() => setDeleting(null)} title="Delete Schedule" size="sm">
          <div className="eod-delete-modal-body">
            <AlertTriangle size={24} className="eod-danger-icon" />
            <p>
              Delete <strong>{displayName(deleting)}</strong> ({deleting.summary})? Runs already
              started are not affected.
            </p>
          </div>
          <div className="eod-modal-footer">
            <button
              type="button"
              className="eod-modal-btn cancel"
              onClick={() => setDeleting(null)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="eod-modal-btn danger"
              onClick={remove}
              disabled={isSaving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="spin-animation" /> Deleting...
                </>
              ) : (
                'Delete Schedule'
              )}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

export default SchedulesNewSection;
