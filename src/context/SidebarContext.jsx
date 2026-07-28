import { createContext, useCallback, useMemo, useState } from 'react';

import { MOBILE_BREAKPOINT } from '@constants/ui';

/**
 * Shell chrome state shared by the sidebar, the header toggle and the backdrop.
 * Kept in context rather than in the layout so any nested component can collapse
 * the sidebar without prop drilling.
 */
export const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggle = useCallback(() => setIsCollapsed((collapsed) => !collapsed), []);
  const collapse = useCallback(() => setIsCollapsed(true), []);
  const expand = useCallback(() => setIsCollapsed(false), []);

  /**
   * Mirrors the original behaviour: navigating on a narrow viewport closes the
   * drawer so the destination page is visible.
   */
  const collapseOnMobile = useCallback(() => {
    if (window.innerWidth <= MOBILE_BREAKPOINT) {
      setIsCollapsed(true);
    }
  }, []);

  const value = useMemo(
    () => ({ isCollapsed, toggle, collapse, expand, collapseOnMobile }),
    [isCollapsed, toggle, collapse, expand, collapseOnMobile],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
