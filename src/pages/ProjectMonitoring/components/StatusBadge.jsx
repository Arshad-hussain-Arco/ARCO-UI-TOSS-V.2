import React from 'react';

export function StatusBadge({ label, color, state = 'current', size = 'medium' }) {
  if (!label) return null;

  return (
    <span
      className={`pm-status-badge size-${size} state-${state}`}
      style={{
        '--badge-color': color || 'var(--c-info)',
      }}
    >
      <span className="pm-badge-dot" />
      <span className="pm-badge-text">{label}</span>
    </span>
  );
}

export default StatusBadge;
