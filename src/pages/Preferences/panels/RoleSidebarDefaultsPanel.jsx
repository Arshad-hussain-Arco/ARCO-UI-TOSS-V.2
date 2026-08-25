import { useCallback, useEffect, useRef, useState } from 'react';
import { GripVertical, RotateCcw, Save } from 'lucide-react';

import { Button } from '@components/ui/Button/Button';
import { Select } from '@components/forms/Select/Select';
import { Loader } from '@components/feedback/Loader/Loader';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { getVisibleNavigation, applyOrder } from '@constants/navigation';
import { roleService } from '@services/roleService';

const EMPTY_ORDER = { order: [], adminChildrenOrder: [] };

/** Nav items the given role (its own permissions/isadmin, not the viewing admin's) can see. */
function catalogForRole(role) {
  if (!role) return [];
  const codes = new Set(role.permissions || []);
  return getVisibleNavigation({ isAdmin: !!role.isadmin }, (code) => codes.has(code));
}

/**
 * Reorderable list of nav items via native HTML5 drag-and-drop (no added
 * dependency) — drag a row onto another row to drop it into that slot.
 */
function DragList({ items, onChange }) {
  const dragIndex = useRef(null);
  const [overIndex, setOverIndex] = useState(null);

  const handleDrop = (dropIndex) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    setOverIndex(null);
    if (from === null || from === dropIndex) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(dropIndex, 0, moved);
    onChange(next);
  };

  return (
    <ul className="pl-item-list">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <li
            key={item.id}
            className="pl-item-row"
            draggable
            data-dragging={dragIndex.current === index}
            data-drop-target={overIndex === index && dragIndex.current !== index}
            onDragStart={() => {
              dragIndex.current = index;
            }}
            onDragEnter={() => setOverIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={() => {
              dragIndex.current = null;
              setOverIndex(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              handleDrop(index);
            }}
          >
            <GripVertical size={13} className="pl-item-grip" aria-hidden="true" />
            {Icon && <Icon size={13} className="pl-item-icon" aria-hidden="true" />}
            <span className="pl-item-label">{item.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Preferences > Sidebar Layout Defaults (admin only) — lets an admin change
 * the default sidebar display order for a chosen role. Every employee
 * holding that role sees the sidebar in this order UNLESS they've set
 * their own personal order (Preferences > Sidebar Layout, open to
 * everyone) — a personal override always wins over the role default.
 * Visibility itself stays fully controlled by Roles & Permissions; this
 * only changes ordering.
 */
export function RoleSidebarDefaultsPanel() {
  const toast = useToast();
  const { user, refreshUser } = useAuth();

  const [roles, setRoles] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState(user?.roleId ?? null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [topLevel, setTopLevel] = useState([]);
  const [adminChildren, setAdminChildren] = useState([]);

  useEffect(() => {
    roleService.getRoles()
      .then((res) => setRoles(res?.data || []))
      .catch(() => toast.error('Failed to load roles.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrderForRole = useCallback((roleId, roleList) => {
    if (!roleId) return;
    const role = roleList.find((r) => String(r.id) === String(roleId));
    // Only items THIS role can actually see, not the viewing admin's own —
    // so a role with no Admin Panel access can never be given an "Admin
    // Panel" row to reorder, matching the live sidebar's own filter.
    const allowedCatalog = catalogForRole(role);
    const allowedAdminChildren = allowedCatalog.find((item) => item.id === 'admin')?.children || [];

    setIsLoadingOrder(true);
    roleService.getSidebarNavOrder(roleId)
      .then((data) => {
        const navOrder = data || EMPTY_ORDER;
        setTopLevel(applyOrder(allowedCatalog, navOrder.order));
        setAdminChildren(applyOrder(allowedAdminChildren, navOrder.adminChildrenOrder));
        setIsDirty(false);
      })
      .catch(() => toast.error('Failed to load sidebar layout for this role.'))
      .finally(() => setIsLoadingOrder(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedRoleId && roles.length > 0) loadOrderForRole(selectedRoleId, roles);
  }, [selectedRoleId, roles, loadOrderForRole]);

  const handleTopLevelChange = (next) => {
    setTopLevel(next);
    setIsDirty(true);
  };

  const handleAdminChildrenChange = (next) => {
    setAdminChildren(next);
    setIsDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await roleService.updateSidebarNavOrder(selectedRoleId, {
        order: topLevel.map((item) => item.id),
        adminChildrenOrder: adminChildren.map((item) => item.id),
      });
      toast.success('Sidebar layout updated successfully.');
      setIsDirty(false);
      if (String(selectedRoleId) === String(user?.roleId)) refreshUser();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update sidebar layout.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsSaving(true);
    try {
      await roleService.updateSidebarNavOrder(selectedRoleId, EMPTY_ORDER);
      toast.success("Sidebar layout reset to the developer's default.");
      loadOrderForRole(selectedRoleId, roles);
      if (String(selectedRoleId) === String(user?.roleId)) refreshUser();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reset sidebar layout.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pl-panel-root">
      <div className="pl-header">
        <p className="pl-subtitle">
          Drag to reorder the default sidebar for everyone in the selected role. This does not
          affect who can see an item — that is still controlled entirely by Roles &amp;
          Permissions — and a user who has set their own personal order (Preferences &gt;
          Sidebar Layout) will keep seeing their own order instead of this default.
        </p>
        <div className="pl-header-actions">
          <Select
            className="pl-role-select"
            value={roles.length > 0 ? (selectedRoleId ?? '') : ''}
            onChange={(val) => setSelectedRoleId(val)}
            options={roles.map(r => ({ value: r.id, label: r.role_name }))}
            placeholder={roles.length === 0 ? 'Loading roles...' : 'Select a role...'}
            disabled={roles.length === 0}
          />
          <Button variant="outline" size="sm" leadingIcon={RotateCcw} onClick={handleResetToDefault} disabled={isSaving || !selectedRoleId}>
            Default
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={isSaving ? undefined : Save}
            onClick={handleSave}
            disabled={isSaving || !isDirty || !selectedRoleId}
            isLoading={isSaving}
          >
            Save
          </Button>
        </div>
      </div>

      {isLoadingOrder ? (
        <Loader size="md" message="Loading role defaults..." />
      ) : (
        <div className="pl-panels">
          <section className="pl-section">
            <h4 className="pl-section-title">Main Navigation</h4>
            <DragList items={topLevel} onChange={handleTopLevelChange} />
          </section>

          {adminChildren.length > 0 && (
            <section className="pl-section">
              <h4 className="pl-section-title">Admin Panel Submenu</h4>
              <DragList items={adminChildren} onChange={handleAdminChildrenChange} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default RoleSidebarDefaultsPanel;
