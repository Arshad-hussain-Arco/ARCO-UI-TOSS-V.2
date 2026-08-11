import { NavLink } from 'react-router-dom';
import { createPortal } from 'react-dom';

/**
 * Flyout shown when hovering an item in the collapsed sidebar: a plain label for
 * leaf items, or the sub-navigation for a branch.
 *
 * @param {Object} props
 * @param {import('@constants/navigation').NavItem} props.item
 * @param {number} props.top                Viewport Y coordinate of the trigger's centre.
 * @param {() => void} props.onMouseEnter
 * @param {() => void} props.onMouseLeave
 * @param {() => void} props.onNavigate
 */
export function SidebarTooltip({ item, top, onMouseEnter, onMouseLeave, onNavigate }) {
  const hasSubmenu = Boolean(item.children);

  const tooltipElement = (
    <div
      className="sidebar-tooltip"
      data-has-submenu={hasSubmenu}
      style={{ top: `${top}px`, transform: 'translateY(-50%) scale(1)' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      role={hasSubmenu ? 'menu' : 'tooltip'}
    >
      {hasSubmenu ? (
        <div className="sidebar-tooltip-submenu">
          <div className="sidebar-tooltip-title">{item.label}</div>
          {item.children.map((child) => (
            <NavLink
              key={child.id}
              to={child.to}
              className="sidebar-tooltip-item"
              role="menuitem"
              onClick={onNavigate}
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      ) : (
        item.label
      )}
    </div>
  );

  return createPortal(tooltipElement, document.body);
}

export default SidebarTooltip;
