import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import logoExpandedUrl from '@assets/images/logo-expanded.png';
import iconCollapseUrl from '@assets/images/icon-collapse.png';
import { APP_NAME } from '@constants/app';
import { SIDEBAR_NAVIGATION } from '@constants/navigation';
import { useSidebar } from '@hooks/useSidebar';

import { SidebarMenuItem } from './SidebarMenuItem';
import { useHoverTooltip } from './useHoverTooltip';
import './Sidebar.css';

/**
 * Primary navigation rail. Active state is derived from the current URL rather
 * than held in component state, so deep links highlight correctly.
 */
export function Sidebar() {
  const { isCollapsed, toggle, collapseOnMobile } = useSidebar();
  const { pathname } = useLocation();

  const [expandedId, setExpandedId] = useState(() => {
    // Initialise with whichever group has an active child
    const active = SIDEBAR_NAVIGATION.find(
      (item) => item.children && item.children.some((child) => window.location.pathname === child.to)
    );
    return active ? active.id : null;
  });
  const tooltip = useHoverTooltip(isCollapsed);

  // Keep the submenu in sync with navigation — open when on a child route, close otherwise
  useEffect(() => {
    const activeGroup = SIDEBAR_NAVIGATION.find(
      (item) => item.children && item.children.some((child) => pathname === child.to)
    );
    if (activeGroup) {
      setExpandedId(activeGroup.id);
    } else {
      setExpandedId(null);
    }
  }, [pathname]);

  const isChildActive = useCallback((to) => pathname === to, [pathname]);

  const isItemActive = useCallback(
    (item) =>
      item.children ? item.children.some((child) => pathname === child.to) : pathname === item.to,
    [pathname],
  );

  const toggleSubmenu = useCallback(
    (id) => setExpandedId((current) => (current === id ? null : id)),
    [],
  );

  const handleNavigate = useCallback(() => {
    collapseOnMobile();
  }, [collapseOnMobile]);

  return (
    <div className="sidebar" data-collapsed={isCollapsed}>
      <div className="sidebar-header">
        {isCollapsed ? (
          <div className="sidebar-logo-container collapsed" key="collapsed">
            <img
              src={iconCollapseUrl}
              alt={APP_NAME}
              className="sidebar-logo-img sidebar-logo-collapsed-img"
            />
          </div>
        ) : (
          <div className="sidebar-logo-container expanded" key="expanded">
            <img
              src={logoExpandedUrl}
              alt={APP_NAME}
              className="sidebar-logo-img sidebar-logo-expanded-img"
            />
          </div>
        )}
      </div>

      <div className="sidebar-menu-container">
        <nav className="sidebar-nav" aria-label="Main navigation">
          {(() => {
            const activeIndex = SIDEBAR_NAVIGATION.findIndex((item) => isItemActive(item));
            return activeIndex !== -1 ? (
              <div
                className="nav-glider"
                style={{ transform: `translateY(${activeIndex * 44}px)` }}
              />
            ) : null;
          })()}
          {SIDEBAR_NAVIGATION.map((item) => (
            <SidebarMenuItem
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
              isActive={isItemActive(item)}
              isExpanded={expandedId === item.id}
              isChildActive={isChildActive}
              onToggleSubmenu={() => toggleSubmenu(item.id)}
              onNavigate={handleNavigate}
              tooltip={tooltip}
            />
          ))}
        </nav>
      </div>

      <button
        type="button"
        onClick={toggle}
        className="sidebar-toggle"
        aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? (
          <ChevronRight className="sidebar-toggle-icon" aria-hidden="true" />
        ) : (
          <ChevronLeft className="sidebar-toggle-icon" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

export default Sidebar;
