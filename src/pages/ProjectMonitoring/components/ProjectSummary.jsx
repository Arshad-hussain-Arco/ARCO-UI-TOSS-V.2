import React, { useState } from 'react';
import ProgressTooltip from './ProgressTooltip';

export function ProjectSummary({ projectId, code, summary, mode = 'business' }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const isDev = mode === 'development';

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: Math.min(rect.left, window.innerWidth - 320),
      y: rect.top - 60,
    });
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div
      className={`pm-summary-cell ${isDev ? 'is-compact' : 'is-normal'}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isDev ? (
        <div className="pm-summary-compact-wrap">
          <div className="pm-summary-header-line">
            <span className="pm-project-id-badge">{code || projectId}</span>
          </div>
          <span className="pm-summary-truncated-text" title={summary}>
            {summary}
          </span>
        </div>
      ) : (
        <div className="pm-summary-normal-wrap">
          <span className="pm-summary-text">{summary}</span>
        </div>
      )}

      {/* Floating full summary tooltip */}
      <ProgressTooltip
        title={`Project: ${code || projectId}`}
        subtitle="Full Summary / Description"
        description={summary}
        position={tooltipPos}
        visible={showTooltip}
      />
    </div>
  );
}

export default ProjectSummary;
