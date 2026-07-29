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

  // ── Local state for added/edited categories ────────────────────
  const [localCategories, setLocalCategories] = useState([]);
  // Map of linkId → locally edited fields (for server-side links)
  const [linkOverrides, setLinkOverrides] = useState({});

  // ── Filter state ───────────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState('__all__');
  const [searchQuery, setSearchQuery] = useState('');

  // ── Modal state ────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [editLink, setEditLink] = useState(null); // { ...link, group: 'Group Title' }

  // ── Merged categories (server + local overrides + locally added) ──
  const mergedCategories = useMemo(() => {
    const server = serverCategories ?? [];

    const mergedServer = server.map((sc) => {
      // Merge link overrides
      const mergedLinks = sc.links.map((link) =>
        linkOverrides[link.id] ? { ...link, ...linkOverrides[link.id] } : link,
      );
      // Append any extra links added locally to this server group
      const shadow = localCategories.find((lc) => lc._mergeWithServerId === sc.id);
      return {
        ...sc,
        links: shadow ? [...mergedLinks, ...shadow.links] : mergedLinks,
      };
    });

    // Pure local groups (not merged with a server group)
    const pureLocal = localCategories.filter((lc) => !lc._mergeWithServerId);

    return [...mergedServer, ...pureLocal];
  }, [serverCategories, localCategories, linkOverrides]);

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
    ({ id, group, isNewGroup, label, url, sharedFolder, comments, pinToHeader, files }) => {
      const newLink = {
        id,
        label,
        url,
        description: [sharedFolder, comments].filter(Boolean).join(' · ') || '',
        sharedFolder: sharedFolder || null,
        comments: comments || null,
        pinToHeader,
        tag: null,
        files,
      };

      if (pinToHeader) {
        pinLink({ id, group, label, url });
      }

      if (isNewGroup) {
        setLocalCategories((prev) => [
          ...prev,
          { id: createId('group'), title: group, iconKey: null, links: [newLink] },
        ]);
      } else {
        // Check if it's a server group
        const serverGroup = (serverCategories ?? []).find((c) => c.title === group);
        if (serverGroup) {
          setLocalCategories((prev) => {
            const shadow = prev.find((lc) => lc._mergeWithServerId === serverGroup.id);
            if (shadow) {
              return prev.map((lc) =>
                lc._mergeWithServerId === serverGroup.id
                  ? { ...lc, links: [...lc.links, newLink] }
                  : lc,
              );
            }
            return [
              ...prev,
              {
                id: createId('group'),
                title: group,
                iconKey: serverGroup.iconKey ?? null,
                _mergeWithServerId: serverGroup.id,
                links: [newLink],
              },
            ];
          });
        } else {
          // Local group
          setLocalCategories((prev) =>
            prev.map((lc) =>
              lc.title === group ? { ...lc, links: [...lc.links, newLink] } : lc,
            ),
          );
        }
      }
    },
    [serverCategories, pinLink],
  );

  // ── Handle Update Link ─────────────────────────────────────────
  const handleUpdateLink = useCallback(
    ({ id, group, label, url, sharedFolder, comments, pinToHeader }) => {
      const updates = { label, url, sharedFolder, comments, pinToHeader, description: [sharedFolder, comments].filter(Boolean).join(' · ') || '' };

      // Update pin state
      if (pinToHeader) {
        pinLink({ id, group, label, url });
      } else {
        unpinLink(id);
      }

      // Check if it's a server-side link
      const isServerLink = (serverCategories ?? []).some((cat) =>
        cat.links.some((l) => l.id === id),
      );

      if (isServerLink) {
        setLinkOverrides((prev) => ({ ...prev, [id]: updates }));
      } else {
        // Update within local categories
        setLocalCategories((prev) =>
          prev.map((cat) => ({
            ...cat,
            links: cat.links.map((l) => (l.id === id ? { ...l, ...updates } : l)),
          })),
        );
      }

      setEditLink(null);
    },
    [serverCategories, pinLink, unpinLink],
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
