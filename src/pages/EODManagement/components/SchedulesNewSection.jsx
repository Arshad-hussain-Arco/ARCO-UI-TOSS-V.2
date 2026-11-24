import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Plus,
  ChevronDown,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { EmptyState } from '@components/feedback/EmptyState/EmptyState';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useAuth } from '@hooks/useAuth';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import {
  EOD_PROFILES,
  KINDS,
  getScheduleProfile,
  getSmartPollInterval,
  runsOnWeekday,
} from '../scheduler/scheduleSpec';
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

// Schedules made by an earlier build of "Add to multiple profiles" were saved as "<name> (Monthly EOD)"; hide that profile suffix.
const LEGACY_PROFILE_SUFFIX =
  /\s*\((?:Daily EOD|Weekly EOD|Monthly EOD|Quarterly EOD|Yearly EOD|Once|Custom Interval|Every N (?:days|hours|minutes))\)$/i;
// "Weekly on Tue at 15:12" under a "Weekly" heading says Weekly twice: drop the leading word that the heading already shows.
const withoutLead = (summary, heading) => {
  const text = String(summary || '');
  const word = String(heading || '').split(' ')[0];
  if (!word || !text.toLowerCase().startsWith(`${word.toLowerCase()} `)) return text;
  const rest = text.slice(word.length + 1).trim();
  return rest ? rest[0].toUpperCase() + rest.slice(1) : text;
};
const displayName = (s) => {
  const base = (s.name || '').replace(LEGACY_PROFILE_SUFFIX, '').trim();
  return base || (s.job ? `Job: ${s.job}` : `Workflow: ${s.folder}`);
};

// The list is grouped by how a schedule repeats. "Custom interval" holds every-N-days/hours/minutes.
// Same order as the EOD Profiles sidebar (Daily, Weekly, Monthly, Quarterly, Yearly, Once, Custom).
const REPEAT_ORDER = [
  'Daily',
  'Weekly',
  'Monthly',
  'Quarterly',
  'Yearly',
  'Once',
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
  const [customProfiles, setCustomProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [, setTick] = useState(0);
  const [selectedProfile, setSelectedProfile] = useState('all');
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const [dayIndex, setDayIndex] = useState(null);
  const [dayMenuOpen, setDayMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dayMenuRef = useRef(null);
  const [scope, setScope] = useState('all'); // all | workflow | job
  const [form, setForm] = useState({ open: false, schedule: null });
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ label: '', description: '', default_kind: 'daily' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [stopping, setStopping] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!dayMenuOpen) return undefined;
    const onDown = (e) => {
      if (dayMenuRef.current && !dayMenuRef.current.contains(e.target)) {
        setDayMenuOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setDayMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [dayMenuOpen]);

  const loadCustomProfiles = useCallback(async () => {
    try {
      const list = await svc.listProfiles(selectedEnv);
      setCustomProfiles(Array.isArray(list) ? list : []);
    } catch {
      /* keep current profiles if backend hasn't restarted yet */
    }
  }, [selectedEnv]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rows] = await Promise.all([svc.listSchedules(selectedEnv), loadCustomProfiles()]);
      setSchedules(rows);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedEnv, loadCustomProfiles]);

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
  // Smart / Anticipation Polling (Expanded ±60s window + 90s post-save window):
  // Default 20s idle poll; ramps to 2s when any schedule is active, due within ±60s, fired within 60s, or saved within 90s.
  const pollIntervalMs = getSmartPollInterval({ schedules, nowMs: Date.now() });

  useEffect(() => {
    const onWake = () => refresh();
    const onVisibilityChange = () => {
      if (!document.hidden) onWake();
    };
    window.addEventListener('eod-schedules-updated', onWake);
    window.addEventListener('focus', onWake);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('eod-schedules-updated', onWake);
      window.removeEventListener('focus', onWake);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(timer);
  }, [pollIntervalMs, refresh]);

  const knownRunIdsRef = useRef(new Set());
  const initialSchedulesRef = useRef(false);

  // When any schedule triggers a new run, dispatch eod-run-triggered so CockpitTab opens and displays it
  useEffect(() => {
    if (!schedules.length) return;
    if (!initialSchedulesRef.current) {
      schedules.forEach((s) => {
        if (s.last_run_id) knownRunIdsRef.current.add(String(s.last_run_id));
      });
      initialSchedulesRef.current = true;
      return;
    }
    for (const s of schedules) {
      if (
        s.last_run_id &&
        s.last_status === 'RUNNING' &&
        !knownRunIdsRef.current.has(String(s.last_run_id))
      ) {
        knownRunIdsRef.current.add(String(s.last_run_id));
        window.dispatchEvent(
          new CustomEvent('eod-run-triggered', {
            detail: { runId: s.last_run_id, folder: s.folder, env: selectedEnv },
          }),
        );
        break;
      }
    }
  }, [schedules, selectedEnv]);

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
      try {
        window.dispatchEvent(new CustomEvent('eod-schedules-updated', { detail: saved }));
      } catch {}
      toast.success(enabled ? 'Schedule turned on.' : 'Schedule turned off.');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusyId(null);
    }
  };

  // Copies made with "Add to multiple profiles": same workflow/job, start date and times, but another EOD profile.
  const deleteSiblings = useMemo(() => {
    if (!deleting || !Array.isArray(schedules)) return [];
    const sig = (x) => {
      const r = x.recurrence || {};
      return [x.workflow_id ?? x.workflow ?? '', x.folder || '', x.job || '', r.start_date || '', [...(r.times || [])].sort().join(',')].join('|');
    };
    const mine = sig(deleting);
    return schedules.filter((x) => x.id !== deleting.id && sig(x) === mine);
  }, [deleting, schedules]);
  const [alsoDelete, setAlsoDelete] = useState([]);
  useEffect(() => setAlsoDelete([]), [deleting]);
  const profileLabelOf = (x) => {
    const pid = getScheduleProfile(x);
    return allProfiles.find((p) => p.id === pid)?.label || pid;
  };

  const remove = async () => {
    setIsSaving(true);
    const ids = [deleting?.id, ...alsoDelete].filter((v) => v != null);
    const done = [];
    try {
      for (const id of ids) {
        await svc.deleteSchedule(selectedEnv, id);
        done.push(id);
      }
      setDeleting(null);
      toast.success(done.length > 1 ? `${done.length} schedules deleted.` : 'Schedule deleted.');
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      if (done.length) {
        setSchedules((prev) => (Array.isArray(prev) ? prev.filter((s) => !done.includes(s.id)) : []));
        try {
          window.dispatchEvent(
            new CustomEvent('eod-schedules-updated', { detail: { deleted: done, env: selectedEnv } })
          );
        } catch {
          /* refresh hint only */
        }
        await load();
      }
      setIsSaving(false);
    }
  };

  const saved = async (result) => {
    setForm({ open: false, schedule: null });
    toast.success(
      result.count > 1
        ? `Schedule added to ${result.count} profiles.`
        : form.schedule && !result.count
          ? 'Schedule updated.'
          : 'Schedule added.',
    );
    (result.warnings || []).forEach((w) => toast.warning(w));
    await load();
  };

  const allProfiles = useMemo(
    () => [
      ...EOD_PROFILES,
      ...customProfiles.map((p) => ({
        ...p,
        defaultKind: p.defaultKind || p.default_kind || 'daily',
        custom: true,
      })),
    ],
    [customProfiles],
  );

  const schedulesByProfile = useMemo(() => {
    const map = {};
    schedules.forEach((s) => {
      const pid = getScheduleProfile(s);
      if (!map[pid]) map[pid] = [];
      map[pid].push(s);
    });
    return map;
  }, [schedules]);

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    const labelTxt = profileDraft.label.trim();
    if (!labelTxt) return;
    setProfileSaving(true);
    try {
      const created = await svc.createProfile(selectedEnv, {
        label: labelTxt,
        description: profileDraft.description.trim(),
        default_kind: profileDraft.default_kind,
      });
      setCustomProfiles((prev) => [...prev, created]);
      setAddProfileOpen(false);
      setProfileDraft({ label: '', description: '', default_kind: 'daily' });
      setSelectedProfile(created.id);
      setDayIndex(null);
      toast.success(`Profile "${created.label}" added.`);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleDeleteProfile = async (e, prof) => {
    e.stopPropagation();
    try {
      await svc.deleteProfile(selectedEnv, prof.id);
      setCustomProfiles((prev) => prev.filter((p) => p.id !== prof.id));
      if (selectedProfile === prof.id) setSelectedProfile('all');
      toast.success(`Profile "${prof.label}" removed.`);
      await load();
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const toggleGroup = (title) =>
    setCollapsedGroups((prev) => ({ ...prev, [title]: !prev[title] }));

  const byProfile = useMemo(
    () =>
      selectedProfile === 'all'
        ? schedules
        : schedules.filter((s) => getScheduleProfile(s) === selectedProfile),
    [schedules, selectedProfile],
  );
  const bySearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return byProfile;
    return byProfile.filter(
      (s) =>
        displayName(s).toLowerCase().includes(q) ||
        (s.folder || '').toLowerCase().includes(q) ||
        (s.job || '').toLowerCase().includes(q) ||
        (s.filename || '').toLowerCase().includes(q) ||
        (s.summary || '').toLowerCase().includes(q),
    );
  }, [byProfile, searchQuery]);
  const byDay = useMemo(
    () => (dayIndex === null ? bySearch : bySearch.filter((s) => runsOnWeekday(s, dayIndex))),
    [bySearch, dayIndex],
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
  // one card per kind of repetition (or custom profile title when viewing a custom profile); soonest run first
  const groups = useMemo(() => {
    const soonest = (s) => (s.next_fire_at ? Date.parse(s.next_fire_at) : Infinity);
    const activeCustom =
      selectedProfile !== 'all'
        ? customProfiles.find((p) => p.id === selectedProfile)
        : null;
    if (activeCustom) {
      if (visible.length === 0) return [];
      return [[activeCustom.label, [...visible].sort((a, b) => soonest(a) - soonest(b) || a.id - b.id)]];
    }
    const map = new Map();
    visible.forEach((s) => {
      const key = repeatKind(s);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return REPEAT_ORDER.filter((k) => map.has(k)).map((k) => [
      k,
      map.get(k).sort((a, b) => soonest(a) - soonest(b) || a.id - b.id),
    ]);
  }, [visible, selectedProfile, customProfiles]);

  // The header is sticky; the search toolbar sticks right below it, so publish the header's height as --eodp-bar-h.
  const barObserver = useRef(null);
  const barRef = useCallback((node) => {
    barObserver.current?.disconnect();
    barObserver.current = null;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const publish = () => node.parentElement?.style.setProperty('--eodp-bar-h', `${node.offsetHeight}px`);
    publish();
    barObserver.current = new ResizeObserver(publish);
    barObserver.current.observe(node);
  }, []);

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
      <div className="eod-section-bar eodp-sticky-bar" ref={barRef}>
        <div>
          <p className="eod-section-title">SCHEDULED RUNS · {selectedEnv}</p>
          <span className="eod-section-subtitle">
            Manage automated End-of-Day batch execution schedules
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

      <div className="eodp-workspace">
        <aside className="eodp-sidebar" aria-label="EOD Profiles">
          <div className="eodp-sidebar-head">
            <span className="eodp-sidebar-title">EOD PROFILES</span>
            {canCreate && (
              <button
                type="button"
                className="eodp-add-profile-btn"
                onClick={() => {
                  setProfileDraft({ label: '', description: '', default_kind: 'daily' });
                  setAddProfileOpen(true);
                }}
              >
                <Plus size={12} /> Add Profile
              </button>
            )}
          </div>
          <div className="eodp-list" role="tablist" aria-label="Filter schedules by EOD profile">
            <button
              type="button"
              role="tab"
              aria-selected={selectedProfile === 'all'}
              className={`eodp-all-btn ${selectedProfile === 'all' ? 'active' : ''}`}
              onClick={() => {
                setSelectedProfile('all');
                setDayIndex(null);
              }}
            >
              <span>All Profiles</span>
              <span className="eodp-count-pill">{schedules.length}</span>
            </button>

            {allProfiles.map((p) => {
              const isSelected = selectedProfile === p.id;
              const cnt = (schedulesByProfile[p.id] || []).length;
              return (
                <div
                  key={p.id}
                  role="tab"
                  tabIndex={0}
                  aria-selected={isSelected}
                  className={`eodp-item ${isSelected ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedProfile(p.id);
                    setDayIndex(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedProfile(p.id);
                      setDayIndex(null);
                    }
                  }}
                >
                  <span className="eodp-item-icon">
                    <Calendar size={14} />
                  </span>
                  <span className="eodp-item-body">
                    <span className="eodp-item-name">{p.label}</span>
                    <span className="eodp-item-sub">{p.description}</span>
                  </span>
                  {p.custom && canDelete && (
                    <button
                      type="button"
                      className="eodp-del-btn"
                      title={`Delete ${p.label}`}
                      aria-label={`Delete ${p.label}`}
                      onClick={(e) => handleDeleteProfile(e, p)}
                    >
                      <X size={11} />
                    </button>
                  )}
                  <span className={`eodp-count-pill ${isSelected ? 'active' : ''}`}>{cnt}</span>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="eodp-main">
          {/* Option 1: Single Compact Unified Filter Toolbar */}
          <div className="eodp-toolbar">
            <div className="eodp-search-wrap">
              <Search size={14} className="eodp-search-icon" aria-hidden="true" />
              <input
                type="text"
                className="eodp-search-input"
                value={searchQuery}
                placeholder="Search schedules..."
                aria-label="Search schedules"
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="eodp-search-clear"
                  aria-label="Clear search"
                  onClick={() => setSearchQuery('')}
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>

            <div className="eodp-day-dropdown-wrap" ref={dayMenuRef}>
              <button
                type="button"
                className={`eodp-day-trigger ${dayIndex !== null ? 'filtered' : ''}`}
                aria-haspopup="listbox"
                aria-expanded={dayMenuOpen}
                onClick={() => setDayMenuOpen((o) => !o)}
              >
                <Calendar size={13} />
                <span>
                  Day:{' '}
                  <strong>
                    {dayIndex === null
                      ? 'All Days'
                      : DAYS_OF_WEEK.find((d) => d.dayIndex === dayIndex)?.name}
                  </strong>
                </span>
                <ChevronDown size={13} />
              </button>

              {dayMenuOpen && (
                <div className="eodp-day-menu" role="listbox" aria-label="Filter by day of week">
                  <button
                    type="button"
                    role="option"
                    aria-selected={dayIndex === null}
                    className={`eodp-day-option ${dayIndex === null ? 'active' : ''}`}
                    onClick={() => {
                      setDayIndex(null);
                      setDayMenuOpen(false);
                    }}
                  >
                    <span>All Days</span>
                    <span className="eodp-day-opt-count">{bySearch.length}</span>
                  </button>
                  {DAYS_OF_WEEK.map((d) => {
                    const selected = dayIndex === d.dayIndex;
                    const dCount = bySearch.filter((s) => runsOnWeekday(s, d.dayIndex)).length;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        className={`eodp-day-option ${selected ? 'active' : ''}`}
                        onClick={() => {
                          setDayIndex(selected ? null : d.dayIndex);
                          setDayMenuOpen(false);
                        }}
                      >
                        <span className="eodp-day-opt-name">
                          {d.name}
                          {today === d.dayIndex && (
                            <span className="eodp-today-chip">TODAY</span>
                          )}
                        </span>
                        <span className="eodp-day-opt-count">{dCount}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="eodp-scope-seg" role="tablist" aria-label="Filter schedules by scope">
              {[
                ['all', `All (${counts.all})`],
                ['workflow', `Workflows (${counts.workflow})`],
                ['job', `Jobs (${counts.job})`],
              ].map(([key, text]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={scope === key}
                  className={`eodp-scope-btn ${scope === key ? 'active' : ''}`}
                  onClick={() => setScope(key)}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          {!isLoading && byProfile.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title={
                selectedProfile === 'all'
                  ? 'No schedules yet'
                  : `No ${allProfiles.find((p) => p.id === selectedProfile)?.label || ''} schedules yet`
              }
              description={
                selectedProfile === 'all'
                  ? `Nothing is scheduled in ${selectedEnv}. Add a schedule for a workflow or a job.`
                  : `There are no schedules in this profile for ${selectedEnv}.`
              }
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
                        setSelectedProfile('all');
                        setSearchQuery('');
                        setDayIndex(null);
                        setScope('all');
                      }}
                    >
                      Show all schedules
                    </button>
                  </div>
                </div>
              ) : (
            groups.map(([title, rows]) => {
              const isCollapsed = Boolean(collapsedGroups[title]);
              return (
              <div key={title} className="eod-schedule-card">
                <button
                  type="button"
                  className="eod-schedule-header eodp-group-toggle"
                  aria-expanded={!isCollapsed}
                  onClick={() => toggleGroup(title)}
                >
                  <div className="eod-schedule-header-title">
                    {isCollapsed ? (
                      <ChevronRight size={15} className="eod-cal-icon" />
                    ) : (
                      <ChevronDown size={15} className="eod-cal-icon" />
                    )}
                    <Calendar size={14} className="eod-cal-icon" />
                    <span>{title}</span>
                  </div>
                  <span className="eod-schedule-count-pill">{rows.length} scheduled</span>
                </button>
                {!isCollapsed && (
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
                      id={`sch-row-${s.id}`}
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
                              <Target size={10} /> Single job
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
                            {s.filename || (s.workflow_id ? `Workflow #${s.workflow_id}` : '')} · {s.folder}
                          </span>
                        </div>
                      </div>
                      <div className="sc-freq-col">
                        <span className="sc-freq-pill" title={s.summary}>
                          <Repeat size={11} className="sc-freq-icon" />
                          <span>{withoutLead(s.summary, title)}</span>
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
                        title={
                          s.last_fire_at
                            ? `Last run: ${fmtDateTime(s.last_fire_at)}${s.last_run_id ? ' (Click to view in Control Run Cockpit)' : ''}`
                            : ''
                        }
                        style={s.last_run_id ? { cursor: 'pointer' } : {}}
                        onClick={() => {
                          if (s.last_run_id) {
                            window.dispatchEvent(
                              new CustomEvent('eod-run-triggered', {
                                detail: { runId: s.last_run_id, folder: s.folder, env: selectedEnv },
                              }),
                            );
                          }
                        }}
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
                )}
              </div>
              );
            })
          )}
        </div>
      )}
        </div>
      </div>

      <ScheduleFormModal
        isOpen={form.open}
        env={selectedEnv}
        schedule={form.schedule}
        profiles={allProfiles}
        defaultProfileId={selectedProfile}
        defaultKind={
          selectedProfile === 'all'
            ? null
            : allProfiles.find((p) => p.id === selectedProfile)?.defaultKind || null
        }
        onClose={() => setForm({ open: false, schedule: null })}
        onSaved={saved}
      />

      {addProfileOpen && (
        <AdminModal
          isOpen
          onClose={() => !profileSaving && setAddProfileOpen(false)}
          title="Add EOD Profile"
          size="sm"
        >
          <form onSubmit={handleCreateProfile} className="eod-schedule-modal-form">
            <div className="eod-modal-field-group">
              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="eodp-new-label">
                  PROFILE NAME <span className="req">*</span>
                </label>
                <input
                  id="eodp-new-label"
                  className="eod-modal-input"
                  value={profileDraft.label}
                  maxLength={64}
                  placeholder="e.g. Mid-Month EOD"
                  autoFocus
                  required
                  onChange={(e) => setProfileDraft((d) => ({ ...d, label: e.target.value }))}
                />
              </div>
              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="eodp-new-desc">
                  DESCRIPTION (optional)
                </label>
                <input
                  id="eodp-new-desc"
                  className="eod-modal-input"
                  value={profileDraft.description}
                  maxLength={140}
                  placeholder="e.g. Mid-month reconciliation schedules"
                  onChange={(e) => setProfileDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </div>
              <div className="eod-modal-field">
                <label className="eod-modal-label" htmlFor="eodp-new-kind">
                  DEFAULT RECURRENCE
                </label>
                <select
                  id="eodp-new-kind"
                  className="eod-modal-input"
                  value={profileDraft.default_kind}
                  onChange={(e) => setProfileDraft((d) => ({ ...d, default_kind: e.target.value }))}
                >
                  {KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="eod-modal-footer">
              <button
                type="button"
                className="eod-modal-btn cancel"
                onClick={() => setAddProfileOpen(false)}
                disabled={profileSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="eod-modal-btn primary-green"
                disabled={profileSaving || !profileDraft.label.trim()}
              >
                {profileSaving ? 'Adding…' : 'Add Profile'}
              </button>
            </div>
          </form>
        </AdminModal>
      )}

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
            {deleteSiblings.length > 0 && (
              <div className="schf-multi-panel" style={{ marginTop: 10, textAlign: 'left' }}>
                <div className="schf-multi-title">
                  This schedule also exists in other profiles. Delete from these too?
                </div>
                <div className="schf-multi-grid">
                  {deleteSiblings.map((x) => (
                    <label key={x.id} className="schf-multi-opt">
                      <input
                        type="checkbox"
                        checked={alsoDelete.includes(x.id)}
                        onChange={() =>
                          setAlsoDelete((sel) =>
                            sel.includes(x.id) ? sel.filter((v) => v !== x.id) : [...sel, x.id],
                          )
                        }
                      />
                      <span>
                        {profileLabelOf(x)}
                        {x.summary ? (
                          <span className="eodsch-muted"> · {withoutLead(x.summary, profileLabelOf(x))}</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="eod-modal-btn cancel"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    setAlsoDelete((sel) =>
                      sel.length === deleteSiblings.length ? [] : deleteSiblings.map((x) => x.id),
                    )
                  }
                >
                  {alsoDelete.length === deleteSiblings.length ? 'Clear selection' : 'Select all'}
                </button>
              </div>
            )}
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
                alsoDelete.length ? `Delete ${alsoDelete.length + 1} schedules` : 'Delete Schedule'
              )}
            </button>
          </div>
        </AdminModal>
      )}
    </div>
  );
}

export default SchedulesNewSection;
