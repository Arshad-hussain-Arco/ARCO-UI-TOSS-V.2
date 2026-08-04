import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ExternalLink, Menu, Moon, MoreVertical, Pin, Sun } from 'lucide-react';

import logoUrl from '@assets/images/logo.png';
import { APP_LONG_NAME, APP_NAME } from '@constants/app';
import { HEADER_NAVIGATION } from '@constants/navigation';
import { usePinnedLinks } from '@context/PinnedLinksContext';
import { useOnClickOutside } from '@hooks/useOnClickOutside';
import { useSidebar } from '@hooks/useSidebar';
import { useTheme } from '@hooks/useTheme';
import { useAuth } from '@hooks/useAuth';
import { useNotifications } from '@hooks/useNotifications';
import { NotificationsDropdown } from './NotificationsDropdown';

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
  const { pinnedLinks } = usePinnedLinks();
  const { user: authUser } = useAuth();

  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const navMenuRef = useRef(null);

  const empId = authUser?.emp_id ?? null;

  const {
    notifications,
    unreadCount,
    wsStatus,
    markRead,
    markAllRead,
  } = useNotifications(empId);

  const closeNavMenu = useCallback(() => setIsNavMenuOpen(false), []);
  const closeNotif   = useCallback(() => setIsNotifOpen(false), []);

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

        {/* Pinned quick-access links */}
        {pinnedLinks.length > 0 && (
          <>
            <div className="header-divider" />
            <div className="header-pinned-links" aria-label="Pinned resources">
              <span className="header-pinned-label">
                <Pin size={11} aria-hidden="true" />
                Quick Links
              </span>
              {pinnedLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  className="header-pinned-item"
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`${link.group} · ${link.label}`}
                >
                  {link.label}
                  <ExternalLink size={10} aria-hidden="true" />
                </a>
              ))}
            </div>
            <div className="header-divider" />
          </>
        )}

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

        {/* ── Notification Bell ── */}
        <button
          type="button"
          id="header-notifications-btn"
          className={`header-icon-button header-notification ${isNotifOpen ? 'header-notif-active' : ''}`}
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          aria-haspopup="dialog"
          aria-expanded={isNotifOpen}
          onClick={() => setIsNotifOpen((o) => !o)}
        >
          <Bell className="header-icon" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="header-notification-badge" aria-hidden="true">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown panel */}
        <NotificationsDropdown
          isOpen={isNotifOpen}
          onClose={closeNotif}
          notifications={notifications}
          unreadCount={unreadCount}
          wsStatus={wsStatus}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
        />

        <div className="header-divider" />

        <ProfileMenu user={user} onLogout={onLogout} />
      </div>
    </header>
  );
}

export default Header;
