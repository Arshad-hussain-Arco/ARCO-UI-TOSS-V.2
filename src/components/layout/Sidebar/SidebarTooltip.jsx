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

  // If the menu item is in the bottom half of the screen on a smaller laptop, expand upwards.
  // On large screens, default to the downward "margin-top" style alignment.
  const isLaptopScreen = typeof window !== 'undefined' && window.innerHeight < 900;
  const isNearBottom = typeof window !== 'undefined' && top > window.innerHeight * 0.6;

  let transformValue = 'translateY(-50%) scale(1)';
  if (hasSubmenu) {
    transformValue = (isLaptopScreen && isNearBottom)
      ? 'translateY(calc(-100% + 24px)) scale(1)' // Expands upwards on laptops
      : 'translateY(-24px) scale(1)';             // Expands downwards on large screens
  }

  const tooltipElement = (
    <div
      className="sidebar-tooltip"
      data-has-submenu={hasSubmenu}
      style={{
        top: `${top}px`,
        transform: transformValue,
      }}
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
