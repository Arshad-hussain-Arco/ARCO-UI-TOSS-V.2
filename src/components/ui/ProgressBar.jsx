import React from 'react';
import { colors, radius, spacing } from '../../styles/tokens';

export const ProgressBar = ({
  label,
  percent = 0,
  count,
  variant = 'neutral',
  className = '',
  ...props
}) => {
  const token = colors[variant] || colors.neutral;
  const clampedPercent = Math.min(100, Math.max(0, percent));

  return (
    <div
      className={`progress-bar-container ${className}`.trim()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: `${spacing.xs}px`,
        width: '100%',
      }}
      {...props}
    >
      {(label || percent !== undefined) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            fontWeight: 500,
            color: colors.textPrimary,
          }}
        >
          {label && <span>{label}</span>}
          <span>{clampedPercent}%</span>
        </div>
      )}

      <div
        style={{
          width: '100%',
          height: '6px',
          backgroundColor: colors.page,
          borderRadius: `${radius.pill}px`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${clampedPercent}%`,
            height: '100%',
            backgroundColor: token.icon,
            borderRadius: `${radius.pill}px`,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {count && (
        <div
          style={{
            fontSize: '12px',
            color: colors.textSecondary,
          }}
        >
          {count}
        </div>
      )}
    </div>
  );
};

export default ProgressBar;
