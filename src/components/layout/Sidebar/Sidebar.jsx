import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import logoUrl from '@assets/images/logo.png';
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

  const [expandedId, setExpandedId] = useState(null);
  const tooltip = useHoverTooltip(isCollapsed);

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
          <div className="sidebar-logo-collapsed">
            <img
              src={logoUrl}
              alt={APP_NAME}
              className="sidebar-logo-img sidebar-logo-img-collapsed"
            />
          </div>
        ) : (
          <div className="sidebar-logo-wrapper">
            <div className="sidebar-logo">
              <img src={logoUrl} alt={APP_NAME} className="sidebar-logo-img" />
            </div>
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
