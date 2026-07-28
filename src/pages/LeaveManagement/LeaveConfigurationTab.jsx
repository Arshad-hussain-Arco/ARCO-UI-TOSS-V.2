import { useState, useMemo } from 'react';
import { Search, ArrowUpDown, Edit2, Check, X, Users } from 'lucide-react';
import { Select } from '@components/forms/Select/Select';
import { activatable } from '@utils/interactive';
import './LeaveConfiguration.css';

// Initial Mock Employees Data for Leave Configuration
const INITIAL_CONFIG_EMPLOYEES = [
  {
    id: 'EMP001',
    employeeId: 'EMP001',
    name: 'Rajesh Kumar',
    email: 'rajesh.k@company.com',
    role: 'Sr. Software Engineer',
    department: 'Engineering',
    team: 'Frontend',
    reportingManager: 'Aarav Gupta',
    status: 'Active',
    lastModified: '2026-07-20',
    carryOver: { balance: 5, limit: 10 },
    sickLeave: { balance: 12, maxQuota: 14 },
    compOff: { balance: 3 },
    weekendWork: { balance: 2 },
  },
  {
    id: 'EMP002',
    employeeId: 'EMP002',
    name: 'Priya Sharma',
    email: 'priya.s@company.com',
    role: 'Tech Lead',
    department: 'Engineering',
    team: 'Frontend',
    reportingManager: 'Aarav Gupta',
    status: 'Active',
    lastModified: '2026-07-18',
    carryOver: { balance: 8, limit: 10 },
    sickLeave: { balance: 14, maxQuota: 14 },
    compOff: { balance: 5 },
    weekendWork: { balance: 4 },
  },
  {
    id: 'EMP003',
    employeeId: 'EMP003',
    name: 'Amit Patel',
    email: 'amit.p@company.com',
    role: 'Software Engineer',
    department: 'Engineering',
    team: 'Backend',
    reportingManager: 'Meera Nair',
    status: 'Active',
    lastModified: '2026-07-15',
    carryOver: { balance: 3, limit: 7 },
    sickLeave: { balance: 10, maxQuota: 12 },
    compOff: { balance: 1 },
    weekendWork: { balance: 0 },
  },
  {
    id: 'EMP004',
    employeeId: 'EMP004',
    name: 'Sneha Reddy',
    email: 'sneha.r@company.com',
    role: 'QA Engineer',
    department: 'Quality Assurance',
    team: 'QA Core',
    reportingManager: 'Vikram Malhotra',
    status: 'Active',
    lastModified: '2026-07-22',
    carryOver: { balance: 4, limit: 8 },
    sickLeave: { balance: 11, maxQuota: 14 },
    compOff: { balance: 2 },
    weekendWork: { balance: 3 },
  },
  {
    id: 'EMP005',
    employeeId: 'EMP005',
    name: 'Vikram Malhotra',
    email: 'vikram.m@company.com',
    role: 'QA Lead',
    department: 'Quality Assurance',
    team: 'QA Core',
    reportingManager: 'Aarav Gupta',
    status: 'Active',
    lastModified: '2026-07-12',
    carryOver: { balance: 10, limit: 12 },
    sickLeave: { balance: 14, maxQuota: 14 },
    compOff: { balance: 6 },
    weekendWork: { balance: 5 },
  },
  {
    id: 'EMP006',
    employeeId: 'EMP006',
    name: 'Ananya Sen',
    email: 'ananya.s@company.com',
    role: 'Product Manager',
    department: 'Product Management',
    team: 'Core Product',
    reportingManager: 'Aarav Gupta',
    status: 'Active',
    lastModified: '2026-07-21',
    carryOver: { balance: 6, limit: 10 },
    sickLeave: { balance: 13, maxQuota: 14 },
    compOff: { balance: 4 },
    weekendWork: { balance: 1 },
  },
  {
    id: 'EMP007',
    employeeId: 'EMP007',
    name: 'Rohan Joshi',
    email: 'rohan.j@company.com',
    role: 'UI/UX Designer',
    department: 'Design',
    team: 'UX Design',
    reportingManager: 'Ananya Sen',
    status: 'Active',
    lastModified: '2026-07-19',
    carryOver: { balance: 2, limit: 5 },
    sickLeave: { balance: 9, maxQuota: 12 },
    compOff: { balance: 0 },
    weekendWork: { balance: 0 },
  },
  {
    id: 'EMP008',
    employeeId: 'EMP008',
    name: 'Kavita Roy',
    email: 'kavita.r@company.com',
    role: 'HR Specialist',
    department: 'HR & Ops',
    team: 'Talent',
    reportingManager: 'Meera Nair',
    status: 'Inactive',
    lastModified: '2026-06-30',
    carryOver: { balance: 0, limit: 5 },
    sickLeave: { balance: 5, maxQuota: 12 },
    compOff: { balance: 0 },
    weekendWork: { balance: 0 },
  },
];

const TEAMS = ['All Teams', 'Frontend', 'Backend', 'QA Core', 'Core Product', 'UX Design', 'Talent'];

function getInitials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = ['#1d4ed8', '#065f46', '#5b21b6', '#92400e', '#0f766e', '#4f46e5'];
function getAvatarBg(id) {
  const num = parseInt(id.replace(/\D/g, ''), 10) || 0;
  return AVATAR_COLORS[num % AVATAR_COLORS.length];
}

export function LeaveConfigurationTab() {
  const [employees, setEmployees] = useState(INITIAL_CONFIG_EMPLOYEES);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('All Teams');

  // Table Sorting State
  const [sortField, setSortField] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');

  // Inline Row Edit State
  const [editingRowId, setEditingRowId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (teamFilter !== 'All Teams' && emp.team !== teamFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = emp.name.toLowerCase().includes(q);
        const matchEmail = emp.email.toLowerCase().includes(q);
        const matchId = emp.employeeId.toLowerCase().includes(q);
        const matchDept = emp.department.toLowerCase().includes(q);
        const matchTeam = emp.team.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchId && !matchDept && !matchTeam) return false;
      }

      return true;
    });
  }, [employees, teamFilter, searchQuery]);

  // Sorted Employees
  const sortedEmployees = useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (sortField === 'carryOver') {
        aVal = a.carryOver.balance;
        bVal = b.carryOver.balance;
      } else if (sortField === 'sickLeave') {
        aVal = a.sickLeave.balance;
        bVal = b.sickLeave.balance;
      } else if (sortField === 'compOff') {
        aVal = a.compOff.balance;
        bVal = b.compOff.balance;
      } else if (sortField === 'weekendWork') {
        aVal = a.weekendWork.balance;
        bVal = b.weekendWork.balance;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
  }, [filteredEmployees, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Inline Edit Handlers
  const handleStartEdit = (emp) => {
    setEditingRowId(emp.id);
    setEditForm({
      carryOverBalance: emp.carryOver.balance,
      carryOverLimit: emp.carryOver.limit,
      sickLeaveBalance: emp.sickLeave.balance,
      sickLeaveMaxQuota: emp.sickLeave.maxQuota,
      compOffBalance: emp.compOff.balance,
      weekendWorkBalance: emp.weekendWork.balance,
    });
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditForm(null);
  };

  const handleSaveEdit = (empId) => {
    if (!editForm) return;

    setEmployees((prev) =>
      prev.map((emp) => {
        if (emp.id === empId) {
          return {
            ...emp,
            carryOver: {
              ...emp.carryOver,
              balance: Number(editForm.carryOverBalance) || 0,
              limit: Number(editForm.carryOverLimit) || 0,
            },
            sickLeave: {
              ...emp.sickLeave,
              balance: Number(editForm.sickLeaveBalance) || 0,
              maxQuota: Number(editForm.sickLeaveMaxQuota) || 0,
            },
            compOff: {
              ...emp.compOff,
              balance: Number(editForm.compOffBalance) || 0,
            },
            weekendWork: {
              ...emp.weekendWork,
              balance: Number(editForm.weekendWorkBalance) || 0,
            },
            lastModified: new Date().toISOString().split('T')[0],
          };
        }
        return emp;
      })
    );

    setEditingRowId(null);
    setEditForm(null);
  };

  return (
    <div className="lc-container">
      {/* ── Top Filter Bar (Search + Team) ─────────────────────────────────── */}
      <div className="lc-filter-panel">
        <div className="lc-filter-row">
          <div className="lc-search-wrap">
            <Search className="lc-search-icon" />
            <input
              type="text"
              className="lc-search-input"
              placeholder="Search employee name, role or team…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select
            value={teamFilter}
            onChange={setTeamFilter}
            options={TEAMS.map((t) => ({ value: t, label: t }))}
            width="team"
          />
        </div>
      </div>

      {/* ── Inline Editable Data Table ────────────────────────────────────────── */}
      <div className="lc-table-container">
        <table className="lc-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className="sortable">
                <div className="th-content">
                  <span>Employee</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('team')} className="sortable">
                <div className="th-content">
                  <span>Team / Manager</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('carryOver')} className="sortable text-center">
                <div className="th-content center">
                  <span>Carry Over</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('sickLeave')} className="sortable text-center">
                <div className="th-content center">
                  <span>Sick Leave</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('compOff')} className="sortable text-center">
                <div className="th-content center">
                  <span>Comp-Off</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th onClick={() => handleSort('weekendWork')} className="sortable text-center">
                <div className="th-content center">
                  <span>Weekend Work</span>
                  <ArrowUpDown size={12} />
                </div>
              </th>
              <th className="text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            {sortedEmployees.length === 0 ? (
              <tr>
                <td colSpan={7} className="lc-empty-td">
                  <div className="lc-empty-state">
                    <Users size={32} />
                    <p>No employee leave configurations found.</p>
                  </div>
                </td>
              </tr>
            ) : (
              sortedEmployees.map((emp) => {
                const isEditing = editingRowId === emp.id;

                return (
                  <tr key={emp.id} className={isEditing ? 'lc-row-editing' : ''}>
                    {/* Employee Name & Role */}
                    <td>
                      <div className="lc-emp-cell">
                        <div
                          className="lc-avatar"
                          style={{ backgroundColor: getAvatarBg(emp.id) }}
                        >
                          {getInitials(emp.name)}
                        </div>
                        <div className="lc-emp-info">
                          <span className="lc-emp-name">{emp.name}</span>
                          <span className="lc-emp-role">{emp.role}</span>
                        </div>
                      </div>
                    </td>

                    {/* Team / Manager */}
                    <td>
                      <div className="lc-team-cell">
                        <span className="lc-team-name">{emp.team}</span>
                        <span className="lc-manager-sub">{emp.reportingManager}</span>
                      </div>
                    </td>

                    {/* Carry Over Column */}
                    <td className="text-center">
                      {isEditing ? (
                        <div className="lc-inline-inputs">
                          <input
                            type="number"
                            aria-label={`Carry over balance for ${emp.name}`}
                            className="lc-inline-num-input"
                            value={editForm.carryOverBalance}
                            onChange={(e) =>
                              setEditForm({ ...editForm, carryOverBalance: e.target.value })
                            }
                          />
                          <span className="lc-inline-slash">/</span>
                          <input
                            type="number"
                            aria-label={`Carry over limit for ${emp.name}`}
                            className="lc-inline-num-input"
                            value={editForm.carryOverLimit}
                            onChange={(e) =>
                              setEditForm({ ...editForm, carryOverLimit: e.target.value })
                            }
                          />
                          <span className="lc-inline-unit">d</span>
                        </div>
                      ) : (
                        <span className="lc-plain-val">
                          {emp.carryOver.balance}d / {emp.carryOver.limit}d
                        </span>
                      )}
                    </td>

                    {/* Sick Leave Column */}
                    <td className="text-center">
                      {isEditing ? (
                        <div className="lc-inline-inputs">
                          <input
                            type="number"
                            aria-label={`Sick leave balance for ${emp.name}`}
                            className="lc-inline-num-input"
                            value={editForm.sickLeaveBalance}
                            onChange={(e) =>
                              setEditForm({ ...editForm, sickLeaveBalance: e.target.value })
                            }
                          />
                          <span className="lc-inline-slash">/</span>
                          <input
                            type="number"
                            aria-label={`Sick leave quota for ${emp.name}`}
                            className="lc-inline-num-input"
                            value={editForm.sickLeaveMaxQuota}
                            onChange={(e) =>
                              setEditForm({ ...editForm, sickLeaveMaxQuota: e.target.value })
                            }
                          />
                          <span className="lc-inline-unit">d</span>
                        </div>
                      ) : (
                        <span className="lc-plain-val">
                          {emp.sickLeave.balance}d / {emp.sickLeave.maxQuota}d
                        </span>
                      )}
                    </td>

                    {/* Comp-Off Column */}
                    <td className="text-center">
                      {isEditing ? (
                        <div className="lc-inline-inputs">
                          <input
                            type="number"
                            aria-label={`Comp off balance for ${emp.name}`}
                            className="lc-inline-num-input single"
                            value={editForm.compOffBalance}
                            onChange={(e) =>
                              setEditForm({ ...editForm, compOffBalance: e.target.value })
                            }
                          />
                          <span className="lc-inline-unit">d</span>
                        </div>
                      ) : (
                        <span className="lc-plain-val">{emp.compOff.balance}d</span>
                      )}
                    </td>

                    {/* Weekend Work Column */}
                    <td className="text-center">
                      {isEditing ? (
                        <div className="lc-inline-inputs">
                          <input
                            type="number"
                            aria-label={`Weekend work credits for ${emp.name}`}
                            className="lc-inline-num-input single"
                            value={editForm.weekendWorkBalance}
                            onChange={(e) =>
                              setEditForm({ ...editForm, weekendWorkBalance: e.target.value })
                            }
                          />
                          <span className="lc-inline-unit">cr</span>
                        </div>
                      ) : (
                        <span className="lc-plain-val">{emp.weekendWork.balance} cr</span>
                      )}
                    </td>

                    {/* Inline Edit Actions */}
                    <td className="text-right">
                      <div className="lc-action-btns">
                        {isEditing ? (
                          <>
                            <button
                              className="lc-act-btn save"
                              title="Save Changes"
                              {...activatable(() => handleSaveEdit(emp.id), {
                                label: `Save changes for ${emp.name}`,
                              })}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              className="lc-act-btn cancel"
                              title="Cancel Edit"
                              {...activatable(handleCancelEdit, {
                                label: `Cancel edit for ${emp.name}`,
                              })}
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <button
                            className="lc-act-btn edit"
                            title="Edit Row Inline"
                            {...activatable(() => handleStartEdit(emp), {
                              label: `Edit configuration for ${emp.name}`,
                            })}
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
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
  );
}

export default LeaveConfigurationTab;
