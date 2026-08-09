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

// Static Work Schedule options (not sourced from the backend).
const WORK_SCHEDULE_OPTIONS = {
  schedules: [
    { value: 'MON_FRI', label: 'Monday to Friday' },
    { value: 'MON_SAT', label: 'Monday to Saturday' },
    { value: 'SUN_THU', label: 'Sunday to Thursday' },
    { value: 'CUSTOM', label: 'Custom' },
  ],
  custom_weekend_days: {
    description: 'Weekday numbers used in custom_weekend_days (Mon=0 ... Sun=6).',
    days: [
      { value: 0, label: 'Monday' },
      { value: 1, label: 'Tuesday' },
      { value: 2, label: 'Wednesday' },
      { value: 3, label: 'Thursday' },
      { value: 4, label: 'Friday' },
      { value: 5, label: 'Saturday' },
      { value: 6, label: 'Sunday' },
    ],
  },
};

function getScheduleLabel(value) {
  const match = WORK_SCHEDULE_OPTIONS.schedules.find((s) => s.value === value);
  return match ? match.label : value;
}

function formatCustomWeekendDays(days) {
  const dayMap = new Map(WORK_SCHEDULE_OPTIONS.custom_weekend_days.days.map((d) => [d.value, d.label]));
  return (days || []).map((d) => dayMap.get(d) || d).join(', ');
}

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
    display_order: 0,
    notes: '',
    policy_notes: '',

    gender_restriction: '',
    requires_work_location: false,
    required_location: '',
    is_active: true,

    is_unlimited: false,
    is_flexible: false,
    entitled_days: '',
    credits_to_leave_type_code: '',
    claim_date_rule: '',
    custom_claim_dates: [],
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
    display_order: lt.display_order ?? 0,
    notes: lt.notes || '',
    policy_notes: p.notes || '',

    gender_restriction: lt.gender_restriction || '',
    requires_work_location: p.requires_work_location ?? false,
    required_location: p.required_location ?? '',
    is_active: lt.is_active ?? true,

    is_unlimited: p.is_unlimited ?? false,
    is_flexible: p.is_flexible ?? false,
    entitled_days: p.entitled_days ?? '',
    credits_to_leave_type_code: p.credits_to_leave_type_code || '',
    claim_date_rule: p.claim_date_rule || '',
    custom_claim_dates: Array.isArray(p.custom_claim_dates) ? p.custom_claim_dates : [],
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
    display_order: Number(form.display_order) || 0,
    notes: form.notes,
    policy_notes: form.policy_notes,

    gender_restriction: form.gender_restriction,
    requires_work_location: form.requires_work_location,
    required_location: form.requires_work_location ? numOrNull(form.required_location) : null,
    is_active: form.is_active,

    // Claim leave types aren't entitlement-capped — force Limited/Unlimited/
    // Flexible off and entitled_days to 0 regardless of stale form state,
    // mirroring the backend's LeavePolicyCreateSerializer.validate().
    is_unlimited: form.category === 'CLAIM' ? false : form.is_unlimited,
    is_flexible: form.category === 'CLAIM' ? false : form.is_flexible,
    entitled_days: form.category === 'CLAIM'
      ? 0
      : (form.is_unlimited ? null : numOrNull(form.entitled_days)),
    // Claim leave types don't hold their own balance — approval credits a
    // separate ACTUAL leave type instead (e.g. CWW -> WW). Meaningless
    // outside Claim, so force-clear it there.
    credits_to_leave_type_code: form.category === 'CLAIM' ? form.credits_to_leave_type_code : '',
    // Which dates count as claimable — Weekend/Company Holiday/Custom
    // Dates. Meaningless outside Claim; custom_claim_dates only matters
    // when the rule is actually Custom Dates.
    claim_date_rule: form.category === 'CLAIM' ? form.claim_date_rule : '',
    custom_claim_dates: (form.category === 'CLAIM' && form.claim_date_rule === 'CUSTOM')
      ? form.custom_claim_dates
      : [],
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

  // Work locations, for the "Requires Work Location" leave-type setting's dropdown
  const [workLocations, setWorkLocations] = useState([]);

  // Work Schedule State — static options, not fetched from backend
  const workScheduleOptions = WORK_SCHEDULE_OPTIONS;
  const [selectedCustomDays, setSelectedCustomDays] = useState([]);
  const [workScheduleSummary, setWorkScheduleSummary] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Reset Work Schedule selections when changing away from that tab
  useEffect(() => {
    if (activeTab !== 'work-schedule') {
      setSelectedCustomDays([]);
    }
  }, [activeTab]);

  // Fetch Holidays — runs once on mount, not gated to the active tab, so all
  // tabs' data is ready as soon as the page loads.
  useEffect(() => {
    let active = true;
    const fetchHolidays = async () => {
      setIsLoading(true);
      try {
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
        if (active) setHolidays(mappedHolidays);
      } catch (err) {
        console.error('Failed to load holidays:', err);
        if (active) toast.error('Error loading holidays');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchHolidays();
    return () => {
      active = false;
    };
  }, []);

  // Fetch Work Locations — runs once on mount, used by the leave-type modal's
  // "Requires Work Location" dropdown.
  useEffect(() => {
    let active = true;
    const fetchWorkLocations = async () => {
      try {
        const data = await leaveService.getWorkLocations();
        const list = Array.isArray(data) ? data : (data?.results || []);
        if (active) setWorkLocations(list);
      } catch (err) {
        console.error('Failed to load work locations:', err);
      }
    };
    fetchWorkLocations();
    return () => {
      active = false;
    };
  }, []);

  // Fetch Work Schedule Summary — org-wide/grouped current schedule assignment
  useEffect(() => {
    let active = true;
    const fetchSummary = async () => {
      setIsSummaryLoading(true);
      try {
        const data = await leaveService.getWorkScheduleSummary();
        if (active) {
          setWorkScheduleSummary(data);
          // Pre-select the currently applied weekend days so the checkboxes reflect
          // the org's current assignment as soon as the tab opens.
          if (data?.meta?.distinct_schedules === 1) {
            const group = data.results[0];
            setSelectedCustomDays(
              group.work_schedule === 'CUSTOM' ? group.custom_weekend_days || [] : [],
            );
          }
        }
      } catch (err) {
        console.error('Failed to load work schedule summary:', err);
        if (active) setWorkScheduleSummary(null);
      } finally {
        if (active) setIsSummaryLoading(false);
      }
    };
    fetchSummary();
    return () => {
      active = false;
    };
  }, []);

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

  // Fetch Leave Types + Policies — runs once on mount alongside the other tabs' data.
  useEffect(() => {
    let active = true;
    const run = async () => {
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
  }, []);

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
  // Client-side required-field errors, keyed by field name (code, name, entitled_days).
  // Mirrors what the backend actually requires — see combinedFormToPayload/validateCombinedForm.
  const [combinedFieldErrors, setCombinedFieldErrors] = useState({});
  // Pending date being picked in the Custom Dates chip-list editor, before "Add" commits it.
  const [pendingCustomClaimDate, setPendingCustomClaimDate] = useState(null);

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
      if (selectedCustomDays.length === 0) {
        toast.error('Please select at least one weekend day');
        return;
      }
      const payload = { work_schedule: 'CUSTOM', custom_weekend_days: selectedCustomDays };

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
    setCombinedFieldErrors({});
    setCombinedForm(emptyCombinedForm());
    setPendingCustomClaimDate(null);
    setIsCombinedModalOpen(true);
  };

  const openEditCombinedModal = (row) => {
    setEditingCombinedCode(row.code);
    setCombinedCodeError('');
    setCombinedFieldErrors({});
    setCombinedForm(combinedRowToForm(row));
    setPendingCustomClaimDate(null);
    setIsCombinedModalOpen(true);
  };

  // Required on the backend: code, name, entitled_days — unless is_unlimited
  // is set, in which case entitled_days is ignored entirely (see hr_admin
  // serializers/views). Everything else has a default or is genuinely optional.
  // Claim leave types (CWW, CCompOff) skip entitled_days entirely — the
  // backend rejects is_unlimited/is_flexible for CLAIM and forces
  // entitled_days to 0, since claims are approval-gated by the manager,
  // not entitlement-capped.
  // Leave type codes credited by at least one active Claim's "Credits To"
  // (LeavePolicy.credits_to_leave_type_code) — these earn their balance
  // entirely through approved claims (accrued_days), so Entitled Days is
  // just an optional base allocation on top of that, not a required quota
  // (mirrors the backend's LeavePolicyCreateSerializer.validate()).
  const claimTargetCodes = new Set(
    combinedLeaveTypes.map((row) => row.policy?.credits_to_leave_type_code).filter(Boolean)
  );

  const validateCombinedForm = (form) => {
    const errors = {};
    if (!form.code.trim()) errors.code = 'Code is required.';
    if (!form.name.trim()) errors.name = 'Name is required.';
    const isClaimTarget = claimTargetCodes.has(form.code);
    if (!form.is_unlimited && form.category !== 'CLAIM' && !isClaimTarget) {
      if (form.entitled_days === '' || form.entitled_days === null) {
        errors.entitled_days = 'Entitled Days is required unless this leave type is unlimited.';
      } else if (Number.isNaN(Number(form.entitled_days))) {
        errors.entitled_days = 'Entitled Days must be a number.';
      }
    } else if (!form.is_unlimited && isClaimTarget && form.entitled_days !== '' && Number.isNaN(Number(form.entitled_days))) {
      errors.entitled_days = 'Entitled Days must be a number.';
    }
    if (form.requires_work_location && (form.required_location === '' || form.required_location === null)) {
      errors.required_location = 'Select a Work Location Type, or turn off Requires Work Location.';
    }
    if (form.category === 'CLAIM' && !form.credits_to_leave_type_code) {
      errors.credits_to_leave_type_code = 'Select which Actual leave type this claim credits on approval.';
    }
    if (form.category === 'CLAIM') {
      if (!form.claim_date_rule) {
        errors.claim_date_rule = 'Select which dates count as claimable — Weekend, Company Holiday, or Custom Dates.';
      } else if (form.claim_date_rule === 'CUSTOM' && form.custom_claim_dates.length === 0) {
        errors.custom_claim_dates = 'Add at least one date, or choose Weekend/Company Holiday instead.';
      }
    }
    return errors;
  };

  const handleSaveCombined = async () => {
    const errors = validateCombinedForm(combinedForm);
    if (Object.keys(errors).length > 0) {
      setCombinedFieldErrors(errors);
      toast.error('Please fill in the required fields.');
      return;
    }
    setCombinedFieldErrors({});

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

  // mode: 'LIMITED' | 'UNLIMITED' | 'FLEXIBLE'
  const setEntitlementMode = (mode) => {
    setCombinedFieldErrors((prev) => ({ ...prev, entitled_days: undefined }));
    setCombinedForm((prev) => ({
      ...prev,
      is_unlimited: mode === 'UNLIMITED',
      is_flexible: mode === 'FLEXIBLE',
      entitled_days: mode === 'UNLIMITED' ? '' : prev.entitled_days,
    }));
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
                            {lt.category === 'CLAIM' ? (
                              <span className="lc-num-cell" title="Claims are approval-gated by the manager, not entitlement-capped">
                                Manager Approved
                              </span>
                            ) : p?.is_unlimited ? (
                              <span className="lc-num-cell">Unlimited</span>
                            ) : p ? (
                              <span className="lc-num-cell">
                                {Number(p.entitled_days).toFixed(1)} Days
                                {p.is_flexible ? ' (Flexible)' : ''}
                              </span>
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

              {isSummaryLoading && (
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Loading current schedule…</div>
              )}

              {!isSummaryLoading && workScheduleSummary?.meta?.distinct_schedules > 1 && (
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '12px', color: '#b45309', marginBottom: '8px' }}>
                    Employees are currently split across multiple schedules. Applying below will set everyone to the selected days.
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {workScheduleSummary.results.map((group, idx) => (
                      <div
                        key={`${group.work_schedule}-${idx}`}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '10px 16px', backgroundColor: '#f9fafb', border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                            {getScheduleLabel(group.work_schedule)}
                          </span>
                          {group.work_schedule === 'CUSTOM' && group.custom_weekend_days && (
                            <span style={{ fontSize: '13px', color: '#334155', marginLeft: '8px' }}>
                              ({formatCustomWeekendDays(group.custom_weekend_days)})
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                          {group.employee_count} employee{group.employee_count === 1 ? '' : 's'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div className="ss-modal-form-group">
                  <label className="ss-modal-label">Select Weekend Days</label>
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
        subtitle="Creates the leave type and its entitlement policy in a single save."
        size="lg"
        variant="panel"
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
        <div className="lc-combined-form">
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
                    className={`ss-input ${(combinedCodeError || combinedFieldErrors.code) ? 'has-error' : ''}`}
                    style={{ textTransform: 'uppercase' }}
                    value={combinedForm.code}
                    placeholder="e.g. PAT"
                    aria-invalid={!!(combinedCodeError || combinedFieldErrors.code)}
                    onChange={(e) => {
                      setCombinedCodeError('');
                      setCombinedFieldErrors((prev) => ({ ...prev, code: undefined }));
                      setCombinedForm((prev) => ({ ...prev, code: e.target.value }));
                    }}
                  />
                  {(combinedCodeError || combinedFieldErrors.code) && (
                    <div className="lc-field-error">
                      {combinedCodeError || combinedFieldErrors.code}
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
                className={`ss-input ${combinedFieldErrors.name ? 'has-error' : ''}`}
                value={combinedForm.name}
                placeholder="e.g. Paternity Leave"
                aria-invalid={!!combinedFieldErrors.name}
                onChange={(e) => {
                  setCombinedFieldErrors((prev) => ({ ...prev, name: undefined }));
                  setCombinedForm((prev) => ({ ...prev, name: e.target.value }));
                }}
              />
              {combinedFieldErrors.name && (
                <div className="lc-field-error">{combinedFieldErrors.name}</div>
              )}
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
                onChange={(e) => {
                  const category = e.target.value;
                  setCombinedFieldErrors((prev) => ({
                    ...prev,
                    entitled_days: undefined,
                    credits_to_leave_type_code: undefined,
                    claim_date_rule: undefined,
                    custom_claim_dates: undefined,
                  }));
                  setCombinedForm((prev) => ({
                    ...prev,
                    category,
                    // Claim leave types aren't entitlement-capped — the manager's
                    // approval is the only gate (see hr_admin serializers). Reset
                    // Limited/Unlimited/Flexible so a stale selection doesn't get
                    // silently rejected on save.
                    ...(category === 'CLAIM'
                      ? { is_unlimited: false, is_flexible: false, entitled_days: 0 }
                      : { credits_to_leave_type_code: '', claim_date_rule: '', custom_claim_dates: [] }),
                    // Carry-forward only applies to ACTUAL/CLAIM; reset when
                    // switching to NOMINAL so a hidden, stale "on" doesn't ship.
                    ...(category === 'NOMINAL'
                      ? { is_carry_forward_allowed: false, max_carry_forward: 0, carry_forward_expiry_months: '' }
                      : {}),
                    // Advance-leave borrowing only applies to ACTUAL; reset when
                    // switching away so a hidden, stale "on" doesn't ship.
                    ...(category !== 'ACTUAL'
                      ? { allow_negative: false, max_negative_days: 0 }
                      : {}),
                  }));
                }}
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

          {combinedForm.category === 'CLAIM' ? (
            <div className="ss-modal-form-group" style={{ marginBottom: '16px' }}>
              <div className="ss-modal-label" role="heading" aria-level="4">Entitlement Mode</div>
              <div className="lc-locked-field" title="Claims are approval-gated by the manager, not entitlement-capped">
                Not applicable — Claim leave types aren&apos;t entitlement-capped. The
                employee isn&apos;t drawing down a balance, they&apos;re asserting they
                worked a day, and the manager&apos;s approval is the only gate.
              </div>

              <label className="ss-modal-label ss-modal-label-required" style={{ marginTop: '14px' }}>
                Credits To
              </label>
              <div className="lc-checkrow-sub" style={{ marginBottom: '8px' }}>
                Which Actual leave type gains a day when this claim is approved (e.g. Claim
                Weekend Work &rarr; Weekend Work).
              </div>
              <Select
                value={combinedForm.credits_to_leave_type_code}
                onChange={(v) => {
                  setCombinedFieldErrors((prev) => ({ ...prev, credits_to_leave_type_code: undefined }));
                  setCombinedForm((prev) => ({ ...prev, credits_to_leave_type_code: v }));
                }}
                options={combinedLeaveTypes
                  .filter((row) => (row.leave_type || {}).category === 'ACTUAL' && (row.leave_type || {}).is_active)
                  .filter((row) => row.code !== combinedForm.code)
                  .map((row) => ({ value: row.code, label: `${row.name} (${row.code})` }))}
                placeholder="Select an Actual leave type"
                width="320px"
              />
              {combinedFieldErrors.credits_to_leave_type_code && (
                <div className="lc-field-error">{combinedFieldErrors.credits_to_leave_type_code}</div>
              )}

              <label className="ss-modal-label ss-modal-label-required" style={{ marginTop: '14px' }}>
                Claim Dates
              </label>
              <div className="lc-checkrow-sub" style={{ marginBottom: '8px' }}>
                Which calendar dates count as claimable for this leave type.
              </div>
              <div className="lc-gender-radio-row">
                <label className={`lc-gender-radio-card ${combinedForm.claim_date_rule === 'WEEKEND' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="claim_date_rule"
                    checked={combinedForm.claim_date_rule === 'WEEKEND'}
                    onChange={() => {
                      setCombinedFieldErrors((prev) => ({ ...prev, claim_date_rule: undefined, custom_claim_dates: undefined }));
                      setCombinedForm((prev) => ({ ...prev, claim_date_rule: 'WEEKEND', custom_claim_dates: [] }));
                    }}
                  />
                  <span className="rtitle">Weekend</span>
                  <span className="rsub">Employee&apos;s weekend days</span>
                </label>
                <label className={`lc-gender-radio-card ${combinedForm.claim_date_rule === 'HOLIDAY' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="claim_date_rule"
                    checked={combinedForm.claim_date_rule === 'HOLIDAY'}
                    onChange={() => {
                      setCombinedFieldErrors((prev) => ({ ...prev, claim_date_rule: undefined, custom_claim_dates: undefined }));
                      setCombinedForm((prev) => ({ ...prev, claim_date_rule: 'HOLIDAY', custom_claim_dates: [] }));
                    }}
                  />
                  <span className="rtitle">Company Holiday</span>
                  <span className="rsub">Registered holiday calendar</span>
                </label>
                <label className={`lc-gender-radio-card ${combinedForm.claim_date_rule === 'CUSTOM' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="claim_date_rule"
                    checked={combinedForm.claim_date_rule === 'CUSTOM'}
                    onChange={() => {
                      setCombinedFieldErrors((prev) => ({ ...prev, claim_date_rule: undefined }));
                      setCombinedForm((prev) => ({ ...prev, claim_date_rule: 'CUSTOM' }));
                    }}
                  />
                  <span className="rtitle">Custom Dates</span>
                  <span className="rsub">HR-picked specific dates</span>
                </label>
              </div>
              {combinedFieldErrors.claim_date_rule && (
                <div className="lc-field-error">{combinedFieldErrors.claim_date_rule}</div>
              )}

              {combinedForm.claim_date_rule === 'CUSTOM' && (
                <div style={{ marginTop: '10px' }}>
                  <div className="lc-inline-edit-wrap" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <DatePicker
                      value={pendingCustomClaimDate}
                      onChange={setPendingCustomClaimDate}
                      placeholder="Select a date"
                      width="220px"
                      showClear={false}
                    />
                    <button
                      type="button"
                      className="lc-ghost-btn"
                      style={{ width: 'auto', padding: '0 12px' }}
                      onClick={() => {
                        if (!pendingCustomClaimDate) return;
                        const dateStr = toDateInputValue(pendingCustomClaimDate);
                        setCombinedFieldErrors((prev) => ({ ...prev, custom_claim_dates: undefined }));
                        setCombinedForm((prev) => ({
                          ...prev,
                          custom_claim_dates: Array.from(new Set([...prev.custom_claim_dates, dateStr])).sort(),
                        }));
                        setPendingCustomClaimDate(null);
                      }}
                    >
                      <Plus size={14} />
                      Add date
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {combinedForm.custom_claim_dates.length === 0 ? (
                      <span className="lc-checkrow-sub">No dates added yet.</span>
                    ) : (
                      combinedForm.custom_claim_dates.map((d) => (
                        <span key={d} className="lc-code-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {formatDate(d)}
                          <button
                            type="button"
                            aria-label={`Remove ${d}`}
                            onClick={() =>
                              setCombinedForm((prev) => ({
                                ...prev,
                                custom_claim_dates: prev.custom_claim_dates.filter((x) => x !== d),
                              }))
                            }
                            style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'inline-flex', padding: 0 }}
                          >
                            <X size={12} />
                          </button>
                        </span>
                      ))
                    )}
                  </div>
                  {combinedFieldErrors.custom_claim_dates && (
                    <div className="lc-field-error">{combinedFieldErrors.custom_claim_dates}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="ss-modal-form-group" style={{ marginBottom: '16px' }}>
              <div className="ss-modal-label" role="heading" aria-level="4">Entitlement Mode</div>
              <div className="lc-gender-radio-row">
                <label className={`lc-gender-radio-card ${!combinedForm.is_unlimited && !combinedForm.is_flexible ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="entitlement_mode"
                    checked={!combinedForm.is_unlimited && !combinedForm.is_flexible}
                    onChange={() => setEntitlementMode('LIMITED')}
                  />
                  <span className="rtitle">Limited</span>
                  <span className="rsub">Fixed entitled days</span>
                </label>
                <label className={`lc-gender-radio-card ${combinedForm.is_unlimited ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="entitlement_mode"
                    checked={combinedForm.is_unlimited}
                    onChange={() => setEntitlementMode('UNLIMITED')}
                  />
                  <span className="rtitle">Unlimited</span>
                  <span className="rsub">No balance validation</span>
                </label>
                <label className={`lc-gender-radio-card ${combinedForm.is_flexible ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="entitlement_mode"
                    checked={combinedForm.is_flexible}
                    onChange={() => setEntitlementMode('FLEXIBLE')}
                  />
                  <span className="rtitle">Flexible</span>
                  <span className="rsub">Entitled days cap, overrideable with justification</span>
                </label>
              </div>
            </div>
          )}

          <div className="lc-modal-grid">
            <div className="ss-modal-form-group">
              {(() => {
                const isClaimTarget = combinedForm.category !== 'CLAIM' && claimTargetCodes.has(combinedForm.code);
                const isRequired = !combinedForm.is_unlimited && combinedForm.category !== 'CLAIM' && !isClaimTarget;
                return (
                  <>
                    <label
                      className={`ss-modal-label ${isRequired ? 'ss-modal-label-required' : ''}`}
                      htmlFor="lt-entitled"
                    >
                      Entitled Days
                    </label>
                    {combinedForm.category === 'CLAIM' ? (
                      <div className="lc-locked-field" title="Not applicable — Claim leave types have no entitlement cap">
                        Not applicable
                      </div>
                    ) : combinedForm.is_unlimited ? (
                      <div className="lc-locked-field" title="Not applicable — this leave type is unlimited">
                        Unlimited
                      </div>
                    ) : (
                      <>
                        {isClaimTarget && (
                          <div className="lc-checkrow-sub" style={{ marginBottom: '6px' }}>
                            Credited by a Claim leave type — balance is earned via approved
                            claims. Optional base allocation on top of that; defaults to 0.
                          </div>
                        )}
                        <input
                          id="lt-entitled"
                          type="number"
                          className={`ss-input ${combinedFieldErrors.entitled_days ? 'has-error' : ''}`}
                          placeholder={isClaimTarget ? '0' : 'e.g. 10'}
                          value={combinedForm.entitled_days}
                          aria-invalid={!!combinedFieldErrors.entitled_days}
                          onChange={(e) => {
                            setCombinedFieldErrors((prev) => ({ ...prev, entitled_days: undefined }));
                            setCombinedForm((prev) => ({ ...prev, entitled_days: e.target.value }));
                          }}
                        />
                        {combinedFieldErrors.entitled_days && (
                          <div className="lc-field-error">{combinedFieldErrors.entitled_days}</div>
                        )}
                      </>
                    )}
                  </>
                );
              })()}
            </div>

            {combinedForm.category === 'ACTUAL' && (
              <>
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
              </>
            )}

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

          {combinedForm.category === 'NOMINAL' ? (
            <div className="lc-locked-field" title="Not applicable — Nominal leave types have no balance to carry forward or borrow against">
              Not applicable — Nominal leave types (e.g. WFH) have no balance impact,
              so there&apos;s nothing to carry forward or borrow against.
            </div>
          ) : (
            <>
              {/* Carry-forward: ACTUAL and CLAIM only */}
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

              {/* Advance leave borrowing: ACTUAL only */}
              {combinedForm.category === 'ACTUAL' && (
                <>
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
                </>
              )}
            </>
          )}
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
              <DatePicker
                id="lt-eff-from"
                value={parseDateValue(combinedForm.effective_from)}
                onChange={(value) => setCombinedForm((prev) => ({ ...prev, effective_from: toDateInputValue(value) }))}
                placeholder="Select date"
                width="100%"
                showClear={false}
              />
            </div>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-eff-to">Effective To</label>
              <DatePicker
                id="lt-eff-to"
                value={parseDateValue(combinedForm.effective_to)}
                onChange={(value) => setCombinedForm((prev) => ({ ...prev, effective_to: toDateInputValue(value) }))}
                placeholder="Blank = ongoing"
                width="100%"
                showClear={true}
              />
            </div>
          </div>

          <div className="lc-toggle-field">
            <div>
              <div className="lc-toggle-field-label">Requires Work Location for Leave Type</div>
              <div className="lc-toggle-field-hint">
                Optional — only turn on for leave types tied to a specific work location.
                Leave off for types anyone can apply for regardless of work location.
              </div>
            </div>
            <Toggle
              checked={combinedForm.requires_work_location}
              onChange={(v) =>
                setCombinedForm((prev) => ({
                  ...prev,
                  requires_work_location: v,
                  required_location: v ? prev.required_location : '',
                }))
              }
              ariaLabel="Requires Work Location for Leave Type"
            />
          </div>
          {combinedForm.requires_work_location && (
            <div className="ss-modal-form-group" style={{ marginBottom: '14px' }}>
              <label className="ss-modal-label">Work Location Type</label>
              <Select
                value={combinedForm.required_location === '' ? '' : String(combinedForm.required_location)}
                onChange={(v) => setCombinedForm((prev) => ({ ...prev, required_location: v }))}
                options={workLocations.map((loc) => ({ value: String(loc.id), label: loc.name }))}
                placeholder="Select Work Location"
                width="260px"
              />
              {combinedFieldErrors.required_location && (
                <div className="lc-field-error">{combinedFieldErrors.required_location}</div>
              )}
            </div>
          )}
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
        </div>
      </AdminModal>
    </div>
  );
}

export default LeaveConfigurationPage;
