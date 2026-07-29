import { useCallback, useState } from 'react';
import {
  Building2,
  Calendar,
  Check,
  Edit2,
  ListChecks,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Toggle } from '@components/ui/Toggle/Toggle';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useToast } from '@hooks/useToast';
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
  },
  {
    id: 'h2',
    name: 'Founding Day',
    date: '2026-02-22',
    day: 'Sunday',
    type: 'National Holiday',
    status: 'Upcoming',
  },
  {
    id: 'h3',
    name: 'Eid Al-Fitr Holiday',
    date: '2026-03-20',
    day: 'Friday',
    type: 'Public Holiday',
    status: 'Upcoming',
  },
  {
    id: 'h4',
    name: 'Eid Al-Adha Holiday',
    date: '2026-05-27',
    day: 'Wednesday',
    type: 'Public Holiday',
    status: 'Upcoming',
  },
  {
    id: 'h5',
    name: 'Saudi National Day',
    date: '2026-09-23',
    day: 'Wednesday',
    type: 'National Holiday',
    status: 'Upcoming',
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

/**
 * Admin Panel Leave Configurations Page Redesign.
 */
export function LeaveConfigurationPage() {
  useDocumentTitle('Leave Configurations - Admin Panel');
  const toast = useToast();

  // Navigation tab state: 'holidays' | 'leave-types' | 'policies'
  const [activeTab, setActiveTab] = useState('holidays');

  // Master Data State
  const [holidays, setHolidays] = useState(INITIAL_HOLIDAYS);
  const [leaveTypes, setLeaveTypes] = useState(INITIAL_LEAVE_TYPES);
  const [policies, setPolicies] = useState(INITIAL_POLICIES);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // ── Inline Edit State for Policies ──────────────────────────────────────────
  const [editingPolicyId, setEditingPolicyId] = useState(null);
  const [editingDaysValue, setEditingDaysValue] = useState('');

  // ── Modal States ───────────────────────────────────────────────────────────
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    day: 'Thursday',
    type: 'Public Holiday',
    status: 'Upcoming',
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
    setHolidayForm({
      name: '',
      date: new Date().toISOString().split('T')[0],
      day: 'Thursday',
      type: 'Public Holiday',
      status: 'Upcoming',
    });
    setIsHolidayModalOpen(true);
  };

  const openEditHolidayModal = (h) => {
    setEditingHoliday(h);
    setHolidayForm({ ...h });
    setIsHolidayModalOpen(true);
  };

  const handleSaveHoliday = () => {
    if (!holidayForm.name || !holidayForm.date) {
      toast.error('Please enter holiday name and date');
      return;
    }

    if (editingHoliday) {
      setHolidays((prev) =>
        prev.map((item) => (item.id === editingHoliday.id ? { ...holidayForm } : item)),
      );
      toast.success(`Updated holiday: ${holidayForm.name}`);
    } else {
      const newH = {
        ...holidayForm,
        id: `h-${Date.now()}`,
      };
      setHolidays((prev) => [...prev, newH]);
      toast.success(`Added holiday: ${holidayForm.name}`);
    }
    setIsHolidayModalOpen(false);
  };

  const handleDeleteHoliday = (id) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    toast.success('Holiday deleted');
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

  const openEditLeaveTypeModal = (lt) => {
    setEditingLeaveType(lt);
    setLeaveTypeForm({ ...lt });
    setIsLeaveTypeModalOpen(true);
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
        <p className="lc-page-subtext">
          Configure company holidays, active leave types, and annual entitlement policies.
        </p>
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

            <table className="lc-data-table">
              <thead>
                <tr>
                  <th>Holiday Name</th>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHolidays.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="lc-empty-state">
                      No holidays match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredHolidays.map((h) => (
                    <tr key={h.id}>
                      <td style={{ fontWeight: 600 }}>{h.name}</td>
                      <td>{formatDate(h.date)}</td>
                      <td style={{ color: '#64748b' }}>{h.day}</td>
                      <td>
                        <span className="lc-code-badge">{h.type}</span>
                      </td>
                      <td>
                        {h.status === 'Upcoming' ? (
                          <span className="lc-tag-upcoming">Upcoming</span>
                        ) : (
                          <span className="lc-tag-past">Past</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="lc-ghost-btn"
                            title="Edit Holiday"
                            onClick={() => openEditHolidayModal(h)}
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
                  filteredLeaveTypes.map((lt) => (
                    <tr key={lt.id}>
                      <td>
                        <span className="lc-code-badge">{lt.code}</span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{lt.name}</td>
                      <td style={{ color: '#64748b', maxWidth: '300px' }}>{lt.description}</td>
                      <td style={{ fontWeight: 600 }}>{lt.maxDays} Days</td>
                      <td>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>
                          {lt.paid ? 'Paid' : 'Unpaid'}
                        </span>
                      </td>
                      <td>
                        <Toggle
                          checked={lt.active}
                          onChange={(val) => handleToggleLeaveTypeActive(lt.id, val)}
                          ariaLabel={`Toggle active status for ${lt.name}`}
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
                            onClick={() => handleDeleteLeaveType(lt.id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
        )}
      </div>

      {/* ── MODAL 1: Add / Edit Holiday ──────────────────────────────────── */}
      <AdminModal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        title={editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="ss-modal-form-group">
            <label className="ss-modal-label ss-modal-label-required" htmlFor="holiday-name">
              Holiday Name
            </label>
            <input
              id="holiday-name"
              type="text"
              className="ss-input"
              value={holidayForm.name}
              placeholder="e.g. Founding Day"
              onChange={(e) => setHolidayForm((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label ss-modal-label-required" htmlFor="holiday-date">
                Date
              </label>
              <input
                id="holiday-date"
                type="date"
                className="ss-input"
                value={holidayForm.date}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="holiday-day">
                Day of Week
              </label>
              <input
                id="holiday-day"
                type="text"
                className="ss-input"
                value={holidayForm.day}
                placeholder="e.g. Thursday"
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, day: e.target.value }))}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="holiday-type">
                Holiday Type
              </label>
              <select
                id="holiday-type"
                className="ss-input"
                value={holidayForm.type}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="Public Holiday">Public Holiday</option>
                <option value="National Holiday">National Holiday</option>
                <option value="Company Holiday">Company Holiday</option>
              </select>
            </div>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="holiday-status">
                Status
              </label>
              <select
                id="holiday-status"
                className="ss-input"
                value={holidayForm.status}
                onChange={(e) => setHolidayForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="Upcoming">Upcoming</option>
                <option value="Past">Past</option>
              </select>
            </div>
          </div>
        </div>
      </AdminModal>

      {/* ── MODAL 2: Add / Edit Leave Type ───────────────────────────────── */}
      <AdminModal
        isOpen={isLeaveTypeModalOpen}
        onClose={() => setIsLeaveTypeModalOpen(false)}
        title={editingLeaveType ? 'Edit Leave Type' : 'Add Leave Type'}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '16px' }}>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label ss-modal-label-required" htmlFor="lt-code">
                Code
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
          </div>

          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="lt-desc">
              Description
            </label>
            <textarea
              id="lt-desc"
              rows={3}
              className="ss-input"
              style={{ height: 'auto', padding: '10px' }}
              placeholder="Brief description of leave policy"
              value={leaveTypeForm.description}
              onChange={(e) =>
                setLeaveTypeForm((prev) => ({ ...prev, description: e.target.value }))
              }
            />
          </div>

          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="lt-maxdays">
              Max Quota (Days)
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

          <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Toggle
                checked={leaveTypeForm.paid}
                onChange={(v) => setLeaveTypeForm((prev) => ({ ...prev, paid: v }))}
                ariaLabel="Paid status"
              />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Paid Leave</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Toggle
                checked={leaveTypeForm.active}
                onChange={(v) => setLeaveTypeForm((prev) => ({ ...prev, active: v }))}
                ariaLabel="Active status"
              />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Active</span>
            </div>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

export default LeaveConfigurationPage;
