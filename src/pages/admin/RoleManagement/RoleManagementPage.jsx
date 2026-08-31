import { useState, useMemo, useEffect, useCallback, Fragment } from 'react';
import {
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Users,
  ShieldAlert,
  Edit,
  Trash,
  Trash2,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  Check,
  Lock,
  Loader2,
  Save,
  Ban,
  UserCog,
} from 'lucide-react';
import { activatable, dismissBackdrop } from '@utils/interactive';
import { useToast } from '@hooks/useToast';
import { useDebounce } from '@hooks/useDebounce';
import { useAuth } from '@hooks/useAuth';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import roleService from '@services/roleService';
import consultantService from '@services/consultantService';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
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
      { code: 'EMPLOYEE_VIEW_INACTIVE', label: 'View Inactive Consultants' },
      { code: 'EMPLOYEE_CREATE', label: 'Create' },
      // Resetting another employee's password rides on this same code —
      // no separate "Reset Password" permission.
      { code: 'EMPLOYEE_EDIT', label: 'Edit (incl. Reset Password)' },
      // Not a real delete — the action soft-toggles ACTIVE/INACTIVE status.
      { code: 'EMPLOYEE_ACTIVATE_DEACTIVATE', label: 'Activate / Deactivate' },
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
    // Upload/Run and Export fold into View — anyone let onto this screen
    // can use the whole stateless workflow by default.
    module: 'Reconciliation',
    codes: [{ code: 'RECONCILIATION_VIEW', label: 'View (incl. Upload/Run/Export)' }],
  },
  {
    module: 'Important Links',
    codes: [
      { code: 'IMPORTANT_LINKS_VIEW', label: 'View' },
      { code: 'IMPORTANT_LINKS_CREATE', label: 'Create' },
      { code: 'IMPORTANT_LINKS_EDIT', label: 'Edit' },
      { code: 'IMPORTANT_LINKS_DELETE', label: 'Delete' },
    ],
  },
  {
    module: 'Important Links — Groups',
    codes: [
      { code: 'IMPORTANT_LINKS_GROUP_CREATE', label: 'Create' },
      { code: 'IMPORTANT_LINKS_GROUP_EDIT', label: 'Rename' },
      { code: 'IMPORTANT_LINKS_GROUP_DELETE', label: 'Delete' },
      { code: 'IMPORTANT_LINKS_PIN_HEADER', label: 'Pin to Header' },
      { code: 'IMPORTANT_LINKS_SHOW_HEADER', label: 'Show in Header' },
      { code: 'IMPORTANT_LINKS_GROUP_ACCESS_CONTROL', label: 'Manage Group Access' },
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
  useDocumentTitle('Roles & Permissions - Admin Panel');
  const toast = useToast();
  const { refreshUser } = useAuth();
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
  const [error, setError] = useState(null);

  const fetchRoles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
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
      setError(err);
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

  const handleAllowAllModal = () => {
    const allCodes = PERMISSION_CATALOG.flatMap(m => m.codes.map(c => c.code));
    setNewRoleCodes(allCodes);
  };

  const handleDenyAllModal = () => {
    setNewRoleCodes([]);
  };

  const handleToggleModuleModal = (allModuleCodes, toggleCodes, isViewAllowed) => {
    const removeCodes = allModuleCodes.map(c => c.code);
    const addCodes = toggleCodes.map(c => c.code);

    if (isViewAllowed) {
      // Turning OFF: remove ALL codes for this module
      setNewRoleCodes(prev => prev.filter(c => !removeCodes.includes(c)));
    } else {
      // Turning ON: add just the toggleCodes (View)
      setNewRoleCodes(prev => [...new Set([...prev, ...addCodes])]);
    }
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

      // Sync the active user's permissions if they just updated their own role
      refreshUser();

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

  const handleAllowAllInline = (roleId) => {
    setDirtyRoles((prev) => new Set(prev).add(roleId));
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id === roleId) {
          return {
            ...r,
            permissions: PERMISSION_CATALOG.flatMap(m => m.codes.map(c => c.code)),
          };
        }
        return r;
      })
    );
  };

  const handleDenyAllInline = (roleId) => {
    setDirtyRoles((prev) => new Set(prev).add(roleId));
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id === roleId) {
          return {
            ...r,
            permissions: [],
          };
        }
        return r;
      })
    );
  };

  const handleToggleModuleInline = (roleId, allModuleCodes, toggleCodes, isViewAllowed) => {
    setDirtyRoles((prev) => new Set(prev).add(roleId));
    const removeCodes = allModuleCodes.map(c => c.code);
    const addCodes = toggleCodes.map(c => c.code);

    setRoles((prev) =>
      prev.map((r) => {
        if (r.id === roleId) {
          if (isViewAllowed) {
            // Turning OFF: remove ALL codes for this module
            return {
              ...r,
              permissions: r.permissions.filter(c => !removeCodes.includes(c)),
            };
          } else {
            // Turning ON: add just the toggleCodes (View)
            return {
              ...r,
              permissions: [...new Set([...r.permissions, ...addCodes])],
            };
          }
        }
        return r;
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

  if (error) {
    return (
      <ErrorState
        title="Roles could not be loaded"
        description={error.message}
        onRetry={fetchRoles}
      />
    );
  }

  return (
    <div className="rm-container">
      {/* ── Top Header & KPI Summary Bar ────────────────────────────────────────── */}


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
            <colgroup>
              <col style={{ width: '20%' }} />
              <col style={{ width: '35%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Role Name</th>
                <th>Description</th>
                <th className="text-center">Permission Count</th>
                <th className="text-center">Admin</th>
                <th className="text-center">Actions</th>
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
                      <UserCog size={32} />
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
                                    <UserCog size={14} />
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
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                  <label className="rm-switch-btn" htmlFor={`admin-toggle-${role.id}`}>
                                    <span className="sr-only">Toggle Admin</span>
                                    <input
                                      id={`admin-toggle-${role.id}`}
                                      type="checkbox"
                                      checked={role.isAdmin}
                                      onChange={() => {
                                        setDirtyRoles((prev) => new Set(prev).add(role.id));
                                        setRoles((prev) => prev.map((r) => r.id === role.id ? { ...r, isAdmin: !r.isAdmin } : r));
                                      }}
                                    />
                                    <span className="rm-switch-slider"></span>
                                  </label>
                                  <span className={`rm-admin-pill ${role.isAdmin ? 'yes' : 'no'}`} style={{ minWidth: '32px' }}>
                                    {role.isAdmin ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </td>

                              <td className="text-center">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
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

                        {/* Inline Accordion Permissions Matrix */}
                        {isExpanded && (
                          <div className="rm-expanded-content" style={{ padding: '16px 20px', background: 'var(--surface-primary)', borderTop: '1px solid var(--border-primary)' }}>
                            <div className="rm-acc-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>Configure Permissions</h4>
                              <div className="rm-acc-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '4px' }}>Global Permissions:</span>
                                <button type="button" className="rm-btn-allow-all" onClick={() => handleAllowAllInline(role.id)}>Allow All</button>
                                <button type="button" className="rm-btn-deny-all" onClick={() => handleDenyAllInline(role.id)}>Deny All</button>
                                <div style={{ width: '1px', height: '20px', background: 'var(--border-primary)', margin: '0 4px' }}></div>
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

                            <div className="rm-permissions-list" style={{ marginTop: '12px' }}>
                              <div className="rm-list-header-row" style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', padding: '8px 12px' }}>
                                <div style={{ width: '160px', fontWeight: 600, fontSize: '10px', }}>Module / Page</div>
                                <div style={{ flex: 1, fontWeight: 600, fontSize: '10px', }}>Available Permissions Configuration</div>
                              </div>
                              <div className="rm-list-subheader-row" style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-primary)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Module Target Scope
                              </div>
                              {PERMISSION_CATALOG.map(({ module, codes }) => {
                                const viewCodeObj = codes.find(c => c.label.startsWith('View'));
                                const nonViewCodes = viewCodeObj ? codes.filter(c => c.code !== viewCodeObj.code) : codes;

                                // Modules with no dedicated View code (e.g. Important Links —
                                // Groups) have no real "master gate" — each permission stays
                                // independently toggleable, and the master switch is just a
                                // bulk allow-all/deny-all shortcut: it reads "on" as long as any
                                // code is allowed, and only reads "off" once every code is denied.
                                const isViewAllowed = viewCodeObj
                                  ? role.permissions.includes(viewCodeObj.code)
                                  : codes.some(c => role.permissions.includes(c.code));
                                const gatesSiblings = !!viewCodeObj;

                                const toggleCodes = viewCodeObj ? [viewCodeObj] : codes;

                                return (
                                  <div className="rm-module-row" key={module}>
                                    <div className="rm-module-sidebar">
                                      <span className="rm-mod-name">{module}</span>
                                      <label className="rm-switch-btn" htmlFor={`inline-module-toggle-${role.id}-${module}`}>
                                        <span className="sr-only">Toggle Module</span>
                                        <input
                                          id={`inline-module-toggle-${role.id}-${module}`}
                                          type="checkbox"
                                          checked={isViewAllowed}
                                          onChange={() => handleToggleModuleInline(role.id, codes, toggleCodes, isViewAllowed)}
                                        />
                                        <span className="rm-switch-slider"></span>
                                      </label>
                                    </div>
                                    <div className="rm-module-permissions">
                                      {nonViewCodes.length > 0 ? (
                                        nonViewCodes.map(({ code, label }) => {
                                          const isAllow = role.permissions.includes(code);
                                          return (
                                            <div
                                              className="rm-perm-box"
                                              key={code}
                                              style={gatesSiblings && !isViewAllowed ? { opacity: 0.5, pointerEvents: 'none' } : {}}
                                            >
                                              <span className="rm-perm-label" title={label}>
                                                {label}
                                              </span>
                                              <div className="rm-perm-toggle-group">
                                                <button
                                                  type="button"
                                                  className={`rm-perm-btn allow ${isAllow ? 'active' : ''}`}
                                                  {...activatable(
                                                    () => { if (!isAllow) handleToggleInlinePermission(role.id, code); },
                                                    { label: `Allow ${label} for ${module} in ${role.name}` }
                                                  )}
                                                >
                                                  <Check size={10} />
                                                  Allow
                                                </button>
                                                <button
                                                  type="button"
                                                  className={`rm-perm-btn deny ${!isAllow ? 'active' : ''}`}
                                                  {...activatable(
                                                    () => { if (isAllow) handleToggleInlinePermission(role.id, code); },
                                                    { label: `Deny ${label} for ${module} in ${role.name}` }
                                                  )}
                                                >
                                                  <Ban size={10} />
                                                  Deny
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                          View-only module
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash size={14} style={{ marginRight: '6px' }} />
                  Delete
                </div>
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
                  <div className="rm-matrix-header-action" style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                    <h4 className="rm-matrix-heading" style={{ fontSize: '11px' }}>Configure All Pages / Modules Permissions</h4>
                    <div className="rm-master-toggles">
                      <button type="button" className="rm-btn-allow-all" onClick={handleAllowAllModal}>Allow All</button>
                      <button type="button" className="rm-btn-deny-all" onClick={handleDenyAllModal}>Deny All</button>
                    </div>
                  </div>
                  <div className="rm-permissions-list">
                    <div className="rm-list-header-row" style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', padding: '8px 12px' }}>
                      <div style={{ width: '160px', fontWeight: 600, fontSize: '10px', }}>Module / Page</div>
                      <div style={{ flex: 1, fontWeight: 600, fontSize: '10px', }}>Available Permissions Configuration</div>
                    </div>
                    <div className="rm-list-subheader-row" style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-primary)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Module Target Scope
                    </div>
                    {PERMISSION_CATALOG.map(({ module, codes }) => {
                      const viewCodeObj = codes.find(c => c.label.startsWith('View'));
                      const nonViewCodes = viewCodeObj ? codes.filter(c => c.code !== viewCodeObj.code) : codes;

                      const isViewAllowed = viewCodeObj
                        ? newRoleCodes.includes(viewCodeObj.code)
                        : codes.some(c => newRoleCodes.includes(c.code));
                      const gatesSiblings = !!viewCodeObj;

                      const toggleCodes = viewCodeObj ? [viewCodeObj] : codes;

                      return (
                        <div className="rm-module-row" key={module}>
                          <div className="rm-module-sidebar">
                            <span className="rm-mod-name">{module}</span>
                            <label className="rm-switch-btn" htmlFor={`module-toggle-${module}`}>
                              <span className="sr-only">Toggle Module</span>
                              <input
                                id={`module-toggle-${module}`}
                                type="checkbox"
                                checked={isViewAllowed}
                                onChange={() => handleToggleModuleModal(codes, toggleCodes, isViewAllowed)}
                              />
                              <span className="rm-switch-slider"></span>
                            </label>
                          </div>
                          <div className="rm-module-permissions">
                            {nonViewCodes.length > 0 ? (
                              nonViewCodes.map(({ code, label }) => {
                                const isAllow = newRoleCodes.includes(code);
                                return (
                                  <div
                                    className="rm-perm-box"
                                    key={code}
                                    style={gatesSiblings && !isViewAllowed ? { opacity: 0.5, pointerEvents: 'none' } : {}}
                                  >
                                    <span className="rm-perm-label" title={label}>
                                      {label}
                                    </span>
                                    <div className="rm-perm-toggle-group">
                                      <button
                                        type="button"
                                        className={`rm-perm-btn allow ${isAllow ? 'active' : ''}`}
                                        {...activatable(
                                          () => { if (!isAllow) handleToggleModalPermission(code); },
                                          { label: `Allow ${label} permission for ${module}` }
                                        )}
                                      >
                                        <Check size={10} />
                                        Allow
                                      </button>
                                      <button
                                        type="button"
                                        className={`rm-perm-btn deny ${!isAllow ? 'active' : ''}`}
                                        {...activatable(
                                          () => { if (isAllow) handleToggleModalPermission(code); },
                                          { label: `Deny ${label} permission for ${module}` }
                                        )}
                                      >
                                        <Ban size={10} />
                                        Deny
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                View-only module
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
