import React, { useState, useLayoutEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

export function ProgressTooltip({
  title,
  subtitle,
  description,
  state,
  position,
  targetRect,
  visible,
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
      // Default: center horizontally relative to the target, position above the target
      x = targetRect.left + (targetRect.width - w) / 2;
      y = targetRect.top - h - 8;

      // Vertical space check: if it goes above the viewport, render below the target instead
      if (y < 10) {
        y = targetRect.bottom + 8;
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
    completed: '#10b981',
    current: '#3b82f6',
    future: '#94a3b8',
  };

  const tooltipContent = (
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
        <span
          className="pm-tooltip-state-dot"
          style={{ background: stateColors[state] || '#3b82f6' }}
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

  return ReactDOM.createPortal(tooltipContent, document.body);
}

export default ProgressTooltip;
