import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, KeyRound, LogOut, UserCog } from 'lucide-react';

import { useOnClickOutside } from '@hooks/useOnClickOutside';
import { ROUTES } from '@constants/routes';
import { withBase } from '@config/env';

/**
 * Avatar button with the account menu. Closes on outside click or Escape.
 *
 * @param {Object} props
 * @param {import('@services/authService').AuthUser} props.user
 * @param {() => void} props.onLogout
 * @param {() => void} [props.onOpenProfileSettings]
 * @param {() => void} [props.onOpenChangePassword]
 */
export function ProfileMenu({ user, onLogout, onOpenProfileSettings, onOpenChangePassword }) {
  const [isOpen, setIsOpen] = useState(false);
  // Pinned = opened by a click/tap/Enter: stays open when the pointer leaves
  // and is toggled by the next click. Unpinned = just hovering/focused.
  const [isPinned, setIsPinned] = useState(false);
  const wrapperRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const close = useCallback(() => {
    clearTimeout(hoverTimeoutRef.current);
    setIsOpen(false);
    setIsPinned(false);
  }, []);
  useOnClickOutside(wrapperRef, close, isOpen);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  useEffect(() => () => clearTimeout(hoverTimeoutRef.current), []);

  const open = () => {
    clearTimeout(hoverTimeoutRef.current);
    setIsOpen(true);
  };

  // Short delay so the pointer can travel from the button to the menu.
  const closeSoon = () => {
    if (isPinned) return;
    hoverTimeoutRef.current = setTimeout(() => setIsOpen(false), 200);
  };

  const handleClick = () => {
    if (isOpen && isPinned) {
      close();
    } else {
      open();
      setIsPinned(true);
    }
  };

  return (
    <div
      className="header-profile-wrapper"
      ref={wrapperRef}
      onMouseEnter={open}
      onMouseLeave={closeSoon}
      onFocus={open}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) closeSoon();
      }}
    >
      <button
        type="button"
        onClick={handleClick}
        className="header-profile-button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <div className="header-profile-avatar">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="header-profile-avatar-img" />
          ) : (
            <span className="header-profile-avatar-text">{user.initials}</span>
          )}
        </div>
        <div className="header-profile-info">
          <div className="header-profile-name">{user.name}</div>
          <div className="header-profile-role">{user.role}</div>
        </div>
        <ChevronDown className="header-profile-chevron" data-open={isOpen} aria-hidden="true" />
      </button>

      {isOpen ? (
        <div className="header-profile-menu" role="menu">
          <button
            type="button"
            className="header-profile-menu-item"
            role="menuitem"
            onClick={() => {
              close();
              if (onOpenProfileSettings) onOpenProfileSettings();
            }}
          >
            <span className="header-profile-menu-text">Profile Settings</span>
          </button>
          <button
            type="button"
            className="header-profile-menu-item"
            role="menuitem"
            onClick={() => {
              close();
              if (onOpenChangePassword) onOpenChangePassword();
            }}
          >

            <span className="header-profile-menu-text">Change Password</span>
          </button>
          <button
            type="button"
            className="header-profile-menu-item"
            role="menuitem"
            onClick={() => {
              close();
              navigate(ROUTES.PREFERENCES);
            }}
          >
            <span className="header-profile-menu-text">Preferences</span>
          </button>

          {user.isAdmin && !user.isImpersonated ? (
            <button
              type="button"
              className="header-profile-menu-item"
              role="menuitem"
              onClick={() => {
                close();
                // Same isolation model as Access Account — a new tab, own
                // sessionStorage-only tokens. See ViewAsRolePage.jsx.
                window.open(withBase(ROUTES.VIEW_AS_ROLE), '_blank', 'noopener,noreferrer');
              }}
            >
              <span className="header-profile-menu-text">View as Role</span>
            </button>
          ) : null}

          {user.hasImpersonationAccess && !user.isImpersonated ? (
            <button
              type="button"
              className="header-profile-menu-item"
              role="menuitem"
              onClick={() => {
                close();
                // A new tab so the admin's own session/state (this tab) is
                // never touched by the impersonation flow — see
                // AccessAccountPage.jsx and utils/impersonationStorage.js.
                window.open(withBase(ROUTES.ACCESS_ACCOUNT), '_blank', 'noopener,noreferrer');
              }}
            >
              {/* <UserCog className="header-profile-menu-icon" aria-hidden="true" /> */}
              <span className="header-profile-menu-text">Access Account</span>
            </button>
          ) : null}

          <div className="header-profile-menu-divider" />

          <button
            type="button"
            onClick={onLogout}
            className="header-profile-menu-item"
            data-danger="true"
            role="menuitem"
          >
            <LogOut className="header-profile-menu-icon" aria-hidden="true" />
            <span className="header-profile-menu-text">Sign Out</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default ProfileMenu;