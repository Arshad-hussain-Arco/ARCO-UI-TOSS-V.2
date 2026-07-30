import { useCallback, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Code, MessageCircle, Plus, Search, Server, Shield } from 'lucide-react';

import { EmptyState } from '@components/feedback/EmptyState/EmptyState';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Button } from '@components/ui/Button/Button';
import { usePinnedLinks } from '@context/PinnedLinksContext';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useOnClickOutside } from '@hooks/useOnClickOutside';
import { linkService } from '@services/linkService';
import { createId } from '@utils/id';

import { AddLinkModal } from './AddLinkModal';
import { GroupCard } from './GroupSection';
import './ImportantLinksPage.css';

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

  const { pinLink, unpinLink, updatePinnedLink } = usePinnedLinks();

  // ── Remote data ────────────────────────────────────────────────
  const fetchCategories = useCallback(() => linkService.getLinkCategories(), []);
  const { data: serverCategories, isLoading, error, refetch } = useAsync(fetchCategories);

  // ── Filter state ───────────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState('__all__');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Modal state ────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editLink, setEditLink] = useState(null); // { ...link, group: 'Group Title' }

  // ── Merged categories (server + local overrides + locally added) ──
  const mergedCategories = useMemo(() => {
    return serverCategories ?? [];
  }, [serverCategories]);

  // ── Filtered display ───────────────────────────────────────────
  const filteredCategories = useMemo(() => {
    const q = norm(searchQuery.trim());

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
  }, [mergedCategories, selectedGroup, searchQuery]);

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

  // ── Handle Add Link ────────────────────────────────────────────
  const handleAddLink = useCallback(
    async ({ id, group, isNewGroup, label, url, sharedFolder, comments, pinToHeader, files }) => {
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
        if (group) {
          formData.append('group', group);
        }
        if (files && files.length > 0 && files[0] instanceof File) {
          formData.append('file', files[0]);
        }

        const newLinkResponse = await linkService.createLink(formData);
        const newLinkId = newLinkResponse?.data?.id || id;

        if (pinToHeader) {
          pinLink({ id: newLinkId, group, label, url });
        }

        await refetch();
      } catch (err) {
        console.error('Failed to add link:', err);
      }
    },
    [serverCategories, pinLink, refetch],
  );

  // ── Handle Update Link ─────────────────────────────────────────
  const handleUpdateLink = useCallback(
    async ({ id, group, label, url, sharedFolder, comments, pinToHeader, files }) => {
      try {
        const existingGroup = serverCategories?.find((c) => c.title === group);
        const groupId = existingGroup?.id;

        const formData = new FormData();
        formData.append('link', label);
        formData.append('url', url);
        formData.append('content', [sharedFolder, comments].filter(Boolean).join(' · ') || '');
        formData.append('is_header', pinToHeader ? 1 : 0);
        if (group) {
          formData.append('group', group);
        }
        if (files && files.length > 0 && files[0] instanceof File) {
          formData.append('file', files[0]);
        }

        await linkService.updateLink(id, formData);

        if (pinToHeader) {
          pinLink({ id, group, label, url });
        } else {
          unpinLink(id);
        }

        await refetch();
        setEditLink(null);
      } catch (err) {
        console.error('Failed to update link:', err);
      }
    },
    [serverCategories, pinLink, unpinLink, refetch],
  );

  // ── Handle Delete Link ─────────────────────────────────────────
  const handleDeleteLink = useCallback(
    async (link) => {
      if (!window.confirm(`Are you sure you want to delete "${link.label}"?`)) {
        return;
      }
      try {
        await linkService.deleteLink(link.id);
        unpinLink(link.id);
        await refetch();
      } catch (err) {
        console.error('Failed to delete link:', err);
      }
    },
    [unpinLink, refetch],
  );

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

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setEditLink(null);
  }, []);

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
          />
        </div>

        <span className="il-toolbar-spacer" aria-hidden="true" />

        <Button
          id="il-add-link-btn"
          variant="primary"
          size="sm"
          leadingIcon={Plus}
          onClick={() => { setEditLink(null); setShowModal(true); }}
        >
          Add Link
        </Button>
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
          {filteredCategories.map((category) => (
            <GroupCard
              key={category.id}
              id={category.id}
              title={category.title}
              icon={CATEGORY_ICONS[category.iconKey] ?? null}
              links={category.links}
              onEditLink={handleEditLink}
              onDeleteLink={handleDeleteLink}
            />
          ))}
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
        />
      )}
    </div>
  );
}

export default ImportantLinksPage;
