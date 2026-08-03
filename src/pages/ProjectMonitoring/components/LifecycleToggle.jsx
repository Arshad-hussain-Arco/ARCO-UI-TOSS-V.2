import React from 'react';
import { ArrowLeftRight, Eye, Code } from 'lucide-react';

export function LifecycleToggle({ mode, onToggle }) {
  const isDev = mode === 'development';

  return (
    <div className="pm-lifecycle-toggle-wrap">
      <button
        type="button"
        className={`pm-lifecycle-toggle-btn ${isDev ? 'is-dev' : 'is-biz'}`}
        onClick={onToggle}
        title={
          isDev
            ? 'Click to switch to Executive Business View (7 Phases)'
            : 'Click to switch to Advanced Development View (17 Phases)'
        }
        aria-label="Toggle Lifecycle View Mode"
      >
        <ArrowLeftRight size={14} className="pm-toggle-icon" />
        <span className="pm-toggle-badge">
          {isDev ? (
            <>
              <Code size={12} /> Dev View (17)
            </>
          ) : (
            <>
              <Eye size={12} /> Business View (7)
            </>
          )}
        </span>
      </button>
    </div>
  );
}

export default LifecycleToggle;
