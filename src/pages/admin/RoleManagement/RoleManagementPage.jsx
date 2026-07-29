import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Users,
  ShieldAlert,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Check,
  Lock,
} from 'lucide-react';
import { activatable, dismissBackdrop } from '@utils/interactive';
import { roleService } from '@services/roleService';
import { Loader } from '@components/feedback/Loader/Loader';
import './RoleManagementPage.css';

// Application Modules List
const MODULES = [
  'Leave Management',
  'Attendance',
  'Consultants',
  'EOD Management',
  'Settings',
  'Teams',
  'Documents',
  'Reports',
];

// Actions List
const ACTIONS = [
  { key: 'add', label: 'Add' },
  { key: 'edit', label: 'Edit' },
  { key: 'delete', label: 'Delete' },
  { key: 'read', label: 'Read' },
  { key: 'export', label: 'Export' },
];

// Default Deny matrix helper
const createEmptyMatrix = () => {
  const matrix = {};
  MODULES.forEach((mod) => {
    matrix[mod] = {
      add: 'Deny',
      edit: 'Deny',
      delete: 'Deny',
      read: 'Deny',
      export: 'Deny',
    };
  });
  return matrix;
};

// Count active "Allow" permissions
const countPermissions = (matrix) => {
  if (!matrix) return 0;
  let count = 0;
  Object.values(matrix).forEach((mod) => {
    Object.values(mod).forEach((val) => {
      if (val === 'Allow') count++;
    });
  });
  return count;
};

export function RoleManagementPage() {
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRoleId, setExpandedRoleId] = useState(null);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await roleService.getRoles();
      const mappedRoles = data.map((r) => {
        const funcs = r.access_functions ? r.access_functions.split(',') : [];
        const matrix = createEmptyMatrix();
        
        const hasAdd = funcs.includes('add');
        const hasEdit = funcs.includes('edit');
        const hasDelete = funcs.includes('delete');
        
        MODULES.forEach((mod) => {
          matrix[mod] = {
            add: hasAdd ? 'Allow' : 'Deny',
            edit: hasEdit ? 'Allow' : 'Deny',
            delete: hasDelete ? 'Allow' : 'Deny',
            read: 'Allow', 
            export: 'Deny',
          };
        });

        return {
          id: r.id,
          name: r.role_name,
          description: `Role ID: ${r.id}, modified by ${r.last_modified_by || 'system'}`,
          isAdmin: r.is_admin === 1,
          permissions: matrix,
          originalFunctions: funcs,
        };
      });
      setRoles(mappedRoles);
    } catch (error) {
      console.error('Failed to fetch roles', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // Modal State for "Add Role"
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleIsAdmin, setNewRoleIsAdmin] = useState(false);
  const [newRoleMatrix, setNewRoleMatrix] = useState(createEmptyMatrix);
  const [nameError, setNameError] = useState(false);

  // Filtered Roles
  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const q = searchQuery.toLowerCase();
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }, [roles, searchQuery]);

  // KPI Calculations
  const adminRolesCount = useMemo(() => roles.filter((r) => r.isAdmin).length, [roles]);
  const assignedRolesCount = roles.length;

  // Toggle Modal Open/Close
  const handleOpenAddModal = () => {
    setNewRoleName('');
    setNewRoleDesc('');
    setNewRoleIsAdmin(false);
    setNewRoleMatrix(createEmptyMatrix());
    setNameError(false);
    setIsAddModalOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddModalOpen(false);
  };

  const handleResetAddModal = () => {
    setNewRoleName('');
    setNewRoleDesc('');
    setNewRoleIsAdmin(false);
    setNewRoleMatrix(createEmptyMatrix());
    setNameError(false);
  };

  // Toggle Modal Permission Matrix Cell
  const handleToggleModalPermission = (moduleName, actionKey) => {
    setNewRoleMatrix((prev) => {
      const current = prev[moduleName][actionKey];
      const next = current === 'Allow' ? 'Deny' : 'Allow';
      return {
        ...prev,
        [moduleName]: {
          ...prev[moduleName],
          [actionKey]: next,
        },
      };
    });
  };

  // Create Role Submit
  const handleCreateRole = (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setNameError(true);
      return;
    }

    const newRole = {
      id: `role-${Date.now()}`,
      name: newRoleName.trim(),
      description: newRoleDesc.trim() || 'No description provided.',
      isAdmin: newRoleIsAdmin,
      permissions: newRoleMatrix,
    };

    setRoles((prev) => [newRole, ...prev]);
    handleCloseAddModal();
  };

  // Delete Role
  const handleDeleteRole = (id) => {
    setRoles((prev) => prev.filter((r) => r.id !== id));
    if (expandedRoleId === id) setExpandedRoleId(null);
  };

  // Toggle Inline Accordion for Row
  const handleToggleConfigure = (id) => {
    setExpandedRoleId((prev) => (prev === id ? null : id));
  };

  // Toggle Permission Cell in Inline Accordion
  const handleToggleInlinePermission = (roleId, moduleName, actionKey) => {
    setRoles((prev) =>
      prev.map((role) => {
        if (role.id === roleId) {
          const currentVal = role.permissions[moduleName]?.[actionKey] || 'Deny';
          const nextVal = currentVal === 'Allow' ? 'Deny' : 'Allow';
          return {
            ...role,
            permissions: {
              ...role.permissions,
              [moduleName]: {
                ...role.permissions[moduleName],
                [actionKey]: nextVal,
              },
            },
          };
        }
        return role;
      })
    );
  };

  return (
    <div className="rm-container">
      {/* ── Top Header & KPI Summary Bar ────────────────────────────────────────── */}
      <div className="rm-header">
        <div className="rm-header-top">
          <div>
            <h1 className="rm-page-title">Roles and Permissions</h1>
            <p className="rm-page-sub">
              Manage enterprise access controls, administrative rights, and module permissions.
            </p>
          </div>
          <button
            type="button"
            className="rm-btn-primary"
            {...activatable(handleOpenAddModal, { label: 'Add New Role' })}
          >
            <Plus size={16} />
            <span>Add Role</span>
          </button>
        </div>

        {/* 4 Compact Stat Cards */}
        <div className="rm-kpi-grid">
          <div className="rm-kpi-card">
            <div className="rm-kpi-icon blue">
              <Users size={16} />
            </div>
            <div className="rm-kpi-info">
              <div className="rm-kpi-val">128</div>
              <div className="rm-kpi-lbl">Total Users</div>
            </div>
          </div>

          <div className="rm-kpi-card">
            <div className="rm-kpi-icon green">
              <ShieldCheck size={16} />
            </div>
            <div className="rm-kpi-info">
              <div className="rm-kpi-val">{adminRolesCount}</div>
              <div className="rm-kpi-lbl">Admin Roles</div>
            </div>
          </div>

          <div className="rm-kpi-card">
            <div className="rm-kpi-icon purple">
              <Lock size={16} />
            </div>
            <div className="rm-kpi-info">
              <div className="rm-kpi-val">{assignedRolesCount}</div>
              <div className="rm-kpi-lbl">Assigned Roles</div>
            </div>
          </div>

          <div className="rm-kpi-card">
            <div className="rm-kpi-icon amber">
              <ShieldAlert size={16} />
            </div>
            <div className="rm-kpi-info">
              <div className="rm-kpi-val">2</div>
              <div className="rm-kpi-lbl">Unassigned Roles</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Section (Search & Existing Roles List Table) ────────────────── */}
      <div className="rm-main-section">
        <div className="rm-table-toolbar">
          <div className="rm-search-wrap">
            <Search className="rm-search-icon" />
            <input
              type="text"
              className="rm-search-input"
              placeholder="Search roles by name or description…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="rm-table-wrapper">
          <table className="rm-roles-table">
            <thead>
              <tr>
                <th style={{ width: '20%' }}>Role Name</th>
                <th style={{ width: '35%' }}>Description</th>
                <th style={{ width: '15%' }} className="text-center">
                  Permission Count
                </th>
                <th style={{ width: '10%' }} className="text-center">
                  Admin
                </th>
                <th style={{ width: '20%' }} className="text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="rm-empty-td">
                    <div className="rm-empty-state">
                      <Loader message="Loading roles..." />
                    </div>
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="rm-empty-td">
                    <div className="rm-empty-state">
                      <Shield size={32} />
                      <p>No matching roles found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role) => {
                  const isExpanded = expandedRoleId === role.id;
                  const pCount = countPermissions(role.permissions);

                  return (
                    <tr key={role.id} className="rm-role-row-container">
                      <td colSpan={5} style={{ padding: 0, border: 'none' }}>
                        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse' }}>
                          <tbody>
                            <tr className={`rm-row-tr ${isExpanded ? 'expanded' : ''}`}>
                              <td style={{ width: '20%' }}>
                                <div className="rm-cell-role-name">
                                  <div className="rm-role-badge-icon">
                                    <Shield size={14} />
                                  </div>
                                  <span className="rm-role-name">{role.name}</span>
                                </div>
                              </td>

                              <td style={{ width: '35%' }}>
                                <span className="rm-role-desc" title={role.description}>
                                  {role.description}
                                </span>
                              </td>

                              <td style={{ width: '15%' }} className="text-center">
                                <span className="rm-perm-badge">{pCount} Permissions</span>
                              </td>

                              <td style={{ width: '10%' }} className="text-center">
                                <span className={`rm-admin-pill ${role.isAdmin ? 'yes' : 'no'}`}>
                                  {role.isAdmin ? 'Yes' : 'No'}
                                </span>
                              </td>

                              <td style={{ width: '20%' }} className="text-right">
                                <div className="rm-action-btns">
                                  <button
                                    type="button"
                                    className={`rm-btn-action configure ${isExpanded ? 'active' : ''}`}
                                    {...activatable(() => handleToggleConfigure(role.id), {
                                      label: `Configure permissions for ${role.name}`,
                                      isExpanded,
                                    })}
                                  >
                                    <Edit2 size={13} />
                                    <span>Configure</span>
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>

                                  <button
                                    type="button"
                                    className="rm-btn-action delete"
                                    title="Delete Role"
                                    {...activatable(() => handleDeleteRole(role.id), {
                                      label: `Delete ${role.name}`,
                                    })}
                                  >
                                    <Trash2 size={13} />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Inline Accordion Expandable Permissions Matrix Panel */}
                        {isExpanded && (
                          <div className="rm-accordion-panel">
                            <div className="rm-accordion-header">
                              <div className="rm-acc-title-wrap">
                                <h3>Functions & Permission Matrix — {role.name}</h3>
                                <p>Click any toggle button to switch between Allow and Deny.</p>
                              </div>
                              <button
                                type="button"
                                className="rm-btn-sm-close"
                                {...activatable(() => setExpandedRoleId(null), {
                                  label: 'Close permissions matrix panel',
                                })}
                              >
                                Done
                              </button>
                            </div>

                            <table className="rm-matrix-table">
                              <thead>
                                <tr>
                                  <th style={{ width: '35%' }}>Function / Module Name</th>
                                  {ACTIONS.map((act) => (
                                    <th key={act.key} style={{ width: '13%' }} className="text-center">
                                      {act.label}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {MODULES.map((mod) => (
                                  <tr key={mod}>
                                    <td className="rm-mod-name" style={{ width: '35%' }}>
                                      {mod}
                                    </td>
                                    {ACTIONS.map((act) => {
                                      const status =
                                        role.permissions[mod]?.[act.key] || 'Deny';
                                      const isAllow = status === 'Allow';

                                      return (
                                        <td key={act.key} style={{ width: '13%' }} className="text-center">
                                          <button
                                            type="button"
                                            className={`rm-toggle-btn ${isAllow ? 'allow' : 'deny'
                                              }`}
                                            {...activatable(
                                              () =>
                                                handleToggleInlinePermission(
                                                  role.id,
                                                  mod,
                                                  act.key
                                                ),
                                              {
                                                label: `Toggle ${act.label} for ${mod} in ${role.name}`,
                                                isPressed: isAllow,
                                              }
                                            )}
                                          >
                                            {isAllow ? 'Allow' : 'Deny'}
                                          </button>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
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

      {/* ── "Add Role" Modal Overlay ───────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="rm-modal-backdrop" {...dismissBackdrop(handleCloseAddModal)}>
          <div
            className="rm-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-role-modal-title"
          >
            <form onSubmit={handleCreateRole} className="rm-modal-form">
              {/* Sticky Header */}
              <div className="rm-modal-header">
                <div>
                  <h2 id="add-role-modal-title" className="rm-modal-title">
                    Add New Role
                  </h2>
                </div>
                <button
                  type="button"
                  className="rm-modal-close"
                  {...activatable(handleCloseAddModal, { label: 'Close modal' })}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable Body Container */}
              <div className="rm-modal-body-content">
                {/* Basic Info Inputs */}
                <div className="rm-form-grid">
                  <div className="rm-form-group">
                    <label htmlFor="role-name-input">
                      Role Name <span className="req">*</span>
                    </label>
                    <input
                      id="role-name-input"
                      type="text"
                      className={`rm-input ${nameError ? 'error' : ''}`}
                      placeholder="e.g., Compliance Officer"
                      value={newRoleName}
                      onChange={(e) => {
                        setNewRoleName(e.target.value);
                        if (e.target.value.trim()) setNameError(false);
                      }}
                    />
                    {nameError && <span className="rm-err-msg">Role Name is required</span>}
                  </div>

                  <div className="rm-form-group">
                    <label htmlFor="role-desc-input">Description</label>
                    <textarea
                      id="role-desc-input"
                      className="rm-textarea"
                      rows={2}
                      placeholder="Describe role responsibilities and privileges..."
                      value={newRoleDesc}
                      onChange={(e) => setNewRoleDesc(e.target.value)}
                    />
                  </div>

                  {/* Admin Switch */}
                  <div className="rm-form-group full">
                    <div className="rm-admin-switch-row">
                      <div>
                        <span className="rm-switch-label">Admin Rights</span>
                        <p className="rm-switch-sub">
                          Grants full administrative control across the platform.
                        </p>
                      </div>
                      <label className="rm-switch-btn" htmlFor="admin-rights-toggle">
                        <span className="sr-only">Admin Rights</span>
                        <input
                          id="admin-rights-toggle"
                          type="checkbox"
                          checked={newRoleIsAdmin}
                          onChange={(e) => setNewRoleIsAdmin(e.target.checked)}
                        />
                        <span className="rm-switch-slider" />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Modal Permissions Matrix Section */}
                <div className="rm-modal-matrix-section">
                  <h4 className="rm-matrix-heading">Configure Module Permissions</h4>
                  <table className="rm-matrix-table">
                    <thead>
                      <tr>
                        <th style={{ width: '35%' }}>Function / Module Name</th>
                        {ACTIONS.map((act) => (
                          <th key={act.key} style={{ width: '13%' }} className="text-center">
                            {act.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {MODULES.map((mod) => (
                        <tr key={mod}>
                          <td className="rm-mod-name" style={{ width: '35%' }}>
                            {mod}
                          </td>
                          {ACTIONS.map((act) => {
                            const status = newRoleMatrix[mod][act.key];
                            const isAllow = status === 'Allow';

                            return (
                              <td key={act.key} style={{ width: '13%' }} className="text-center">
                                <button
                                  type="button"
                                  className={`rm-toggle-btn ${isAllow ? 'allow' : 'deny'}`}
                                  {...activatable(
                                    () => handleToggleModalPermission(mod, act.key),
                                    {
                                      label: `Toggle ${act.label} permission for ${mod}`,
                                      isPressed: isAllow,
                                    }
                                  )}
                                >
                                  {isAllow ? 'Allow' : 'Deny'}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="rm-modal-footer">
                <button
                  type="button"
                  className="rm-btn-secondary"
                  {...activatable(handleCloseAddModal, { label: 'Cancel' })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rm-btn-reset"
                  {...activatable(handleResetAddModal, { label: 'Reset Form' })}
                >
                  <RotateCcw size={13} />
                  <span>Reset</span>
                </button>
                <button type="submit" className="rm-btn-primary">
                  <Check size={14} />
                  <span>Create Role</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RoleManagementPage;
