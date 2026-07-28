import { ChevronDown } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { SidebarTooltip } from './SidebarTooltip';

/**
 * A single top-level sidebar entry. Leaf entries navigate; branch entries toggle
 * their sub-navigation. Both share the same visual treatment.
 *
 * @param {Object} props
 * @param {import('@constants/navigation').NavItem} props.item
 * @param {boolean} props.isCollapsed
 * @param {boolean} props.isActive
 * @param {boolean} props.isExpanded
 * @param {(pathname: string) => boolean} props.isChildActive
 * @param {() => void} props.onToggleSubmenu
 * @param {() => void} props.onNavigate
 * @param {Object} props.tooltip           Result of useHoverTooltip, scoped to this item.
 */
export function SidebarMenuItem({
  item,
  isCollapsed,
  isActive,
  isExpanded,
  isChildActive,
  onToggleSubmenu,
  onNavigate,
  tooltip,
}) {
  const Icon = item.icon;
  const hasSubmenu = Boolean(item.children);

  const sharedProps = {
    className: 'sidebar-menu-item',
    'data-active': isActive,
    'data-collapsed': isCollapsed,
    'data-has-submenu': hasSubmenu,
    onMouseEnter: (event) => tooltip.show(item.id, event.currentTarget),
    onMouseLeave: tooltip.scheduleHide,
  };

  const body = (
    <>
      <Icon className="sidebar-menu-icon" aria-hidden="true" />
      {!isCollapsed ? (
        <>
          <span className="sidebar-menu-label">{item.label}</span>
          {hasSubmenu ? (
            <ChevronDown
              className="sidebar-menu-chevron"
              data-expanded={isExpanded}
              aria-hidden="true"
            />
          ) : null}
        </>
      ) : null}
    </>
  );

  return (
    <div className="sidebar-menu-group">
      {hasSubmenu ? (
        <button
          type="button"
          {...sharedProps}
          onClick={onToggleSubmenu}
          aria-expanded={isExpanded}
          aria-label={isCollapsed ? item.label : undefined}
        >
          {body}
        </button>
      ) : (
        <NavLink
          to={item.to}
          {...sharedProps}
          onClick={onNavigate}
          aria-label={isCollapsed ? item.label : undefined}
        >
          {body}
        </NavLink>
      )}

      {isCollapsed && tooltip.activeId === item.id && tooltip.top !== null ? (
        <SidebarTooltip
          item={item}
          top={tooltip.top}
          onMouseEnter={() => tooltip.keepVisible(item.id)}
          onMouseLeave={tooltip.hideNow}
          onNavigate={() => {
            tooltip.hideNow();
            onNavigate();
          }}
        />
      ) : null}

      {!isCollapsed && isExpanded && hasSubmenu ? (
        <div className="sidebar-submenu">
          {item.children.map((child) => (
            <NavLink
              key={child.id}
              to={child.to}
              className="sidebar-submenu-item"
              data-active={isChildActive(child.to)}
              onClick={onNavigate}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default SidebarMenuItem;
