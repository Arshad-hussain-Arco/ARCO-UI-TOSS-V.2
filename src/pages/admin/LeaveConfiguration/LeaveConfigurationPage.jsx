import { useState, useEffect, useRef } from 'react';
import {
  Calendar,
  Check,
  ChevronDown,
  Edit,
  ListChecks,
  Plus,
  Search,
  Trash,
  X,
  RefreshCw,
  Loader2,
} from 'lucide-react';

import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { Select } from '@components/forms/Select/Select';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Toggle } from '@components/ui/Toggle/Toggle';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useToast } from '@hooks/useToast';
import { useDebounce } from '@hooks/useDebounce';
import { leaveService } from '@services/leaveService';
import { Loader } from '@components/feedback/Loader/Loader';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
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

function computeDayOfWeek(dateStrVal) {
  if (!dateStrVal) return '';
  const d = parseDateValue(dateStrVal);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function dateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function eachDay(s, e) {
  const days = [];
  const cur = new Date(s);
  cur.setHours(0, 0, 0, 0);
  const fin = new Date(e);
  fin.setHours(0, 0, 0, 0);
  while (cur <= fin) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function formatHolidayDates(dates) {
  if (!dates || dates.length === 0) return '';
  if (dates.length === 1) return formatDate(dates[0]);

  // Sort dates asc
  const sorted = [...dates].sort((a, b) => new Date(a) - new Date(b));
  const start = sorted[0];
  const end = sorted[sorted.length - 1];

  const startD = new Date(start);
  const endD = new Date(end);

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  return `${fmt(startD)} - ${fmt(endD)}`;
}

function computeStatus(datesVal) {
  if (!datesVal) return 'Upcoming';
  const datesList = Array.isArray(datesVal) ? datesVal : [datesVal];
  if (datesList.length === 0) return 'Upcoming';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Sort dates
  const sorted = [...datesList].sort((a, b) => new Date(a) - new Date(b));
  const startD = new Date(sorted[0]);
  startD.setHours(0, 0, 0, 0);
  const endD = new Date(sorted[sorted.length - 1]);
  endD.setHours(0, 0, 0, 0);

  if (today >= startD && today <= endD) {
    return 'Ongoing';
  } else if (today < startD) {
    return 'Upcoming';
  } else {
    return 'Past';
  }
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
    allow_year_spanning: true,
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
    allow_year_spanning: p.allow_year_spanning ?? true,
    effective_from: p.effective_from || toDateInputValue(new Date()),
    effective_to: p.effective_to || '',
  };
}

/** Build the API payload from the form, numeric-coercing and dropping empty-string optionals to null. */
function combinedFormToPayload(form, isClaimTarget) {
  const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  const carryForwardEligible = (
    form.category === 'ACTUAL' && ((!form.is_unlimited && !form.is_flexible) || isClaimTarget)
  );
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
    // Accrual Type only applies to an Actual leave type that isn't itself
    // credited by a Claim type — its balance already comes from approved
    // claims, so force the default rather than trust stale form state.
    accrual_type: isClaimTarget ? 'NONE' : form.accrual_type,
    proration_type: form.proration_type,
    // Carry-forward: Limited-entitlement Actual types, or an Actual type
    // that's a Claim credit target (regardless of mode) — mirrors
    // year_end_processing.py's eligibility. Force off rather than trust
    // stale form state left over from a prior category/mode.
    is_carry_forward_allowed: carryForwardEligible ? form.is_carry_forward_allowed : false,
    max_carry_forward: (carryForwardEligible && form.is_carry_forward_allowed)
      ? Number(form.max_carry_forward) || 0 : 0,
    carry_forward_expiry_months: (carryForwardEligible && form.is_carry_forward_allowed)
      ? numOrNull(form.carry_forward_expiry_months)
      : null,
    // Advance leave (negative balance) only applies to a Limited-entitlement
    // Actual leave type that isn't itself credited by a Claim type — mirrors
    // the backend's LeavePolicyCreateSerializer.validate(). Force off rather
    // than trust stale form state left over from a prior category/mode.
    allow_negative: (
      form.category === 'ACTUAL' && !form.is_unlimited && !form.is_flexible && !isClaimTarget
    ) ? form.allow_negative : false,
    max_negative_days: (
      form.category === 'ACTUAL' && !form.is_unlimited && !form.is_flexible && !isClaimTarget && form.allow_negative
    ) ? Number(form.max_negative_days) || 0 : 0,
    // Year-spanning eligibility includes Unlimited (unlike allow_negative
    // above) — mirrors the backend's _is_year_spanning_eligible. Meaningless
    // for an ineligible type, so force the permissive default rather than
    // trust stale form state.
    allow_year_spanning: (
      form.category === 'ACTUAL' && !form.is_flexible && !isClaimTarget
    ) ? form.allow_year_spanning : true,
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
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          tabIndex={-1}
        >
          <ChevronDown size={14} style={{ pointerEvents: 'none' }} />
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

  // Navigation tab state: 'holidays' | 'leave-types-policies' | 'overlap-policies' | 'work-schedule'
  const [activeTab, setActiveTab] = useState('holidays');

  const [holidays, setHolidays] = useState([]);
  // Each row is the combined shape returned by /hr/leave-types-with-policy/:
  // { code, name, leave_type: {...}, policy: {...} | null }
  const [combinedLeaveTypes, setCombinedLeaveTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  // Error from the primary Leave Types & Policies fetch — the core dataset
  // this page can't function without. Other secondary fetches (holidays,
  // work locations, summary, overlap policies) keep their own toast-only
  // error handling below.
  const [leaveTypesError, setLeaveTypesError] = useState(null);

  // Overlap Adjustment Policy rules — { id, source_leave_types, source_leave_type_codes,
  // target_leave_types, target_leave_type_codes, is_active, notes }
  const [overlapPolicies, setOverlapPolicies] = useState([]);
  const [isOverlapModalOpen, setIsOverlapModalOpen] = useState(false);
  const [editingOverlapPolicy, setEditingOverlapPolicy] = useState(null);
  const [overlapForm, setOverlapForm] = useState({ source_leave_types: [], target_leave_types: [], is_active: true, notes: '' });
  const [overlapFieldErrors, setOverlapFieldErrors] = useState({});

  // Work locations, for the "Requires Work Location" leave-type setting's dropdown
  const [workLocations, setWorkLocations] = useState([]);

  // Work Schedule State — static options, not fetched from backend
  const workScheduleOptions = WORK_SCHEDULE_OPTIONS;
  const [selectedCustomDays, setSelectedCustomDays] = useState([]);
  const [workScheduleSummary, setWorkScheduleSummary] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // Fetch Holidays — runs once on mount, not gated to the active tab, so all
  // tabs' data is ready as soon as the page loads.
  useEffect(() => {
    let active = true;
    const fetchHolidays = async () => {
      setIsLoading(true);
      try {
        const hData = await leaveService.listHolidays();
        const mappedHolidays = (hData || []).map(h => ({
          ...h,
          id: h.id,
          name: h.holiday_name || h.name,
          dates: h.dates || (h.date ? [h.date] : []),
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
          if (data?.meta?.distinct_schedules === 1) {
            const group = data.results[0];
            let days = [];
            if (group.work_schedule === 'MON_FRI') {
              days = [5, 6];
            } else if (group.work_schedule === 'MON_SAT') {
              days = [6];
            } else if (group.work_schedule === 'SUN_THU') {
              days = [4, 5];
            } else if (group.custom_weekend_days) {
              let parsed = group.custom_weekend_days;
              if (typeof parsed === 'string') {
                try { parsed = JSON.parse(parsed); }
                catch (e) { parsed = parsed.split(',').map(s => s.trim()); }
              }
              if (Array.isArray(parsed)) days = parsed.map(Number);
            }
            if (days.length > 0) setSelectedCustomDays(days);
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
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Leave Types + Policies Fetch & Search Effect
  const fetchCombinedLeaveTypes = async () => {
    setIsLoading(true);
    setLeaveTypesError(null);
    try {
      const res = await leaveService.getLeaveTypesWithPolicy();
      setCombinedLeaveTypes(res || []);
    } catch (err) {
      console.error('Failed to load leave types & policies', err);
      toast.error('Error loading leave types & policies');
      setLeaveTypesError(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch Leave Types + Policies — runs once on mount alongside the other tabs' data.
  // This is the primary/core dataset for this page (Leave Policy Management).
  useEffect(() => {
    let active = true;
    const run = async () => {
      setIsLoading(true);
      setLeaveTypesError(null);
      try {
        const res = await leaveService.getLeaveTypesWithPolicy();
        if (active) setCombinedLeaveTypes(res || []);
      } catch (err) {
        console.error('Failed to load leave types & policies', err);
        toast.error('Error loading leave types & policies');
        if (active) setLeaveTypesError(err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, []);

  // Fetch Overlap Adjustment Policies — runs once on mount alongside the other tabs' data.
  const fetchOverlapPolicies = async () => {
    setIsLoading(true);
    try {
      const res = await leaveService.getOverlapPolicies();
      setOverlapPolicies(res || []);
    } catch (err) {
      console.error('Failed to load overlap adjustment policies', err);
      toast.error('Error loading overlap adjustment policies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverlapPolicies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openAddOverlapModal() {
    setEditingOverlapPolicy(null);
    setOverlapForm({ source_leave_types: [], target_leave_types: [], is_active: true, notes: '' });
    setOverlapFieldErrors({});
    setIsOverlapModalOpen(true);
  }

  function openEditOverlapModal(rule) {
    setEditingOverlapPolicy(rule);
    setOverlapForm({
      source_leave_types: rule.source_leave_types || [],
      target_leave_types: rule.target_leave_types || [],
      is_active: rule.is_active ?? true,
      notes: rule.notes || '',
    });
    setOverlapFieldErrors({});
    setIsOverlapModalOpen(true);
  }

  function toggleOverlapFormType(field, id) {
    setOverlapFieldErrors((prev) => ({ ...prev, [field]: undefined, non_field: undefined }));
    setOverlapForm((prev) => {
      const current = prev[field];
      const next = current.includes(id) ? current.filter((v) => v !== id) : [...current, id];
      return { ...prev, [field]: next };
    });
  }

  function validateOverlapForm(form) {
    const errors = {};
    if (!form.target_leave_types || form.target_leave_types.length === 0) {
      errors.target_leave_types = 'At least one target leave type is required.';
    }
    const overlapping = (form.source_leave_types || []).filter((id) => (form.target_leave_types || []).includes(id));
    if (overlapping.length > 0) {
      const codes = combinedLeaveTypes
        .filter((row) => overlapping.includes(row.leave_type?.id))
        .map((row) => row.code)
        .join(', ');
      errors.non_field = `A leave type cannot be both source and target on the same rule: ${codes}.`;
    }
    return errors;
  }

  async function handleSaveOverlapPolicy() {
    const errors = validateOverlapForm(overlapForm);
    setOverlapFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setIsSaving(true);
    try {
      const payload = {
        source_leave_types: overlapForm.source_leave_types,
        target_leave_types: overlapForm.target_leave_types,
        is_active: overlapForm.is_active,
        notes: overlapForm.notes,
      };
      if (editingOverlapPolicy) {
        await leaveService.updateOverlapPolicy(editingOverlapPolicy.id, payload);
        toast.success('Overlap adjustment policy updated');
      } else {
        await leaveService.createOverlapPolicy(payload);
        toast.success('Overlap adjustment policy created');
      }
      setIsOverlapModalOpen(false);
      await fetchOverlapPolicies();
    } catch (err) {
      console.error('Failed to save overlap adjustment policy', err);
      const detail = err?.response?.data;
      toast.error(typeof detail === 'string' ? detail : (detail?.non_field_errors?.[0] || 'Error saving overlap adjustment policy'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleOverlapActive(rule, value) {
    try {
      await leaveService.updateOverlapPolicy(rule.id, { is_active: value });
      setOverlapPolicies((prev) => prev.map((r) => (r.id === rule.id ? { ...r, is_active: value } : r)));
    } catch (err) {
      console.error('Failed to toggle overlap adjustment policy', err);
      toast.error('Error updating overlap adjustment policy');
    }
  }

  const handleDeleteOverlapPolicy = (rule) => {
    setDeleteTargetOverlap(rule);
  };

  const executeDeleteOverlapPolicy = async () => {
    if (!deleteTargetOverlap) return;
    setIsSaving(true);
    try {
      await leaveService.deleteOverlapPolicy(deleteTargetOverlap.id);
      toast.success('Overlap adjustment policy deactivated');
      await fetchOverlapPolicies();
      setDeleteTargetOverlap(null);
    } catch (err) {
      console.error('Failed to deactivate overlap adjustment policy', err);
      toast.error('Error deactivating overlap adjustment policy');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Target states
  const [deleteTargetHoliday, setDeleteTargetHoliday] = useState(null);
  const [deleteTargetCombined, setDeleteTargetCombined] = useState(null);
  const [deleteTargetOverlap, setDeleteTargetOverlap] = useState(null);

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
    startDate: '',
    endDate: '',
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
    setHolidayForm({
      name: '',
      startDate: '',
      endDate: '',
      day: '',
      type: 'Public Holiday',
      status: '',
      description: '',
    });
    setIsHolidayModalOpen(true);
  };

  const openEditHolidayModal = (h) => {
    setEditingHoliday(h);
    setHolidayForm({
      ...h,
      startDate: h.date || '',
      endDate: h.date || '',
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
    if (!holidayForm.name || !holidayForm.startDate) {
      toast.error('Please enter holiday name and date');
      return;
    }

    setIsSaving(true);

    // Generate dates list from startDate to endDate
    const datesList = [];
    if (holidayForm.startDate) {
      const targetEnd = holidayForm.endDate || holidayForm.startDate;
      const startD = parseDateValue(holidayForm.startDate);
      const endD = parseDateValue(targetEnd);
      if (startD && endD) {
        eachDay(startD, endD).forEach((d) => {
          datesList.push(dateStr(d));
        });
      }
    }

    const payload = {
      holiday_name: holidayForm.name,
      dates: datesList.length > 0 ? datesList : [holidayForm.startDate],
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
        dates: h.dates || (h.date ? [h.date] : []),
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyWorkSchedule = async () => {
    try {
      if (selectedCustomDays.length === 0) {
        toast.error('Please select at least one weekend day');
        return;
      }
      setIsSaving(true);
      const payload = { work_schedule: 'CUSTOM', custom_weekend_days: selectedCustomDays };

      const response = await leaveService.bulkUpdateEmployeeProfiles(payload, { all: true });
      toast.success(`Work schedule applied! Updated ${response.updated} employees.`);

      // Refresh the summary
      const data = await leaveService.getWorkScheduleSummary();
      setWorkScheduleSummary(data);
      if (data?.meta?.distinct_schedules === 1) {
        const group = data.results[0];
        let days = [];
        if (group.work_schedule === 'MON_FRI') {
          days = [5, 6];
        } else if (group.work_schedule === 'MON_SAT') {
          days = [6];
        } else if (group.work_schedule === 'SUN_THU') {
          days = [4, 5];
        } else if (group.custom_weekend_days) {
          let parsed = group.custom_weekend_days;
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); }
            catch (e) { parsed = parsed.split(',').map(s => s.trim()); }
          }
          if (Array.isArray(parsed)) days = parsed.map(Number);
        }
        if (days.length > 0) setSelectedCustomDays(days);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply work schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHoliday = (holiday) => {
    setDeleteTargetHoliday(holiday);
  };

  const executeDeleteHoliday = async () => {
    if (!deleteTargetHoliday) return;
    setIsSaving(true);
    try {
      await leaveService.deleteHoliday(deleteTargetHoliday.id, { emp_id: 10 });
      setHolidays((prev) => prev.filter((h) => h.id !== deleteTargetHoliday.id));
      toast.success(`Deleted holiday: ${deleteTargetHoliday.name}`);
      setDeleteTargetHoliday(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete holiday');
    } finally {
      setIsSaving(false);
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

    const payload = combinedFormToPayload(combinedForm, claimTargetCodes.has(combinedForm.code));

    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCombined = (row) => {
    setDeleteTargetCombined(row);
  };

  const executeDeleteCombined = async () => {
    if (!deleteTargetCombined) return;
    setIsSaving(true);
    try {
      await leaveService.deleteLeaveTypeWithPolicy(deleteTargetCombined.code);
      toast.success(`Deactivated ${deleteTargetCombined.name}`);
      fetchCombinedLeaveTypes();
      setDeleteTargetCombined(null);
    } catch (err) {
      toast.error('Failed to deactivate leave type');
      console.error(err);
    } finally {
      setIsSaving(false);
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
      // Advance-leave borrowing only applies to Limited entitlement; reset
      // when switching away so a hidden, stale "on" doesn't ship.
      ...(mode !== 'LIMITED' ? { allow_negative: false, max_negative_days: 0 } : {}),
      // Year-spanning eligibility includes Unlimited (unlike advance-leave
      // borrowing above) — only Flexible needs a reset here.
      ...(mode === 'FLEXIBLE' ? { allow_year_spanning: true } : {}),
      // Carry-forward stays eligible in any mode for a Claim credit target
      // (e.g. WW/CompOff) — only reset for a non-claim-target type leaving
      // Limited mode.
      ...(mode !== 'LIMITED' && !claimTargetCodes.has(prev.code)
        ? { is_carry_forward_allowed: false, max_carry_forward: 0, carry_forward_expiry_months: '' }
        : {}),
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
      (h.name || '').toLowerCase().includes((debouncedSearchQuery || '').toLowerCase()) ||
      (h.type || '').toLowerCase().includes((debouncedSearchQuery || '').toLowerCase()),
  );

  const filteredCombinedLeaveTypes = combinedLeaveTypes.filter((row) => {
    const q = (debouncedSearchQuery || '').toLowerCase();
    return (
      (row.name || '').toLowerCase().includes(q) ||
      (row.code || '').toLowerCase().includes(q)
    );
  });

  if (leaveTypesError) {
    return (
      <ErrorState
        title="Leave policies could not be loaded"
        description={leaveTypesError.message}
        onRetry={fetchCombinedLeaveTypes}
      />
    );
  }

  return (
    <div className="lc-redesign-container">
      {/* ── Header ────────────────────────────────────────────────────────── */}


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
          role="tab"
          aria-selected={activeTab === 'overlap-policies'}
          className={`lc-tab-btn ${activeTab === 'overlap-policies' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('overlap-policies');
            setSearchQuery('');
          }}
        >
          <ListChecks size={16} />
          <span>Overlap Policies</span>
          <span className="lc-tab-count">{overlapPolicies?.length || 0}</span>
        </button>

        <button
          type="button"
          className={`lc-tab-btn ${activeTab === 'work-schedule' ? 'active' : ''}`}
          onClick={() => { setActiveTab('work-schedule'); setSearchQuery(''); }}
        >
          <Calendar size={16} />
          <span>Weekend Configurations</span>
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
          <option value="overlap-policies">Overlap Policies ({overlapPolicies?.length || 0})</option>
          <option value="work-schedule">weekend configurations</option>
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
                {searchQuery && (
                  <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
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
                                  minDate={new Date()}
                                  placeholder="Select date"
                                  width="100%"
                                  showClear={false}
                                />
                              </div>
                            ) : (
                              formatHolidayDates(h.dates && h.dates.length > 0 ? h.dates : h.date ? [h.date] : [])
                            )}
                          </td>
                          <td style={{ color: 'var(--text-secondary)' }}>
                            {isEditing ? computeDayOfWeek(holidayEditForm.date) : (h.dates && h.dates.length > 1 ? 'Multiple Days' : computeDayOfWeek(h.date || (h.dates && h.dates[0])))}
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
                              (() => {
                                const stat = computeStatus(holidayEditForm.date);
                                const cls = stat === 'Ongoing' ? 'lc-tag-ongoing' : stat === 'Upcoming' ? 'lc-tag-upcoming' : 'lc-tag-past';
                                return <span className={cls}>{stat}</span>;
                              })()
                            ) : (
                              (() => {
                                const targetDates = h.dates && h.dates.length > 0 ? h.dates : h.date ? [h.date] : [];
                                const stat = computeStatus(targetDates);
                                const cls = stat === 'Ongoing' ? 'lc-tag-ongoing' : stat === 'Upcoming' ? 'lc-tag-upcoming' : 'lc-tag-past';
                                return <span className={cls}>{stat}</span>;
                              })()
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
                              <div style={{ display: 'inline-flex', gap: '4px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="lc-inline-btn save"
                                  title="Save Changes"
                                  style={{ width: '32px', height: '32px', borderRadius: '6px' }}
                                  onClick={() => handleSaveHolidayInlineEdit(h.id)}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  type="button"
                                  className="lc-inline-btn cancel"
                                  title="Cancel"
                                  style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'var(--surface-primary)', border: '1px solid var(--border-secondary)', color: 'var(--c-danger)' }}
                                  onClick={cancelHolidayInlineEdit}
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                {(() => {
                                  const targetDates = h.dates && h.dates.length > 0 ? h.dates : h.date ? [h.date] : [];
                                  const stat = computeStatus(targetDates);
                                  const canModify = stat === 'Upcoming';
                                  
                                  return canModify ? (
                                    <>
                                      <button
                                        type="button"
                                        className="action-icon-btn edit"
                                        title="Edit Holiday"
                                        onClick={() => startHolidayInlineEdit(h)}
                                      >
                                        <Edit size={15} />
                                      </button>
                                      <button
                                        type="button"
                                        className="action-icon-btn delete"
                                        title="Delete Holiday"
                                        onClick={() => handleDeleteHoliday(h)}
                                      >
                                        <Trash size={15} />
                                      </button>
                                    </>
                                  ) : (
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', paddingLeft: '4px' }}>
                                      No Modification
                                    </span>
                                  );
                                })()}
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
                {searchQuery && (
                  <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
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
                                className="action-icon-btn edit"
                                title="Edit Leave Type & Policy"
                                onClick={() => openEditCombinedModal(row)}
                              >
                                <Edit size={15} />
                              </button>
                              <button
                                type="button"
                                className="action-icon-btn delete"
                                title="Deactivate Leave Type & Policy"
                                onClick={() => handleDeleteCombined(row)}
                              >
                                <Trash size={15} />
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
        {/* ── TAB: OVERLAP ADJUSTMENT POLICIES ── */}
        {activeTab === 'overlap-policies' && (
          <div className="lc-card-panel">
            <div className="lc-card-toolbar">
              <div className="lc-search-box">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="Search source or target leave type codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <button type="button" className="lc-btn-primary" onClick={openAddOverlapModal}>
                <Plus size={16} />
                Add Overlap Policy
              </button>
            </div>

            <div className="lc-table-responsive">
              <table className="lc-data-table">
                <thead>
                  <tr>
                    <th>Source Leave Type</th>
                    <th>Target Leave Type</th>
                    <th>Notes</th>
                    <th>Active Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={5}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                          <Loader message="Loading overlap adjustment policies..." />
                        </div>
                      </td>
                    </tr>
                  ) : overlapPolicies.filter((r) => {
                    const q = searchQuery.trim().toLowerCase();
                    if (!q) return true;
                    const sourceText = (r.source_leave_type_codes || []).join(' ').toLowerCase() || 'any';
                    const targetText = (r.target_leave_type_codes || []).join(' ').toLowerCase();
                    return sourceText.includes(q) || targetText.includes(q);
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="lc-empty-state">
                        No overlap adjustment policies match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    overlapPolicies
                      .filter((r) => {
                        const q = searchQuery.trim().toLowerCase();
                        if (!q) return true;
                        const sourceText = (r.source_leave_type_codes || []).join(' ').toLowerCase() || 'any';
                        const targetText = (r.target_leave_type_codes || []).join(' ').toLowerCase();
                        return sourceText.includes(q) || targetText.includes(q);
                      })
                      .map((rule) => {
                        const sourceLabel = (rule.source_leave_type_codes || []).join(', ') || 'Any';
                        const targetLabel = (rule.target_leave_type_codes || []).join(', ');
                        return (
                          <tr key={rule.id}>
                            <td>
                              <span className="lc-code-badge">{sourceLabel}</span>
                            </td>
                            <td>
                              <span className="lc-code-badge">{targetLabel}</span>
                            </td>
                            <td >{rule.notes || '—'}</td>
                            <td>
                              <Toggle
                                checked={rule.is_active}
                                onChange={(val) => handleToggleOverlapActive(rule, val)}
                                ariaLabel={`Toggle active status for ${sourceLabel} to ${targetLabel}`}
                              />
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  className="action-icon-btn edit"
                                  title="Edit Overlap Policy"
                                  onClick={() => openEditOverlapModal(rule)}
                                >
                                  <Edit size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="action-icon-btn delete"
                                  title="Deactivate Overlap Policy"
                                  onClick={() => handleDeleteOverlapPolicy(rule)}
                                >
                                  <Trash size={15} />
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
          <div className="lc-card-panel" style={{ flex: 'none' }}>
            <div style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '16px' }}>weekend configurations Settings</h3>

              {isSummaryLoading ? (
                <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
                  <Loader message="Loading current schedule..." />
                </div>
              ) : (
                <>
                  {workScheduleSummary?.meta?.distinct_schedules > 1 && (
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
                              padding: '10px 16px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)',
                              borderRadius: '8px',
                            }}
                          >
                            <div>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {getScheduleLabel(group.work_schedule)}
                              </span>
                              {group.work_schedule === 'CUSTOM' && group.custom_weekend_days && (
                                <span style={{ fontSize: '13px', color: 'var(--text-primary)', marginLeft: '8px' }}>
                                  ({formatCustomWeekendDays(group.custom_weekend_days)})
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                              {group.employee_count} employee{group.employee_count === 1 ? '' : 's'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="ss-modal-form-group">
                      <div style={{ marginBottom: '20px' }}>
                        <label className="ss-modal-label" style={{ marginBottom: '4px', display: 'block' }}>Select Weekend Days</label>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {workScheduleOptions.custom_weekend_days?.description || 'Select the days that constitute a weekend.'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {(workScheduleOptions.custom_weekend_days?.days || []).map((day) => {
                          const isSelected = selectedCustomDays.includes(day.value);
                          return (
                            <label
                              key={day.value}
                              htmlFor={`ws-weekend-day-${day.value}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '12px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                                color: 'var(--text-primary)',
                                userSelect: 'none'
                              }}
                            >
                              <input
                                id={`ws-weekend-day-${day.value}`}
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedCustomDays([...selectedCustomDays, day.value]);
                                  } else {
                                    setSelectedCustomDays(selectedCustomDays.filter(d => d !== day.value));
                                  }
                                }}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  accentColor: 'var(--c-primary)',
                                  cursor: 'pointer'
                                }}
                              />
                              <span>{day.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-secondary)', paddingTop: '24px' }}>
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
                </>
              )}
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
              onClick={() => setIsHolidayModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button type="button" className="lc-btn-primary" onClick={handleSaveHoliday} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isSaving ? <><Loader2 size={16} className="spin-animation" /> Saving...</> : 'Save Holiday'}
            </button>
          </>
        }
      >
        <div className="lc-modal-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {/* Holiday Name */}
          <div className="ss-modal-form-group" style={{ gridColumn: 'span 2' }}>
            <label className="ss-modal-label ss-modal-label-required" htmlFor="holiday-name" style={{ fontSize: '13px', fontWeight: '600', }}>
              Holiday Name
            </label>
            <input
              id="holiday-name"
              type="text"
              className="ss-input"
              style={{
                width: '100%',
                padding: '0 12px',
                height: '38px',
                border: '1px solid var(--border-secondary)',
                borderRadius: '6px',
                fontSize: '13px'
              }}
              value={holidayForm.name}
              placeholder="e.g. Founding Day"
              onChange={(e) => setHolidayForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Start Date */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label ss-modal-label-required" htmlFor="holiday-start-date" style={{ fontSize: '13px', fontWeight: '600', }}>
              Start Date
            </label>
            <DatePicker
              value={parseDateValue(holidayForm.startDate)}
              onChange={(value) => {
                const dateStrVal = toDateInputValue(value);
                setHolidayForm((prev) => {
                  const updated = {
                    ...prev,
                    startDate: dateStrVal,
                    day: computeDayOfWeek(dateStrVal),
                    status: computeStatus(dateStrVal)
                  };
                  if (prev.endDate && parseDateValue(prev.endDate) < value) {
                    updated.endDate = dateStrVal;
                  }
                  return updated;
                });
              }}
              minDate={new Date()}
              placeholder="Select start date"
              width="100%"
              style={{
                padding: '0 12px',
                height: '38px',
                border: '1px solid var(--border-secondary)',
                borderRadius: '6px',
                fontSize: '13px'
              }}
              showClear={false}
            />
          </div>

          {/* End Date */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label ss-modal-label-required" htmlFor="holiday-end-date" style={{ fontSize: '13px', fontWeight: '600', }}>
              End Date
            </label>
            <DatePicker
              value={parseDateValue(holidayForm.endDate)}
              onChange={(value) => {
                const dateStrVal = toDateInputValue(value);
                setHolidayForm((prev) => ({
                  ...prev,
                  endDate: dateStrVal
                }));
              }}
              minDate={parseDateValue(holidayForm.startDate) || new Date()}
              placeholder="Select end date"
              width="100%"
              style={{
                padding: '0 12px',
                height: '38px',
                border: '1px solid var(--border-secondary)',
                borderRadius: '6px',
                fontSize: '13px'
              }}
              showClear={false}
            />
          </div>

          {/* Computed Day & Status Row */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="holiday-computed-day" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Day of Week (Computed)
            </label>
            <div
              id="holiday-computed-day"
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '38px',
                padding: '0 12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-secondary)',
                borderRadius: '6px',
                fontSize: '13px',
                color: holidayForm.startDate ? 'var(--text-secondary)' : 'var(--text-tertiary)',
                fontWeight: 500
              }}
            >
              {holidayForm.startDate ? (
                holidayForm.endDate && holidayForm.endDate !== holidayForm.startDate ? (
                  'Multiple Days'
                ) : (
                  computeDayOfWeek(holidayForm.startDate)
                )
              ) : (
                'Day of Week will be computed'
              )}
            </div>
          </div>

          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="holiday-computed-status" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Status (Computed)
            </label>
            <div
              id="holiday-computed-status"
              style={{
                display: 'flex',
                alignItems: 'center',
                height: '38px',
                padding: '0 12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-secondary)',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              {holidayForm.startDate ? (
                computeStatus(holidayForm.startDate) === 'Upcoming' ? (
                  <span className="lc-tag-upcoming" style={{ fontSize: '11px', padding: '2px 8px' }}>Upcoming</span>
                ) : (
                  <span className="lc-tag-past" style={{ fontSize: '11px', padding: '2px 8px' }}>Past</span>
                )
              ) : (
                <span style={{ color: 'var(--text-tertiary)' }}>Status will be computed</span>
              )}
            </div>
          </div>

          {/* Holiday Type */}
          <div className="ss-modal-form-group" style={{ gridColumn: 'span 2' }}>
            <label className="ss-modal-label" htmlFor="holiday-type" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
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
          <div className="ss-modal-form-group" style={{ gridColumn: 'span 2' }}>
            <label className="ss-modal-label" htmlFor="holiday-description" style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)' }}>
              Description
            </label>
            <input
              id="holiday-description"
              type="text"
              className="ss-input"
              style={{
                width: '100%',
                padding: '0 12px',
                height: '38px',
                border: '1px solid var(--border-secondary)',
                borderRadius: '6px',
                fontSize: '13px'
              }}
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
              disabled={isSaving}
            >
              Cancel
            </button>
            <button type="button" className="lc-btn-primary" onClick={handleSaveCombined} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isSaving ? <><Loader2 size={16} className="spin-animation" /> Saving...</> : 'Save Leave Type'}
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
                      // Carry-forward only applies to ACTUAL now (CLAIM types
                      // themselves don't hold a real balance); reset when
                      // switching away so a hidden, stale "on" doesn't ship.
                      ...(category !== 'ACTUAL'
                        ? { is_carry_forward_allowed: false, max_carry_forward: 0, carry_forward_expiry_months: '' }
                        : {}),
                      // Advance-leave borrowing only applies to ACTUAL; reset when
                      // switching away so a hidden, stale "on" doesn't ship.
                      ...(category !== 'ACTUAL'
                        ? { allow_negative: false, max_negative_days: 0 }
                        : {}),
                      // Year-spanning only applies to ACTUAL too (Unlimited is
                      // included within ACTUAL, unlike advance-leave above —
                      // this reset is purely about category, not mode).
                      ...(category !== 'ACTUAL' ? { allow_year_spanning: true } : {}),
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
                  {!claimTargetCodes.has(combinedForm.code) && (
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
                  )}

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
                      <option value="MONTHLY_DAYBAND">By join-day band (partial month credit)</option>
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

            {combinedForm.category !== 'ACTUAL' ? (
              <div className="lc-locked-field" title="Not applicable — only Actual leave types carry a balance to carry forward or borrow against">
                Not applicable — only Actual leave types (e.g. AL) have a
                balance to carry forward or borrow against.
              </div>
            ) : (
              <>
                {/* Carry-forward: Limited-entitlement Actual types, OR an
                  Actual type that's a Claim credit target (e.g. WW/CompOff,
                  credited by CWW/CCompOff) — those earn their balance via
                  approved claims rather than a flat grant, so the Limited-
                  mode restriction doesn't apply to them; carry-forward
                  still makes sense for whatever they've accumulated.
                  Unlimited/Flexible non-claim-target types are excluded —
                  mirrors year_end_processing.py's eligibility exactly. */}
                {((!combinedForm.is_unlimited && !combinedForm.is_flexible) || claimTargetCodes.has(combinedForm.code)) && (
                  <>
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
                  </>
                )}

                {/* Advance leave borrowing: Limited-entitlement Actual leave
                  types only, and not a leave type credited by a Claim type
                  (mirrors LeavePolicyCreateSerializer.validate()). Flexible
                  types already allow exceeding entitlement (with
                  justification) via their own mechanism, and a claim-earned
                  balance isn't something you borrow against. */}
                {combinedForm.category === 'ACTUAL'
                  && !combinedForm.is_unlimited
                  && !combinedForm.is_flexible
                  && !claimTargetCodes.has(combinedForm.code) && (
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

                {/* Year-spanning requests: Actual leave types only, Limited OR
                  Unlimited (unlike advance-leave above, Unlimited IS
                  included — there's no balance to protect either way), and
                  not a leave type credited by a Claim type. Mirrors the
                  backend's _is_year_spanning_eligible. */}
                {combinedForm.category === 'ACTUAL'
                  && !combinedForm.is_flexible
                  && !claimTargetCodes.has(combinedForm.code) && (
                    <label className="lc-checkrow" style={{ marginTop: '14px' }}>
                      <input
                        type="checkbox"
                        aria-label="Allow year spanning"
                        checked={combinedForm.allow_year_spanning}
                        onChange={(e) => setCombinedForm((prev) => ({ ...prev, allow_year_spanning: e.target.checked }))}
                      />
                      <span>
                        <span className="lc-checkrow-title">Allow year spanning</span>
                        <span className="lc-checkrow-sub">
                          Employees can apply for/modify leave that crosses into, or falls entirely within, next year
                        </span>
                      </span>
                    </label>
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

      {/* ── MODAL: Add / Edit Overlap Adjustment Policy ────────────────────── */}
      <AdminModal
        isOpen={isOverlapModalOpen}
        onClose={() => setIsOverlapModalOpen(false)}
        title={editingOverlapPolicy ? 'Edit Overlap Policy' : 'Add Overlap Policy'}
        subtitle="Configure which leave type's overlapping records get pushed, pulled, split, or rejected when another leave type is applied for."
        size="md"
        footer={
          <>
            <button
              type="button"
              className="lc-ghost-btn"
              style={{ padding: '0 16px', width: 'auto' }}
              onClick={() => setIsOverlapModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button type="button" className="lc-btn-primary" onClick={handleSaveOverlapPolicy} disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {isSaving ? <><Loader2 size={16} className="spin-animation" /> Saving...</> : 'Save Overlap Policy'}
            </button>
          </>
        }
      >
        <div className="lc-modal-grid" style={{ gridTemplateColumns: '1fr', gap: '16px' }}>
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" style={{ fontSize: '13px', fontWeight: '600', }}>
              Source Leave Type(s)
            </label>
            <div className="lc-checkbox-chip-list">
              {combinedLeaveTypes
                .filter((row) => (row.leave_type || {}).is_active)
                .map((row) => {
                  const id = row.leave_type?.id;
                  const checked = overlapForm.source_leave_types.includes(id);
                  const disabledByTarget = overlapForm.target_leave_types.includes(id);
                  return (
                    <label
                      key={`source-${row.code}`}
                      className={`lc-checkbox-chip ${checked ? 'checked' : ''} ${disabledByTarget ? 'disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabledByTarget}
                        onChange={() => toggleOverlapFormType('source_leave_types', id)}
                      />
                      <span>{row.code}</span>
                    </label>
                  );
                })}
            </div>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              Leave all unchecked ("Any leave type") to trigger this rule no matter what leave type is applied for.
            </p>
          </div>

          <div className="ss-modal-form-group">
            <label className="ss-modal-label ss-modal-label-required" style={{ fontSize: '13px', fontWeight: '600', }}>
              Target Leave Type(s)
            </label>
            <div className="lc-checkbox-chip-list">
              {combinedLeaveTypes
                .filter((row) => (row.leave_type || {}).is_active)
                .map((row) => {
                  const id = row.leave_type?.id;
                  const checked = overlapForm.target_leave_types.includes(id);
                  const disabledBySource = overlapForm.source_leave_types.includes(id);
                  return (
                    <label
                      key={`target-${row.code}`}
                      className={`lc-checkbox-chip ${checked ? 'checked' : ''} ${disabledBySource ? 'disabled' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabledBySource}
                        onChange={() => toggleOverlapFormType('target_leave_types', id)}
                      />
                      <span>{row.code}</span>
                    </label>
                  );
                })}
            </div>
            {overlapFieldErrors.target_leave_types && (
              <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>{overlapFieldErrors.target_leave_types}</p>
            )}
            {overlapFieldErrors.non_field && (
              <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>{overlapFieldErrors.non_field}</p>
            )}
            <p style={{ fontSize: '12px', marginTop: '4px' }}>
              These leave types' overlapping PENDING/APPROVED records get adjusted. A leave type can't be selected as both source and target.
            </p>
          </div>

          <div className="ss-modal-form-group">
            <label className="ss-modal-label" style={{ fontSize: '13px', fontWeight: '600', }}>
              Internal Notes
            </label>
            <textarea
              className="ss-input"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', minHeight: '70px' }}
              placeholder="Optional note for HR reference"
              value={overlapForm.notes}
              onChange={(e) => setOverlapForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className="ss-modal-form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Toggle
              checked={overlapForm.is_active}
              onChange={(val) => setOverlapForm((prev) => ({ ...prev, is_active: val }))}
              ariaLabel="Toggle overlap policy active status"
            />
            <span style={{ fontSize: '13px', fontWeight: 600, }}>Active</span>
          </div>
        </div>
      </AdminModal>

      {/* Confirm Delete Holiday Modal */}
      <AdminModal
        isOpen={!!deleteTargetHoliday}
        onClose={() => setDeleteTargetHoliday(null)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="lc-ghost-btn"
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--surface-primary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: '500',
                height: '36px',
                width: 'auto',
                fontSize: '13px'
              }}
              onClick={() => setDeleteTargetHoliday(null)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="lc-btn-primary"
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--c-danger)',
                color: '#fffff',
                cursor: 'pointer',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '36px',
                width: 'auto',
                fontSize: '13px'
              }}
              onClick={executeDeleteHoliday}
              disabled={isSaving}
            >
              {isSaving ? <><Loader2 size={16} className="spin-animation" /> Deleting...</> : 'Delete'}
            </button>
          </>
        }
      >
        <div style={{ padding: '16px 0', fontSize: '13px', color: 'var(--text-primary)' }}>
          Are you sure you want to delete the holiday <strong>{deleteTargetHoliday?.name}</strong>?
        </div>
      </AdminModal>

      {/* Confirm Delete Leave Type & Policy Modal */}
      <AdminModal
        isOpen={!!deleteTargetCombined}
        onClose={() => setDeleteTargetCombined(null)}
        title="Confirm Deactivation"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="lc-ghost-btn"
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--surface-primary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: '500',
                height: '36px',
                width: 'auto',
                fontSize: '13px'
              }}
              onClick={() => setDeleteTargetCombined(null)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="lc-btn-primary"
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--c-danger)',
                color: '#ffffff',
                cursor: 'pointer',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '36px',
                width: 'auto',
                fontSize: '13px'
              }}
              onClick={executeDeleteCombined}
              disabled={isSaving}
            >
              {isSaving ? <><Loader2 size={16} className="spin-animation" /> Deactivating...</> : 'Deactivate'}
            </button>
          </>
        }
      >
        <div style={{ padding: '16px 0', fontSize: '13px', color: 'var(--text-primary)' }}>
          Are you sure you want to deactivate <strong>{deleteTargetCombined?.name}</strong> and its policy?
        </div>
      </AdminModal>

      {/* Confirm Delete Overlap Policy Modal */}
      <AdminModal
        isOpen={!!deleteTargetOverlap}
        onClose={() => setDeleteTargetOverlap(null)}
        title="Confirm Deactivation"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="lc-ghost-btn"
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border-primary)',
                backgroundColor: 'var(--surface-primary)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontWeight: '500',
                height: '36px',
                width: 'auto',
                fontSize: '13px'
              }}
              onClick={() => setDeleteTargetOverlap(null)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="lc-btn-primary"
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: 'var(--c-danger)',
                color: '#ffffff',
                cursor: 'pointer',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                height: '36px',
                width: 'auto',
                fontSize: '13px'
              }}
              onClick={executeDeleteOverlapPolicy}
              disabled={isSaving}
            >
              {isSaving ? <><Loader2 size={16} className="spin-animation" /> Deactivating...</> : 'Deactivate'}
            </button>
          </>
        }
      >
        <div style={{ padding: '16px 0', fontSize: '13px', color: 'var(--text-primary)' }}>
          Are you sure you want to deactivate the rule <strong>{(deleteTargetOverlap?.source_leave_type_codes || []).join(', ') || 'Any'} &rarr; {(deleteTargetOverlap?.target_leave_type_codes || []).join(', ')}</strong>?
        </div>
      </AdminModal>
    </div>
  );
}

export default LeaveConfigurationPage;
