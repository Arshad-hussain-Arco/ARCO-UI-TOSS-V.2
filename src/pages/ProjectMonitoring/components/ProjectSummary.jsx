import React, { useState } from 'react';
import ProgressTooltip from './ProgressTooltip';

export function ProjectSummary({ summary }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleMouseEnter = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const tooltipHeight = 70;
    // Render above if space permits, otherwise below
    const topPos = rect.top - tooltipHeight > 10 ? rect.top - tooltipHeight : rect.bottom + 8;
    setTooltipPos({
      x: Math.max(10, Math.min(rect.left, window.innerWidth - 320)),
      y: topPos,
    });
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
  };

  return (
    <div
      className="pm-summary-cell"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span className="pm-summary-single-line">
        {summary}
      </span>

      {/* Floating full summary tooltip */}
      <ProgressTooltip
        title="Project Description"
        description={summary}
        position={tooltipPos}
        visible={showTooltip}
      />
    </div>
  );
}

export default ProjectSummary;
