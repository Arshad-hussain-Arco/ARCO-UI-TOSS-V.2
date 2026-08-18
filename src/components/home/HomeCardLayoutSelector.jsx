import React from 'react';
import './HomeCardLayoutSelector.css';

/**
 * Enterprise Visual Layout Selector for Home Cards.
 * Allows choosing between 50% (Half Width - Vertical) and 100% (Full Width - Horizontal).
 */
export function HomeCardLayoutSelector({ value = '100%', onChange }) {
  return (
    <div className="home-card-layout-selector-group">
      <label className="home-card-layout-label">
        Card Layout & Display Width <span className="required-star">*</span>
      </label>
      <div className="home-card-layout-options" role="radiogroup" aria-label="Card Display Width">
        {/* Option 1: Half Width (50% - Vertical) */}
        <button
          type="button"
          role="radio"
          aria-checked={value === '50%'}
          tabIndex={value === '50%' ? 0 : -1}
          className={`layout-option-card ${value === '50%' ? 'is-selected' : ''}`}
          onClick={() => onChange('50%')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChange('50%');
            }
          }}
        >

          <div className="layout-option-meta">
            <div className="layout-option-title">
              <span>Half Width (50%)</span>
              {value === '50%' && <span className="layout-active-badge">Active</span>}
            </div>
            <span className="layout-option-subtitle">Vertical layout for 2-column grid</span>
          </div>
        </button>

        {/* Option 2: Full Width (100% - Horizontal) */}
        <button
          type="button"
          role="radio"
          aria-checked={value === '100%'}
          tabIndex={value === '100%' ? 0 : -1}
          className={`layout-option-card ${value === '100%' ? 'is-selected' : ''}`}
          onClick={() => onChange('100%')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onChange('100%');
            }
          }}
        >

          <div className="layout-option-meta">
            <div className="layout-option-title">
              <span>Full Width (100%)</span>
              {value === '100%' && <span className="layout-active-badge">Active</span>}
            </div>
            <span className="layout-option-subtitle">Horizontal layout spanning full row</span>
          </div>
        </button>
      </div>
    </div>
  );
}

export default HomeCardLayoutSelector;
