import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
  Calendar as CalendarIcon,
  CalendarDays,
  CalendarRange,
  Repeat,
  Server,
  Check,
  Search,
  X,
  Target,
  FileCode,
  Folder,
  FolderTree,
  Loader2,
} from 'lucide-react';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useToast } from '@hooks/useToast';
import { formToCronList } from '@utils/cronUtils';
import { toShortEnvName } from '@services/eodService';
import { eodSchedulerService } from '@services/eodSchedulerService';
import { saveScheduleDraft, clearScheduleDraft } from '../scheduler/schedulerModel';

const DAYS_OF_WEEK = [
  { label: 'Sun', full: 'Sunday', idx: 0 },
  { label: 'Mon', full: 'Monday', idx: 1 },
  { label: 'Tue', full: 'Tuesday', idx: 2 },
  { label: 'Wed', full: 'Wednesday', idx: 3 },
  { label: 'Thu', full: 'Thursday', idx: 4 },
  { label: 'Fri', full: 'Friday', idx: 5 },
  { label: 'Sat', full: 'Saturday', idx: 6 },
];

const DEFAULT_JOBS = [
  { name: 'mx_eod_init', level: 1, group: 'Init', description: 'Initialize environment' },
  { name: 'mx_market_data_load', level: 2, group: 'Market', description: 'Load curves and fixing rates' },
  { name: 'mx_cashflow_generation', level: 3, group: 'Valuation', description: 'Generate expected cashflows' },
  { name: 'mx_reval_batch', level: 4, group: 'Valuation', description: 'Portfolio mark-to-market revaluation' },
  { name: 'mx_var_monte_carlo', level: 5, group: 'Risk', description: 'Value-at-Risk computation' },
  { name: 'mx_accounting_posting', level: 6, group: 'Finance', description: 'General ledger postings' },
  { name: 'mx_report_archive', level: 7, group: 'Archive', description: 'Consolidate and archive output reports' },
];

function extractWorkflowsFromData(wfData) {
  if (!wfData?.folders || !Array.isArray(wfData.folders)) return [];
  return wfData.folders
    .filter((f) => Boolean(f?.folder))
    .map((f) => ({
      name: f.folder,
      jobsCount: (f.jobs || []).length,
    }));
}

function extractJobsFromWorkflow(wfData) {
  if (!wfData?.folders) return [];
  const allJobs = [];
  const seen = new Set();
  wfData.folders.forEach((f) => {
    (f.jobs || []).forEach((j) => {
      if (j?.name && !seen.has(j.name)) {
        seen.add(j.name);
        allJobs.push({
          name: j.name,
          level: j.level || 1,
          group: f.folder || 'Workflow',
          folder: f.folder || 'Workflow',
          description: j.command ? `Command: ${j.command.slice(0, 40)}` : 'Workflow job',
        });
      }
    });
  });
  return allJobs;
}

/**
 * Interactive Calendar Date Picker (Matching Image 1 Reference)
 */
function InteractiveCalendarPicker({ selectedDate, onSelectDate }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  // Single letter headers matching Image 1: S M T W T F S
  const singleLetterDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({ date: d, isCurrentMonth: false, dayNum: daysInPrevMonth - i });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, dayNum: i });
    }

    // Next month filler days (to make 42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, dayNum: i });
    }

    return days;
  }, [year, month]);

  const today = new Date();
  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  return (
    <div className="eod-ref-calendar-picker">
      <div className="eod-ref-cal-nav">
        <button
          type="button"
          className="eod-ref-cal-arrow-btn"
          onClick={prevMonth}
          title="Previous month"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="eod-ref-cal-title">
          {monthNames[month]} {year}
        </span>
        <button
          type="button"
          className="eod-ref-cal-arrow-btn"
          onClick={nextMonth}
          title="Next month"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="eod-ref-cal-weekdays">
        {singleLetterDays.map((letter, idx) => (
          <span key={`${letter}-${idx}`} className="eod-ref-cal-weekday">
            {letter}
          </span>
        ))}
      </div>

      <div className="eod-ref-cal-grid">
        {calendarDays.map((item, idx) => {
          const isSelected = isSameDay(item.date, selectedDate);
          const isTodayDate = isSameDay(item.date, today);

          return (
            <button
              key={idx}
              type="button"
              className={`eod-ref-cal-day-cell ${
                !item.isCurrentMonth ? 'is-outside' : ''
              } ${isSelected ? 'is-selected' : ''} ${isTodayDate ? 'is-today' : ''}`}
              onClick={() => onSelectDate(item.date)}
              title={item.date.toDateString()}
            >
              {item.dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Modern Custom Dropdown (flush seamless popup, zero gap)
 * Supports optional search filter (e.g. for Target Job) while keeping clean list for Env/Recurrence
 */
function CustomDropdown({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  error,
  searchable = false,
  searchPlaceholder = 'Search...',
  allowClear = false,
  onClear,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedOption = useMemo(
    () =>
      options.find(
        (opt) =>
          opt.value === value ||
          String(opt.value) === String(value) ||
          (typeof opt.value === 'string' &&
            typeof value === 'string' &&
            opt.value.toLowerCase() === value.toLowerCase())
      ),
    [options, value]
  );

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('pointerdown', handleOutsideClick);
      if (searchable) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 30);
      }
    } else {
      setSearchQuery('');
    }
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const matchLabel = opt.label && String(opt.label).toLowerCase().includes(q);
      const matchValue = opt.value && String(opt.value).toLowerCase().includes(q);
      const matchSubtext = opt.subtext && String(opt.subtext).toLowerCase().includes(q);
      const matchKeywords = opt.searchKeywords && String(opt.searchKeywords).toLowerCase().includes(q);
      return Boolean(matchLabel || matchValue || matchSubtext || matchKeywords);
    });
  }, [options, searchQuery, searchable]);

  return (
    <div className="eod-custom-dropdown-wrap" ref={containerRef}>
      <button
        id={id}
        type="button"
        className={`eod-custom-dropdown-trigger ${error ? 'error' : ''} ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="eod-custom-dropdown-trigger-content">
          {selectedOption?.icon && (
            <span
              className="eod-custom-dropdown-trigger-icon"
              style={selectedOption.color ? { color: selectedOption.color } : {}}
            >
              {selectedOption.icon}
            </span>
          )}
          <span className="eod-custom-dropdown-trigger-label">
            {selectedOption ? selectedOption.label : <span className="placeholder">{placeholder}</span>}
          </span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {allowClear && selectedOption && (
            <span
              role="button"
              tabIndex={0}
              className="eod-custom-dropdown-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (onClear) onClear();
                else onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  if (onClear) onClear();
                  else onChange('');
                }
              }}
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`eod-custom-dropdown-arrow ${isOpen ? 'rotated' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="eod-custom-dropdown-menu" role="listbox">
          {searchable && (
            <div className="eod-custom-dropdown-search">
              <Search size={12} className="eod-custom-dropdown-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="eod-custom-dropdown-search-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
              />
              {searchQuery && (
                <span
                  role="button"
                  tabIndex={0}
                  className="eod-custom-dropdown-search-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      setSearchQuery('');
                    }
                  }}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </span>
              )}
            </div>
          )}

          <div className="eod-custom-dropdown-list">
            {filteredOptions.length === 0 ? (
              <div className="eod-custom-dropdown-empty">
                {searchable && searchQuery.trim() ? (
                  <button
                    type="button"
                    className="eod-custom-dropdown-item"
                    style={{ textAlign: 'left', width: '100%' }}
                    onClick={() => {
                      onChange(searchQuery.trim());
                      setIsOpen(false);
                    }}
                  >
                    <span className="eod-custom-dropdown-item-left">
                      <span
                        className="eod-custom-dropdown-item-icon"
                        style={{ color: '#2563eb', background: 'rgba(37, 99, 235, 0.1)' }}
                      >
                        <Target size={12} />
                      </span>
                      <span className="eod-custom-dropdown-item-text">
                        <span className="title">Select custom job &quot;{searchQuery.trim()}&quot;</span>
                      </span>
                    </span>
                  </button>
                ) : searchable ? (
                  'No matching target jobs found'
                ) : (
                  'No options available'
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedOption?.value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`eod-custom-dropdown-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                  >
                    <span className="eod-custom-dropdown-item-left">
                      {opt.icon && (
                        <span
                          className="eod-custom-dropdown-item-icon"
                          style={
                            !isSelected && opt.color
                              ? { color: opt.color, background: `${opt.color}15` }
                              : {}
                          }
                        >
                          {opt.icon}
                        </span>
                      )}
                      <span className="eod-custom-dropdown-item-text">
                        <span className="title">{opt.label}</span>
                        {opt.subtext && <span className="subtext">{opt.subtext}</span>}
                      </span>
                    </span>
                    {isSelected && <Check size={13} className="eod-custom-dropdown-check" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Custom Searchable Target Job Dropdown (Matching unified dropdown menu design)
 */
function TargetJobPicker({ id = 'eod-modal-target-job-select', value, onChange, error, availableJobs = [] }) {
  const targetJobOptions = useMemo(() => {
    const base = availableJobs && availableJobs.length > 0 ? availableJobs : DEFAULT_JOBS;
    const list = [...base];
    if (value && !list.some((j) => j.name === value)) {
      list.unshift({
        name: value,
        level: 1,
        group: 'Target',
        description: 'Selected target job',
      });
    }
    return list.map((j) => ({
      value: j.name,
      label: j.name,
      subtext: j.description ? `${j.group ? `${j.group} · ` : ''}${j.description}` : `Level ${j.level || 1} · ${j.group || 'Job'}`,
      icon: <Target size={12} />,
      color: '#2563eb',
      searchKeywords: `${j.group || ''} ${j.description || ''} ${j.name}`,
    }));
  }, [availableJobs, value]);

  return (
    <CustomDropdown
      id={id}
      value={value}
      onChange={onChange}
      options={targetJobOptions}
      placeholder="Select target job..."
      searchable
      searchPlaceholder="Search target jobs..."
      allowClear
      onClear={() => onChange('')}
      error={error}
    />
  );
}

/**
 * Main ScheduleNewModal Component
 */
export function ScheduleNewModal({
  isOpen,
  schedule,
  environments,
  selectedEnv,
  onClose,
  onSave,
  onNavigateToTargets,
}) {
  const toast = useToast();
  const initialDate = schedule?.selectedDate ? new Date(schedule.selectedDate) : new Date();

  const activeEnvCode =
    selectedEnv ||
    schedule?.environmentCode ||
    schedule?.environmentName ||
    null;

  const filteredEnvironments = useMemo(() => {
    if (activeEnvCode && environments.length > 0) {
      const match = environments.find(
        (e) =>
          (e.code && e.code.toUpperCase() === activeEnvCode.toUpperCase()) ||
          (e.name && e.name.toUpperCase() === activeEnvCode.toUpperCase()) ||
          String(e.id) === String(activeEnvCode)
      );
      if (match) return [match];
    }
    return environments;
  }, [environments, activeEnvCode]);

  const defaultEnvId =
    filteredEnvironments[0]?.id ??
    filteredEnvironments[0]?.code ??
    activeEnvCode ??
    environments[0]?.id ??
    '';

  const [form, setForm] = useState({
    id: schedule?.id || '',
    groupId: schedule?.scheduleGroupId || null,
    name: schedule?.name || '',
    runScope: schedule?.runScope || (schedule?.targetJob ? 'job' : 'batch'),
    targetJob: schedule?.targetJob || '',
    xmlFileId: schedule?.xmlFileId || (schedule?.workflowFileId ? String(schedule.workflowFileId) : ''),
    xmlFile: schedule?.xmlFile || schedule?.workflowFile || schedule?.uploadedFileName || '',
    workflow: schedule?.workflow || schedule?.folder || 'ALL',
    workflowFileId: schedule?.workflowFileId ? String(schedule.workflowFileId) : '',
    workflowFile: schedule?.workflowFile || schedule?.uploadedFileName || '',
    envId: schedule?.envId || defaultEnvId,
    maxParallel: schedule?.maxParallel !== undefined ? schedule.maxParallel : 4,
    simulateAll: !!schedule?.simulateAll,
    selectedDate: schedule?.selectedDate ? new Date(schedule.selectedDate) : new Date(),
    selectedMonth: schedule?.selectedMonth || initialDate.getMonth() + 1,
    selectedDayOfMonth:
      schedule?.selectedDayOfMonth !== undefined ? schedule.selectedDayOfMonth : initialDate.getDate() || 1,
    selectedDays: Array.isArray(schedule?.selectedDays)
      ? schedule.selectedDays
      : schedule?.dayOfWeek
      ? [schedule.dayOfWeek]
      : ['Monday'],
    selectedQuarters: Array.isArray(schedule?.selectedQuarters)
      ? schedule.selectedQuarters
      : [1, 4, 7, 10],
    quarterPosition: schedule?.quarterPosition || 'first',
    time: schedule?.time || '22:00',
    recurrence: schedule?.recurrence || 'Daily',
    isActive: schedule?.isActive !== undefined ? schedule.isActive : true,
  });

  const [availableXmlFiles, setAvailableXmlFiles] = useState([]);
  const [availableWorkflows, setAvailableWorkflows] = useState([]);
  const [workflowJobs, setWorkflowJobs] = useState([]);
  const [isLoadingXml, setIsLoadingXml] = useState(false);
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(false);
  const activeWfCacheRef = useRef(null);

  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Resolve the exact environment partition code according to the active environment
    const targetEnv = activeEnvCode || form.envId;
    if (!targetEnv) return;

    const envObj = environments.find(
      (e) =>
        e.id === targetEnv ||
        String(e.id) === String(targetEnv) ||
        (e.code && e.code.toUpperCase() === String(targetEnv).toUpperCase()) ||
        (e.name && e.name.toUpperCase() === String(targetEnv).toUpperCase()) ||
        (e.code && String(targetEnv).toUpperCase().includes(e.code.toUpperCase()))
    );
    const rawEnv = envObj?.code || envObj?.name || targetEnv;
    const cleanToken = String(rawEnv).trim().split(/[\s—–-]+/)[0];
    const envCode = toShortEnvName(cleanToken || rawEnv);

    let isMounted = true;
    setIsLoadingXml(true);

    eodSchedulerService
      .getWorkflow(envCode)
      .then((wf) => {
        if (!isMounted) return;
        activeWfCacheRef.current = wf;

        // XML files uploaded for this environment
        const allFiles = wf?.workflows || [];
        let displayFiles = allFiles;
        if (displayFiles.length === 0 && wf?.meta?.id) {
          displayFiles = [
            {
              id: wf.meta.id,
              filename: wf.meta.filename,
              active: true,
              uploaded_at: wf.meta.uploaded_at,
            },
          ];
        }
        setAvailableXmlFiles(displayFiles);

        // Auto-select active XML file if none currently selected or if selected XML file is not in list
        let currentXml = displayFiles.find(
          (f) =>
            String(f.id) === String(form.xmlFileId || form.workflowFileId) ||
            f.filename === (form.xmlFile || form.workflowFile)
        );
        if (!currentXml && displayFiles.length > 0) {
          currentXml = displayFiles.find((f) => f.active || f.is_active) || displayFiles[0];
        }

        if (currentXml) {
          setForm((prev) => ({
            ...prev,
            xmlFileId: String(currentXml.id),
            xmlFile: currentXml.filename,
            workflowFileId: String(currentXml.id),
            workflowFile: currentXml.filename,
          }));

          // If currentXml is active and parsed in wf:
          if (currentXml.active || String(currentXml.id) === String(wf?.meta?.id) || !wf?.meta?.id) {
            setAvailableWorkflows(extractWorkflowsFromData(wf));
            setWorkflowJobs(extractJobsFromWorkflow(wf));
          } else {
            // Load specific XML file details
            setIsLoadingWorkflows(true);
            eodSchedulerService
              .getWorkflowItem(envCode, currentXml.id)
              .then((itemWf) => {
                if (isMounted) {
                  setAvailableWorkflows(extractWorkflowsFromData(itemWf));
                  setWorkflowJobs(extractJobsFromWorkflow(itemWf));
                }
              })
              .catch(() => {
                if (isMounted) {
                  setAvailableWorkflows(extractWorkflowsFromData(wf));
                  setWorkflowJobs(extractJobsFromWorkflow(wf));
                }
              })
              .finally(() => {
                if (isMounted) setIsLoadingWorkflows(false);
              });
          }
        } else {
          setAvailableWorkflows([]);
          setWorkflowJobs([]);
        }
      })
      .catch((err) => {
        console.warn('Failed to load active XML workflows for environment:', err);
        if (isMounted) {
          setAvailableXmlFiles([]);
          setAvailableWorkflows([]);
          setWorkflowJobs([]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoadingXml(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeEnvCode, form.envId, environments]);

  useEffect(() => {
    if (isOpen) {
      setShowCalendar(false);
    }
    if (isOpen && schedule) {
      const initDate = schedule.selectedDate ? new Date(schedule.selectedDate) : new Date();
      let initRecurrence = schedule.recurrence || 'Daily';
      if (
        initRecurrence === 'Custom / One-time' ||
        initRecurrence === 'Annually' ||
        initRecurrence.startsWith('Specific Date')
      ) {
        initRecurrence = 'Specific Date & Time';
      }
      const matchedEnvId =
        filteredEnvironments.find(
          (e) =>
            String(e.id) === String(schedule.envId) ||
            (e.code && e.code.toUpperCase() === String(schedule.envId).toUpperCase())
        )?.id || filteredEnvironments[0]?.id || schedule.envId || defaultEnvId;

      setForm({
        id: schedule.id || '',
        groupId: schedule.scheduleGroupId || null,
        name: schedule.name || '',
        runScope: schedule.runScope || (schedule.targetJob ? 'job' : 'batch'),
        targetJob: schedule.targetJob || '',
        xmlFileId: schedule.xmlFileId || (schedule.workflowFileId ? String(schedule.workflowFileId) : ''),
        xmlFile: schedule.xmlFile || schedule.workflowFile || schedule.uploadedFileName || '',
        workflow: schedule.workflow || schedule.folder || 'ALL',
        workflowFileId: schedule.workflowFileId ? String(schedule.workflowFileId) : '',
        workflowFile: schedule.workflowFile || schedule.uploadedFileName || '',
        envId: matchedEnvId,
        maxParallel: schedule.maxParallel !== undefined ? schedule.maxParallel : 4,
        simulateAll: !!schedule.simulateAll,
        selectedDate: schedule.selectedDate ? new Date(schedule.selectedDate) : new Date(),
        selectedMonth: schedule.selectedMonth || initDate.getMonth() + 1,
        selectedDayOfMonth:
          schedule.selectedDayOfMonth !== undefined ? schedule.selectedDayOfMonth : initDate.getDate() || 1,
        selectedDays: Array.isArray(schedule.selectedDays)
          ? schedule.selectedDays
          : schedule.dayOfWeek
          ? [schedule.dayOfWeek]
          : ['Monday'],
        selectedQuarters: Array.isArray(schedule.selectedQuarters)
          ? schedule.selectedQuarters
          : [1, 4, 7, 10],
        quarterPosition: schedule.quarterPosition || 'first',
        time: schedule.time || '22:00',
        recurrence: initRecurrence,
        isActive: schedule.isActive !== undefined ? schedule.isActive : true,
      });
      setErrors({});
    } else if (isOpen && !schedule) {
      setForm({
        id: '',
        groupId: null,
        name: '',
        runScope: 'batch',
        targetJob: '',
        xmlFileId: '',
        xmlFile: '',
        workflow: 'ALL',
        workflowFileId: '',
        workflowFile: '',
        envId: defaultEnvId,
        maxParallel: 4,
        simulateAll: false,
        selectedDate: new Date(),
        selectedMonth: new Date().getMonth() + 1,
        selectedDayOfMonth: new Date().getDate() || 1,
        selectedDays: ['Monday'],
        selectedQuarters: [1, 4, 7, 10],
        quarterPosition: 'first',
        time: '22:00',
        recurrence: 'Daily',
        isActive: true,
      });
      setErrors({});
    }
  }, [isOpen, schedule, environments]);

  const handleXmlFileChange = (fileId) => {
    const chosen = availableXmlFiles.find((f) => String(f.id) === String(fileId));
    setForm((prev) => ({
      ...prev,
      xmlFileId: String(fileId),
      xmlFile: chosen?.filename || '',
      workflowFileId: String(fileId),
      workflowFile: chosen?.filename || '',
      workflow: 'ALL',
      targetJob: '',
    }));
    if (errors.xmlFile) setErrors((prev) => ({ ...prev, xmlFile: null }));
    if (errors.workflow) setErrors((prev) => ({ ...prev, workflow: null }));
    if (errors.targetJob) setErrors((prev) => ({ ...prev, targetJob: null }));

    if (!chosen) {
      setAvailableWorkflows([]);
      setWorkflowJobs([]);
      return;
    }

    const targetEnv = activeEnvCode || form.envId;
    const envObj = environments.find(
      (e) =>
        e.id === targetEnv ||
        String(e.id) === String(targetEnv) ||
        (e.code && e.code.toUpperCase() === String(targetEnv).toUpperCase()) ||
        (e.name && e.name.toUpperCase() === String(targetEnv).toUpperCase()) ||
        (e.code && String(targetEnv).toUpperCase().includes(e.code.toUpperCase()))
    );
    const rawEnv = envObj?.code || envObj?.name || targetEnv;
    const cleanToken = String(rawEnv).trim().split(/[\s—–-]+/)[0];
    const envCode = toShortEnvName(cleanToken || rawEnv);

    if (chosen.active || String(chosen.id) === String(activeWfCacheRef.current?.meta?.id)) {
      setAvailableWorkflows(extractWorkflowsFromData(activeWfCacheRef.current));
      setWorkflowJobs(extractJobsFromWorkflow(activeWfCacheRef.current));
    } else {
      setIsLoadingWorkflows(true);
      eodSchedulerService
        .getWorkflowItem(envCode, chosen.id)
        .then((data) => {
          setAvailableWorkflows(extractWorkflowsFromData(data));
          setWorkflowJobs(extractJobsFromWorkflow(data));
        })
        .catch((err) => {
          console.warn('Could not load workflows and jobs for file:', err);
          setAvailableWorkflows([]);
          setWorkflowJobs([]);
        })
        .finally(() => setIsLoadingWorkflows(false));
    }
  };

  const handleWorkflowChange = (workflowName) => {
    setForm((prev) => ({
      ...prev,
      workflow: workflowName,
      targetJob: '',
    }));
    if (errors.workflow) setErrors((prev) => ({ ...prev, workflow: null }));
    if (errors.targetJob) setErrors((prev) => ({ ...prev, targetJob: null }));
  };

  const isEdit = Boolean(form.id);

  // Auto-suggested name generator without repeating time, recurrence or environment
  const suggestedName = useMemo(() => {
    if (form.runScope === 'job' && form.targetJob) {
      return `Target: ${form.targetJob}`;
    }
    if (form.workflow && form.workflow !== 'ALL') {
      return `${form.workflow} Batch`;
    }
    return 'EOD Batch Run';
  }, [form.runScope, form.targetJob, form.workflow]);

  // Display label for the fixed active environment
  const currentEnvDisplay = useMemo(() => {
    const match =
      filteredEnvironments.find(
        (e) =>
          e.id === form.envId ||
          String(e.id) === String(form.envId) ||
          (e.code && e.code.toUpperCase() === String(form.envId).toUpperCase()) ||
          (e.name && e.name.toUpperCase() === String(form.envId).toUpperCase())
      ) || filteredEnvironments[0];
    if (match) {
      return toShortEnvName(match.code || match.name);
    }
    return activeEnvCode ? toShortEnvName(activeEnvCode) : 'DEV';
  }, [filteredEnvironments, form.envId, activeEnvCode]);

  // Options for XML Files Dropdown (uploaded batch files)
  const xmlFileOptions = useMemo(() => {
    return (availableXmlFiles || []).map((wf) => ({
      value: String(wf.id),
      label: wf.filename || `Batch File ${wf.id}`,
      subtext: wf.active
        ? 'Active batch · Currently loaded'
        : wf.uploaded_at
        ? `Uploaded ${new Date(wf.uploaded_at).toLocaleDateString()}`
        : 'Uploaded XML file',
      icon: <FileCode size={12} />,
      color: wf.active ? '#15803d' : '#64748b',
    }));
  }, [availableXmlFiles]);

  // Options for Workflows Dropdown (present in selected XML file)
  const workflowOptions = useMemo(() => {
    const totalJobs = workflowJobs.length;
    const list = [
      {
        value: 'ALL',
        label: `All Workflows (${totalJobs})`,
        subtext: 'Run all workflows present in this XML file',
        icon: <FolderTree size={12} />,
        color: '#005a36',
      },
    ];
    (availableWorkflows || []).forEach((w) => {
      list.push({
        value: w.name,
        label: `${w.name} (${w.jobsCount})`,
        subtext: `${w.jobsCount} job${w.jobsCount === 1 ? '' : 's'} in this workflow`,
        icon: <Folder size={12} />,
        color: '#0284c7',
      });
    });
    return list;
  }, [availableWorkflows, workflowJobs]);

  // Jobs scoped to the selected workflow
  const scopedTargetJobs = useMemo(() => {
    if (!form.workflow || form.workflow === 'ALL') return workflowJobs;
    return workflowJobs.filter(
      (j) =>
        (j.group && j.group.toUpperCase() === form.workflow.toUpperCase()) ||
        (j.folder && j.folder.toUpperCase() === form.workflow.toUpperCase())
    );
  }, [workflowJobs, form.workflow]);

  // Options for Recurrence Custom Dropdown (clean, matching standard 12px input style)
  const recurrenceOptions = useMemo(
    () => [
      {
        value: 'Daily',
        label: 'Daily',
        icon: <Repeat size={12} />,
      },
      {
        value: 'Weekly',
        label: 'Weekly',
        icon: <CalendarIcon size={12} />,
      },
      {
        value: 'Monthly',
        label: 'Monthly',
        icon: <CalendarRange size={12} />,
      },
      {
        value: 'Specific Date & Time',
        label: 'Specific Date & Time',
        icon: <CalendarDays size={12} />,
      },
    ],
    []
  );

  const toggleDay = (dayFull) => {
    const current = form.selectedDays || [];
    let updated;
    if (current.includes(dayFull)) {
      if (current.length === 1) return;
      updated = current.filter((d) => d !== dayFull);
    } else {
      updated = [...current, dayFull];
    }
    setForm({ ...form, selectedDays: updated });
    if (errors.selectedDays) setErrors({ ...errors, selectedDays: null });
  };

  const validate = () => {
    const errs = {};
    if (!form.envId) errs.envId = 'Environment is required';
    if (availableXmlFiles.length > 0 && !form.xmlFileId) {
      errs.xmlFile = 'Please select an XML file';
    }
    if (form.runScope === 'job' && !form.targetJob) {
      errs.targetJob = 'Please select a target job';
    }
    const par = Number(form.maxParallel);
    if (isNaN(par) || par < 1 || par > 20) {
      errs.maxParallel = 'Must be between 1 and 20';
    }
    if (
      (form.recurrence === 'Specific Date & Time' ||
        form.recurrence === 'Specific Date & Time (Calendar)' ||
        form.recurrence === 'Custom / One-time') &&
      !form.selectedDate
    ) {
      errs.selectedDate = 'Schedule Date is required';
    }
    if (form.recurrence === 'Weekly' && (!form.selectedDays || form.selectedDays.length === 0)) {
      errs.selectedDays = 'At least one day of week is required';
    }
    if (!form.time) errs.time = 'Schedule Time is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      const cronExpressions = formToCronList(form);
      const isJobScope = form.runScope === 'job';
      const cleanTargetJob = isJobScope ? (form.targetJob || '').trim() : '';
      const finalName =
        (form.name || '').trim() ||
        (isJobScope && cleanTargetJob ? `Target: ${cleanTargetJob}` : form.workflow && form.workflow !== 'ALL' ? `${form.workflow} Batch` : 'EOD Batch Run');

      await onSave({
        ...form,
        runScope: isJobScope ? 'job' : 'batch',
        targetJob: cleanTargetJob,
        xmlFile: form.xmlFile,
        xmlFileId: form.xmlFileId,
        workflow: form.workflow,
        folder: form.workflow,
        workflowFile: form.xmlFile || form.workflowFile,
        workflowFileId: form.xmlFileId || form.workflowFileId,
        name: finalName,
        selectedDate: form.selectedDate,
        dayOfWeek: (form.selectedDays || []).join(', '),
        cronExpression: cronExpressions[0],
        cronExpressions,
      });
      clearScheduleDraft();
    } finally {
      setIsSaving(false);
    }
  };

  const formattedSelectedSummary = useMemo(() => {
    const timeStr = form.time || '22:00';
    if (form.recurrence === 'Daily') {
      return `Runs every day at ${timeStr}`;
    }
    if (form.recurrence === 'Weekly') {
      const days =
        form.selectedDays && form.selectedDays.length > 0
          ? form.selectedDays.join(', ')
          : 'selected days';
      return `Runs weekly on ${days} at ${timeStr}`;
    }
    if (form.recurrence === 'Monthly') {
      const dom =
        form.selectedDayOfMonth === 'L'
          ? 'the last day of month'
          : `day ${form.selectedDayOfMonth || 1}`;
      return `Runs monthly on ${dom} at ${timeStr}`;
    }
    if (
      form.recurrence === 'Specific Date & Time' ||
      form.recurrence === 'Specific Date & Time (Calendar)' ||
      form.recurrence === 'Custom / One-time'
    ) {
      if (!form.selectedDate) return `Specific date run at ${timeStr}`;
      const d = new Date(form.selectedDate);
      if (isNaN(d.getTime())) return `Specific date run at ${timeStr}`;
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
      ];
      return `${dayNames[d.getDay()]}, ${monthNames[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} at ${timeStr}`;
    }
    return `Runs at ${timeStr}`;
  }, [form.recurrence, form.selectedDays, form.selectedDayOfMonth, form.selectedDate, form.time]);

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Schedule' : 'Add New Schedule'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="eod-schedule-modal-form">
        <div className="eod-modal-field-group">
          {/* 1. RUN SCOPE (Segmented: Entire Batch vs Specific Job Run) */}
          <div className="eod-modal-field">
            <span className="eod-modal-label">RUN SCOPE</span>
            <div className="eod-segmented-control" role="radiogroup" aria-label="Run Scope">
              <button
                type="button"
                role="radio"
                aria-checked={form.runScope === 'batch'}
                className={`eod-segmented-btn ${form.runScope === 'batch' ? 'active' : ''}`}
                onClick={() => setForm({ ...form, runScope: 'batch' })}
              >
                Entire Batch
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={form.runScope === 'job'}
                className={`eod-segmented-btn ${form.runScope === 'job' ? 'active' : ''}`}
                onClick={() => setForm({ ...form, runScope: 'job' })}
              >
                Specific Job Run
              </button>
            </div>
          </div>

          {/* 2. ENVIRONMENT (Fixed to current active environment) */}
          <div className="eod-modal-field">
            <label className="eod-modal-label">
              ENVIRONMENT <span className="req">*</span>
            </label>
            <div
              className="eod-custom-dropdown-trigger eod-env-fixed"
              style={{
                cursor: 'default',
                backgroundColor: 'var(--bg-muted, #f8fafc)',
                borderColor: 'var(--border-secondary, #e2e8f0)',
                color: 'var(--text-primary, #0f172a)',
                userSelect: 'none',
              }}
              title={`Environment: ${currentEnvDisplay}`}
            >
              <span className="eod-custom-dropdown-trigger-content">
                <span className="eod-custom-dropdown-trigger-icon">
                  <Server size={12} />
                </span>
                <span className="eod-custom-dropdown-trigger-label" style={{ fontWeight: 500 }}>
                  {currentEnvDisplay}
                </span>
              </span>
            </div>
            {errors.envId && <span className="eod-field-error">{errors.envId}</span>}
          </div>

          {/* 3. XML FILE Dropdown (Select uploaded XML file) */}
          <div className="eod-modal-field">
            <label className="eod-modal-label" htmlFor="eod-modal-xml-file-select">
              XML FILE <span className="req">*</span>
            </label>
            {isLoadingXml ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-secondary, #e2e8f0)',
                  fontSize: 12,
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                <Loader2 size={13} className="spin-animation" />
                <span>Loading XML files…</span>
              </div>
            ) : xmlFileOptions.length > 0 ? (
              <CustomDropdown
                id="eod-modal-xml-file-select"
                value={form.xmlFileId}
                options={xmlFileOptions}
                onChange={handleXmlFileChange}
                placeholder="Select uploaded XML file..."
                error={errors.xmlFile}
              />
            ) : (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px dashed var(--border-secondary, #cbd5e1)',
                  background: 'var(--surface-secondary, #f8fafc)',
                  fontSize: 12,
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                No uploaded XML files found for this environment
              </div>
            )}
            {errors.xmlFile && <span className="eod-field-error">{errors.xmlFile}</span>}
          </div>

          {/* 4. WORKFLOW Dropdown (Workflows present in that selected XML file) */}
          <div className="eod-modal-field">
            <label className="eod-modal-label" htmlFor="eod-modal-workflow-select">
              WORKFLOW <span className="req">*</span>
            </label>
            {isLoadingWorkflows ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px solid var(--border-secondary, #e2e8f0)',
                  fontSize: 12,
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                <Loader2 size={13} className="spin-animation" />
                <span>Loading workflows in XML file…</span>
              </div>
            ) : workflowOptions.length > 0 ? (
              <CustomDropdown
                id="eod-modal-workflow-select"
                value={form.workflow}
                options={workflowOptions}
                onChange={handleWorkflowChange}
                placeholder="Select workflow..."
                error={errors.workflow}
              />
            ) : (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: 6,
                  border: '1px dashed var(--border-secondary, #cbd5e1)',
                  background: 'var(--surface-secondary, #f8fafc)',
                  fontSize: 12,
                  color: 'var(--text-muted, #64748b)',
                }}
              >
                {form.xmlFileId ? 'No workflows found in this XML file' : 'Select an XML file first'}
              </div>
            )}
            {errors.workflow && <span className="eod-field-error">{errors.workflow}</span>}
          </div>

          {/* 5. TARGET JOB Dropdown (Shown for Specific Job Run when user selects the file) */}
          {form.runScope === 'job' && (
            <div className="eod-modal-field">
              <label className="eod-modal-label" htmlFor="eod-modal-target-job-select">
                TARGET JOB <span className="req">*</span>
              </label>
              {form.xmlFileId ? (
                <TargetJobPicker
                  id="eod-modal-target-job-select"
                  value={form.targetJob}
                  availableJobs={scopedTargetJobs}
                  onChange={(val) => {
                    setForm({ ...form, targetJob: val });
                    if (errors.targetJob) setErrors({ ...errors, targetJob: null });
                  }}
                  error={errors.targetJob}
                />
              ) : (
                <div
                  style={{
                    padding: '9px 12px',
                    borderRadius: 6,
                    border: '1px dashed var(--border-secondary, #cbd5e1)',
                    background: 'var(--surface-secondary, #f8fafc)',
                    fontSize: 12,
                    color: 'var(--text-muted, #64748b)',
                  }}
                >
                  Select an XML file above to load target jobs
                </div>
              )}
              {errors.targetJob && <span className="eod-field-error">{errors.targetJob}</span>}
            </div>
          )}

          {/* 5. MAX AT ONCE (PARALLELISM) + Simulate dry-run */}
          <div className="eod-modal-field">
            <label className="eod-modal-label" htmlFor="eod-modal-par-input">
              MAX AT ONCE (PARALLELISM)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <input
                id="eod-modal-par-input"
                type="number"
                min={1}
                max={20}
                className="eod-modal-input"
                style={{ width: 120 }}
                value={form.maxParallel}
                onChange={(e) => setForm({ ...form, maxParallel: e.target.value })}
              />
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                }}
                htmlFor="eod-modal-sim-check"
              >
                <input
                  id="eod-modal-sim-check"
                  type="checkbox"
                  checked={form.simulateAll}
                  onChange={(e) => setForm({ ...form, simulateAll: e.target.checked })}
                />
                Simulate all jobs (Dry-run)
              </label>
            </div>
            {errors.maxParallel && <span className="eod-field-error">{errors.maxParallel}</span>}
          </div>

          {/* SCHEDULE NAME */}
          <div className="eod-modal-field">
            <label className="eod-modal-label" htmlFor="eod-modal-name-input">
              SCHEDULE NAME
            </label>
            <input
              id="eod-modal-name-input"
              type="text"
              className="eod-modal-input"
              placeholder={`${suggestedName} (suggested, or type your own)`}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* 5. RECURRENCE Custom Dropdown (matching Image 1) */}
          <div className="eod-modal-field">
            <label className="eod-modal-label" htmlFor="eod-modal-recurrence-select">
              RECURRENCE <span className="req">*</span>
            </label>
            <CustomDropdown
              id="eod-modal-recurrence-select"
              value={form.recurrence}
              options={recurrenceOptions}
              onChange={(val) => {
                setForm({ ...form, recurrence: val });
                setErrors({});
              }}
              placeholder="Select recurrence..."
            />
          </div>

          {/* 5.1 Weekly day selector */}
          {form.recurrence === 'Weekly' && (
            <div className="eod-modal-field">
              <div className="eod-field-header-row">
                <span className="eod-modal-label">
                  DAYS OF WEEK <span className="req">*</span>
                </span>
                <div className="eod-day-quick-presets">
                  <button
                    type="button"
                    className="eod-preset-mini-btn"
                    onClick={() =>
                      setForm({
                        ...form,
                        selectedDays: [
                          'Sunday',
                          'Monday',
                          'Tuesday',
                          'Wednesday',
                          'Thursday',
                          'Friday',
                          'Saturday',
                        ],
                      })
                    }
                  >
                    All Days
                  </button>
                  <button
                    type="button"
                    className="eod-preset-mini-btn"
                    onClick={() =>
                      setForm({
                        ...form,
                        selectedDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                      })
                    }
                  >
                    Mon – Fri
                  </button>
                  <button
                    type="button"
                    className="eod-preset-mini-btn"
                    onClick={() =>
                      setForm({
                        ...form,
                        selectedDays: ['Sunday', 'Saturday'],
                      })
                    }
                  >
                    Weekends
                  </button>
                </div>
              </div>

              <div className="eod-modal-days-grid">
                {DAYS_OF_WEEK.map((day) => {
                  const isSel = (form.selectedDays || []).includes(day.full);
                  return (
                    <button
                      key={day.full}
                      type="button"
                      className={`eod-day-pill-btn ${isSel ? 'selected' : ''}`}
                      onClick={() => toggleDay(day.full)}
                      title={`Click to ${isSel ? 'deselect' : 'select'} ${day.full}`}
                      aria-pressed={isSel}
                    >
                      <span className="day-name-full">{day.full}</span>
                      <span className="day-name-short">{day.label}</span>
                    </button>
                  );
                })}
              </div>
              {errors.selectedDays && <span className="eod-field-error">{errors.selectedDays}</span>}
            </div>
          )}

          {/* 5.2 Monthly day-of-month selector */}
          {form.recurrence === 'Monthly' && (
            <div className="eod-modal-field">
              <div className="eod-field-header-row">
                <label className="eod-modal-label" htmlFor="eod-modal-dom-input">
                  DAY OF MONTH <span className="req">*</span>
                </label>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 12,
                    color: 'var(--brand-primary, #005a36)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.selectedDayOfMonth === 'L'}
                    onChange={(e) => {
                      setForm({ ...form, selectedDayOfMonth: e.target.checked ? 'L' : 1 });
                      if (errors.selectedDayOfMonth) setErrors({ ...errors, selectedDayOfMonth: null });
                    }}
                  />
                  <span>Last Day of Month (L)</span>
                </label>
              </div>
              {form.selectedDayOfMonth === 'L' ? (
                <input
                  type="text"
                  className="eod-modal-input"
                  value="Last Day of Month (L)"
                  disabled
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--brand-primary, #005a36)',
                    fontWeight: 600,
                  }}
                />
              ) : (
                <input
                  id="eod-modal-dom-input"
                  type="number"
                  min={1}
                  max={31}
                  className={`eod-modal-input ${errors.selectedDayOfMonth ? 'error' : ''}`}
                  value={form.selectedDayOfMonth || 1}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setForm({
                      ...form,
                      selectedDayOfMonth: isNaN(val) ? 1 : Math.min(31, Math.max(1, val)),
                    });
                    if (errors.selectedDayOfMonth) setErrors({ ...errors, selectedDayOfMonth: null });
                  }}
                />
              )}
              {errors.selectedDayOfMonth && (
                <span className="eod-field-error">{errors.selectedDayOfMonth}</span>
              )}
            </div>
          )}

          {/* 5.3 Specific Date selector */}
          {(form.recurrence === 'Specific Date & Time' ||
            form.recurrence === 'Specific Date & Time (Calendar)') && (
            <div className="eod-modal-field">
              <label className="eod-modal-label" htmlFor="eod-modal-specific-date-input">
                SCHEDULE DATE <span className="req">*</span>
              </label>
              <div className="eod-modal-input-with-icon">
                <input
                  id="eod-modal-specific-date-input"
                  type="text"
                  readOnly
                  className="eod-modal-input"
                  value={
                    form.selectedDate
                      ? new Date(form.selectedDate).toLocaleDateString(undefined, {
                          weekday: 'short',
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'Select date...'
                  }
                  onClick={() => setShowCalendar(true)}
                  style={{ cursor: 'pointer' }}
                />
                <button
                  type="button"
                  className="eod-input-icon-btn"
                  onClick={() => setShowCalendar(true)}
                  aria-label="Pick date from calendar"
                >
                  <CalendarIcon size={15} />
                </button>
              </div>
              {errors.selectedDate && (
                <span className="eod-field-error">{errors.selectedDate}</span>
              )}
            </div>
          )}

          {/* 6. SCHEDULE TIME */}
          <div className="eod-modal-field">
            <label className="eod-modal-label" htmlFor="eod-modal-time-input">
              SCHEDULE TIME <span className="req">*</span>
            </label>

            <div className="eod-modal-input-with-icon">
              <input
                id="eod-modal-time-input"
                type="time"
                className={`eod-modal-input ${errors.time ? 'error' : ''}`}
                value={form.time}
                onChange={(e) => {
                  setForm({ ...form, time: e.target.value });
                  if (errors.time) setErrors({ ...errors, time: null });
                }}
              />
              <button
                type="button"
                className="eod-input-icon-btn"
                onClick={() => setShowCalendar((prev) => !prev)}
                title={showCalendar ? 'Close calendar' : 'Open calendar date picker'}
                aria-label="Open calendar date picker"
              >
                <CalendarIcon size={15} />
              </button>
            </div>

            {/* Selected Date & Time Live Summary */}
            {formattedSelectedSummary && (
              <div className="eod-cal-selected-summary">
                <Clock size={12} />
                <span>{formattedSelectedSummary}</span>
              </div>
            )}

            {errors.time && <span className="eod-field-error">{errors.time}</span>}
            {errors.selectedDate && <span className="eod-field-error">{errors.selectedDate}</span>}
          </div>
        </div>

        {/* Floating Calendar Overlay Dialog - Opens in front of screen, background stays intact */}
        {showCalendar && (
          <div className="eod-cal-modal-backdrop" role="presentation">
            <button
              type="button"
              className="eod-cal-backdrop-dismiss"
              onClick={() => setShowCalendar(false)}
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
                  onClick={() => setShowCalendar(false)}
                  aria-label="Close calendar"
                >
                  <X size={15} />
                </button>
              </div>

              <InteractiveCalendarPicker
                selectedDate={form.selectedDate}
                onSelectDate={(newDate) => {
                  setForm({
                    ...form,
                    selectedDate: newDate,
                    recurrence: 'Specific Date & Time',
                  });
                  if (errors.selectedDate) setErrors({ ...errors, selectedDate: null });
                }}
              />

              {formattedSelectedSummary && (
                <div className="eod-cal-selected-summary" style={{ marginTop: 12 }}>
                  <Clock size={13} />
                  <span>{formattedSelectedSummary}</span>
                </div>
              )}

              <div className="eod-cal-floating-actions">
                <button
                  type="button"
                  className="eod-cal-floating-done-btn"
                  onClick={() => setShowCalendar(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. MODAL FOOTER */}
        <div className="eod-modal-footer">
          <button
            type="button"
            className="eod-modal-btn cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="eod-modal-btn primary-green"
            disabled={isSaving}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <CalendarIcon size={13} />
            {isSaving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Schedule'}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

export default ScheduleNewModal;
