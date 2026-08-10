import React, { useState, useMemo, useEffect } from 'react';
import { Search, ArrowUpDown, Edit2, Check, X, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { Select } from '@components/forms/Select/Select';
import { activatable } from '@utils/interactive';
import { Loader } from '@components/feedback/Loader/Loader';
import api from '@api/httpClient';
import endpoints from '@api/endpoints';
import { useAuth } from '@hooks/useAuth';
import './LeaveConfiguration.css';

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
  const num = parseInt(String(id).replace(/\D/g, ''), 10) || 0;
  return AVATAR_COLORS[num % AVATAR_COLORS.length];
}

function parsePhotoUrl(photoUrl) {
  if (!photoUrl) return null;
  let url = photoUrl;

  if (url.startsWith('data:image')) return url;
  if (url.startsWith('http') || url.startsWith('/')) return url;

  if (url.startsWith('ZGF0Y')) {
    try {
      url = atob(url);
    } catch (e) {
      console.warn('Failed to decode base64 avatar');
    }
  }

  if (url && !url.startsWith('data:image')) {
    let mime = 'image/jpeg';
    if (url.startsWith('iVBORw')) mime = 'image/png';
    else if (url.startsWith('R0lGOD')) mime = 'image/gif';
    else if (url.startsWith('UklGR')) mime = 'image/webp';

    return `data:${mime};base64,${url}`;
  }

  return url;
}

export function LeaveConfigurationTab() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [teams, setTeams] = useState(['All Teams']);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      if (!user?.emp_id) return;
      setLoading(true);
      try {
        const res = await api.get(endpoints.manager.teamEditQuotaFields(user.emp_id), { params: { year: new Date().getFullYear() } });
        const payload = res.data?.data || res.data;
        const rawData = Array.isArray(payload) ? payload : (payload?.results || []);

        const mappedEmployees = rawData.map(emp => {
          const efs = Array.isArray(emp.editable_fields) ? emp.editable_fields : [];

          const al = efs.find(f => f.leave_type_code === 'AL') || {};
          const sl = efs.find(f => f.leave_type_code === 'SL') || {};
          const compOff = efs.find(f => f.leave_type_code === 'CompOff' || f.leave_type_code === 'CCompOff') || {};
          const ww = efs.find(f => f.leave_type_code === 'WW' || f.leave_type_code === 'CWW') || {};

          return {
            id: emp.emp_id,
            employeeId: `EMP${emp.emp_id}`,
            name: emp.emp_name || 'Unknown Employee',
            email: '',
            role: emp.designation || '',
            department: emp.department_name || '',
            team: emp.team_name || 'Unassigned',
            reportingManager: '',
            status: 'Active',
            lastModified: new Date().toISOString().split('T')[0],
            carryOver: { balance: al.current_value || 0, limit: 0 },
            sickLeave: { balance: sl.current_value || 0, maxQuota: 0 },
            compOff: { balance: compOff.current_value || 0 },
            weekendWork: { balance: ww.current_value || 0 },
            photo: parsePhotoUrl(emp.photo),
            _raw: emp
          };
        });

        setEmployees(mappedEmployees);

        const uniqueTeams = Array.from(new Set(mappedEmployees.map(e => e.team))).filter(Boolean);
        setTeams(['All Teams', ...uniqueTeams]);
      } catch (err) {
        console.error('Failed to load employees for leave configuration', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [user?.emp_id]);

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

  const treeData = useMemo(() => {
    if (sortedEmployees.length === 0) return [];

    const nodes = sortedEmployees.map(emp => ({ ...emp, children: [] }));
    const rootNodes = [];
    const nodeMap = {};
    nodes.forEach(n => { nodeMap[n.id] = n; });

    const orphans = [];

    nodes.forEach(n => {
      const parentId = n._raw?.manager_id || n._raw?.reporting_to || n._raw?.reporting_manager_id;
      // Prevent circular references where an employee is their own manager
      if (parentId && parentId !== n.id && nodeMap[parentId]) {
        nodeMap[parentId].children.push(n);
      } else {
        orphans.push(n);
      }
    });

    // Direct display without dummy team groupings
    rootNodes.push(...orphans);

    return rootNodes;
  }, [sortedEmployees]);

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

  const handleSaveEdit = async (empId) => {
    if (!editForm || !user?.emp_id) return;
    setIsSaving(true);

    const emp = employees.find(e => e.id === empId);
    if (!emp) {
      setIsSaving(false);
      return;
    }

    const currentYear = new Date().getFullYear();
    const promises = [];

    // Check AL carryover change
    const newCarryOver = Number(editForm.carryOverBalance) || 0;
    if (newCarryOver !== emp.carryOver.balance) {
      promises.push(
        api.post(endpoints.manager.updateQuota(user.emp_id, empId), {
          leave_type_code: "AL",
          field: "carried_forward",
          year: currentYear,
          new_value: newCarryOver
        })
      );
    }

    // Check SL entitled change
    const newSickLeave = Number(editForm.sickLeaveBalance) || 0;
    if (newSickLeave !== emp.sickLeave.balance) {
      promises.push(
        api.post(endpoints.manager.updateQuota(user.emp_id, empId), {
          leave_type_code: "SL",
          field: "entitled_days",
          year: currentYear,
          new_value: newSickLeave
        })
      );
    }

    // Check CompOff entitled change
    const newCompOff = Number(editForm.compOffBalance) || 0;
    if (newCompOff !== emp.compOff.balance) {
      promises.push(
        api.post(endpoints.manager.updateQuota(user.emp_id, empId), {
          leave_type_code: "CCompOff",
          field: "entitled_days",
          year: currentYear,
          new_value: newCompOff
        })
      );
    }

    // Check Weekend Work entitled change
    const newWeekendWork = Number(editForm.weekendWorkBalance) || 0;
    if (newWeekendWork !== emp.weekendWork.balance) {
      promises.push(
        api.post(endpoints.manager.updateQuota(user.emp_id, empId), {
          leave_type_code: "CWW",
          field: "entitled_days",
          year: currentYear,
          new_value: newWeekendWork
        })
      );
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }

    setEmployees((prev) =>
      prev.map((e) => {
        if (e.id === empId) {
          return {
            ...e,
            carryOver: { ...e.carryOver, balance: newCarryOver },
            sickLeave: { ...e.sickLeave, balance: newSickLeave },
            compOff: { ...e.compOff, balance: newCompOff },
            weekendWork: { ...e.weekendWork, balance: newWeekendWork },
            lastModified: new Date().toISOString().split('T')[0],
          };
        }
        return e;
      })
    );

    setEditingRowId(null);
    setEditForm(null);
    setIsSaving(false);
  };

  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderTreeRow = (emp, depth = 0) => {
    const isEditing = editingRowId === emp.id;
    const hasChildren = emp.children && emp.children.length > 0;
    const isExpanded = expandedRows[emp.id] !== false; // Default expanded to see tree initially
    const isManager = emp.role?.toLowerCase().includes('manager') || hasChildren;

    return (
      <React.Fragment key={emp.id}>
        <tr className={`lc-tree-row ${isEditing ? 'lc-row-editing' : ''} depth-${depth} ${hasChildren ? 'is-parent' : ''}`}>
          <td className="lc-td-name">
            <div className="lc-tree-indent" style={{ paddingLeft: `${depth * 42}px` }}>
              {hasChildren ? (
                <button className="lc-expand-btn" onClick={() => toggleRow(emp.id)}>
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <span className="lc-expand-placeholder"></span>
              )}
              <div className="lc-emp-cell">
                <div className="lc-avatar" style={{ backgroundColor: getAvatarBg(emp.id) }}>
                  {emp.photo ? (
                    <img src={emp.photo} alt={emp.name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', backgroundColor: '#ffffff' }} />
                  ) : (
                    getInitials(emp.name)
                  )}
                </div>
                <div className="lc-emp-info">
                  <div className="lc-emp-name-wrap">
                    <span className="lc-emp-name">{emp.name}</span>
                    {isManager && <span className="lc-manager-pill">Manager</span>}
                  </div>
                  <span className="lc-emp-role">{emp.role || 'Employee'}</span>
                </div>
              </div>
            </div>
          </td>

          <td className="lc-td-team">{emp.team}</td>

          <td className="text-center">
            {isEditing ? (
              <div className="lc-inline-inputs">
                <input type="number" className="lc-inline-num-input" value={editForm.carryOverBalance} onChange={(e) => setEditForm({ ...editForm, carryOverBalance: e.target.value })} />
                <span className="lc-inline-slash">/</span>
                <input type="number" className="lc-inline-num-input" value={editForm.carryOverLimit} onChange={(e) => setEditForm({ ...editForm, carryOverLimit: e.target.value })} />
                <span className="lc-inline-unit">d</span>
              </div>
            ) : (
              <span className="lc-plain-val">{emp.carryOver.balance}d / {emp.carryOver.limit}d</span>
            )}
          </td>

          <td className="text-center">
            {isEditing ? (
              <div className="lc-inline-inputs">
                <input type="number" className="lc-inline-num-input" value={editForm.sickLeaveBalance} onChange={(e) => setEditForm({ ...editForm, sickLeaveBalance: e.target.value })} />
                <span className="lc-inline-slash">/</span>
                <input type="number" className="lc-inline-num-input" value={editForm.sickLeaveMaxQuota} onChange={(e) => setEditForm({ ...editForm, sickLeaveMaxQuota: e.target.value })} />
                <span className="lc-inline-unit">d</span>
              </div>
            ) : (
              <span className="lc-plain-val">{emp.sickLeave.balance}d / {emp.sickLeave.maxQuota}d</span>
            )}
          </td>

          <td className="text-center">
            {isEditing ? (
              <div className="lc-inline-inputs">
                <input type="number" className="lc-inline-num-input single" value={editForm.compOffBalance} onChange={(e) => setEditForm({ ...editForm, compOffBalance: e.target.value })} />
                <span className="lc-inline-unit">d</span>
              </div>
            ) : (
              <span className="lc-plain-val">{emp.compOff.balance}d</span>
            )}
          </td>

          <td className="text-center">
            {isEditing ? (
              <div className="lc-inline-inputs">
                <input type="number" className="lc-inline-num-input single" value={editForm.weekendWorkBalance} onChange={(e) => setEditForm({ ...editForm, weekendWorkBalance: e.target.value })} />
                <span className="lc-inline-unit">cr</span>
              </div>
            ) : (
              <span className="lc-plain-val">{emp.weekendWork.balance} cr</span>
            )}
          </td>

          <td className="text-right">
            {!emp._isDummy && (
              isEditing ? (
                <div className="lc-action-btns">
                  <button className="lc-save-btn" onClick={() => handleSaveEdit(emp.id)} disabled={isSaving}>
                    {isSaving ? <Loader size="sm" /> : <Check size={14} />}
                  </button>
                  <button className="lc-cancel-btn" onClick={handleCancelEdit} disabled={isSaving}><X size={14} /></button>
                </div>
              ) : (
                <button className="lc-edit-btn" onClick={() => handleStartEdit(emp)}><Edit2 size={14} /></button>
              )
            )}
          </td>
        </tr>

        {hasChildren && isExpanded && (
          emp.children.map(child => renderTreeRow(child, depth + 1))
        )}
      </React.Fragment>
    );
  };

  return (
    <div className="lc-container">
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
          <Loader size="md" message="Loading leave configuration..." />
        </div>
      ) : (
        <>
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
                  style={{ paddingRight: '32px' }}
                />
                {searchQuery && (
                  <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <Select
                value={teamFilter}
                onChange={setTeamFilter}
                options={teams.map((t) => ({ value: t, label: t }))}
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
                      <span>Team</span>
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
                {treeData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="lc-empty-td">
                      <div className="lc-empty-state">
                        <Users size={32} />
                        <p>No employee leave configurations found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  treeData.map((emp) => renderTreeRow(emp, 0))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default LeaveConfigurationTab;
