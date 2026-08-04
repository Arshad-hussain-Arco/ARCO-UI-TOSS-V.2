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

  useEffect(() => {
    linkService.getLinkCategories()
      .then(categories => {
        const headerLinks = [];
        categories.forEach(cat => {
          cat.links.forEach(link => {
            if (link.pinToHeader) {
              headerLinks.push({
                id: link.id,
                group: cat.title,
                label: link.label,
                url: link.url
              });
            }
          });
        });
        setPinnedLinks(headerLinks);
      })
      .catch(err => console.error("Failed to fetch pinned links:", err));
  }, []);

  const pinLink = useCallback((link) => {
    setPinnedLinks((prev) => {
      const exists = prev.some((p) => p.id === link.id);
      if (exists) {
        return prev.map((p) => (p.id === link.id ? { ...p, ...link } : p));
      }
      return [...prev, link];
    });
  }, []);

  const unpinLink = useCallback((id) => {
    setPinnedLinks((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const updatePinnedLink = useCallback((id, updates) => {
    setPinnedLinks((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    );
  }, []);

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
