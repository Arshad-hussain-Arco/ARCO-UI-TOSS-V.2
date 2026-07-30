import { useState, useEffect, useRef } from 'react';
import {
  Building2,
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
import './LeaveConfigurationPage.css';

/* ── Pre-populated Initial Mock Data ── */

const INITIAL_HOLIDAYS = [
  {
    id: 'h1',
    name: "New Year's Day",
    date: '2026-01-01',
    day: 'Thursday',
    type: 'Public Holiday',
    status: 'Past',
    description: 'Saudi National Holiday celebrated with national festivities and public observance.',
  },
  {
    id: 'h2',
    name: 'Founding Day',
    date: '2026-02-22',
    day: 'Sunday',
    type: 'National Holiday',
    status: 'Upcoming',
    description: 'Commemorates the founding of the kingdom with a day off for all employees.',
  },
  {
    id: 'h3',
    name: 'Eid Al-Fitr Holiday',
    date: '2026-03-20',
    day: 'Friday',
    type: 'Public Holiday',
    status: 'Upcoming',
    description: 'Observed holiday for the Eid Al-Fitr celebration period across the organization.',
  },
  {
    id: 'h4',
    name: 'Eid Al-Adha Holiday',
    date: '2026-05-27',
    day: 'Wednesday',
    type: 'Public Holiday',
    status: 'Upcoming',
    description: 'Annual holiday aligned with the Eid Al-Adha observance and family gatherings.',
  },
  {
    id: 'h5',
    name: 'Saudi National Day',
    date: '2026-09-23',
    day: 'Wednesday',
    type: 'National Holiday',
    status: 'Upcoming',
    description: 'National day celebration marked as a public holiday for employees and leaders.',
  },
];

const INITIAL_LEAVE_TYPES = [
  {
    id: 'lt1',
    code: 'AL',
    name: 'Annual Leave',
    description: 'Standard paid annual vacation days entitlement for full-time employees.',
    maxDays: 24,
    paid: true,
    active: true,
  },
  {
    id: 'lt2',
    code: 'SL',
    name: 'Sick Leave',
    description: 'Medical and health leave with official medical certification.',
    maxDays: 14,
    paid: true,
    active: true,
  },
  {
    id: 'lt3',
    code: 'WFH',
    name: 'Work From Home',
    description: 'Remote work allocation allowed per employee calendar year.',
    maxDays: 12,
    paid: true,
    active: true,
  },
  {
    id: 'lt4',
    code: 'ML',
    name: 'Maternity Leave',
    description: 'Maternity leave allocation for eligible female staff members.',
    maxDays: 90,
    paid: true,
    active: true,
  },
  {
    id: 'lt5',
    code: 'PL',
    name: 'Paternity Leave',
    description: 'Paternity leave entitlement for eligible male staff members.',
    maxDays: 10,
    paid: true,
    active: true,
  },
  {
    id: 'lt6',
    code: 'CL',
    name: 'Compassionate Leave',
    description: 'Emergency family or bereavement leave entitlement.',
    maxDays: 5,
    paid: true,
    active: true,
  },
];

const INITIAL_POLICIES = [
  {
    id: 'p1',
    policyName: 'Standard Full-Time Vacation Policy',
    leaveCode: 'AL',
    appliesTo: 'All Full-time',
    accrualSchedule: 'Annual Frontload',
    entitlementDays: 24,
    carryForwardLimit: '5 Days',
  },
  {
    id: 'p2',
    policyName: 'Medical & Sick Leave Policy',
    leaveCode: 'SL',
    appliesTo: 'All Staff',
    accrualSchedule: 'Annual Frontload',
    entitlementDays: 14,
    carryForwardLimit: '0 Days',
  },
  {
    id: 'p3',
    policyName: 'Engineering & Product Remote Policy',
    leaveCode: 'WFH',
    appliesTo: 'Engineering & Product',
    accrualSchedule: 'Monthly Accrual (1 Day/mo)',
    entitlementDays: 12,
    carryForwardLimit: '2 Days',
  },
  {
    id: 'p4',
    policyName: 'Executive Leadership Vacation Policy',
    leaveCode: 'AL',
    appliesTo: 'Executive',
    accrualSchedule: 'Annual Frontload',
    entitlementDays: 30,
    carryForwardLimit: '10 Days',
  },
  {
    id: 'p5',
    policyName: 'Parental Care Entitlement Policy',
    leaveCode: 'PL',
    appliesTo: 'Eligible Male Staff',
    accrualSchedule: 'Event Based',
    entitlementDays: 10,
    carryForwardLimit: '0 Days',
  },
];

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

  // Navigation tab state: 'holidays' | 'leave-types' | 'policies'
  const [activeTab, setActiveTab] = useState('holidays');

  // Master Data State
  const [holidays, setHolidays] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState(INITIAL_LEAVE_TYPES);
  const [policies, setPolicies] = useState(INITIAL_POLICIES);

  // Fetch API Data
  useEffect(() => {
    const fetchData = async () => {
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
        }
      } catch (err) {
        console.error('Failed to load holidays:', err);
        toast({ title: 'Error loading data', type: 'error' });
      }
    };
    fetchData();
  }, [activeTab]);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // ── Inline Edit State for Policies ──────────────────────────────────────────
  const [editingPolicyId, setEditingPolicyId] = useState(null);
  const [editingDaysValue, setEditingDaysValue] = useState('');

  // ── Inline Edit State for Holidays / Leave Types ──────────────────────────
  const [editingHolidayId, setEditingHolidayId] = useState(null);
  const [holidayEditForm, setHolidayEditForm] = useState({
    name: '',
    date: '',
    day: '',
    type: 'Public Holiday',
    status: 'Upcoming',
    description: '',
  });

  const [editingLeaveTypeId, setEditingLeaveTypeId] = useState(null);
  const [leaveTypeEditForm, setLeaveTypeEditForm] = useState({
    code: '',
    name: '',
    description: '',
    maxDays: 10,
    paid: true,
    active: true,
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

  const [isLeaveTypeModalOpen, setIsLeaveTypeModalOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState(null);
  const [leaveTypeForm, setLeaveTypeForm] = useState({
    code: '',
    name: '',
    description: '',
    maxDays: 10,
    paid: true,
    active: true,
  });

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

  // ── Section 2: Leave Type Handlers ──────────────────────────────────────────
  const openAddLeaveTypeModal = () => {
    setEditingLeaveType(null);
    setLeaveTypeForm({
      code: '',
      name: '',
      description: '',
      maxDays: 12,
      paid: true,
      active: true,
    });
    setIsLeaveTypeModalOpen(true);
  };

  const startLeaveTypeInlineEdit = (lt) => {
    setEditingLeaveTypeId(lt.id);
    setLeaveTypeEditForm({ ...lt });
  };

  const cancelLeaveTypeInlineEdit = () => {
    setEditingLeaveTypeId(null);
    setLeaveTypeEditForm({
      code: '',
      name: '',
      description: '',
      maxDays: 10,
      paid: true,
      active: true,
    });
  };

  const handleSaveLeaveTypeInlineEdit = (id) => {
    if (!leaveTypeEditForm.code || !leaveTypeEditForm.name) {
      toast.error('Please enter leave code and name');
      return;
    }

    setLeaveTypes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...leaveTypeEditForm } : item)),
    );
    setEditingLeaveTypeId(null);
    toast.success(`Updated leave type: ${leaveTypeEditForm.name}`);
  };

  const handleSaveLeaveType = () => {
    if (!leaveTypeForm.code || !leaveTypeForm.name) {
      toast.error('Please enter leave code and name');
      return;
    }

    if (editingLeaveType) {
      setLeaveTypes((prev) =>
        prev.map((item) => (item.id === editingLeaveType.id ? { ...leaveTypeForm } : item)),
      );
      toast.success(`Updated leave type: ${leaveTypeForm.name}`);
    } else {
      const newLt = {
        ...leaveTypeForm,
        id: `lt-${Date.now()}`,
      };
      setLeaveTypes((prev) => [...prev, newLt]);
      toast.success(`Added leave type: ${leaveTypeForm.name}`);
    }
    setIsLeaveTypeModalOpen(false);
  };

  const handleDeleteLeaveType = (id) => {
    setLeaveTypes((prev) => prev.filter((lt) => lt.id !== id));
    toast.success('Leave type removed');
  };

  const handleToggleLeaveTypeActive = (id, checked) => {
    setLeaveTypes((prev) =>
      prev.map((item) => (item.id === id ? { ...item, active: checked } : item)),
    );
    toast.success('Active status updated');
  };

  // ── Section 3: Policy Inline Editing Handlers ────────────────────────────────
  const handleStartPolicyEdit = (p) => {
    setEditingPolicyId(p.id);
    setEditingDaysValue(String(p.entitlementDays));
  };

  const handleCancelPolicyEdit = () => {
    setEditingPolicyId(null);
    setEditingDaysValue('');
  };

  const handleSavePolicyEdit = (pId) => {
    const num = parseInt(editingDaysValue, 10);
    if (!isNaN(num) && num >= 0) {
      setPolicies((prev) =>
        prev.map((item) => (item.id === pId ? { ...item, entitlementDays: num } : item)),
      );
      toast.success('Policy entitlement days updated');
    }
    setEditingPolicyId(null);
    setEditingDaysValue('');
  };

  const handlePolicyKeyDown = (e, pId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSavePolicyEdit(pId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelPolicyEdit();
    }
  };

  // Filtered views based on search query
  const filteredHolidays = holidays.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredLeaveTypes = leaveTypes.filter(
    (lt) =>
      lt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lt.code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredPolicies = policies.filter(
    (p) =>
      p.policyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.leaveCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.appliesTo.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
          <span className="lc-tab-count">{holidays.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'leave-types'}
          className={`lc-tab-btn ${activeTab === 'leave-types' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('leave-types');
            setSearchQuery('');
          }}
        >
          <ListChecks size={16} />
          <span>Leave Types</span>
          <span className="lc-tab-count">{leaveTypes.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'policies'}
          className={`lc-tab-btn ${activeTab === 'policies' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('policies');
            setSearchQuery('');
          }}
        >
          <Building2 size={16} />
          <span>Organization Leave Policies</span>
          <span className="lc-tab-count">{policies.length}</span>
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
          <option value="holidays">Holidays ({holidays.length})</option>
          <option value="leave-types">Leave Types ({leaveTypes.length})</option>
          <option value="policies">Organization Leave Policies ({policies.length})</option>
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
                  {filteredHolidays.length === 0 ? (
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

        {/* ── TAB 2: LEAVE TYPES ── */}
        {activeTab === 'leave-types' && (
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
              <button type="button" className="lc-btn-primary" onClick={openAddLeaveTypeModal}>
                <Plus size={16} />
                Add Leave Type
              </button>
            </div>

            <div className="lc-table-responsive">
              <table className="lc-data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Leave Type Name</th>
                    <th>Description</th>
                    <th>Max Quota</th>
                    <th>Payment</th>
                    <th>Active Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeaveTypes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="lc-empty-state">
                        No leave types match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaveTypes.map((lt) => {
                      const isEditing = editingLeaveTypeId === lt.id;

                      return (
                        <tr key={lt.id}>
                          <td>
                            {isEditing ? (
                              <input
                                className="lc-inline-input"
                                style={{ width: '100%', minWidth: '70px' }}
                                value={leaveTypeEditForm.code}
                                onChange={(e) =>
                                  setLeaveTypeEditForm((prev) => ({ ...prev, code: e.target.value }))
                                }
                                autoFocus
                              />
                            ) : (
                              <span className="lc-code-badge">{lt.code}</span>
                            )}
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {isEditing ? (
                              <input
                                className="lc-inline-input"
                                style={{ width: '100%', minWidth: '150px' }}
                                value={leaveTypeEditForm.name}
                                onChange={(e) =>
                                  setLeaveTypeEditForm((prev) => ({ ...prev, name: e.target.value }))
                                }
                              />
                            ) : (
                              lt.name
                            )}
                          </td>
                          <td style={{ color: '#64748b', maxWidth: '300px' }}>{lt.description}</td>
                          <td style={{ fontWeight: 600 }}>{lt.maxDays} Days</td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>
                              {lt.paid ? 'Paid' : 'Unpaid'}
                            </span>
                          </td>
                          <td>
                            {isEditing ? (
                              <span className="lc-inline-readonly">{lt.active ? 'Active' : 'Inactive'}</span>
                            ) : (
                              <Toggle
                                checked={lt.active}
                                onChange={(val) => handleToggleLeaveTypeActive(lt.id, val)}
                                ariaLabel={`Toggle active status for ${lt.name}`}
                              />
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isEditing ? (
                              <div style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  type="button"
                                  className="lc-btn-primary"
                                  style={{ height: '32px', padding: '0 12px' }}
                                  onClick={() => handleSaveLeaveTypeInlineEdit(lt.id)}
                                >
                                  <Check size={14} />
                                  Save Changes
                                </button>
                                <button
                                  type="button"
                                  className="lc-ghost-btn"
                                  style={{ width: 'auto', padding: '0 12px' }}
                                  onClick={cancelLeaveTypeInlineEdit}
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
                                  title="Edit Leave Type"
                                  onClick={() => startLeaveTypeInlineEdit(lt)}
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="lc-ghost-btn danger"
                                  title="Delete Leave Type"
                                  onClick={() => handleDeleteLeaveType(lt.id)}
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

        {/* ── TAB 3: ORGANIZATION LEAVE POLICIES (In-Line Edit Redesign) ── */}
        {activeTab === 'policies' && (
          <div className="lc-card-panel">
            <div className="lc-card-toolbar">
              <div className="lc-search-box">
                <Search className="search-icon" />
                <input
                  type="text"
                  placeholder="Search policies or codes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="lc-table-responsive">
              <table className="lc-data-table">
                <thead>
                  <tr>
                    <th>Policy Name</th>
                    <th>Leave Code</th>
                    <th>Applies To</th>
                    <th>Accrual Schedule</th>
                    <th>Entitled Days (Inline Edit)</th>
                    <th>Carry-Over Limit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPolicies.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="lc-empty-state">
                        No organization policies match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPolicies.map((p) => {
                      const isEditing = editingPolicyId === p.id;

                      return (
                        <tr key={p.id}>
                          <td style={{ fontWeight: 600 }}>{p.policyName}</td>
                          <td>
                            <span className="lc-code-badge">{p.leaveCode}</span>
                          </td>
                          <td style={{ color: '#475569' }}>{p.appliesTo}</td>
                          <td style={{ color: '#64748b' }}>{p.accrualSchedule}</td>

                          {/* In-Line Editing Cell for Entitled Days */}
                          <td>
                            {isEditing ? (
                              <div className="lc-inline-edit-wrap">
                                <input
                                  type="number"
                                  className="lc-inline-input"
                                  value={editingDaysValue}
                                  onChange={(e) => setEditingDaysValue(e.target.value)}
                                  onKeyDown={(e) => handlePolicyKeyDown(e, p.id)}
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  className="lc-inline-btn save"
                                  title="Save (Press Enter)"
                                  onClick={() => handleSavePolicyEdit(p.id)}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="lc-inline-btn cancel"
                                  title="Cancel (Press Esc)"
                                  onClick={handleCancelPolicyEdit}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div
                                className="lc-inline-badge"
                                onClick={() => handleStartPolicyEdit(p)}
                                title="Click to edit entitled days"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') handleStartPolicyEdit(p);
                                }}
                              >
                                <span>{p.entitlementDays} Days</span>
                                <Edit2 size={13} style={{ color: '#64748b' }} />
                              </div>
                            )}
                          </td>

                          <td style={{ color: '#64748b' }}>{p.carryForwardLimit}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
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

      {/* ── MODAL 2: Add / Edit Leave Type ───────────────────────────────── */}
      <AdminModal
        isOpen={isLeaveTypeModalOpen}
        onClose={() => setIsLeaveTypeModalOpen(false)}
        title={editingLeaveType ? 'Edit Leave Type' : 'Add Leave Type'}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="lc-ghost-btn"
              style={{ padding: '0 16px', width: 'auto' }}
              onClick={() => setIsLeaveTypeModalOpen(false)}
            >
              Cancel
            </button>
            <button type="button" className="lc-btn-primary" onClick={handleSaveLeaveType}>
              Save Leave Type
            </button>
          </>
        }
      >
        <div className="lc-modal-grid">
          {/* Leave Code */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label ss-modal-label-required" htmlFor="lt-code">
              Leave Code
            </label>
            <input
              id="lt-code"
              type="text"
              className="ss-input"
              value={leaveTypeForm.code}
              placeholder="e.g. AL"
              onChange={(e) => setLeaveTypeForm((prev) => ({ ...prev, code: e.target.value }))}
            />
          </div>

          {/* Leave Type Name */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label ss-modal-label-required" htmlFor="lt-name">
              Leave Type Name
            </label>
            <input
              id="lt-name"
              type="text"
              className="ss-input"
              value={leaveTypeForm.name}
              placeholder="e.g. Annual Leave"
              onChange={(e) => setLeaveTypeForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Description */}
          <div className="ss-modal-form-group lc-modal-grid-span-2">
            <label className="ss-modal-label" htmlFor="lt-desc">
              Description
            </label>
            <textarea
              id="lt-desc"
              rows={2}
              className="ss-input"
              style={{ minHeight: '74px', resize: 'vertical' }}
              placeholder="Brief description of leave policy"
              value={leaveTypeForm.description}
              onChange={(e) => setLeaveTypeForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Maximum Days */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="lt-maxdays">
              Maximum Days
            </label>
            <input
              id="lt-maxdays"
              type="number"
              className="ss-input"
              value={leaveTypeForm.maxDays}
              onChange={(e) =>
                setLeaveTypeForm((prev) => ({
                  ...prev,
                  maxDays: parseInt(e.target.value, 10) || 0,
                }))
              }
            />
          </div>

          {/* Status Toggles */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label">Status</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', minHeight: '38px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Toggle
                  checked={leaveTypeForm.paid}
                  onChange={(v) => setLeaveTypeForm((prev) => ({ ...prev, paid: v }))}
                  ariaLabel="Paid status"
                />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Paid</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Toggle
                  checked={leaveTypeForm.active}
                  onChange={(v) => setLeaveTypeForm((prev) => ({ ...prev, active: v }))}
                  ariaLabel="Active status"
                />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  {leaveTypeForm.active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

export default LeaveConfigurationPage;
