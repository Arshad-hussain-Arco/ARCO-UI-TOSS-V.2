import { useEffect, useMemo, useRef, useState } from 'react';
import { GripVertical, RotateCcw, Save } from 'lucide-react';

import { Button } from '@components/ui/Button/Button';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { getVisibleNavigation, applyOrder } from '@constants/navigation';
import { authService } from '@services/authService';

const EMPTY_ORDER = { order: [], adminChildrenOrder: [] };

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
 * Preferences > Sidebar Layout — every user's own personal sidebar order.
 * Starts from whatever's currently in effect for them (their own override
 * if they've set one, otherwise their role's admin-configured default —
 * both already merged into `user.sidebarNavOrder` server-side). Saving
 * writes a personal override that takes precedence over the role default;
 * "Reset to Role Default" clears it, falling back to whatever the admin
 * configured for their role.
 */
export function MySidebarLayoutPanel() {
  const toast = useToast();
  const { user, hasPermission, refreshUser } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Only items this user can actually see — same filter the live sidebar
  // uses. An employee with no Admin Panel access never gets an "Admin
  // Panel" row to reorder here, and the admin submenu section below simply
  // won't exist for them (their filtered catalog has no 'admin' item).
  const allowedNavigation = useMemo(
    () => getVisibleNavigation(user, hasPermission),
    [user, hasPermission],
  );
  const allowedAdminChildren = allowedNavigation.find((item) => item.id === 'admin')?.children || [];

  const [topLevel, setTopLevel] = useState(allowedNavigation);
  const [adminChildren, setAdminChildren] = useState(allowedAdminChildren);

  useEffect(() => {
    setTopLevel(applyOrder(allowedNavigation, user?.sidebarNavOrder?.order));
    setAdminChildren(applyOrder(allowedAdminChildren, user?.sidebarNavOrder?.adminChildrenOrder));
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.sidebarNavOrder, allowedNavigation]);

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
      await authService.updateMySidebarNavOrder({
        order: topLevel.map((item) => item.id),
        adminChildrenOrder: adminChildren.map((item) => item.id),
      });
      toast.success('Sidebar layout updated successfully.');
      setIsDirty(false);
      refreshUser();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update sidebar layout.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToRoleDefault = async () => {
    setIsSaving(true);
    try {
      await authService.updateMySidebarNavOrder(EMPTY_ORDER);
      toast.success('Sidebar layout reset to your role\'s default.');
      refreshUser();
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
          Drag to reorder the sidebar the way you want it. This only changes what you see — it
          does not affect anyone else, and it does not change which items you can see (that's
          still controlled by Roles &amp; Permissions).
        </p>
        <div className="pl-header-actions">
          <Button variant="outline" size="sm" leadingIcon={RotateCcw} onClick={handleResetToRoleDefault} disabled={isSaving}>
            Default
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={isSaving ? undefined : Save}
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            isLoading={isSaving}
          >
            Save
          </Button>
        </div>
      </div>

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
    </div>
  );
}

export default MySidebarLayoutPanel;
