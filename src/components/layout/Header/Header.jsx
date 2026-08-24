import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, ExternalLink, Menu, Moon, MoreVertical, Sun } from 'lucide-react';

import logoUrl from '@assets/images/favicon.png';
import { APP_LONG_NAME, APP_NAME } from '@constants/app';
import { ROUTES, buildPath } from '@constants/routes';
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
 * @param {() => void} props.onOpenProfileSettings
 * @param {() => void} [props.onOpenChangePassword]
 */
export function Header({ user, onLogout, onOpenProfileSettings, onOpenChangePassword }) {
  const { toggle: toggleSidebar } = useSidebar();
  const { isDarkMode, toggleTheme } = useTheme();
  const { pinnedLinks } = usePinnedLinks();
  const { user: authUser } = useAuth();
  const navigate = useNavigate();
  
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

  const [activeGroupDropdown, setActiveGroupDropdown] = useState(null);

  const groupDropdownRef = useRef(null);
  useOnClickOutside(groupDropdownRef, () => setActiveGroupDropdown(null), activeGroupDropdown !== null);

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
        {/* No artificial cap here — the real limit is enforced (and
            configurable) at pin-time in ImportantLinksPage/backend; this
            just renders whatever's actually pinned. */}
        <nav className="header-pinned-links" aria-label="Pinned links" ref={groupDropdownRef}>
          {pinnedLinks.map((group) => {
            const isOpen = activeGroupDropdown === group.groupId;
            return (
              <div key={group.groupId} className="header-pinned-dropdown-wrapper">
                <button
                  type="button"
                  className="header-pinned-item"
                  onClick={() => setActiveGroupDropdown(isOpen ? null : group.groupId)}
                >
                  {group.groupTitle}
                  <ChevronDown size={11} aria-hidden="true" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
                </button>
                <div className="header-pinned-dropdown-menu" data-open={isOpen}>
                  {group.links.map((link) =>
                    link.url ? (
                      <a
                        key={link.id}
                        href={link.url}
                        className="header-pinned-dropdown-link"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setActiveGroupDropdown(null)}
                      >
                        <span>{link.label}</span>
                        <ExternalLink size={10} style={{ marginLeft: 'auto', opacity: 0.6 }} />
                      </a>
                    ) : (
                      // Shared Folder / Upload File / Comments content type — no
                      // URL to open, so this navigates in-app to a full page
                      // instead of a dead/empty anchor.
                      <button
                        key={link.id}
                        type="button"
                        className="header-pinned-dropdown-link"
                        style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left' }}
                        onClick={() => {
                          setActiveGroupDropdown(null);
                          navigate(buildPath(ROUTES.IMPORTANT_LINKS_CONTENT, { id: link.id }));
                        }}
                      >
                        <span>{link.label}</span>
                      </button>
                    ),
                  )}
                </div>
              </div>
            );
          })}
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

          {isNavMenuOpen && pinnedLinks.length > 0 ? (
            <div className="header-mobile-nav-menu" role="menu">
              {pinnedLinks.flatMap(g => g.links).map((link) => 
                link.url ? (
                  <a
                    key={link.id}
                    href={link.url}
                    className="header-mobile-nav-item"
                    role="menuitem"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={closeNavMenu}
                  >
                    {link.label}
                  </a>
                ) : (
                  <button
                    key={link.id}
                    type="button"
                    className="header-mobile-nav-item"
                    role="menuitem"
                    style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '12px 16px' }}
                    onClick={() => {
                      closeNavMenu();
                      navigate(buildPath(ROUTES.IMPORTANT_LINKS_CONTENT, { id: link.id }));
                    }}
                  >
                    {link.label}
                  </button>
                )
              )}
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
              {unreadCount > 99 ? '99+' : unreadCount}
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

        <ProfileMenu
          user={user}
          onLogout={onLogout}
          onOpenProfileSettings={onOpenProfileSettings}
          onOpenChangePassword={onOpenChangePassword}
        />
      </div>
    </header>
  );
}

export default Header;
