import React from 'react';
import { colors, radius, spacing } from '../../styles/tokens';

export const Pill = ({
  children,
  variant = 'neutral',
  className = '',
  ...props
}) => {
  const token = colors[variant] || colors.neutral;

  return (
    <span
      className={`ui-pill ${className}`.trim()}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${spacing.xs}px ${spacing.sm}px`,
        borderRadius: `${radius.pill}px`,
        backgroundColor: token.pillBg,
        color: token.pillText,
        fontSize: '12px',
        fontWeight: 600,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
      {...props}
    >
      {children}
    </span>
  );
};

export default Pill;
