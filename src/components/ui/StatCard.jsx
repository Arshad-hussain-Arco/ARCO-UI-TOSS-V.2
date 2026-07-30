import React from 'react';
import { colors, radius, spacing } from '../../styles/tokens';

export const StatCard = ({
  icon: Icon,
  label,
  value,
  variant = 'neutral',
  trend,
  caption,
  className = '',
  ...props
}) => {
  const token = colors[variant] || colors.neutral;

  return (
    <div
      className={`stat-card ${className}`.trim()}
      style={{
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: `${radius.card}px`,
        padding: `${spacing.lg}px`,
        display: 'flex',
        flexDirection: 'column',
        gap: `${spacing.sm}px`,
        boxSizing: 'border-box',
      }}
      {...props}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {Icon && (
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: token.bg,
              color: token.icon,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon size={20} style={{ color: token.icon }} />
          </div>
        )}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: `${spacing.xs}px` }}>
          <span
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: colors.textPrimary,
              lineHeight: 1.2,
            }}
          >
            {value}
          </span>
          {trend && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: trend.direction === 'up' ? colors.green.icon : colors.red.icon,
              }}
            >
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
            </span>
          )}
        </div>
        {label && (
          <div
            style={{
              fontSize: '13px',
              color: colors.textSecondary,
              marginTop: `${spacing.xs}px`,
            }}
          >
            {label}
          </div>
        )}
      </div>

      {caption && (
        <div
          style={{
            fontSize: '12px',
            color: colors.textSecondary,
            marginTop: 'auto',
            paddingTop: `${spacing.xs}px`,
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
};

export default StatCard;
