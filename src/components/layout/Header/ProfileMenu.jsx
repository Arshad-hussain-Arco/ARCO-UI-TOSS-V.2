import { useCallback, useRef, useState } from 'react';
import { ChevronDown, KeyRound, LogOut } from 'lucide-react';

import { useOnClickOutside } from '@hooks/useOnClickOutside';

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
  const wrapperRef = useRef(null);

  const close = useCallback(() => setIsOpen(false), []);
  useOnClickOutside(wrapperRef, close, isOpen);

  return (
    <div className="header-profile-wrapper" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="header-profile-button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <div className="header-profile-avatar">
          <span className="header-profile-avatar-text">{user.initials}</span>
        </div>
        <div className="header-profile-info">
          <div className="header-profile-name">{user.name}</div>
          <div className="header-profile-role">{user.role}</div>
        </div>
        <ChevronDown className="header-profile-chevron" aria-hidden="true" />
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
          <button type="button" className="header-profile-menu-item" role="menuitem">
            <span className="header-profile-menu-text">Preferences</span>
          </button>

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

          <div className="header-profile-menu-version" style={{ fontSize: '10px', color: 'var(--text-tertiary)', padding: '8px 12px 4px', textAlign: 'center' }}>
            TOSS v.2.0.0
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ProfileMenu;
