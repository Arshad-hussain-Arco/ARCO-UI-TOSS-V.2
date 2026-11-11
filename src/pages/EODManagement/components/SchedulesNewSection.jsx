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
  Target,
  Layers,
  Repeat,
} from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { EmptyState } from '@components/feedback/EmptyState/EmptyState';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useAuth } from '@hooks/useAuth';
import { eodService, toShortEnvName } from '@services/eodService';
import { eodSchedulerService } from '@services/eodSchedulerService';
import { ScheduleNewModal } from './ScheduleNewModal';
import Skeleton from '@/components/feedback/Skeleton/Skeleton';

// Sunday (0) through Saturday (6)
const DAYS_OF_WEEK = [
  { id: 'sunday', name: 'Sunday', short: 'Sun', dayIndex: 0 },
  { id: 'monday', name: 'Monday', short: 'Mon', dayIndex: 1 },
  { id: 'tuesday', name: 'Tuesday', short: 'Tue', dayIndex: 2 },
  { id: 'wednesday', name: 'Wednesday', short: 'Wed', dayIndex: 3 },
  { id: 'thursday', name: 'Thursday', short: 'Thu', dayIndex: 4 },
  { id: 'friday', name: 'Friday', short: 'Fri', dayIndex: 5 },
  { id: 'saturday', name: 'Saturday', short: 'Sat', dayIndex: 6 },
];

/** Countdown format: "05:22:11" or "2d 03:10:00" */
function countdown(iso) {
  if (!iso) return '–';
  const target = typeof iso === 'string' ? Date.parse(iso) : iso.getTime();
  const s = Math.max(0, Math.floor((target - Date.now()) / 1000));
  if (s <= 0) return 'Starting…';
  const p = (n) => String(n).padStart(2, '0');
  const d = Math.floor(s / 86400);
  return `${d ? `${d}d ` : ''}${p(Math.floor((s % 86400) / 3600))}:${p(
    Math.floor((s % 3600) / 60)
  )}:${p(s % 60)}`;
}

/** Human span: "5 h 20 min", "2 days" */
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
  const target = typeof iso === 'string' ? Date.parse(iso) : iso.getTime();
  const ms = Date.now() - target;
  return ms < 60000 ? 'Just now' : `${span(ms)} ago`;
};

function fmtDateTime(iso) {
  if (!iso) return '–';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return Number.isNaN(+d)
    ? '–'
    : d.toLocaleString([], { hour12: false, dateStyle: 'medium', timeStyle: 'short' });
}

function formatNextStart(sch, nextRun, isSwitchOn) {
  if (!isSwitchOn) return 'Off';
  if (!nextRun) return '–';
  const d = typeof nextRun === 'string' ? new Date(nextRun) : nextRun;
  if (isNaN(d.getTime())) return '–';

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const timeStr =
    sch.time ||
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

  if (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  ) {
    return `Today ${timeStr}`;
  }

  if (
    d.getDate() === tomorrow.getDate() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getFullYear() === tomorrow.getFullYear()
  ) {
    return `Tomorrow ${timeStr}`;
  }

  const monthNames = [
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
  ];
  return `${d.getDate()} ${monthNames[d.getMonth()]}, ${timeStr}`;
}

/** Compute next scheduled date/time for a schedule */
function computeNextRun(sch) {
  if (sch.nextRunAt || sch.next_run_at) {
    return new Date(sch.nextRunAt || sch.next_run_at);
  }
  const time = sch.time || '22:00';
  const [hh, mm] = time.split(':').map((x) => parseInt(x, 10) || 0);
  const now = new Date();

  const candidate = new Date();
  candidate.setHours(hh, mm, 0, 0);

  if (sch.recurrence === 'Daily' || !sch.recurrence) {
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate;
  }

  if (sch.recurrence === 'Weekly') {
    const days = (sch.selectedDays || (sch.dayOfWeek ? sch.dayOfWeek.split(',') : [])).map((d) =>
      d.trim().toLowerCase()
    );
    for (let offset = 0; offset < 7; offset++) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      d.setHours(hh, mm, 0, 0);
      const dayName = DAYS_OF_WEEK[d.getDay()].name.toLowerCase();
      if (days.some((x) => x.startsWith(dayName) || dayName.startsWith(x))) {
        if (d.getTime() > now.getTime()) {
          return d;
        }
      }
    }
    candidate.setDate(candidate.getDate() + 7);
    return candidate;
  }

  if (
    sch.selectedDate ||
    sch.recurrence === 'Annually' ||
    sch.recurrence === 'Specific Date & Time' ||
    sch.recurrence === 'Custom / One-time'
  ) {
    let d = sch.selectedDate ? new Date(sch.selectedDate) : null;
    if (!d || isNaN(d.getTime())) {
      if (sch.selectedMonth && sch.selectedDayOfMonth) {
        const yr = now.getFullYear();
        const dom = sch.selectedDayOfMonth === 'L' ? 28 : sch.selectedDayOfMonth;
        d = new Date(yr, sch.selectedMonth - 1, dom);
      }
    }
    if (d && !isNaN(d.getTime())) {
      d.setHours(hh, mm, 0, 0);
      if (d.getTime() <= now.getTime()) {
        d.setFullYear(d.getFullYear() + 1);
      }
      return d;
    }
  }

  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

function formatDateGroup(dateVal) {
  if (!dateVal) return 'Daily Runs';
  const d = typeof dateVal === 'string' ? new Date(dateVal) : dateVal;
  if (isNaN(d.getTime())) return String(dateVal);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  return `${dayNames[d.getDay()]} ${d.getDate()} ${monthNames[d.getMonth()]}`;
}

/** Clean schedule display name without repetitive words */
function getScheduleDisplayName(sch) {
  if (
    sch.name &&
    !sch.name.startsWith('Every day ') &&
    !sch.name.startsWith('Target:') &&
    sch.name.trim().length > 0
  ) {
    return sch.name;
  }
  if (sch.runScope === 'job' || sch.targetJob) {
    return sch.targetJob ? `Job: ${sch.targetJob}` : 'Specific Job Run';
  }
  return 'EOD Batch Run';
}

/** Formats frequency / recurrence cadence for column display */
function formatFrequency(sch) {
  if (!sch) return 'Daily';
  const rec = sch.recurrence || 'Daily';
  const recLower = rec.toLowerCase();

  if (recLower === 'daily') {
    return 'Daily';
  }
  if (recLower === 'weekly') {
    if (sch.selectedDays && sch.selectedDays.length > 0) {
      const shortDays = sch.selectedDays.map((d) => d.slice(0, 3)).join(', ');
      return `Weekly (${shortDays})`;
    }
    if (sch.dayOfWeek) {
      return `Weekly (${sch.dayOfWeek})`;
    }
    return 'Weekly';
  }
  if (recLower === 'monthly') {
    if (sch.selectedDayOfMonth) {
      return sch.selectedDayOfMonth === 'L'
        ? 'Monthly (Last day)'
        : `Monthly (Day ${sch.selectedDayOfMonth})`;
    }
    return 'Monthly';
  }
  if (recLower === 'quarterly') {
    return 'Quarterly';
  }
  if (
    recLower.startsWith('specific date') ||
    recLower === 'custom / one-time' ||
    recLower === 'annually'
  ) {
    if (sch.selectedDate) {
      const d = new Date(sch.selectedDate);
      if (!isNaN(d.getTime())) {
        const m = d.toLocaleString('en', { month: 'short' });
        return `Once (${d.getDate()} ${m})`;
      }
    }
    return 'Specific Date';
  }
  return rec;
}

/** Evaluates whether a schedule runs on a specific day of the week (0 = Sunday ... 6 = Saturday) */
function isScheduleOnDay(sch, dayIndex) {
  if (!sch) return false;
  if (sch.recurrence === 'Daily' || sch.recurrence === 'daily' || !sch.recurrence) return true;

  const targetDay = DAYS_OF_WEEK[dayIndex];
  if (!targetDay) return false;

  if (sch.recurrence === 'Weekly' || sch.recurrence === 'weekly') {
    const days = (sch.selectedDays || (sch.dayOfWeek ? sch.dayOfWeek.split(',') : [])).map((d) =>
      d.trim().toLowerCase()
    );
    return days.some(
      (d) => d.startsWith(targetDay.name.toLowerCase()) || targetDay.name.toLowerCase().startsWith(d)
    );
  }

  if (sch.dateGroup && typeof sch.dateGroup === 'string') {
    const dg = sch.dateGroup.trim().toLowerCase();
    if (dg.startsWith(targetDay.short.toLowerCase()) || dg.startsWith(targetDay.name.toLowerCase())) {
      return true;
    }
  }

  if (sch.selectedDate) {
    const d = new Date(sch.selectedDate);
    if (!isNaN(d.getTime()) && d.getDay() === dayIndex) {
      return true;
    }
  }

  return false;
}

export function SchedulesNewSection({ selectedEnv }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canCreate = hasPermission('EOD_SCHEDULE_CREATE');
  const canEdit = hasPermission('EOD_SCHEDULE_EDIT');
  const canDelete = hasPermission('EOD_SCHEDULE_DELETE');

  const [scheduleList, setScheduleList] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Live second ticker for live countdowns
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayDayIndex = useMemo(() => new Date().getDay(), []); // 0 = Sunday

  // Top Day Navigation: defaults to today's day index (0..6 Sun..Sat), or null for All Days
  const [selectedDayIndex, setSelectedDayIndex] = useState(() => new Date().getDay());

  // Scope filter: 'all' | 'batch' | 'target' (from Orchestrator)
  const [currentScope, setCurrentScope] = useState('all');

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [deleteConfirmSchedule, setDeleteConfirmSchedule] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [runningIds, setRunningIds] = useState(new Set());

  /** Fetch schedule records only on page load */
  const fetchScheduleData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const schedulesData = await eodService.getEodSchedules();
      setScheduleList(schedulesData || []);
    } catch (err) {
      console.error('Failed to fetch EOD schedules:', err);
      setError(err?.message || 'Failed to load schedule data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Lazily load environments */
  const fetchEnvironmentsIfNeeded = useCallback(async () => {
    if (environments.length > 0) return environments;
    try {
      const envsData = await eodService.getEnvironments();
      setEnvironments(envsData || []);
      return envsData || [];
    } catch (err) {
      console.error('Failed to fetch environments for modal:', err);
      return [];
    }
  }, [environments]);

  useEffect(() => {
    fetchScheduleData();
    fetchEnvironmentsIfNeeded();
  }, [fetchScheduleData, fetchEnvironmentsIfNeeded]);

  const getEnv = useCallback(
    (envId) =>
      environments.find(
        (e) =>
          e.id === envId ||
          String(e.id) === String(envId) ||
          (e.code && String(e.code).toLowerCase() === String(envId).toLowerCase()) ||
          (e.name && e.name.toLowerCase() === String(envId).toLowerCase())
      ),
    [environments]
  );

  const handleOpenAdd = async (initialDate = new Date()) => {
    const envs = await fetchEnvironmentsIfNeeded();
    let defaultEnvId = envs[0]?.id ?? envs[0]?.code ?? '';
    if (selectedEnv && envs.length > 0) {
      const match = envs.find(
        (e) =>
          (e.code && e.code.toUpperCase() === selectedEnv.toUpperCase()) ||
          (e.name && e.name.toUpperCase() === selectedEnv.toUpperCase()) ||
          String(e.id) === String(selectedEnv)
      );
      if (match) defaultEnvId = match.id;
    }
    setEditingSchedule({
      id: '',
      envId: defaultEnvId,
      selectedDate: initialDate,
      time: '22:00',
      recurrence: 'Daily',
      runScope: 'batch',
      maxParallel: 4,
      simulateAll: false,
      isActive: true,
    });
    setModalOpen(true);
  };

  const handleOpenEdit = async (sch, e) => {
    e?.stopPropagation();
    await fetchEnvironmentsIfNeeded();
    setEditingSchedule({
      ...sch,
      runScope: sch.runScope || (sch.targetJob ? 'job' : 'batch'),
      targetJob: sch.targetJob || '',
      name:
        sch.name && !sch.name.startsWith('Every day ') && !sch.name.startsWith('Target:')
          ? sch.name
          : '',
      selectedDate: sch.selectedDate || new Date(),
    });
    setModalOpen(true);
  };

  const handleToggleSchedule = async (id, nextState) => {
    setScheduleList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: nextState } : s))
    );
    toast.success(nextState ? 'Schedule turned on.' : 'Schedule turned off.');
  };

  const handleRunNow = async (sch) => {
    if (!sch) return;
    const scheduleName = getScheduleDisplayName(sch);
    const envs = await fetchEnvironmentsIfNeeded();
    const envObj =
      envs.find(
        (e) =>
          e.id === sch.envId ||
          String(e.id) === String(sch.envId) ||
          (e.code && String(e.code).toLowerCase() === String(sch.envId).toLowerCase()) ||
          (e.name && e.name.toLowerCase() === String(sch.envId).toLowerCase())
      ) || getEnv(sch.envId);

    const rawEnv =
      envObj?.code ||
      envObj?.environment ||
      sch.environmentCode ||
      sch.environmentName ||
      envObj?.name ||
      sch.envId ||
      'DEV';
    const envCode = toShortEnvName(rawEnv);

    setRunningIds((prev) => new Set(prev).add(sch.id));
    try {
      await eodSchedulerService.runNow(envCode, { allow_overlap: false });
      toast.success(`Run started in Scheduler for ${scheduleName} (${envCode}).`);
    } catch (err) {
      console.error('Failed to trigger run in scheduler:', err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.message ||
        'Failed to start run in Scheduler';
      toast.error(`Could not start run: ${msg}`);
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(sch.id);
        return next;
      });
    }
  };

  const handleSaveSchedule = async (schData) => {
    try {
      let formattedDate = 'Daily Runs';
      if (
        schData.recurrence === 'Specific Date & Time' ||
        schData.recurrence === 'Specific Date & Time (Calendar)' ||
        schData.recurrence === 'Custom / One-time' ||
        schData.recurrence === 'Annually'
      ) {
        formattedDate = formatDateGroup(schData.selectedDate);
      } else if (schData.recurrence === 'Weekly') {
        const days = (schData.selectedDays || []).map((d) => d.slice(0, 3)).join(', ');
        formattedDate = `Weekly (${days || 'Custom Days'})`;
      } else if (schData.recurrence === 'Monthly') {
        const dom =
          schData.selectedDayOfMonth === 'L'
            ? 'Last Day'
            : `day ${schData.selectedDayOfMonth || 1}`;
        formattedDate = `Monthly (${dom})`;
      }

      const payload = {
        ...schData,
        dateGroup: formattedDate,
      };

      if (schData.id) {
        await eodService.updateEodSchedule(schData.id, payload);
      } else {
        await eodService.createEodSchedule(payload);
      }
      setModalOpen(false);
      await fetchScheduleData();
      toast.success(schData.id ? 'Schedule updated.' : 'Schedule added.');
    } catch (err) {
      console.error('Failed to save schedule:', err);
      let formattedDate = 'Daily Runs';
      if (
        schData.recurrence === 'Specific Date & Time' ||
        schData.recurrence === 'Specific Date & Time (Calendar)' ||
        schData.recurrence === 'Custom / One-time' ||
        schData.recurrence === 'Annually'
      ) {
        formattedDate = formatDateGroup(schData.selectedDate);
      } else if (schData.recurrence === 'Weekly') {
        const days = (schData.selectedDays || []).map((d) => d.slice(0, 3)).join(', ');
        formattedDate = `Weekly (${days || 'Custom Days'})`;
      } else if (schData.recurrence === 'Monthly') {
        const dom =
          schData.selectedDayOfMonth === 'L'
            ? 'Last Day'
            : `day ${schData.selectedDayOfMonth || 1}`;
        formattedDate = `Monthly (${dom})`;
      }
      const itemToSave = {
        id: schData.id || `sch-${Date.now()}`,
        name: schData.name || '',
        envId: schData.envId,
        dateGroup: formattedDate,
        time: schData.time,
        recurrence: schData.recurrence,
        runScope: schData.runScope,
        targetJob: schData.targetJob,
        maxParallel: schData.maxParallel,
        simulateAll: schData.simulateAll,
        isActive: schData.isActive !== undefined ? schData.isActive : true,
        selectedDate: schData.selectedDate,
        selectedDays: schData.selectedDays,
        cronExpressions: schData.cronExpressions,
        cronExpression: schData.cronExpression,
      };
      if (schData.id) {
        setScheduleList((prev) => prev.map((s) => (s.id === schData.id ? itemToSave : s)));
      } else {
        setScheduleList((prev) => [...prev, itemToSave]);
      }
      setModalOpen(false);
      toast.success(schData.id ? 'Schedule updated.' : 'Schedule added.');
    }
  };

  const handleDeleteSchedule = async (id, groupId) => {
    setIsSaving(true);
    try {
      await eodService.deleteEodSchedule(id, groupId);
      setDeleteConfirmSchedule(null);
      await fetchScheduleData();
      toast.success('Schedule deleted.');
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      setScheduleList((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirmSchedule(null);
      toast.success('Schedule deleted.');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered schedules for the list below
  const filteredScheduleList = useMemo(() => {
    return scheduleList.filter((sch) => {
      // 1. Day Filter
      if (selectedDayIndex !== null && !isScheduleOnDay(sch, selectedDayIndex)) {
        return false;
      }
      // 2. Scope Filter ('all' | 'batch' | 'target')
      const isTarget = sch.runScope === 'job' || !!sch.targetJob;
      if (currentScope === 'batch' && isTarget) return false;
      if (currentScope === 'target' && !isTarget) return false;
      return true;
    });
  }, [scheduleList, selectedDayIndex, currentScope]);

  // Counts for scope filter tabs
  const scopeCounts = useMemo(() => {
    const dayFiltered =
      selectedDayIndex !== null
        ? scheduleList.filter((s) => isScheduleOnDay(s, selectedDayIndex))
        : scheduleList;
    const batch = dayFiltered.filter((s) => s.runScope !== 'job' && !s.targetJob).length;
    const target = dayFiltered.length - batch;
    return { all: dayFiltered.length, batch, target };
  }, [scheduleList, selectedDayIndex]);

  // Group schedules by dateGroup (e.g. Daily Runs, Sat 28 Feb)
  const groupedDays = useMemo(() => {
    const set = new Set();
    filteredScheduleList.forEach((s) => {
      set.add(s.dateGroup || 'Daily Runs');
    });
    return Array.from(set);
  }, [filteredScheduleList]);

  if (error) {
    return (
      <ErrorState
        title="Schedules could not be loaded"
        description={error}
        onRetry={fetchScheduleData}
      />
    );
  }

  return (
    <div className="eod-section">
      {/* ── Section Header Bar ── */}
      <div className="eod-section-bar">
        <div>
          <p className="eod-section-title">SCHEDULED RUNS</p>
          <span className="eod-section-subtitle">
            Manage automated End-of-Day batch execution schedules across environments
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="eod-add-btn"
            onClick={fetchScheduleData}
            style={{
              background: 'transparent',
              color: 'var(--c-primary, #005a36)',
              border: '1px solid var(--c-primary, #005a36)',
            }}
          >
            <RefreshCw size={11} /> Refresh
          </button>
          {canCreate && (
            <button
              type="button"
              className="eod-add-btn primary-green"
              onClick={() => handleOpenAdd(new Date())}
            >
              <Calendar size={13} /> Add Schedule
            </button>
          )}
        </div>
      </div>

      {/* ── Top Day Filter Bar (Sunday, Monday, etc. at Top of New Schedule) ── */}
      <div className="eod-day-nav-bar" role="tablist" aria-label="Filter schedules by day">
        <button
          type="button"
          role="tab"
          aria-selected={selectedDayIndex === null}
          className={`eod-day-nav-btn ${selectedDayIndex === null ? 'active' : ''}`}
          onClick={() => setSelectedDayIndex(null)}
        >
          <span>All Days</span>
          <span className="eod-day-nav-count">{scheduleList.length}</span>
        </button>

        {DAYS_OF_WEEK.map((d) => {
          const count = scheduleList.filter((s) => isScheduleOnDay(s, d.dayIndex)).length;
          const isSelected = selectedDayIndex === d.dayIndex;
          const isToday = todayDayIndex === d.dayIndex;

          return (
            <button
              key={d.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`eod-day-nav-btn ${isSelected ? 'active' : ''}`}
              onClick={() => setSelectedDayIndex(isSelected ? null : d.dayIndex)}
            >
              <span>{d.name}</span>
              {isToday && <span className="eod-day-today-indicator">TODAY</span>}
              <span className="eod-day-nav-count">{count}</span>
            </button>
          );
        })}
      </div>

      {/* ── Active Day Filter Banner (from Orchestrator) ── */}
      {selectedDayIndex !== null && (
        <div className="eod-day-filter-banner">
          <div className="eod-day-filter-banner-text">
            <Calendar size={14} />
            <span>
              Showing all runs scheduled for <b>{DAYS_OF_WEEK[selectedDayIndex].name}</b> (
              {scopeCounts.all} {scopeCounts.all === 1 ? 'total run' : 'total runs'})
            </span>
          </div>
          <button
            type="button"
            className="eod-day-filter-reset-btn"
            onClick={() => setSelectedDayIndex(null)}
          >
            Show all days
          </button>
        </div>
      )}

      {/* ── Filter Controls Row: Scope Tabs (All / Entire Batch / Specific Job) ── */}
      <div className="eod-sch-controls-row">
        <div className="eod-scope-filter-bar" role="tablist" aria-label="Filter schedules by scope">
          <button
            type="button"
            role="tab"
            aria-selected={currentScope === 'all'}
            className={`eod-scope-filter-btn ${currentScope === 'all' ? 'active' : ''}`}
            onClick={() => setCurrentScope('all')}
          >
            All schedules ({scopeCounts.all})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentScope === 'batch'}
            className={`eod-scope-filter-btn ${currentScope === 'batch' ? 'active' : ''}`}
            onClick={() => setCurrentScope('batch')}
          >
            <Layers size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
            Entire batch runs ({scopeCounts.batch})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentScope === 'target'}
            className={`eod-scope-filter-btn ${currentScope === 'target' ? 'active' : ''}`}
            onClick={() => setCurrentScope('target')}
          >
            <Target size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
            Specific job runs ({scopeCounts.target})
          </button>
        </div>
      </div>

      {/* ── Schedules List Matching Image 2 & Orchestrator ── */}
      {!isLoading && scheduleList.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No records found"
          description="No automated End-of-Day batch execution schedules available."
          action={
            canCreate && (
              <button
                type="button"
                className="eod-add-btn primary-green"
                onClick={() => handleOpenAdd(new Date())}
              >
                <Calendar size={13} /> Add Schedule
              </button>
            )
          }
        />
      ) : (
        <div className="eod-schedules-container">
          {isLoading && scheduleList.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="eod-schedule-card">
                <div
                  className="eod-schedule-header"
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Skeleton height={16} width={16} />
                    <Skeleton height={20} width={120} />
                  </div>
                  <Skeleton height={24} width={80} style={{ borderRadius: '12px' }} />
                </div>
                <div
                  className="eod-timeline-list"
                  style={{
                    padding: '0 20px 20px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                  }}
                >
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div
                      key={j}
                      className="eod-timeline-item"
                      style={{ display: 'flex', gap: '20px' }}
                    >
                      <div
                        className="eod-timeline-time-col"
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          width: '80px',
                        }}
                      >
                        <Skeleton height={18} width={60} />
                        <Skeleton height={12} width={40} />
                      </div>
                      <div
                        className="eod-timeline-content"
                        style={{
                          flex: 1,
                          background: 'var(--surface-primary)',
                          border: '1px solid var(--border-secondary)',
                          borderRadius: '8px',
                          padding: '12px',
                          display: 'flex',
                          gap: '16px',
                          alignItems: 'center',
                        }}
                      >
                        <Skeleton height={40} width={4} style={{ borderRadius: '2px' }} />
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            flex: 1,
                          }}
                        >
                          <Skeleton height={16} width="40%" />
                          <Skeleton height={14} width="80%" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : groupedDays.length === 0 ? (
            <div className="eod-schedule-card">
              <div className="eod-schedule-empty">
                <Clock size={18} className="eod-empty-clock" />
                <span>
                  No schedules found for{' '}
                  {selectedDayIndex !== null
                    ? DAYS_OF_WEEK[selectedDayIndex].name
                    : 'this selection'}
                  .
                </span>
                <button
                  type="button"
                  className="eod-week-clear-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => setSelectedDayIndex(null)}
                >
                  Show all schedules
                </button>
              </div>
            </div>
          ) : (
            groupedDays.map((day) => {
              const daySchedules = filteredScheduleList.filter(
                (s) => (s.dateGroup || 'Daily Runs') === day
              );
              return (
                <div key={day} className="eod-schedule-card">
                  <div className="eod-schedule-header">
                    <div className="eod-schedule-header-title">
                      <Calendar size={14} className="eod-cal-icon" />
                      <span>{day}</span>
                    </div>
                    <span className="eod-schedule-count-pill">
                      {daySchedules.length} scheduled
                    </span>
                  </div>

                  {daySchedules.length === 0 ? (
                    <div className="eod-schedule-empty">
                      <Clock size={18} className="eod-empty-clock" />
                      <span>No scheduled runs for {day}.</span>
                      {canCreate && (
                        <button
                          type="button"
                          className="eod-empty-add-btn"
                          onClick={() => handleOpenAdd(new Date())}
                        >
                          <Calendar size={11} /> Add Schedule
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="sc-grid" role="list">
                      <div className="sc-cols" aria-hidden="true">
                        <span className="sc-col-on">On</span>
                        <span className="sc-col-name">Name</span>
                        <span className="sc-col-order">Order</span>
                        <span className="sc-col-freq">Frequency</span>
                        <span className="sc-col-next">Next start</span>
                        <span className="sc-col-result">Last result</span>
                        <span className="sc-col-actions">Actions</span>
                      </div>
                      {daySchedules.map((sch) => {
                        const env = getEnv(sch.envId);
                        const envBadge = toShortEnvName(
                          env?.code ||
                          env?.name ||
                          sch.environmentCode ||
                          sch.environmentName ||
                          sch.envId ||
                          'DEV'
                        );
                        const envColor = env?.color || '#005A36';
                        const nextRun = computeNextRun(sch);
                        const isSwitchOn = sch.isActive !== false;
                        const nextStartStr = formatNextStart(sch, nextRun, isSwitchOn);

                        return (
                          <article
                            key={sch.id}
                            className={`sc-card ${!isSwitchOn ? 'sched-off' : ''}`}
                            role="listitem"
                          >
                            {/* Col 1: Switch Toggle (Orchestrator) */}
                            <div className="sc-cell-on">
                              <label
                                className="switch"
                                title={isSwitchOn ? 'On: click to turn off' : 'Off: click to turn on'}
                                htmlFor={`sch-toggle-${sch.id}`}
                              >
                                <input
                                  id={`sch-toggle-${sch.id}`}
                                  type="checkbox"
                                  role="switch"
                                  checked={isSwitchOn}
                                  onChange={(e) => handleToggleSchedule(sch.id, e.target.checked)}
                                  aria-label={`${sch.name || sch.time} is ${isSwitchOn ? 'on' : 'off'}`}
                                />
                                <span />
                              </label>
                            </div>

                            {/* Col 2: Name */}
                            <div className="sc-name-col">
                              <div className="sc-name-row">
                                <span className="sc-name-text">
                                  {getScheduleDisplayName(sch)}
                                </span>
                              </div>
                              <div className="sc-name-sub">
                                {sch.runScope === 'job' || sch.targetJob ? (
                                  <span className="sc-scope-badge scope-target">
                                    <Target size={10} /> Specific Job
                                  </span>
                                ) : (
                                  <span className="sc-scope-badge scope-batch">
                                    <Layers size={10} /> Entire Batch
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Col 3: Order / Route (Orchestrator) */}
                            <div className="sc-order-col">
                              <span className="route">
                                <span
                                  className="env-pill"
                                  style={{
                                    color: envColor,
                                    borderColor: envColor,
                                    background: `${envColor}18`,
                                  }}
                                >
                                  {envBadge}
                                </span>
                              </span>
                            </div>

                            {/* Col 4: Frequency (Cadence) */}
                            <div className="sc-freq-col">
                              <span
                                className="sc-freq-pill"
                                title={`Frequency: ${formatFrequency(sch)}`}
                              >
                                <Repeat size={11} className="sc-freq-icon" />
                                <span>{formatFrequency(sch)}</span>
                              </span>
                            </div>

                            {/* Col 5: Next start (with live countdown subtext) */}
                            <div
                              className="sc-next-start-col"
                              title={
                                isSwitchOn
                                  ? `${nextStartStr} (Starts in: ${countdown(nextRun)})`
                                  : 'Off'
                              }
                            >
                              <span className="sc-fact-text">
                                {isSwitchOn ? nextStartStr : 'Off'}
                              </span>
                              {isSwitchOn && (
                                <span
                                  className="sc-countdown-sub"
                                  title={`Starts in: ${countdown(nextRun)}`}
                                >
                                  in {countdown(nextRun)}
                                </span>
                              )}
                            </div>

                            {/* Col 6: Last result (Orchestrator) */}
                            <div
                              className="sc-last-result-col"
                              title={sch.lastRunAt ? `Last run: ${fmtDateTime(sch.lastRunAt)}` : ''}
                            >
                              <span className="sc-fact-text">
                                {sch.lastStatus
                                  ? `${sch.lastStatus}${sch.lastRunAt ? ` · ${agoText(sch.lastRunAt)}` : ''}`
                                  : 'Never started'}
                              </span>
                            </div>

                            {/* Col 7: Actions: Run now + Edit + Delete (Orchestrator) */}
                            <div className="sched-actions">
                              <button
                                type="button"
                                className="btn sm btn-run-now"
                                onClick={() => handleRunNow(sch)}
                                disabled={runningIds.has(sch.id)}
                                title="Run it now in Scheduler"
                              >
                                {runningIds.has(sch.id) ? (
                                  <Loader2 size={10} className="animate-spin" />
                                ) : (
                                  <Play size={10} />
                                )}
                                <span className="run-now-text">
                                  {runningIds.has(sch.id) ? 'Starting…' : 'Run now'}
                                </span>
                              </button>
                              {canEdit && (
                                <button
                                  type="button"
                                  className="btn sm btn-edit-icon"
                                  onClick={(e) => handleOpenEdit(sch, e)}
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
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteConfirmSchedule(sch);
                                  }}
                                  title="Delete schedule"
                                  aria-label="Delete schedule"
                                >
                                  <Trash size={12} />
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Add / Edit Schedule Modal Overlay (Circular picker matching Image 1) */}
      {modalOpen && editingSchedule && (
        <ScheduleNewModal
          isOpen={modalOpen}
          schedule={editingSchedule}
          environments={environments}
          onClose={() => setModalOpen(false)}
          onSave={handleSaveSchedule}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmSchedule && (
        <AdminModal
          isOpen={Boolean(deleteConfirmSchedule)}
          onClose={() => setDeleteConfirmSchedule(null)}
          title="Delete Schedule"
          size="sm"
        >
          <div className="eod-delete-modal-body">
            <AlertTriangle size={24} className="eod-danger-icon" />
            <p>
              Are you sure you want to delete the schedule for{' '}
              <strong>
                {getEnv(deleteConfirmSchedule.envId)?.name ||
                  deleteConfirmSchedule.environmentName ||
                  deleteConfirmSchedule.envId}
              </strong>{' '}
              at <strong>{deleteConfirmSchedule.time}</strong>?
            </p>
          </div>
          <div className="eod-modal-footer">
            <button
              type="button"
              className="eod-modal-btn cancel"
              onClick={() => setDeleteConfirmSchedule(null)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="eod-modal-btn danger"
              onClick={() =>
                handleDeleteSchedule(
                  deleteConfirmSchedule.id,
                  deleteConfirmSchedule.scheduleGroupId
                )
              }
              disabled={isSaving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
