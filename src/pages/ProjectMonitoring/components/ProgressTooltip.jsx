import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import './ProgressTooltip.css';

export function ProgressTooltip({
  title,
  subtitle,
  description,
  state,
  position,
  targetRect,
  visible,
  placement = 'top',
  onMouseEnter,
  onMouseLeave,
}) {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef(null);

  useLayoutEffect(() => {
    if (!visible || !tooltipRef.current) return;

    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    let x = 0;
    let y = 0;

    if (targetRect) {
      x = targetRect.left + (targetRect.width - w) / 2;

      if (placement === 'bottom') {
        y = targetRect.bottom + 8;
        // flip to top if there isn't enough space below
        if (y + h > window.innerHeight - 10) {
          y = targetRect.top - h - 8;
        }
      } else {
        y = targetRect.top - h - 8;
        // flip to bottom if there isn't enough space above
        if (y < 10) {
          y = targetRect.bottom + 8;
        }
      }

      // Horizontal boundary check: keep within viewport limits
      if (x < 10) {
        x = 10;
      } else if (x + w > window.innerWidth - 10) {
        x = window.innerWidth - w - 10;
      }

      // Vertical boundary check 2: if it goes below the viewport when positioned below, clamp or flip it
      if (y + h > window.innerHeight - 10) {
        if (targetRect.top > window.innerHeight - targetRect.bottom) {
          y = Math.max(10, targetRect.top - h - 8);
        } else {
          y = window.innerHeight - h - 10;
        }
      }
    } else if (position) {
      x = position.x;
      y = position.y;

      // Adjust position based on size if it goes off boundaries
      if (x < 10) {
        x = 10;
      } else if (x + w > window.innerWidth - 10) {
        x = window.innerWidth - w - 10;
      }

      if (y < 10) {
        y = 10;
      } else if (y + h > window.innerHeight - 10) {
        y = window.innerHeight - h - 10;
      }
    }

    setCoords({ x, y });
  }, [visible, targetRect, position, title, subtitle, description]);

  if (!visible) return null;

  const stateColors = {
    completed: 'var(--c-success)',
    current: 'var(--c-info)',
    future: 'var(--text-tertiary)',
  };

  return createPortal(
    <div
      ref={tooltipRef}
      className="pm-progress-tooltip"
      style={{
        left: coords.x,
        top: coords.y,
        pointerEvents: (onMouseEnter || onMouseLeave) ? 'auto' : 'none',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="pm-tooltip-header">
        {state !== 'none' && (
          <span
            className="pm-tooltip-state-dot"
            style={{ background: stateColors[state] || 'var(--c-info)' }}
          />
        )}
        <span className="pm-tooltip-title">{title}</span>
        {state && state !== 'none' && (
          <span className={`pm-tooltip-state-tag state-${state}`}>
            {state.toUpperCase()}
          </span>
        )}
      </div>
      {subtitle && <div className="pm-tooltip-subtitle">{subtitle}</div>}
      {description && <div className="pm-tooltip-desc">{description}</div>}
    </div>,
    document.body
  );
}

export default ProgressTooltip;
