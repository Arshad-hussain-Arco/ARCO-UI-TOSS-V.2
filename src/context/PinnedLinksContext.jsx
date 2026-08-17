import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@hooks/useAuth';
import { linkService } from '@services/linkService';

/**
 * Holds the list of resources pinned to the application header by the
 * Important Links module. Any page can read the list; only the Important
 * Links page writes to it.
 *
 * IMPORTANT_LINKS_SHOW_HEADER — not IMPORTANT_LINKS_VIEW, and not
 * IMPORTANT_LINKS_PIN_HEADER — gates whether a user sees this widget.
 * All three are deliberately independent: VIEW only controls sidebar/tab
 * access to the Important Links page itself; PIN_HEADER only controls who
 * can flip the pin toggle on that page; someone without VIEW or PIN_HEADER
 * can still see org-pinned links in the header if they hold SHOW_HEADER,
 * and conversely a user with VIEW and/or PIN_HEADER but not SHOW_HEADER
 * sees no header widget at all.
 */
const PinnedLinksContext = createContext(null);

export function PinnedLinksProvider({ children }) {
  const { hasPermission } = useAuth();
  const canSeeHeaderLinks = hasPermission('IMPORTANT_LINKS_SHOW_HEADER');
  const [pinnedLinks, setPinnedLinks] = useState([]);

  const refreshPinnedLinks = useCallback(() => {
    if (!canSeeHeaderLinks) {
      setPinnedLinks([]);
      return;
    }
    linkService.getLinkCategories()
      .then(categories => {
        const grouped = [];
        categories.forEach(cat => {
          const linksInGroup = cat.links.filter(link => link.pinToHeader);
          if (linksInGroup.length > 0) {
            grouped.push({
              groupId: cat.id,
              groupTitle: cat.title,
              links: linksInGroup.map(link => ({
                id: link.id,
                label: link.label,
                url: link.url
              }))
            });
          }
        });
        setPinnedLinks(grouped);
      })
      .catch(err => console.error("Failed to fetch pinned links:", err));
  }, [canSeeHeaderLinks]);

  useEffect(() => {
    refreshPinnedLinks();
    window.addEventListener('pinned-links:refresh', refreshPinnedLinks);
    return () => {
      window.removeEventListener('pinned-links:refresh', refreshPinnedLinks);
    };
  }, [refreshPinnedLinks]);

  const pinLink = useCallback((link) => {
    refreshPinnedLinks();
  }, [refreshPinnedLinks]);

  const unpinLink = useCallback((id) => {
    refreshPinnedLinks();
  }, [refreshPinnedLinks]);

  const updatePinnedLink = useCallback((id, updates) => {
    refreshPinnedLinks();
  }, [refreshPinnedLinks]);

  return (
    <PinnedLinksContext.Provider value={{ pinnedLinks, pinLink, unpinLink, updatePinnedLink }}>
      {children}
    </PinnedLinksContext.Provider>
  );
}

export function usePinnedLinks() {
  const ctx = useContext(PinnedLinksContext);
  if (!ctx) throw new Error('usePinnedLinks must be used within a PinnedLinksProvider');
  return ctx;
}
