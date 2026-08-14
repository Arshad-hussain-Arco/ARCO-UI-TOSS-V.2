import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Users,
  ShieldAlert,
  Edit,
  Trash,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Check,
  Lock,
  Loader2,
  Save,
} from 'lucide-react';
import { activatable, dismissBackdrop } from '@utils/interactive';
import { useToast } from '@hooks/useToast';
import { useDebounce } from '@hooks/useDebounce';
import roleService from '@services/roleService';
import consultantService from '@services/consultantService';
import './RoleManagementPage.css';

// Permission catalog — mirrors the codes seeded by
// ARCO-API-TOSS-V.2/rbac/management/commands/seed_permissions.py. Every
// role's `permissions` is a flat list of these codes (never the old nested
// module/Allow-Deny matrix). Admin Panel access (Roles & Permissions, Leave
// Policy Management, System Settings) is a separate `isAdmin` flag and has
// no codes of its own here.
const PERMISSION_CATALOG = [
  {
    module: 'Project Monitoring',
    codes: [
      { code: 'PROJECT_MONITORING_VIEW', label: 'View' },
      { code: 'PROJECT_MONITORING_EXPORT', label: 'Export' },
    ],
  },
  {
    module: 'Environment Dashboard',
    codes: [
      { code: 'ENVIRONMENT_DASHBOARD_VIEW', label: 'View' },
      { code: 'ENVIRONMENT_DASHBOARD_CREATE', label: 'Create' },
      { code: 'ENVIRONMENT_DASHBOARD_EDIT', label: 'Edit' },
      { code: 'ENVIRONMENT_DASHBOARD_DELETE', label: 'Delete' },
      { code: 'ENVIRONMENT_DASHBOARD_EXPORT', label: 'Export' },
    ],
  },
  {
    module: 'Murex Runtime Trends',
    codes: [
      { code: 'MUREX_RUNTIME_VIEW', label: 'View' },
      // Script Management tab (category CRUD) — a mutable sub-feature of
      // this otherwise read-only screen, gated separately.
      { code: 'MUREX_SCRIPT_CATEGORY_CREATE', label: 'Create Category' },
      { code: 'MUREX_SCRIPT_CATEGORY_EDIT', label: 'Edit Category' },
      { code: 'MUREX_SCRIPT_CATEGORY_DELETE', label: 'Delete Category' },
    ],
  },
  {
    module: 'EOD Management — Overview',
    codes: [{ code: 'EOD_OVERVIEW_VIEW', label: 'View' }],
  },
  {
    module: 'EOD Management — Configuration',
    codes: [
      { code: 'EOD_CONFIG_VIEW', label: 'View' },
      { code: 'EOD_CONFIG_CREATE', label: 'Create' },
      { code: 'EOD_CONFIG_EDIT', label: 'Edit' },
      { code: 'EOD_CONFIG_DELETE', label: 'Delete' },
    ],
  },
  {
    module: 'EOD Management — Schedules',
    codes: [
      { code: 'EOD_SCHEDULE_VIEW', label: 'View' },
      { code: 'EOD_SCHEDULE_CREATE', label: 'Create' },
      { code: 'EOD_SCHEDULE_EDIT', label: 'Edit' },
      { code: 'EOD_SCHEDULE_DELETE', label: 'Delete' },
    ],
  },
  {
    module: 'EOD Management — Control',
    codes: [
      { code: 'EOD_CONTROL_VIEW', label: 'View' },
      // Start/Stop/Pause/Resume/Run-All are one merged code, not split
      // further, per explicit direction.
      { code: 'EOD_CONTROL_EXECUTE', label: 'Execute' },
      { code: 'EOD_CONTROL_VIEW_LOGS', label: 'View Logs' },
    ],
  },
  {
    // Sidebar label is "Consultants" — matched here so admins can find it.
    module: 'Consultants',
    codes: [
      { code: 'EMPLOYEE_VIEW', label: 'View' },
      { code: 'EMPLOYEE_CREATE', label: 'Create' },
      // Resetting another employee's password rides on this same code —
      // no separate "Reset Password" permission.
      { code: 'EMPLOYEE_EDIT', label: 'Edit (incl. Reset Password)' },
      // Not a real delete — the action soft-toggles ACTIVE/INACTIVE status.
      { code: 'EMPLOYEE_ACTIVATE_DEACTIVATE', label: 'Activate / Deactivate' },
      { code: 'EMPLOYEE_EXPORT', label: 'Export' },
    ],
  },
  {
    module: 'Consultants — Teams',
    codes: [
      { code: 'TEAMS_VIEW', label: 'View' },
      { code: 'TEAMS_CREATE', label: 'Create' },
      { code: 'TEAMS_EDIT', label: 'Edit' },
      { code: 'TEAMS_DELETE', label: 'Delete' },
    ],
  },
  {
    // 4 sub-tabs are read-only views over the same team-calendar/quota
    // data — no edit action exists on this screen.
    module: 'Attendance',
    codes: [
      { code: 'ATTENDANCE_VIEW', label: 'View' },
      { code: 'ATTENDANCE_EXPORT', label: 'Export' },
    ],
  },
  {
    // Summary/Team views are two display modes over one dataset — no
    // create/edit action exists on this screen. CR/WO column mapping
    // lives under Admin Panel > System Settings instead (is_admin).
    module: 'Capacity Planning',
    codes: [
      { code: 'CAPACITY_PLANNING_VIEW', label: 'View' },
      { code: 'CAPACITY_PLANNING_EXPORT', label: 'Export' },
    ],
  },
  {
    // Upload + Run Reconciliation are two halves of one stateless
    // workflow (CREATE) — no DB persistence exists to "edit".
    module: 'Reconciliation',
    codes: [
      { code: 'RECONCILIATION_VIEW', label: 'View' },
      { code: 'RECONCILIATION_CREATE', label: 'Upload / Run' },
      { code: 'RECONCILIATION_EXPORT', label: 'Export' },
    ],
  },
  {
    module: 'Important Links',
    codes: [
      { code: 'IMPORTANT_LINKS_VIEW', label: 'View' },
      { code: 'IMPORTANT_LINKS_CREATE', label: 'Create' },
      { code: 'IMPORTANT_LINKS_EDIT', label: 'Edit' },
      { code: 'IMPORTANT_LINKS_DELETE', label: 'Delete' },
      { code: 'IMPORTANT_LINKS_PIN_HEADER', label: 'Pin to Header' },
    ],
  },
  {
    module: 'Important Links — Groups',
    codes: [
      { code: 'IMPORTANT_LINKS_GROUP_CREATE', label: 'Create' },
      { code: 'IMPORTANT_LINKS_GROUP_EDIT', label: 'Rename' },
      { code: 'IMPORTANT_LINKS_GROUP_DELETE', label: 'Delete' },
    ],
  },
  {
    module: 'Documents',
    codes: [
      { code: 'DOCUMENTS_VIEW', label: 'View (tree only)' },
      { code: 'DOCUMENTS_CREATE', label: 'Create' },
      { code: 'DOCUMENTS_EDIT', label: 'Edit' },
      { code: 'DOCUMENTS_DELETE', label: 'Delete' },
      { code: 'DOCUMENTS_DOWNLOAD', label: 'Download / View Content' },
    ],
  },
];

// Count assigned permission codes
const countPermissions = (codes) => (Array.isArray(codes) ? codes.length : 0);

// Map backend role structure (flat permission-code list) to frontend structure
const mapRole = (r) => {
  let codes = r.permissions;
  if (typeof codes === 'string') {
    try {
      codes = JSON.parse(codes);
    } catch (e) {
      console.error('Failed to parse permissions', e);
      codes = [];
    }
  }
  return {
    id: r.id,
    name: r.role_name,
    description: r.description || '-',
    isAdmin: r.isadmin === 1 || r.isadmin === true,
    permissions: Array.isArray(codes) ? codes : [],
  };
};

export function RoleManagementPage() {
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [expandedRoleId, setExpandedRoleId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({
    total_users: 0,
    admin_roles: 0,
    assigned_roles: 0,
    unassigned_roles: 0,
  });
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [roleToCancel, setRoleToCancel] = useState(null);
  const [dirtyRoles, setDirtyRoles] = useState(new Set());

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await roleService.getRoles();
      if (response && response.data && response.stats) {
        setRoles(response.data.map(mapRole));
        setStats(response.stats);
      } else if (Array.isArray(response)) {
        setRoles(response.map(mapRole));
      } else if (response && response.data && Array.isArray(response.data)) {
        setRoles(response.data.map(mapRole));
      }
    } catch (err) {
      toast.error('Failed to load roles.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);


  // Modal State for "Add Role"
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRoleIsAdmin, setNewRoleIsAdmin] = useState(false);
  const [newRoleCodes, setNewRoleCodes] = useState(() => []);
  const [nameError, setNameError] = useState(false);

  // Filtered Roles
  const filteredRoles = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return roles;
    const q = debouncedSearchQuery.toLowerCase();
    return roles.filter(
      (r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q)
    );
  }, [roles, debouncedSearchQuery]);

  // Toggle Modal Open/Close
  const handleOpenAddModal = () => {
    setNewRoleName('');
    setNewRoleDesc('');
    setNewRoleIsAdmin(false);
    setNewRoleCodes([]);
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
    setNewRoleCodes([]);
    setNameError(false);
  };

  // Toggle a permission code in the "Add Role" modal
  const handleToggleModalPermission = (code) => {
    setNewRoleCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  // Create Role Submit
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) {
      setNameError(true);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: newRoleName.trim(),
        description: newRoleDesc,
        isAdmin: newRoleIsAdmin,
        permissions: newRoleCodes,
      };
      await roleService.createRole(payload);
      toast.success('Role permissions added successfully.');
      handleCloseAddModal();
      fetchRoles();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to create role.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Role
  const handleDeleteRole = (id) => {
    const role = roles.find((r) => r.id === id);
    if (role) setRoleToDelete(role);
  };

  const confirmDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      await roleService.deleteRole(roleToDelete.id);
      toast.success('Role deleted successfully.');
      if (expandedRoleId === roleToDelete.id) setExpandedRoleId(null);
      fetchRoles();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete role.');
    } finally {
      setRoleToDelete(null);
    }
  };

  // Update Role (Inline Configuration)
  const handleUpdateRole = async (role) => {
    setIsSaving(true);
    try {
      await roleService.updateRole(role.id, {
        name: role.name,
        isAdmin: role.isAdmin,
        description: role.description === '-' ? '' : role.description,
        permissions: role.permissions,
      });
      toast.success('Role permissions updated successfully.');
      setDirtyRoles((prev) => {
        const next = new Set(prev);
        next.delete(role.id);
        return next;
      });
      setExpandedRoleId(null);
      fetchRoles();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update role permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle Inline Accordion for Row
  const handleToggleConfigure = (id) => {
    if (expandedRoleId && expandedRoleId === id && dirtyRoles.has(id)) {
      setRoleToCancel(id);
      return;
    }
    if (expandedRoleId && expandedRoleId !== id && dirtyRoles.has(expandedRoleId)) {
      setRoleToCancel(expandedRoleId);
      return;
    }
    setExpandedRoleId((prev) => (prev === id ? null : id));
  };

  const handleCancelClick = (roleId) => {
    if (dirtyRoles.has(roleId)) {
      setRoleToCancel(roleId);
    } else {
      setExpandedRoleId(null);
    }
  };

  const confirmCancel = () => {
    setExpandedRoleId(null);
    setRoleToCancel(null);
    fetchRoles(); // Reset unsaved changes
    setDirtyRoles(new Set()); // Reset dirty state
  };

  // Toggle a permission code for a role in the inline accordion
  const handleToggleInlinePermission = (roleId, code) => {
    setDirtyRoles((prev) => new Set(prev).add(roleId));
    setRoles((prev) =>
      prev.map((role) => {
        if (role.id === roleId) {
          const has = role.permissions.includes(code);
          return {
            ...role,
            permissions: has
              ? role.permissions.filter((c) => c !== code)
              : [...role.permissions, code],
          };
        }
        return role;
      })
    );
  };

  // Update Role Description Inline
  const handleInlineDescriptionChange = (roleId, newDescription) => {
    setDirtyRoles((prev) => new Set(prev).add(roleId));
    setRoles((prev) =>
      prev.map((role) => {
        if (role.id === roleId) {
          return {
            ...role,
            description: newDescription,
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


        {/* 4 Compact Stat Cards */}
        <div className="rm-kpi-grid">
          <div className="rm-kpi-card">
            <div className="rm-kpi-icon blue">
              <Users size={16} />
            </div>
            <div className="rm-kpi-info">
              <div className="rm-kpi-val">{stats.total_users}</div>
              <div className="rm-kpi-lbl">Total Users</div>
            </div>
          </div>

          <div className="rm-kpi-card">
            <div className="rm-kpi-icon green">
              <ShieldCheck size={16} />
            </div>
            <div className="rm-kpi-info">
              <div className="rm-kpi-val">{stats.admin_roles}</div>
              <div className="rm-kpi-lbl">Admin Roles</div>
            </div>
          </div>

          <div className="rm-kpi-card">
            <div className="rm-kpi-icon purple">
              <Lock size={16} />
            </div>
            <div className="rm-kpi-info">
              <div className="rm-kpi-val">{stats.assigned_roles}</div>
              <div className="rm-kpi-lbl">Assigned Roles</div>
            </div>
          </div>

          <div className="rm-kpi-card">
            <div className="rm-kpi-icon amber">
              <ShieldAlert size={16} />
            </div>
            <div className="rm-kpi-info">
              <div className="rm-kpi-val">{stats.unassigned_roles}</div>
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
              style={{ paddingRight: '32px' }} />
            {searchQuery && (
              <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="rm-header-top">

            <button
              type="button"
              className="rm-btn-primary"
              {...activatable(handleOpenAddModal, { label: 'Add New Role' })}
            >
              <Plus size={16} />
              <span>Add Role</span>
            </button>
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
                      <Loader2 size={32} className="spin" style={{ opacity: 0.5 }} />
                      <p>Loading roles...</p>
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
                                    {/* <Edit size={13} /> */}
                                    <span>Configure</span>
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                  </button>

                                  <button
                                    type="button"
                                    className="action-icon-btn delete"
                                    title="Delete Role"
                                    {...activatable(() => handleDeleteRole(role.id), {
                                      label: `Delete ${role.name}`,
                                    })}
                                  >
                                    <Trash size={13} />
                                    {/* <span>Delete</span> */}
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
                              <div className="rm-acc-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                  type="text"
                                  className="ef-input"
                                  style={{ padding: '6px 12px', height: '32px', fontSize: '13px', width: '250px' }}
                                  value={role.description === '-' ? '' : role.description}
                                  onChange={(e) => handleInlineDescriptionChange(role.id, e.target.value)}
                                  placeholder="Role Description"
                                />
                                <button
                                  type="button"
                                  className="rm-btn-sm-close"
                                  disabled={isSaving}
                                  style={{ padding: '6px 12px', fontSize: '13px', height: '32px', display: 'flex', alignItems: 'center' }}
                                  {...activatable(() => handleCancelClick(role.id), {
                                    label: 'Cancel permission changes',
                                  })}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="rm-btn-primary"
                                  disabled={isSaving || pCount === 0 || !dirtyRoles.has(role.id)}
                                  style={{ padding: '6px 12px', fontSize: '13px', height: '32px', display: 'flex', alignItems: 'center', opacity: pCount === 0 || !dirtyRoles.has(role.id) ? 0.5 : 1, cursor: pCount === 0 || !dirtyRoles.has(role.id) ? 'not-allowed' : 'pointer' }}
                                  {...activatable(() => handleUpdateRole(role), {
                                    label: 'Save permission changes',
                                  })}
                                >
                                  {isSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                                  <span style={{ marginLeft: '4px' }}>Save Changes</span>
                                </button>
                              </div>
                            </div>

                            <table className="rm-matrix-table">
                              <thead>
                                <tr>
                                  <th>Function / Module Name</th>
                                  <th>Permissions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {PERMISSION_CATALOG.map(({ module, codes }) => (
                                  <tr key={module}>
                                    <td className="rm-mod-name">{module}</td>
                                    <td>
                                      <div className="rm-code-badges">
                                        {codes.map(({ code, label }) => {
                                          const isAllow = role.permissions.includes(code);
                                          return (
                                            <button
                                              key={code}
                                              type="button"
                                              className={`rm-toggle-btn ${isAllow ? 'allow' : 'deny'}`}
                                              {...activatable(
                                                () => handleToggleInlinePermission(role.id, code),
                                                {
                                                  label: `Toggle ${label} for ${module} in ${role.name}`,
                                                  isPressed: isAllow,
                                                }
                                              )}
                                            >
                                              {label}: {isAllow ? 'Allow' : 'Deny'}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </td>
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

      {/* ── "Delete Role" Confirmation Modal ────────────────────────────────────── */}
      {roleToDelete && (
        <div className="rm-modal-backdrop" {...dismissBackdrop(() => setRoleToDelete(null))}>
          <div
            className="rm-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-role-modal-title"
            style={{ maxWidth: '400px' }}
          >
            <div className="rm-modal-header">
              <h2 id="delete-role-modal-title" className="rm-modal-title">
                Confirm Delete
              </h2>
              <button
                type="button"
                className="rm-modal-close"
                {...activatable(() => setRoleToDelete(null), { label: 'Close modal' })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="rm-modal-body-content" style={{ padding: '20px' }}>
              <p style={{ margin: 0, fontSize: '14px', }}>
                Are you sure you want to delete the role <strong>{roleToDelete.name}</strong>? This action cannot be undone.
              </p>
            </div>
            <div className="rm-modal-footer">
              <button
                type="button"
                className="rm-btn-secondary"
                {...activatable(() => setRoleToDelete(null), { label: 'Cancel' })}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rm-btn-primary"
                style={{ backgroundColor: 'var(--c-danger)', borderColor: 'var(--c-danger)' }}
                {...activatable(confirmDeleteRole, { label: 'Confirm Delete' })}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── "Cancel" Confirmation Modal ────────────────────────────────────── */}
      {roleToCancel && (
        <div className="rm-modal-backdrop" {...dismissBackdrop(() => setRoleToCancel(null))}>
          <div
            className="rm-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cancel-role-modal-title"
            style={{ maxWidth: '400px' }}
          >
            <div className="rm-modal-header">
              <h2 id="cancel-role-modal-title" className="rm-modal-title">
                Discard Changes
              </h2>
              <button
                type="button"
                className="rm-modal-close"
                {...activatable(() => setRoleToCancel(null), { label: 'Close modal' })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="rm-modal-body-content" style={{ padding: '20px' }}>
              <p style={{ margin: 0, fontSize: '14px', }}>
                You have unsaved changes. Are you sure you want to discard them?
              </p>
            </div>
            <div className="rm-modal-footer">
              <button
                type="button"
                className="rm-btn-secondary"
                {...activatable(() => setRoleToCancel(null), { label: 'Keep Editing' })}
              >
                Keep Editing
              </button>
              <button
                type="button"
                className="rm-btn-primary"
                style={{ backgroundColor: 'var(--c-danger)', borderColor: 'var(--c-danger)' }}
                {...activatable(confirmCancel, { label: 'Discard Changes' })}
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

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
                        <th>Function / Module Name</th>
                        <th>Permissions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PERMISSION_CATALOG.map(({ module, codes }) => (
                        <tr key={module}>
                          <td className="rm-mod-name">{module}</td>
                          <td>
                            <div className="rm-code-badges">
                              {codes.map(({ code, label }) => {
                                const isAllow = newRoleCodes.includes(code);
                                return (
                                  <button
                                    key={code}
                                    type="button"
                                    className={`rm-toggle-btn ${isAllow ? 'allow' : 'deny'}`}
                                    {...activatable(
                                      () => handleToggleModalPermission(code),
                                      {
                                        label: `Toggle ${label} permission for ${module}`,
                                        isPressed: isAllow,
                                      }
                                    )}
                                  >
                                    {label}: {isAllow ? 'Allow' : 'Deny'}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
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
