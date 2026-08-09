import React from 'react';

export function ProgressTooltip({ title, subtitle, description, state, position, visible }) {
  if (!visible) return null;

  const stateColors = {
    completed: 'var(--c-success)',
    current: 'var(--c-info)',
    future: 'var(--text-tertiary)',
  };

  return (
    <div
      className="pm-progress-tooltip"
      style={{
        left: position?.x ?? 0,
        top: position?.y ?? 0,
      }}
    >
      <div className="pm-tooltip-header">
        <span
          className="pm-tooltip-state-dot"
          style={{ background: stateColors[state] || 'var(--c-info)' }}
        />
        <span className="pm-tooltip-title">{title}</span>
        {state && (
          <span className={`pm-tooltip-state-tag state-${state}`}>
            {state.toUpperCase()}
          </span>
        )}
      </div>
      {subtitle && <div className="pm-tooltip-subtitle">{subtitle}</div>}
      {description && <div className="pm-tooltip-desc">{description}</div>}
    </div>
  );
}

export default ProgressTooltip;
