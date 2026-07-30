import React from 'react';
import { colors, radius } from '../../styles/tokens';

const getInitials = (name = '') => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const Avatar = ({
  name = '',
  size = 26,
  className = '',
  ...props
}) => {
  const initials = getInitials(name);
  const fontSize = Math.max(10, Math.floor(size * 0.45));

  return (
    <div
      className={`ui-avatar ${className}`.trim()}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: radius.avatar,
        backgroundColor: colors.brand,
        color: colors.surface,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: `${fontSize}px`,
        fontWeight: 600,
        userSelect: 'none',
        flexShrink: 0,
      }}
      {...props}
    >
      {initials}
    </div>
  );
};

export default Avatar;
