import React from 'react';
import { colors, radius, spacing } from '../../styles/tokens';

export const AlertRow = ({
  message,
  variant = 'amber',
  className = '',
  ...props
}) => {
  const token = colors[variant] || colors.amber;
  const borderColor = token.border || token.icon;

  return (
    <div
      className={`alert-row ${className}`.trim()}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderLeft: `2px solid ${borderColor}`,
        backgroundColor: token.bg || token.pillBg,
        color: token.pillText,
        borderRadius: `0 ${radius.card / 2}px ${radius.card / 2}px 0`,
        fontSize: '13px',
        fontWeight: 500,
        lineHeight: 1.4,
      }}
      {...props}
    >
      {message}
    </div>
  );
};

export default AlertRow;
