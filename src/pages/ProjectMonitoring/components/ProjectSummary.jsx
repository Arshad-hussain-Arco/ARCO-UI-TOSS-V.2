import React, { useState, useRef } from 'react';
import ProgressTooltip from './ProgressTooltip';

export function ProjectSummary({ summary }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [targetRect, setTargetRect] = useState(null);
  const timeoutRef = useRef(null);

  const handleMouseEnter = (e) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setTargetRect(e.currentTarget.getBoundingClientRect());
    setShowTooltip(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowTooltip(false);
    }, 100);
  };

  const handleTooltipMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleTooltipMouseLeave = () => {
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
        targetRect={targetRect}
        visible={showTooltip}
        onMouseEnter={handleTooltipMouseEnter}
        onMouseLeave={handleTooltipMouseLeave}
      />
    </div>
  );
}

export default ProjectSummary;
