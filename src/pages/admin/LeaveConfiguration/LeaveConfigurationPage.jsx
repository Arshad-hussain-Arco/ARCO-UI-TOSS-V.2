import { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  Edit2,
  ListChecks,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { Select } from '@components/forms/Select/Select';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Toggle } from '@components/ui/Toggle/Toggle';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useToast } from '@hooks/useToast';
import { leaveService } from '@services/leaveService';
import { Loader } from '@components/feedback/Loader/Loader';
import './LeaveConfigurationPage.css';


/**
 * Format raw date string (e.g. '2026-02-22') into 'MMM DD, YYYY' (e.g. 'Feb 22, 2026').
 */
function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const normalized = value.includes('T') ? value : `${value}T00:00:00`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function toDateInputValue(dateValue) {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeDayOfWeek(dateStr) {
  if (!dateStr) return '';
  const d = parseDateValue(dateStr);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function computeStatus(dateStr) {
  if (!dateStr) return 'Upcoming';
  const date = parseDateValue(dateStr);
  if (!date || Number.isNaN(date.getTime())) return 'Upcoming';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return targetDate.getTime() < today.getTime() ? 'Past' : 'Upcoming';
}

/** Empty combined leave-type-with-policy form, matching the /hr/leave-types-with-policy/ payload. */
function emptyCombinedForm() {
  return {
    code: '',
    name: '',
    description: '',
    category: 'ACTUAL',
    payment_type: 'PAID',
    max_quota_days: '',
    max_days_per_application: '',
    display_order: 0,
    notes: '',
    policy_notes: '',

    gender_restriction: '',
    requires_approval: true,
    is_active: true,

    entitled_days: '',
    min_notice_days: 0,
    max_consecutive: '',
    accrual_type: 'NONE',
    proration_type: 'MONTHLY',
    is_carry_forward_allowed: false,
    max_carry_forward: 0,
    carry_forward_expiry_months: '',
    allow_negative: false,
    max_negative_days: 0,
    effective_from: toDateInputValue(new Date()),
    effective_to: '',
  };
}

/** Map a combined API row ({ code, name, leave_type, policy }) into the flat form the modal edits. */
function combinedRowToForm(row) {
  const lt = row.leave_type || {};
  const p = row.policy || {};
  return {
    code: row.code || lt.code || '',
    name: row.name || lt.name || '',
    description: lt.description || '',
    category: lt.category || 'ACTUAL',
    payment_type: lt.payment_type || 'PAID',
    max_quota_days: lt.max_quota_days ?? '',
    max_days_per_application: lt.max_days_per_application ?? '',
    display_order: lt.display_order ?? 0,
    notes: lt.notes || '',
    policy_notes: p.notes || '',

    gender_restriction: lt.gender_restriction || '',
    requires_approval: lt.requires_approval ?? true,
    is_active: lt.is_active ?? true,

    entitled_days: p.entitled_days ?? '',
    min_notice_days: p.min_notice_days ?? 0,
    max_consecutive: p.max_consecutive ?? '',
    accrual_type: p.accrual_type || 'NONE',
    proration_type: p.proration_type || 'MONTHLY',
    is_carry_forward_allowed: p.is_carry_forward_allowed ?? false,
    max_carry_forward: p.max_carry_forward ?? 0,
    carry_forward_expiry_months: p.carry_forward_expiry_months ?? '',
    allow_negative: p.allow_negative ?? false,
    max_negative_days: p.max_negative_days ?? 0,
    effective_from: p.effective_from || toDateInputValue(new Date()),
    effective_to: p.effective_to || '',
  };
}

/** Build the API payload from the form, numeric-coercing and dropping empty-string optionals to null. */
function combinedFormToPayload(form) {
  const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    description: form.description,
    category: form.category,
    payment_type: form.payment_type,
    max_quota_days: numOrNull(form.max_quota_days),
    max_days_per_application: numOrNull(form.max_days_per_application),
    display_order: Number(form.display_order) || 0,
    notes: form.notes,
    policy_notes: form.policy_notes,

    gender_restriction: form.gender_restriction,
    requires_approval: form.requires_approval,
    is_active: form.is_active,

    entitled_days: numOrNull(form.entitled_days),
    min_notice_days: Number(form.min_notice_days) || 0,
    max_consecutive: numOrNull(form.max_consecutive),
    accrual_type: form.accrual_type,
    proration_type: form.proration_type,
    is_carry_forward_allowed: form.is_carry_forward_allowed,
    max_carry_forward: form.is_carry_forward_allowed ? Number(form.max_carry_forward) || 0 : 0,
    carry_forward_expiry_months: form.is_carry_forward_allowed
      ? numOrNull(form.carry_forward_expiry_months)
      : null,
    allow_negative: form.allow_negative,
    max_negative_days: form.allow_negative ? Number(form.max_negative_days) || 0 : 0,
    effective_from: form.effective_from || null,
    effective_to: form.effective_to || null,
  };
}

function GenderBadge({ value }) {
  if (value === 'M') return <span className="lc-badge lc-badge-male">&#9794; Male</span>;
  if (value === 'F') return <span className="lc-badge lc-badge-female">&#9792; Female</span>;
  return <span className="lc-badge lc-badge-all">All</span>;
}

function CategoryTag({ value }) {
  const label = value ? value.charAt(0) + value.slice(1).toLowerCase() : '—';
  const cls =
    value === 'CLAIM' ? 'lc-tag-claim' : value === 'NOMINAL' ? 'lc-tag-nominal' : 'lc-tag-actual';
  return <span className={`lc-category-tag ${cls}`}>{label}</span>;
}



function CreatableSelect({ value, onChange, placeholder, options, id }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch(value || '');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  const uniqueOptions = Array.from(new Set([...options, value].filter(Boolean)));
  const filtered = uniqueOptions.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const showCreateOption =
    search.trim() &&
    !uniqueOptions.some((opt) => opt.toLowerCase() === search.trim().toLowerCase());

  const handleSelect = (val) => {
    onChange(val);
    setSearch(val);
    setIsOpen(false);
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsOpen(true);
      setFocusedIndex((prev) =>
        prev < (showCreateOption ? filtered.length : filtered.length - 1) ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0) {
        if (focusedIndex === filtered.length && showCreateOption) {
          handleSelect(search.trim());
        } else if (filtered[focusedIndex]) {
          handleSelect(filtered[focusedIndex]);
        }
      } else if (search.trim()) {
        handleSelect(search.trim());
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearch(value || '');
    }
  };

  return (
    <div className="lc-creatable-select" ref={containerRef} style={{ position: 'relative' }}>
      <div className="lc-creatable-input-wrap">
        <input
          id={id}
          type="text"
          className="ss-input"
          style={{ width: '100%', paddingRight: '32px' }}
          placeholder={placeholder}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            setFocusedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button
          type="button"
          className="lc-creatable-chevron"
          onClick={() => setIsOpen((prev) => !prev)}
          tabIndex={-1}
        >
          <ChevronDown size={14} />
        </button>
      </div>

      {isOpen && (
        <ul className="lc-creatable-dropdown">
          {filtered.map((opt, index) => (
            <li
              key={opt}
              className={`lc-creatable-option ${index === focusedIndex ? 'focused' : ''} ${opt === value ? 'selected' : ''
                }`}
              onClick={() => handleSelect(opt)}
              onMouseEnter={() => setFocusedIndex(index)}
            >
              <span>{opt}</span>
              {opt === value && <Check size={12} className="check-icon" />}
            </li>
          ))}
          {showCreateOption && (
            <li
              className={`lc-creatable-option create ${focusedIndex === filtered.length ? 'focused' : ''
                }`}
              onClick={() => handleSelect(search.trim())}
              onMouseEnter={() => setFocusedIndex(filtered.length)}
            >
              <span>Create "{search.trim()}"</span>
            </li>
          )}
          {filtered.length === 0 && !showCreateOption && (
            <li className="lc-creatable-no-options">No matches found</li>
          )}
        </ul>
      )}
    </div>
  );
}



/**
 * Admin Panel Leave Configurations Page Redesign.
 */
export function LeaveConfigurationPage() {
  useDocumentTitle('Leave Configurations - Admin Panel');
  const toast = useToast();

  // Navigation tab state: 'holidays' | 'leave-types-policies' | 'work-schedule'
  const [activeTab, setActiveTab] = useState('holidays');

  const [holidays, setHolidays] = useState([]);
  // Each row is the combined shape returned by /hr/leave-types-with-policy/:
  // { code, name, leave_type: {...}, policy: {...} | null }
  const [combinedLeaveTypes, setCombinedLeaveTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Work Schedule State
  const [workScheduleOptions, setWorkScheduleOptions] = useState({ schedules: [], custom_weekend_days: { days: [] } });
  const [selectedSchedule, setSelectedSchedule] = useState('');
  const [selectedCustomDays, setSelectedCustomDays] = useState([]);

  // Fetch API Data
  useEffect(() => {
    // Reset Work Schedule selections when changing tabs
    if (activeTab !== 'work-schedule') {
      setSelectedSchedule('');
      setSelectedCustomDays([]);
    }

    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (activeTab === 'holidays') {
          const hData = await leaveService.listHolidays();
          // Adjust field names if backend returns something different (e.g., holiday_name vs name)
          const mappedHolidays = (hData || []).map(h => ({
            ...h,
            id: h.id,
            name: h.holiday_name || h.name,
            date: h.date || (h.dates && h.dates[0]) || '',
            day: h.day || (h.date ? computeDayOfWeek(h.date) : ''),
            type: h.type || 'Public Holiday',
            status: h.status || 'Upcoming',
            description: h.description || '',
          }));
          setHolidays(mappedHolidays);
        } else if (activeTab === 'work-schedule') {
          const wsData = await leaveService.getWorkScheduleOptions();
          if (wsData) {
            setWorkScheduleOptions(wsData);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        toast.error('Error loading data');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [activeTab]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Leave Types + Policies Fetch & Search Effect
  const fetchCombinedLeaveTypes = async () => {
    setIsLoading(true);
    try {
      const res = await leaveService.getLeaveTypesWithPolicy();
      setCombinedLeaveTypes(res || []);
    } catch (err) {
      console.error('Failed to load leave types & policies', err);
      toast.error('Error loading leave types & policies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (activeTab !== 'leave-types-policies') return;
      setIsLoading(true);
      try {
        const res = await leaveService.getLeaveTypesWithPolicy();
        if (active) setCombinedLeaveTypes(res || []);
      } catch (err) {
        console.error('Failed to load leave types & policies', err);
        toast.error('Error loading leave types & policies');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [activeTab]);

  // ── Inline Edit State for Holidays ────────────────────────────────────────
  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [holidayEditForm, setHolidayEditForm] = useState({
    name: '',
    date: '',
    day: '',
    type: 'Public Holiday',
    status: 'Upcoming',
    description: '',
  });

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    day: '',
    type: 'Public Holiday',
    status: 'Upcoming',
    description: '',
  });

  // ── Leave Type + Policy modal state ───────────────────────────────────────
  const [isCombinedModalOpen, setIsCombinedModalOpen] = useState(false);
  const [editingCombinedCode, setEditingCombinedCode] = useState(null); // null = create
  const [combinedCodeError, setCombinedCodeError] = useState('');
  const [combinedForm, setCombinedForm] = useState(emptyCombinedForm());

  // ── Section 1: Holiday Handlers ─────────────────────────────────────────────
  const openAddHolidayModal = () => {
    setEditingHoliday(null);
    const todayStr = toDateInputValue(new Date());
    setHolidayForm({
      name: '',
      date: todayStr,
      day: computeDayOfWeek(todayStr),
      type: 'Public Holiday',
      status: computeStatus(todayStr),
      description: '',
    });
    setIsHolidayModalOpen(true);
  };

  const openEditHolidayModal = (h) => {
    setEditingHoliday(h);
    setHolidayForm({
      ...h,
      day: computeDayOfWeek(h.date),
      status: computeStatus(h.date),
    });
    setIsHolidayModalOpen(true);
  };

  const startHolidayInlineEdit = (h) => {
    setEditingHolidayId(h.id);
    setHolidayEditForm({
      name: h.name,
      date: h.date,
      day: computeDayOfWeek(h.date),
      type: h.type || 'Public Holiday',
      status: computeStatus(h.date),
      description: h.description || '',
    });
  };

  const cancelHolidayInlineEdit = () => {
    setEditingHolidayId(null);
    setHolidayEditForm({
      name: '',
      date: '',
      day: '',
      type: 'Public Holiday',
      status: 'Upcoming',
      description: '',
    });
  };

  const handleSaveHolidayInlineEdit = async (id) => {
    if (!holidayEditForm.name || !holidayEditForm.date) {
      toast.error('Please enter holiday name and date');
      return;
    }

    const payload = {
      holiday_name: holidayEditForm.name,
      dates: [holidayEditForm.date],
      description: holidayEditForm.description || '',
      emp_id: 10
    };

    try {
      await leaveService.editHoliday(id, payload);
      const computedDay = computeDayOfWeek(holidayEditForm.date);
      const computedStatus = computeStatus(holidayEditForm.date);

      setHolidays((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
              ...item,
              name: holidayEditForm.name,
              date: holidayEditForm.date,
              day: computedDay,
              type: holidayEditForm.type,
              status: computedStatus,
              description: holidayEditForm.description,
            }
            : item,
        ),
      );
      setEditingHolidayId(null);
      toast.success(`Updated holiday: ${holidayEditForm.name}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save inline edit');
    }
  };

  const handleSaveHoliday = async () => {
    if (!holidayForm.name || !holidayForm.date) {
      toast.error('Please enter holiday name and date');
      return;
    }

    const payload = {
      holiday_name: holidayForm.name,
      dates: [holidayForm.date],
      description: holidayForm.description,
      emp_id: 10 // Assuming current user ID 10
    };

    try {
      if (editingHoliday) {
        await leaveService.editHoliday(editingHoliday.id, payload);
        toast.success(`Updated holiday: ${holidayForm.name}`);
      } else {
        await leaveService.addHoliday(payload);
        toast.success(`Added holiday: ${holidayForm.name}`);
      }
      setIsHolidayModalOpen(false);
      // Re-fetch holidays
      const hData = await leaveService.listHolidays();
      const mappedHolidays = (hData || []).map(h => ({
        ...h,
        id: h.id,
        name: h.holiday_name || h.name,
        date: h.date || (h.dates && h.dates[0]) || '',
        day: h.day || (h.date ? computeDayOfWeek(h.date) : ''),
        type: h.type || 'Public Holiday',
        status: h.status || 'Upcoming',
        description: h.description || '',
      }));
      setHolidays(mappedHolidays);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save holiday');
    }
  };

  const handleApplyWorkSchedule = async () => {
    try {
      if (!selectedSchedule) {
        toast.error('Please select a standard work week');
        return;
      }
      if (selectedSchedule === 'CUSTOM' && selectedCustomDays.length === 0) {
        toast.error('Please select at least one custom weekend day');
        return;
      }
      const payload = { work_schedule: selectedSchedule };
      if (selectedSchedule === 'CUSTOM') {
        payload.custom_weekend_days = selectedCustomDays;
      }

      await leaveService.bulkUpdateEmployeeProfiles(payload, { all: true });
      toast.success('Work schedule applied successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply work schedule');
    }
  };

  const handleDeleteHoliday = async (id) => {
    try {
      await leaveService.deleteHoliday(id, { emp_id: 10 });
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      toast.success('Holiday deleted');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete holiday');
    }
  };

  // ── Section 2: Leave Type + Policy Handlers ─────────────────────────────────
  const openAddCombinedModal = () => {
    setEditingCombinedCode(null);
    setCombinedCodeError('');
    setCombinedForm(emptyCombinedForm());
    setIsCombinedModalOpen(true);
  };

  const openEditCombinedModal = (row) => {
    setEditingCombinedCode(row.code);
    setCombinedCodeError('');
    setCombinedForm(combinedRowToForm(row));
    setIsCombinedModalOpen(true);
  };

  const handleSaveCombined = async () => {
    if (!combinedForm.code.trim() || !combinedForm.name.trim()) {
      toast.error('Please enter a code and name');
      return;
    }
    if (combinedForm.entitled_days === '' || combinedForm.entitled_days === null) {
      toast.error('Entitled Days is required');
      return;
    }

    const payload = combinedFormToPayload(combinedForm);

    try {
      setCombinedCodeError('');
      if (editingCombinedCode) {
        delete payload.code; // immutable server-side; avoid sending a no-op change
        await leaveService.updateLeaveTypeWithPolicy(editingCombinedCode, payload);
        toast.success(`Updated ${combinedForm.name}`);
      } else {
        await leaveService.createLeaveTypeWithPolicy(payload);
        toast.success(`Added ${combinedForm.name}`);
      }
      setIsCombinedModalOpen(false);
      fetchCombinedLeaveTypes();
    } catch (err) {
      const codeErr = err.response?.data?.leave_type?.code;
      if (err.response?.status === 400 && codeErr) {
        setCombinedCodeError(Array.isArray(codeErr) ? codeErr[0] : String(codeErr));
      } else if (err.response?.status === 400 && err.response.data?.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error('Failed to save leave type & policy');
        console.error(err);
      }
    }
  };

  const handleDeleteCombined = async (row) => {
    if (window.confirm(`Deactivate "${row.name}" and its policy?`)) {
      try {
        await leaveService.deleteLeaveTypeWithPolicy(row.code);
        toast.success(`Deactivated ${row.name}`);
        fetchCombinedLeaveTypes();
      } catch (err) {
        toast.error('Failed to deactivate leave type');
        console.error(err);
      }
    }
  };

  const handleToggleCombinedActive = async (row, checked) => {
    try {
      await leaveService.updateLeaveTypeWithPolicy(row.code, { is_active: checked });
      toast.success(checked ? `Activated ${row.name}` : `Deactivated ${row.name}`);
      fetchCombinedLeaveTypes();
    } catch (err) {
      toast.error('Failed to update status');
      console.error(err);
    }
  };

  const toggleCarryForward = (checked) => {
    setCombinedForm((prev) => ({
      ...prev,
      is_carry_forward_allowed: checked,
      max_carry_forward: checked ? prev.max_carry_forward : 0,
      carry_forward_expiry_months: checked ? prev.carry_forward_expiry_months : '',
    }));
  };

  const toggleAllowNegative = (checked) => {
    setCombinedForm((prev) => ({
      ...prev,
      allow_negative: checked,
      max_negative_days: checked ? prev.max_negative_days : 0,
    }));
  };

  // Filtered views based on search query
  const filteredHolidays = holidays.filter(
    (h) =>
      (h.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (h.type || '').toLowerCase().includes((searchQuery || '').toLowerCase()),
  );

  const filteredCombinedLeaveTypes = combinedLeaveTypes.filter((row) => {
    const q = (searchQuery || '').toLowerCase();
    return (
      (row.name || '').toLowerCase().includes(q) ||
      (row.code || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="lc-redesign-container">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="lc-page-header">
        <h1 className="lc-page-title">Leaves Configurations</h1>
      </div>

      {/* ── Tabbed Navigation Bar ─────────────────────────────────────────── */}
      <div className="lc-nav-tabs" role="tablist" aria-label="Leave configurations sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'holidays'}
          className={`lc-tab-btn ${activeTab === 'holidays' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('holidays');
            setSearchQuery('');
          }}
        >
          <Calendar size={16} />
          <span>Holidays</span>
          <span className="lc-tab-count">{holidays?.length || 0}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'leave-types-policies'}
          className={`lc-tab-btn ${activeTab === 'leave-types-policies' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('leave-types-policies');
            setSearchQuery('');
          }}
        >
          <ListChecks size={16} />
          <span>Leave Types &amp; Policies</span>
          <span className="lc-tab-count">{combinedLeaveTypes?.length || 0}</span>
        </button>

        <button
          type="button"
          className={`lc-tab-btn ${activeTab === 'work-schedule' ? 'active' : ''}`}
          onClick={() => { setActiveTab('work-schedule'); setSearchQuery(''); }}
        >
          <Calendar size={16} />
          <span>Work Schedule</span>
        </button>
      </div>

      {/* ── Mobile Tab Navigation (Dropdown) ── */}
      <div className="lc-nav-tabs-mobile">
        <select
          value={activeTab}
          onChange={(e) => {
            setActiveTab(e.target.value);
            setSearchQuery('');
          }}
          className="lc-tab-select"
        >
          <option value="holidays">Holidays ({holidays?.length || 0})</option>
          <option value="leave-types-policies">Leave Types &amp; Policies ({combinedLeaveTypes?.length || 0})</option>
          <option value="work-schedule">Work Schedule</option>
        </select>
      </div>

      {/* ── Main Tab Content ──────────────────────────────────────────────── */}
      <div className="lc-tab-content">
        {/* ── TAB 1: HOLIDAYS ── */}
        {activeTab === 'holidays' && (
          <div className="lc-card-panel">
            <div className="lc-card-toolbar">
              <div className="lc-search-box">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="Search holidays..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button type="button" className="lc-btn-primary" onClick={openAddHolidayModal}>
                <Plus size={16} />
                Add Holiday
              </button>
            </div>

            <div className="lc-table-responsive">
              <table className="lc-data-table">
                <thead>
                  <tr>
                    <th>Holiday Name</th>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                          <Loader message="Loading holidays..." />
                        </div>
                      </td>
                    </tr>
                  ) : filteredHolidays.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="lc-empty-state">
                        No holidays match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredHolidays.map((h) => {
                      const isEditing = editingHolidayId === h.id;

                      return (
                        <tr key={h.id}>
                          <td style={{ fontWeight: 600 }}>
                            {isEditing ? (
                              <input
                                className="lc-inline-input"
                                style={{ width: '100%', minWidth: '150px' }}
                                value={holidayEditForm.name}
                                onChange={(e) =>
                                  setHolidayEditForm((prev) => ({ ...prev, name: e.target.value }))
                                }
                                autoFocus
                              />
                            ) : (
                              h.name
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <div className="lc-inline-edit-wrap" style={{ width: '100%' }}>
                                <DatePicker
                                  value={parseDateValue(holidayEditForm.date)}
                                  onChange={(value) =>
                                    setHolidayEditForm((prev) => ({
                                      ...prev,
                                      date: toDateInputValue(value),
                                    }))
                                  }
                                  placeholder="Select date"
                                  width="100%"
                                  showClear={false}
                                />
                              </div>
                            ) : (
                              formatDate(h.date)
                            )}
                          </td>
                          <td style={{ color: '#64748b' }}>
                            {isEditing ? computeDayOfWeek(holidayEditForm.date) : computeDayOfWeek(h.date)}
                          </td>
                          <td>
                            {isEditing ? (
                              <Select
                                value={holidayEditForm.type}
                                onChange={(value) =>
                                  setHolidayEditForm((prev) => ({ ...prev, type: value }))
                                }
                                options={[
                                  { value: 'Public Holiday', label: 'Public Holiday' },
                                  { value: 'National Holiday', label: 'National Holiday' },
                                  { value: 'Company Holiday', label: 'Company Holiday' },
                                ]}
                                placeholder="Select type"
                                width="180px"
                              />
                            ) : (
                              <span className="lc-code-badge">{h.type}</span>
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              <span className={computeStatus(holidayEditForm.date) === 'Upcoming' ? 'lc-tag-upcoming' : 'lc-tag-past'}>
                                {computeStatus(holidayEditForm.date)}
                              </span>
                            ) : (
                              <span className={computeStatus(h.date) === 'Upcoming' ? 'lc-tag-upcoming' : 'lc-tag-past'}>
                                {computeStatus(h.date)}
                              </span>
                            )}
                          </td>

                          <td>
                            {isEditing ? (
                              <input
                                className="lc-inline-input"
                                style={{ width: '100%', minWidth: '150px' }}
                                value={holidayEditForm.description}
                                onChange={(e) =>
                                  setHolidayEditForm((prev) => ({ ...prev, description: e.target.value }))
                                }
                              />
                            ) : (
                              <span
                                className="lc-description-cell"
                                title={h.description || 'No description available'}
                              >
                                {h.description || '—'}
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isEditing ? (
                              <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="lc-btn-primary"
                                  style={{ height: '32px', padding: '0 12px' }}
                                  onClick={() => handleSaveHolidayInlineEdit(h.id)}
                                >
                                  <Check size={14} />
                                  Save Changes
                                </button>
                                <button
                                  type="button"
                                  className="lc-ghost-btn"
                                  style={{ width: 'auto', padding: '0 12px' }}
                                  onClick={cancelHolidayInlineEdit}
                                >
                                  <X size={14} />
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  className="lc-ghost-btn"
                                  title="Edit Holiday"
                                  onClick={() => startHolidayInlineEdit(h)}
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="lc-ghost-btn danger"
                                  title="Delete Holiday"
                                  onClick={() => handleDeleteHoliday(h.id)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: LEAVE TYPES & POLICIES (combined) ── */}
        {activeTab === 'leave-types-policies' && (
          <div className="lc-card-panel">
            <div className="lc-card-toolbar">
              <div className="lc-search-box">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="Search leave types or codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button type="button" className="lc-btn-primary" onClick={openAddCombinedModal}>
                <Plus size={16} />
                Add Leave Type &amp; Policy
              </button>
            </div>

            <div className="lc-table-responsive">
              <table className="lc-data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Leave Type Name</th>
                    <th>Entitled Days</th>
                    <th>Gender</th>
                    <th>Category</th>
                    <th>Payment</th>
                    <th>Active Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={8}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                          <Loader message="Loading leave types & policies..." />
                        </div>
                      </td>
                    </tr>
                  ) : filteredCombinedLeaveTypes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="lc-empty-state">
                        No leave types match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredCombinedLeaveTypes.map((row) => {
                      const lt = row.leave_type || {};
                      const p = row.policy;
                      const isActive = lt.is_active ?? true;

                      return (
                        <tr key={row.code}>
                          <td>
                            <span className="lc-code-badge">{row.code}</span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{row.name}</td>
                          <td style={{ fontWeight: 600 }}>
                            {p ? (
                              <span className="lc-num-cell">{Number(p.entitled_days).toFixed(1)} Days</span>
                            ) : (
                              <span className="lc-num-cell empty">—</span>
                            )}
                          </td>
                          <td>
                            <GenderBadge value={lt.gender_restriction} />
                          </td>
                          <td>
                            <CategoryTag value={lt.category} />
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>
                              {lt.payment_type === 'UNPAID' ? 'Unpaid' : 'Paid'}
                            </span>
                          </td>
                          <td>
                            <Toggle
                              checked={isActive}
                              onChange={(val) => handleToggleCombinedActive(row, val)}
                              ariaLabel={`Toggle active status for ${row.name}`}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="lc-ghost-btn"
                                title="Edit Leave Type & Policy"
                                onClick={() => openEditCombinedModal(row)}
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                className="lc-ghost-btn danger"
                                title="Deactivate Leave Type & Policy"
                                onClick={() => handleDeleteCombined(row)}
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* ── TAB 3: WORK SCHEDULE ── */}
        {activeTab === 'work-schedule' && (
          <div className="lc-card-panel">
            <div style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '16px' }}>Work Schedule Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="ss-modal-form-group">
                  <label className="ss-modal-label">Standard Work Week</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                    {(workScheduleOptions.schedules || []).map((schedule) => (
                      <label key={schedule.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="workSchedule"
                          value={schedule.value}
                          checked={selectedSchedule === schedule.value}
                          onChange={() => setSelectedSchedule(schedule.value)}
                          style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                        />
                        <span style={{ fontSize: '14px', color: '#334155' }}>{schedule.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {selectedSchedule === 'CUSTOM' && (
                  <div className="ss-modal-form-group" style={{ paddingLeft: '24px', borderLeft: '2px solid #e2e8f0', marginLeft: '8px' }}>
                    <label className="ss-modal-label">Select Custom Weekend Days</label>
                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
                      {workScheduleOptions.custom_weekend_days?.description || 'Select the days that constitute a weekend.'}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {(workScheduleOptions.custom_weekend_days?.days || []).map((day) => (
                        <label key={day.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={selectedCustomDays.includes(day.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedCustomDays([...selectedCustomDays, day.value]);
                              } else {
                                setSelectedCustomDays(selectedCustomDays.filter(d => d !== day.value));
                              }
                            }}
                            style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                          />
                          <span style={{ fontSize: '14px', color: '#334155' }}>{day.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
                <button
                  type="button"
                  className="lc-btn-primary"
                  onClick={handleApplyWorkSchedule}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Check size={16} />
                  Apply Work Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL 1: Add / Edit Holiday ──────────────────────────────────── */}
      <AdminModal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        title={editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="lc-ghost-btn"
              style={{ padding: '0 16px', width: 'auto' }}
              onClick={() => setIsHolidayModalOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className="lc-btn-primary" onClick={handleSaveHoliday}>
              Save Holiday
            </button>
          </>
        }
      >
        <div className="lc-modal-grid">
          {/* Holiday Name */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label ss-modal-label-required" htmlFor="holiday-name">
              Holiday Name
            </label>
            <input
              id="holiday-name"
              type="text"
              className="ss-input"
              style={{ width: '100%' }}
              value={holidayForm.name}
              placeholder="e.g. Founding Day"
              onChange={(e) => setHolidayForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Date */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label ss-modal-label-required" htmlFor="holiday-date">
              Date
            </label>
            <DatePicker
              value={parseDateValue(holidayForm.date)}
              onChange={(value) => {
                const dateStr = toDateInputValue(value);
                setHolidayForm((prev) => ({
                  ...prev,
                  date: dateStr,
                  day: computeDayOfWeek(dateStr),
                  status: computeStatus(dateStr)
                }));
              }}
              placeholder="Select holiday date"
              width="100%"
              showClear={false}
            />
          </div>

          {/* Computed Day (Read-only Info Field) */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="holiday-computed-day">
              Day of Week (Computed)
            </label>
            <div
              id="holiday-computed-day"
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '38px',
                padding: '0 12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#475569',
                fontWeight: 500
              }}
            >
              {holidayForm.date ? computeDayOfWeek(holidayForm.date) : 'Select a date'}
            </div>
          </div>

          {/* Computed Status (Read-only Info Badge) */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="holiday-computed-status">
              Status (Computed)
            </label>
            <div
              id="holiday-computed-status"
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '38px',
                padding: '0 12px',
                backgroundColor: '#f9fafb',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
              }}
            >
              {holidayForm.date ? (
                computeStatus(holidayForm.date) === 'Upcoming' ? (
                  <span className="lc-tag-upcoming" style={{ fontSize: '12px', padding: '2px 8px' }}>Upcoming</span>
                ) : (
                  <span className="lc-tag-past" style={{ fontSize: '12px', padding: '2px 8px' }}>Past</span>
                )
              ) : (
                <span style={{ color: '#94a3b8' }}>Select a date</span>
              )}
            </div>
          </div>

          {/* Holiday Type */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="holiday-type">
              Holiday Type
            </label>
            <CreatableSelect
              id="holiday-type"
              value={holidayForm.type}
              onChange={(value) => setHolidayForm((prev) => ({ ...prev, type: value }))}
              placeholder="Select or type holiday type"
              options={Array.from(new Set(['Public Holiday', 'National Holiday', 'Company Holiday', ...holidays.map(h => h.type).filter(Boolean)]))}
            />
          </div>


          {/* Description */}
          <div className="ss-modal-form-group lc-modal-grid-span-2">
            <label className="ss-modal-label" htmlFor="holiday-description">
              Description
            </label>
            <input
              id="holiday-description"
              type="text"
              className="ss-input"
              style={{ width: '100%' }}
              placeholder="Add a concise holiday summary"
              value={holidayForm.description}
              onChange={(e) => setHolidayForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
        </div>
      </AdminModal>

      {/* ── MODAL 2: Add / Edit Leave Type & Policy (combined) ────────────── */}
      <AdminModal
        isOpen={isCombinedModalOpen}
        onClose={() => setIsCombinedModalOpen(false)}
        title={editingCombinedCode ? `Edit ${combinedForm.name || 'Leave Type'}` : 'Add Leave Type & Policy'}
        size="xl"
        footer={
          <>
            <button
              type="button"
              className="lc-ghost-btn"
              style={{ padding: '0 16px', width: 'auto' }}
              onClick={() => setIsCombinedModalOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className="lc-btn-primary" onClick={handleSaveCombined}>
              Save Leave Type
            </button>
          </>
        }
      >
        {/* Section: Basic Info */}
        <div className="lc-form-section">
          <div className="lc-form-section-title">Basic Info</div>
          <div className="lc-modal-grid">
            <div className="ss-modal-form-group">
              <label className="ss-modal-label ss-modal-label-required" htmlFor="lt-code">
                Code
              </label>
              {editingCombinedCode ? (
                <div className="lc-locked-field" title="Cannot be changed once created">
                  {combinedForm.code}
                </div>
              ) : (
                <div>
                  <input
                    id="lt-code"
                    type="text"
                    className="ss-input"
                    style={{ textTransform: 'uppercase', borderColor: combinedCodeError ? '#ef4444' : undefined }}
                    value={combinedForm.code}
                    placeholder="e.g. PAT"
                    onChange={(e) => {
                      setCombinedCodeError('');
                      setCombinedForm((prev) => ({ ...prev, code: e.target.value }));
                    }}
                  />
                  {combinedCodeError && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                      {combinedCodeError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label ss-modal-label-required" htmlFor="lt-name">
                Name
              </label>
              <input
                id="lt-name"
                type="text"
                className="ss-input"
                value={combinedForm.name}
                placeholder="e.g. Paternity Leave"
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="ss-modal-form-group lc-modal-grid-span-2">
              <label className="ss-modal-label" htmlFor="lt-desc">
                Description
              </label>
              <input
                id="lt-desc"
                type="text"
                className="ss-input"
                placeholder="Shown to employees when applying"
                value={combinedForm.description}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-category">Category</label>
              <select
                id="lt-category"
                className="ss-input"
                value={combinedForm.category}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, category: e.target.value }))}
              >
                <option value="ACTUAL">Actual — deducts balance</option>
                <option value="CLAIM">Claim — earns balance</option>
                <option value="NOMINAL">Nominal — no balance impact</option>
              </select>
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-payment">Payment Type</label>
              <select
                id="lt-payment"
                className="ss-input"
                value={combinedForm.payment_type}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, payment_type: e.target.value }))}
              >
                <option value="PAID">Paid</option>
                <option value="UNPAID">Unpaid</option>
              </select>
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-maxdays">Max Quota Days</label>
              <input
                id="lt-maxdays"
                type="number"
                className="ss-input"
                placeholder="Blank = no cap"
                value={combinedForm.max_quota_days}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, max_quota_days: e.target.value }))}
              />
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-order">Display Order</label>
              <input
                id="lt-order"
                type="number"
                className="ss-input"
                value={combinedForm.display_order}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, display_order: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Section: Entitlement */}
        <div className="lc-form-section">
          <div className="lc-form-section-title">
            Entitlement <span className="lc-form-section-hint">Creates the policy row</span>
          </div>
          <div className="lc-modal-grid">
            <div className="ss-modal-form-group">
              <label className="ss-modal-label ss-modal-label-required" htmlFor="lt-entitled">
                Entitled Days
              </label>
              <input
                id="lt-entitled"
                type="number"
                className="ss-input"
                placeholder="e.g. 10"
                value={combinedForm.entitled_days}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, entitled_days: e.target.value }))}
              />
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-maxperapp">Max Days / Application</label>
              <input
                id="lt-maxperapp"
                type="number"
                className="ss-input"
                placeholder="Blank = no limit"
                value={combinedForm.max_days_per_application}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, max_days_per_application: e.target.value }))}
              />
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-accrual">Accrual Type</label>
              <select
                id="lt-accrual"
                className="ss-input"
                value={combinedForm.accrual_type}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, accrual_type: e.target.value }))}
              >
                <option value="NONE">Grant all at start of year</option>
                <option value="MONTHLY">Accrue monthly</option>
              </select>
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-proration">Proration Type</label>
              <select
                id="lt-proration"
                className="ss-input"
                value={combinedForm.proration_type}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, proration_type: e.target.value }))}
              >
                <option value="NONE">No proration</option>
                <option value="MONTHLY">By full months worked</option>
                <option value="DAILY">By calendar days worked</option>
              </select>
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-notice">Min Notice (days)</label>
              <input
                id="lt-notice"
                type="number"
                className="ss-input"
                value={combinedForm.min_notice_days}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, min_notice_days: e.target.value }))}
              />
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-consecutive">Max Consecutive (days)</label>
              <input
                id="lt-consecutive"
                type="number"
                className="ss-input"
                placeholder="Blank = no limit"
                value={combinedForm.max_consecutive}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, max_consecutive: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Section: Carry-Forward & Advance */}
        <div className="lc-form-section">
          <div className="lc-form-section-title">Carry-Forward &amp; Advance</div>

          <label className="lc-checkrow">
            <input
              type="checkbox"
              aria-label="Allow carry-forward"
              checked={combinedForm.is_carry_forward_allowed}
              onChange={(e) => toggleCarryForward(e.target.checked)}
            />
            <span>
              <span className="lc-checkrow-title">Allow carry-forward</span>
              <span className="lc-checkrow-sub">Unused days roll into the next year</span>
            </span>
          </label>
          <div className={`lc-conditional-grid ${combinedForm.is_carry_forward_allowed ? '' : 'disabled'}`}>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-carryforward">Max Carry Forward (days)</label>
              <input
                id="lt-carryforward"
                type="number"
                className="ss-input"
                value={combinedForm.max_carry_forward}
                disabled={!combinedForm.is_carry_forward_allowed}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, max_carry_forward: e.target.value }))}
              />
            </div>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-carryforward-expiry">Expires After (months)</label>
              <input
                id="lt-carryforward-expiry"
                type="number"
                className="ss-input"
                placeholder="Blank = never"
                value={combinedForm.carry_forward_expiry_months}
                disabled={!combinedForm.is_carry_forward_allowed}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, carry_forward_expiry_months: e.target.value }))}
              />
            </div>
          </div>

          <label className="lc-checkrow" style={{ marginTop: '14px' }}>
            <input
              type="checkbox"
              aria-label="Allow advance leave"
              checked={combinedForm.allow_negative}
              onChange={(e) => toggleAllowNegative(e.target.checked)}
            />
            <span>
              <span className="lc-checkrow-title">Allow advance leave</span>
              <span className="lc-checkrow-sub">Employees can borrow from next year&apos;s balance</span>
            </span>
          </label>
          <div className={`lc-conditional-grid ${combinedForm.allow_negative ? '' : 'disabled'}`}>
            <div className="ss-modal-form-group lc-modal-grid-span-2">
              <label className="ss-modal-label" htmlFor="lt-negative-days">Max Negative Days</label>
              <input
                id="lt-negative-days"
                type="number"
                className="ss-input"
                value={combinedForm.max_negative_days}
                disabled={!combinedForm.allow_negative}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, max_negative_days: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Section: Restrictions & Status */}
        <div className="lc-form-section">
          <div className="lc-form-section-title">Restrictions &amp; Status</div>

          <div className="ss-modal-form-group" style={{ marginBottom: '16px' }}>
            <div className="ss-modal-label" role="heading" aria-level="4">Gender Restriction</div>
            <div className="lc-gender-radio-row">
              <label className={`lc-gender-radio-card ${combinedForm.gender_restriction === '' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="gender_restriction"
                  checked={combinedForm.gender_restriction === ''}
                  onChange={() => setCombinedForm((prev) => ({ ...prev, gender_restriction: '' }))}
                />
                <span className="rtitle">All employees</span>
                <span className="rsub">No restriction</span>
              </label>
              <label className={`lc-gender-radio-card male ${combinedForm.gender_restriction === 'M' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="gender_restriction"
                  checked={combinedForm.gender_restriction === 'M'}
                  onChange={() => setCombinedForm((prev) => ({ ...prev, gender_restriction: 'M' }))}
                />
                <span className="rtitle">&#9794; Male only</span>
                <span className="rsub">e.g. Paternity</span>
              </label>
              <label className={`lc-gender-radio-card female ${combinedForm.gender_restriction === 'F' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="gender_restriction"
                  checked={combinedForm.gender_restriction === 'F'}
                  onChange={() => setCombinedForm((prev) => ({ ...prev, gender_restriction: 'F' }))}
                />
                <span className="rtitle">&#9792; Female only</span>
                <span className="rsub">e.g. Maternity</span>
              </label>
            </div>
          </div>

          <div className="lc-modal-grid" style={{ marginBottom: '6px' }}>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-eff-from">Effective From</label>
              <input
                id="lt-eff-from"
                type="date"
                className="ss-input"
                value={combinedForm.effective_from}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, effective_from: e.target.value }))}
              />
            </div>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-eff-to">Effective To</label>
              <input
                id="lt-eff-to"
                type="date"
                className="ss-input"
                placeholder="Blank = ongoing"
                value={combinedForm.effective_to}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, effective_to: e.target.value }))}
              />
            </div>
          </div>

          <div className="lc-toggle-field">
            <div>
              <div className="lc-toggle-field-label">Requires approval</div>
              <div className="lc-toggle-field-hint">If off, leave is auto-approved on submission</div>
            </div>
            <Toggle
              checked={combinedForm.requires_approval}
              onChange={(v) => setCombinedForm((prev) => ({ ...prev, requires_approval: v }))}
              ariaLabel="Requires approval"
            />
          </div>
          <div className="lc-toggle-field">
            <div>
              <div className="lc-toggle-field-label">Active</div>
              <div className="lc-toggle-field-hint">Inactive leave types can&apos;t be applied for</div>
            </div>
            <Toggle
              checked={combinedForm.is_active}
              onChange={(v) => setCombinedForm((prev) => ({ ...prev, is_active: v }))}
              ariaLabel="Active status"
            />
          </div>

          <div className="lc-modal-grid" style={{ marginTop: '14px' }}>
            <div className="ss-modal-form-group lc-modal-grid-span-2">
              <label className="ss-modal-label" htmlFor="lt-notes">Notes <span className="lc-form-optional-hint">— internal, on the leave type</span></label>
              <textarea
                id="lt-notes"
                className="ss-input"
                style={{ minHeight: '56px', resize: 'vertical' }}
                placeholder="Internal HR reference note"
                value={combinedForm.notes}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="ss-modal-form-group lc-modal-grid-span-2">
              <label className="ss-modal-label" htmlFor="lt-policy-notes">Policy Notes <span className="lc-form-optional-hint">— internal, on the policy</span></label>
              <textarea
                id="lt-policy-notes"
                className="ss-input"
                style={{ minHeight: '56px', resize: 'vertical' }}
                placeholder="Optional — note specific to this entitlement rule"
                value={combinedForm.policy_notes}
                onChange={(e) => setCombinedForm((prev) => ({ ...prev, policy_notes: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

export default LeaveConfigurationPage;
