import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Menu, Moon, MoreVertical, Sun } from 'lucide-react';

import logoUrl from '@assets/images/logo.png';
import { APP_LONG_NAME, APP_NAME } from '@constants/app';
import { HEADER_NAVIGATION } from '@constants/navigation';
import { useOnClickOutside } from '@hooks/useOnClickOutside';
import { useSidebar } from '@hooks/useSidebar';
import { useTheme } from '@hooks/useTheme';

import { ProfileMenu } from './ProfileMenu';
import './Header.css';

/**
 * Application header: sidebar toggle, brand, secondary navigation, theme switch,
 * notifications and the account menu.
 *
 * @param {Object} props
 * @param {import('@services/authService').AuthUser} props.user
 * @param {() => void} props.onLogout
 */
export function Header({ user, onLogout }) {
  const { toggle: toggleSidebar } = useSidebar();
  const { isDarkMode, toggleTheme } = useTheme();

  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const navMenuRef = useRef(null);

  const closeNavMenu = useCallback(() => setIsNavMenuOpen(false), []);
  useOnClickOutside(navMenuRef, closeNavMenu, isNavMenuOpen);

  return (
    <header className="header">
      {/* Left group: toggle + logo + title */}
      <div className="header-left-group">
        <button
          type="button"
          className="header-mobile-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle navigation"
        >
          <Menu className="header-icon" aria-hidden="true" />
        </button>

        <div className="header-mobile-logo">
          <img src={logoUrl} alt={APP_NAME} className="header-mobile-logo-img" />
        </div>

        <div className="header-title-wrapper">
          <h2 className="header-title">{APP_LONG_NAME}</h2>
        </div>
      </div>

      {/* Right group: navigation + actions */}
      <div className="header-right-group">
        <nav className="header-nav-links" aria-label="Secondary navigation">
          {HEADER_NAVIGATION.map((item) => (
            <Link key={item.id} to={item.to} className="header-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-mobile-nav-wrapper" ref={navMenuRef}>
          <button
            type="button"
            onClick={() => setIsNavMenuOpen((open) => !open)}
            className="header-icon-button"
            aria-haspopup="menu"
            aria-expanded={isNavMenuOpen}
            aria-label="More links"
          >
            <MoreVertical className="header-icon" aria-hidden="true" />
          </button>

          {isNavMenuOpen ? (
            <div className="header-mobile-nav-menu" role="menu">
              {HEADER_NAVIGATION.map((item) => (
                <Link
                  key={item.id}
                  to={item.to}
                  className="header-mobile-nav-item"
                  role="menuitem"
                  onClick={closeNavMenu}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        <div className="header-divider" />

        <button
          type="button"
          onClick={toggleTheme}
          className="header-icon-button"
          data-active={isDarkMode}
          aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {isDarkMode ? (
            <Moon className="header-icon" aria-hidden="true" />
          ) : (
            <Sun className="header-icon" aria-hidden="true" />
          )}
        </button>

        <button
          type="button"
          className="header-icon-button header-notification"
          aria-label="Notifications"
        >
          <Bell className="header-icon" aria-hidden="true" />
          <span className="header-notification-badge" />
        </button>

        <div className="header-divider" />

        <ProfileMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}

export default Header;
