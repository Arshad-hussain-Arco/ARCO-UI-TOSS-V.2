import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Code, Loader2, MessageCircle, Plus, Search, Server, Shield, X } from 'lucide-react';

import { EmptyState } from '@components/feedback/EmptyState/EmptyState';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { usePinnedLinks } from '@context/PinnedLinksContext';
import { useAsync } from '@hooks/useAsync';
import { useDebounce } from '@hooks/useDebounce';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useOnClickOutside } from '@hooks/useOnClickOutside';
import { linkService } from '@services/linkService';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { createId } from '@utils/id';

import { AddLinkModal } from './AddLinkModal';
import { GroupCard } from './GroupSection';
import './ImportantLinksPage.css';

/** Max number of groups that can be pinned to the header. */
const MAX_PINNED_GROUPS = 4;

/** Canonical icon mapping for server-supplied categories */
const CATEGORY_ICONS = {
  server: Server,
  code: Code,
  shield: Shield,
  chat: MessageCircle,
  book: BookOpen,
};

const norm = (str) => (str || '').toLowerCase();

// ─────────────────────────────────────────────────────────────────────────────
// Custom Group Filter Dropdown (toolbar)
// ─────────────────────────────────────────────────────────────────────────────
function GroupFilterDropdown({ groups, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useOnClickOutside(wrapRef, () => setOpen(false), open);

  const selectedLabel =
    selected === '__all__'
      ? 'All Groups'
      : (groups.find((g) => g.id === selected)?.title ?? 'All Groups');

  return (
    <div className="il-group-dropdown-wrapper" ref={wrapRef}>
      <button
        type="button"
        id="il-group-filter"
        className="il-group-trigger"
        data-open={open}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Filter by group"
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedLabel}
        </span>
        <ChevronDown size={12} strokeWidth={2} className="il-group-trigger-chevron" />
      </button>

      {open && (
        <div className="il-group-dropdown-panel" role="listbox" aria-label="Group filter options">
          <div className="il-group-dropdown-viewport">
            {/* All Groups */}
            <button
              type="button"
              role="option"
              aria-selected={selected === '__all__'}
              data-selected={selected === '__all__'}
              className="il-group-dropdown-item"
              onClick={() => { onChange('__all__'); setOpen(false); }}
            >
              <span style={{ flex: 1 }}>All Groups</span>
              {selected === '__all__' && (
                <Check size={11} strokeWidth={2.5} className="il-group-dropdown-item-check" />
              )}
            </button>

            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                role="option"
                aria-selected={selected === g.id}
                data-selected={selected === g.id}
                className="il-group-dropdown-item"
                onClick={() => { onChange(g.id); setOpen(false); }}
              >
                <span style={{ flex: 1 }}>{g.title}</span>
                {selected === g.id && (
                  <Check size={11} strokeWidth={2.5} className="il-group-dropdown-item-check" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────
export function ImportantLinksPage() {
  useDocumentTitle('Important Links');

  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('IMPORTANT_LINKS_CREATE');
  const canEdit = hasPermission('IMPORTANT_LINKS_EDIT');
  const canDelete = hasPermission('IMPORTANT_LINKS_DELETE');
  const canPinHeader = hasPermission('IMPORTANT_LINKS_PIN_HEADER');
  const canGroupEdit = hasPermission('IMPORTANT_LINKS_GROUP_EDIT');
  const canGroupDelete = hasPermission('IMPORTANT_LINKS_GROUP_DELETE');
  const canGroupCreate = hasPermission('IMPORTANT_LINKS_GROUP_CREATE');
  const { pinnedLinks, pinLink, unpinLink, updatePinnedLink } = usePinnedLinks();

  // ── Remote data ────────────────────────────────────────────────
  const fetchCategories = useCallback(() => linkService.getLinkCategories(), []);
  const { data: serverCategories, isLoading, error, refetch } = useAsync(fetchCategories);

  // ── Filter state ───────────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState('__all__');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  const [showModal, setShowModal] = useState(false);
  const [editLink, setEditLink] = useState(null); // { ...link, group: 'Group Title' }
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [renameGroupTarget, setRenameGroupTarget] = useState(null); // { id, title }
  const [renameGroupValue, setRenameGroupValue] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState(null); // { id, title }

  // ── Merged categories (server + local overrides + locally added) ──
  const mergedCategories = useMemo(() => {
    return serverCategories ?? [];
  }, [serverCategories]);

  // ── Filtered display ───────────────────────────────────────────
  const filteredCategories = useMemo(() => {
    const q = norm(debouncedSearchQuery.trim());

    return mergedCategories
      .filter((cat) => {
        if (selectedGroup !== '__all__' && cat.id !== selectedGroup) return false;
        if (!q) return true;
        if (norm(cat.title).includes(q)) return true;
        return cat.links.some(
          (l) =>
            norm(l.label).includes(q) ||
            norm(l.url).includes(q) ||
            norm(l.description).includes(q),
        );
      })
      .map((cat) => {
        if (!q) return cat;
        const matchingLinks = norm(cat.title).includes(q)
          ? cat.links
          : cat.links.filter(
            (l) =>
              norm(l.label).includes(q) ||
              norm(l.url).includes(q) ||
              norm(l.description).includes(q),
          );
        return { ...cat, links: matchingLinks };
      })
      .filter((cat) => cat.links.length > 0);
  }, [mergedCategories, selectedGroup, debouncedSearchQuery]);

  // Dropdown group options
  const dropdownGroups = useMemo(
    () => mergedCategories.map((c) => ({ id: c.id, title: c.title })),
    [mergedCategories],
  );

  // All group titles for the modal
  const allGroupTitles = useMemo(
    () => mergedCategories.map((c) => c.title),
    [mergedCategories],
  );

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditLink(null);
  }, []);

  // ── Handle Add Link ────────────────────────────────────────────
  const handleAddLink = useCallback(
    async ({ id, group, isNewGroup, label, url, sharedFolder, comments, pinToHeader, files }) => {
      if (pinToHeader) {
        const isGroupAlreadyPinned = pinnedLinks.some(p => p.groupTitle === group);
        if (!isGroupAlreadyPinned && pinnedLinks.length >= MAX_PINNED_GROUPS) {
          toast.error(`Only ${MAX_PINNED_GROUPS} group${MAX_PINNED_GROUPS === 1 ? '' : 's'} can be pinned to the header. Please unpin an existing group first to pin this new group.`);
          return;
        }
      }
      setIsSaving(true);
      try {
        let groupId;
        const existingGroup = serverCategories?.find((c) => c.title === group);

        if (isNewGroup || !existingGroup) {
          const newGroup = await linkService.createGroup(group);
          groupId = newGroup.id;
        } else {
          groupId = existingGroup.id;
        }

        const formData = new FormData();
        formData.append('link', label);
        formData.append('url', url);
        formData.append('content', [sharedFolder, comments].filter(Boolean).join(' · ') || '');
        formData.append('is_header', pinToHeader ? 1 : 0);
        formData.append('isHeader', pinToHeader ? 1 : 0);
        if (group) {
          formData.append('group', group);
        }
        if (files && files.length > 0 && files[0] instanceof File) {
          formData.append('file', files[0]);
        }

        const newLinkResponse = await linkService.createLink(formData);
        const newLinkId = newLinkResponse?.data?.id || id;

        refetch();
        window.dispatchEvent(new Event('pinned-links:refresh'));
        toast.success('Link added successfully');
        handleCloseModal();
      } catch (err) {
        console.error('Failed to add link:', err);
        toast.error(err.message || 'Failed to add link');
      } finally {
        setIsSaving(false);
      }
    },
    [serverCategories, pinLink, refetch, handleCloseModal, toast, pinnedLinks],
  );

  // ── Handle Update Link ─────────────────────────────────────────
  const handleUpdateLink = useCallback(
    async ({ id, group, label, url, sharedFolder, comments, pinToHeader, files }) => {
      if (pinToHeader) {
        const isGroupAlreadyPinned = pinnedLinks.some(p => p.groupTitle === group);
        if (!isGroupAlreadyPinned && pinnedLinks.length >= MAX_PINNED_GROUPS) {
          toast.error(`Only ${MAX_PINNED_GROUPS} group${MAX_PINNED_GROUPS === 1 ? '' : 's'} can be pinned to the header. Please unpin an existing group first to pin this new group.`);
          return;
        }
      }
      setIsSaving(true);
      try {
        const existingGroup = serverCategories?.find((c) => c.title === group);
        const groupId = existingGroup?.id;

        const hasNewFile = files && files.length > 0 && files[0] instanceof File;

        let payload;
        if (hasNewFile) {
          payload = new FormData();
          payload.append('link', label);
          payload.append('url', url);
          payload.append('content', [sharedFolder, comments].filter(Boolean).join(' · ') || '');
          payload.append('is_header', pinToHeader ? 1 : 0);
          payload.append('isHeader', pinToHeader ? 1 : 0);
          if (group) payload.append('group', group);
          payload.append('file', files[0]);
        } else {
          payload = {
            link: label,
            url: url,
            content: [sharedFolder, comments].filter(Boolean).join(' · ') || '',
            is_header: pinToHeader ? 1 : 0,
            isHeader: pinToHeader ? 1 : 0,
          };
          if (group) payload.group = group;

          if (!files || files.length === 0) {
            payload.file_name = null;
          }
        }

        await linkService.updateLink(id, payload);

        refetch();
        window.dispatchEvent(new Event('pinned-links:refresh'));
        toast.success('Link updated successfully');
        handleCloseModal();
      } catch (err) {
        console.error('Failed to update link:', err);
        toast.error(err.message || 'Failed to update link');
      } finally {
        setIsSaving(false);
      }
    },
    [serverCategories, pinLink, unpinLink, refetch, handleCloseModal, toast, pinnedLinks],
  );

  // ── Handle Delete Link ─────────────────────────────────────────
  const handleDeleteLink = useCallback((link) => {
    setDeleteTarget(link);
  }, []);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await linkService.deleteLink(deleteTarget.id);
      refetch();
      window.dispatchEvent(new Event('pinned-links:refresh'));
      toast.success('Link deleted successfully');
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete link:', err);
      toast.error(err.message || 'Failed to delete link');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Toggle Pin Group ───────────────────────────────────────────
  const handleTogglePinGroup = useCallback(async (groupId, currentPinnedStatus) => {
    const category = mergedCategories.find(c => c.id === groupId);
    if (!category) return;

    if (!currentPinnedStatus && pinnedLinks.length >= MAX_PINNED_GROUPS && !pinnedLinks.some(p => p.groupId === groupId)) {
      toast.error(`Only ${MAX_PINNED_GROUPS} group${MAX_PINNED_GROUPS === 1 ? '' : 's'} can be pinned to the header. Please unpin an existing group first to pin this new group.`);
      return;
    }

    const newPinStatus = !currentPinnedStatus;
    setIsSaving(true);
    try {
      await Promise.all(category.links.map(link => {
        if (link.pinToHeader !== newPinStatus) {
          const formData = new FormData();
          formData.append('link', link.label || '');
          formData.append('url', link.url || '');
          if (link.description) {
            formData.append('content', link.description);
          }
          if (category.title) {
            formData.append('group', category.title);
          }
          formData.append('is_header', newPinStatus ? 1 : 0);
          formData.append('isHeader', newPinStatus ? 1 : 0);
          return linkService.updateLink(link.id, formData);
        }
        return Promise.resolve();
      }));
      refetch();
      window.dispatchEvent(new Event('pinned-links:refresh'));
      toast.success(newPinStatus ? 'Group pinned to header' : 'Group unpinned from header');
    } catch (err) {
      console.error('Failed to update group pin status:', err);
      toast.error('Failed to update group pin status');
    } finally {
      setIsSaving(false);
    }
  }, [mergedCategories, pinnedLinks, refetch, toast]);

  // ── Open edit modal ────────────────────────────────────────────
  const handleEditLink = useCallback(
    (link) => {
      // Find which group this link belongs to for prefilling
      const parentGroup = mergedCategories.find((cat) =>
        cat.links.some((l) => l.id === link.id),
      );
      setEditLink({ ...link, group: parentGroup?.title ?? '' });
      setShowModal(true);
    },
    [mergedCategories],
  );

  // ── Rename Group ────────────────────────────────────────────────
  const handleRenameGroupClick = useCallback((category) => {
    setRenameGroupTarget({ id: category.id, title: category.title });
    setRenameGroupValue(category.title);
  }, []);

  const executeRenameGroup = async () => {
    if (!renameGroupTarget || !renameGroupValue.trim()) return;
    setIsSavingGroup(true);
    try {
      await linkService.updateGroup(renameGroupTarget.id, renameGroupValue.trim());
      await refetch();
      toast.success('Group renamed successfully');
      setRenameGroupTarget(null);
    } catch (err) {
      console.error('Failed to rename group:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to rename group');
    } finally {
      setIsSavingGroup(false);
    }
  };

  // ── Delete Group ────────────────────────────────────────────────
  const handleDeleteGroupClick = useCallback((category) => {
    setDeleteGroupTarget({ id: category.id, title: category.title });
  }, []);

  const executeDeleteGroup = async () => {
    if (!deleteGroupTarget) return;
    setIsSavingGroup(true);
    try {
      await linkService.deleteGroup(deleteGroupTarget.id);
      await refetch();
      window.dispatchEvent(new Event('pinned-links:refresh'));
      toast.success('Group deleted successfully');
      setDeleteGroupTarget(null);
    } catch (err) {
      console.error('Failed to delete group:', err);
      toast.error(err.response?.data?.message || err.message || 'Failed to delete group');
    } finally {
      setIsSavingGroup(false);
    }
  };

  return (
    <div className="il-page">

      {/* ── Filter / Action Toolbar ────────────────────────────── */}
      <div className="il-toolbar" role="toolbar" aria-label="Link filters">

        <GroupFilterDropdown
          groups={dropdownGroups}
          selected={selectedGroup}
          onChange={setSelectedGroup}
        />

        <div className="il-search-wrapper">
          <Search size={13} className="il-search-icon" aria-hidden="true" />
          <input
            id="il-search"
            type="text"
            className="il-search-input"
            placeholder="Search links…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search links"
            style={{ paddingRight: '32px' }} />
          {searchQuery && (
            <button type="button" className="il-search-clear-btn" onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <span className="il-toolbar-spacer" aria-hidden="true" />

        {canCreate && (
          <Button
            id="il-add-link-btn"
            variant="primary"
            size="sm"
            leadingIcon={Plus}
            onClick={() => { setEditLink(null); setShowModal(true); }}
          >
            Add Link
          </Button>
        )}
      </div>

      {/* ── Main Content ─────────────────────────────────────────── */}
      {error ? (
        <ErrorState
          title="Links could not be loaded"
          description={error.message}
          onRetry={refetch}
        />
      ) : isLoading && !serverCategories ? (
        <Loader message="Loading links…" />
      ) : filteredCategories.length === 0 ? (
        <EmptyState
          title="No links found"
          description={
            searchQuery
              ? `No results for "${searchQuery}". Try a different search term.`
              : 'No links have been published yet.'
          }
        />
      ) : (
        <div className="il-groups-grid">
          {filteredCategories.map((category) => {
            const isPinned = category.links.some(l => l.pinToHeader);
            return (
              <GroupCard
                key={category.id}
                id={category.id}
                title={category.title}
                icon={CATEGORY_ICONS[category.iconKey] ?? null}
                links={category.links}
                isPinned={isPinned}
                onTogglePinGroup={canPinHeader ? (status) => handleTogglePinGroup(category.id, status) : undefined}
                canEdit={canEdit}
                canDelete={canDelete}
                onEditLink={handleEditLink}
                onDeleteLink={handleDeleteLink}
                onRenameGroup={canGroupEdit ? () => handleRenameGroupClick(category) : undefined}
                onDeleteGroup={canGroupDelete ? () => handleDeleteGroupClick(category) : undefined}
              />
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Link Modal ─────────────────────────────────── */}
      {showModal && (
        <AddLinkModal
          existingGroups={allGroupTitles}
          editLink={editLink}
          onAdd={handleAddLink}
          onUpdate={handleUpdateLink}
          onClose={handleCloseModal}
          isSaving={isSaving}
          canCreateGroup={canGroupCreate}
        />
      )}

      {/* Confirm Delete Modal */}
      <AdminModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="tv-btn cancel"
              style={{ padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'var(--font-family)' }}
              onClick={() => setDeleteTarget(null)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tv-btn save"
              style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--c-danger)', color: '#ffffff', cursor: 'pointer', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={executeDelete}
              disabled={isSaving}
            >
              {isSaving ? <><Loader2 size={16} className="spin-animation" /> Deleting...</> : 'Delete'}
            </button>
          </>
        }
      >
        <div style={{ padding: '16px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
          Are you sure you want to delete the link <strong>{deleteTarget?.label}</strong>?
        </div>
      </AdminModal>

      {/* Rename Group Modal */}
      <AdminModal
        isOpen={!!renameGroupTarget}
        onClose={() => setRenameGroupTarget(null)}
        title="Rename Group"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="tv-btn cancel"
              style={{ padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'var(--font-family)' }}
              onClick={() => setRenameGroupTarget(null)}
              disabled={isSavingGroup}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tv-btn save"
              style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--c-primary)', color: '#ffffff', cursor: 'pointer', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={executeRenameGroup}
              disabled={isSavingGroup || !renameGroupValue.trim()}
            >
              {isSavingGroup ? <><Loader2 size={16} className="spin-animation" /> Saving...</> : 'Save'}
            </button>
          </>
        }
      >
        <div style={{ padding: '16px 0' }}>
          <label htmlFor="il-rename-group-input" style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-secondary)' }}>
            Group name
          </label>
          <input
            id="il-rename-group-input"
            type="text"
            className="il-input"
            style={{ width: '100%' }}
            value={renameGroupValue}
            onChange={(e) => setRenameGroupValue(e.target.value)}
            autoFocus
          />
        </div>
      </AdminModal>

      {/* Confirm Delete Group Modal */}
      <AdminModal
        isOpen={!!deleteGroupTarget}
        onClose={() => setDeleteGroupTarget(null)}
        title="Delete Group"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="tv-btn cancel"
              style={{ padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s ease', fontFamily: 'var(--font-family)' }}
              onClick={() => setDeleteGroupTarget(null)}
              disabled={isSavingGroup}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tv-btn save"
              style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--c-danger)', color: '#ffffff', cursor: 'pointer', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={executeDeleteGroup}
              disabled={isSavingGroup}
            >
              {isSavingGroup ? <><Loader2 size={16} className="spin-animation" /> Deleting...</> : 'Delete'}
            </button>
          </>
        }
      >
        <div style={{ padding: '16px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
          Are you sure you want to delete the group <strong>{deleteGroupTarget?.title}</strong>?
          Its links will not be deleted — they'll move to "Other Links".
        </div>
      </AdminModal>
    </div>
  );
}

export default ImportantLinksPage;
