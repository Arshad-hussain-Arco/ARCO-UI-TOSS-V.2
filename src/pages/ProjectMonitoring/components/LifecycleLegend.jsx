import React from 'react';

export function LifecycleLegend({ totalStages = 7, currentStage = 1 }) {
  return (
    <div className="pm-lifecycle-legend">
      <div className="pm-legend-item">
        <span className="pm-legend-swatch completed" />
        <span className="pm-legend-label">Completed</span>
      </div>
      <div className="pm-legend-item">
        <span className="pm-legend-swatch current" />
        <span className="pm-legend-label">Current Phase</span>
      </div>
      <div className="pm-legend-item">
        <span className="pm-legend-swatch future" />
        <span className="pm-legend-label">Upcoming</span>
      </div>
      <div className="pm-legend-count">
        Stage {currentStage} of {totalStages}
      </div>
    </div>
  );
}

export default LifecycleLegend;
