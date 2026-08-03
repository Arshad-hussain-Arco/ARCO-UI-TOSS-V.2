import React from 'react';
import Toggle from '../../../components/ui/Toggle/Toggle';

export function LifecycleToggle({ mode, onToggle }) {
  const isDev = mode === 'development';

  return (
    <div className="pm-lifecycle-toggle-container">
      <span className={`pm-toggle-label ${!isDev ? 'active' : ''}`}>
        SDLC View (7 Stages)
      </span>
      <Toggle
        checked={isDev}
        onChange={onToggle}
        ariaLabel="Switch between SDLC View (7 Stages) and Tech View (17 Stages)"
      />
      <span className={`pm-toggle-label ${isDev ? 'active' : ''}`}>
        Tech View (17 Stages)
      </span>
    </div>
  );
}

export default LifecycleToggle;
