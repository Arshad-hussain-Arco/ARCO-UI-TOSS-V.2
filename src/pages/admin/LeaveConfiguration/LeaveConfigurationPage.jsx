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

  const [holidays, setHolidays] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [policies, setPolicies] = useState([]);
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

  // Leave Types Fetch & Search Effect
  useEffect(() => {
    let active = true;
    const fetchLeaveTypes = async () => {
      if (activeTab !== 'leave-types') return;
      setIsLoading(true);
      try {
        const res = await leaveService.getLeaveTypes();
        if (active) setLeaveTypes(res || []);
      } catch (err) {
        console.error('Failed to load leave types', err);
        toast.error('Error loading leave types');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchLeaveTypes();
    return () => {
      active = false;
    };
  }, [activeTab]);

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

  // (Removed inline edit states for leave types to use Modal exclusively)

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
  const [leaveTypeCodeError, setLeaveTypeCodeError] = useState('');
  const [leaveTypeForm, setLeaveTypeForm] = useState({
    code: '',
    name: '',
    description: '',
    max_quota_days: 10,
    payment_type: 'PAID',
    is_active: true,
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

  // ── Section 2: Leave Type Handlers ──────────────────────────────────────────
  const fetchLeaveTypesSilently = async () => {
    try {
      const res = await leaveService.getLeaveTypes();
      setLeaveTypes(res || []);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddLeaveTypeModal = () => {
    setEditingLeaveType(null);
    setLeaveTypeCodeError('');
    setLeaveTypeForm({
      code: '',
      name: '',
      description: '',
      max_quota_days: 10,
      payment_type: 'PAID',
      is_active: true,
    });
    setIsLeaveTypeModalOpen(true);
  };

  const openEditLeaveTypeModal = (lt) => {
    setEditingLeaveType(lt);
    setLeaveTypeCodeError('');
    setLeaveTypeForm({
      code: lt.code || '',
      name: lt.name || lt.leave_type || '',
      description: lt.description || '',
      max_quota_days: lt.max_quota_days ?? 10,
      payment_type: lt.payment_type || 'PAID',
      is_active: lt.active !== undefined ? lt.active : (lt.is_active ?? true),
    });
    setIsLeaveTypeModalOpen(true);
  };

  const handleSaveLeaveType = async () => {
    if (!leaveTypeForm.code || !leaveTypeForm.name) {
      toast.error('Please enter leave code and name');
      return;
    }

    try {
      setLeaveTypeCodeError('');
      if (editingLeaveType) {
        // Update (ignore code in payload)
        const payload = { ...leaveTypeForm };
        delete payload.code;
        await leaveService.updateLeaveType(editingLeaveType.id, payload);
        toast.success(`Updated leave type: ${leaveTypeForm.name}`);
      } else {
        // Create
        await leaveService.createLeaveType(leaveTypeForm);
        toast.success(`Added leave type: ${leaveTypeForm.name}`);
      }
      setIsLeaveTypeModalOpen(false);
      fetchLeaveTypesSilently();
    } catch (err) {
      if (err.response?.status === 400 && err.response.data?.code) {
        setLeaveTypeCodeError(err.response.data.code[0]);
      } else {
        toast.error('Failed to save leave type');
        console.error(err);
      }
    }
  };

  const handleDeleteLeaveType = async (lt) => {
    const name = lt.name || lt.leave_type;
    if (window.confirm(`Are you sure you want to delete/deactivate ${name}?`)) {
      try {
        await leaveService.deactivateLeaveType(lt.id);
        toast.success(`Deactivated ${name}`);
        fetchLeaveTypesSilently();
      } catch (err) {
        toast.error('Failed to deactivate leave type');
        console.error(err);
      }
    }
  };

  const handleToggleLeaveTypeActive = async (lt, checked) => {
    const name = lt.name || lt.leave_type;
    try {
      if (checked) {
        await leaveService.activateLeaveType(lt.id);
        toast.success(`Activated ${name}`);
      } else {
        await leaveService.deactivateLeaveType(lt.id);
        toast.success(`Deactivated ${name}`);
      }
      fetchLeaveTypesSilently();
    } catch (err) {
      toast.error('Failed to update status');
      console.error(err);
    }
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
      (h.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (h.type || '').toLowerCase().includes((searchQuery || '').toLowerCase()),
  );

  const filteredLeaveTypes = leaveTypes.filter(
    (lt) =>
      (lt.name || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (lt.code || '').toLowerCase().includes((searchQuery || '').toLowerCase()),
  );

  const filteredPolicies = policies.filter(
    (p) =>
      (p.policyName || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (p.leaveCode || '').toLowerCase().includes((searchQuery || '').toLowerCase()) ||
      (p.appliesTo || '').toLowerCase().includes((searchQuery || '').toLowerCase()),
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
          <span className="lc-tab-count">{holidays?.length || 0}</span>
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
          <span className="lc-tab-count">{leaveTypes?.length || 0}</span>
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
          <span className="lc-tab-count">{policies?.length || 0}</span>
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
          <option value="leave-types">Leave Types ({leaveTypes?.length || 0})</option>
          <option value="policies">Organization Leave Policies ({policies?.length || 0})</option>
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={7}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                          <Loader message="Loading leave types..." />
                        </div>
                      </td>
                    </tr>
                  ) : filteredLeaveTypes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="lc-empty-state">
                        No leave types match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLeaveTypes.map((lt) => {
                      const name = lt.name || lt.leave_type || '';
                      const isActive = lt.active !== undefined ? lt.active : (lt.is_active ?? true);
                      
                      return (
                        <tr key={lt.id}>
                          <td>
                            <span className="lc-code-badge">{lt.code}</span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{name}</td>
                          <td style={{ color: '#64748b', maxWidth: '300px' }}>{lt.description || '-'}</td>
                          <td style={{ fontWeight: 600 }}>{lt.max_quota_days ? `${lt.max_quota_days} Days` : '-'}</td>
                          <td>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>
                              {lt.payment_type === 'UNPAID' ? 'Unpaid' : 'Paid'}
                            </span>
                          </td>
                          <td>
                            <Toggle
                              checked={isActive}
                              onChange={(val) => handleToggleLeaveTypeActive(lt, val)}
                              ariaLabel={`Toggle active status for ${name}`}
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="lc-ghost-btn"
                                title="Edit Leave Type"
                                onClick={() => openEditLeaveTypeModal(lt)}
                              >
                                <Edit2 size={15} />
                              </button>
                              <button
                                type="button"
                                className="lc-ghost-btn danger"
                                title="Delete Leave Type"
                                onClick={() => handleDeleteLeaveType(lt)}
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={6}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                          <Loader message="Loading policies..." />
                        </div>
                      </td>
                    </tr>
                  ) : filteredPolicies.length === 0 ? (
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
        {/* ── TAB 4: WORK SCHEDULE ── */}
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
            {editingLeaveType ? (
              <div
                style={{
                  height: '38px',
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  color: '#64748b',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'not-allowed'
                }}
              >
                {leaveTypeForm.code}
              </div>
            ) : (
              <div>
                <input
                  id="lt-code"
                  type="text"
                  className="ss-input"
                  style={{ borderColor: leaveTypeCodeError ? '#ef4444' : undefined }}
                  value={leaveTypeForm.code}
                  placeholder="e.g. AL"
                  onChange={(e) => {
                    setLeaveTypeCodeError('');
                    setLeaveTypeForm((prev) => ({ ...prev, code: e.target.value }));
                  }}
                />
                {leaveTypeCodeError && (
                  <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
                    {leaveTypeCodeError}
                  </div>
                )}
              </div>
            )}
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

          {/* Maximum Quota Days */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="lt-maxdays">
              Max Quota Days
            </label>
            <input
              id="lt-maxdays"
              type="number"
              className="ss-input"
              value={leaveTypeForm.max_quota_days}
              onChange={(e) =>
                setLeaveTypeForm((prev) => ({
                  ...prev,
                  max_quota_days: e.target.value ? parseFloat(e.target.value) : null,
                }))
              }
            />
          </div>

          {/* Status Toggles */}
          <div className="ss-modal-form-group">
            <label className="ss-modal-label">Status & Payment</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', minHeight: '38px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Toggle
                  checked={leaveTypeForm.payment_type === 'PAID'}
                  onChange={(v) => setLeaveTypeForm((prev) => ({ ...prev, payment_type: v ? 'PAID' : 'UNPAID' }))}
                  ariaLabel="Paid status"
                />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>Paid</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Toggle
                  checked={leaveTypeForm.is_active}
                  onChange={(v) => setLeaveTypeForm((prev) => ({ ...prev, is_active: v }))}
                  ariaLabel="Active status"
                />
                <span style={{ fontSize: '13px', fontWeight: 600 }}>
                  {leaveTypeForm.is_active ? 'Active' : 'Inactive'}
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
