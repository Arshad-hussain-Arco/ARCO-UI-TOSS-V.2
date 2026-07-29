import { createContext, useContext, useState, useCallback } from 'react';

/**
 * Holds the list of resources pinned to the application header by the
 * Important Links module. Any page can read the list; only the Important
 * Links page writes to it.
 */
const PinnedLinksContext = createContext(null);

export function PinnedLinksProvider({ children }) {
  const [pinnedLinks, setPinnedLinks] = useState([]);

  const pinLink = useCallback((link) => {
    setPinnedLinks((prev) => {
      // Avoid duplicates by id
      if (prev.some((p) => p.id === link.id)) return prev;
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
