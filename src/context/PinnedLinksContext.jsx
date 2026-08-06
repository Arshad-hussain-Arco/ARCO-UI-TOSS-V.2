import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { linkService } from '@services/linkService';

/**
 * Holds the list of resources pinned to the application header by the
 * Important Links module. Any page can read the list; only the Important
 * Links page writes to it.
 */
const PinnedLinksContext = createContext(null);

export function PinnedLinksProvider({ children }) {
  const [pinnedLinks, setPinnedLinks] = useState([]);

  const refreshPinnedLinks = useCallback(() => {
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
  }, []);

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
