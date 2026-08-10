import React, { useState } from 'react';
import { BUSINESS_PHASES } from '../utils/businessLifecycleMap';
import { getStepState } from '../utils/statusMapper';
import ProgressTooltip from './ProgressTooltip';

export function BusinessLifecycle({ currentStageIdx = 0, isCompleted = false }) {
  const [activeTooltip, setActiveTooltip] = useState(null);

  const handleMouseEnter = (e, phase, state) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      title: phase.label,
      description: phase.description,
      state,
      targetRect: rect,
    });
  };

  const handleMouseLeave = () => {
    setActiveTooltip(null);
  };

  return (
    <div className="pm-lifecycle-wrapper pm-business-view">
      <div className="pm-chips-stepper-scroll-wrap">
        <div className="pm-chips-stepper">
          {BUSINESS_PHASES.map((phase, idx) => {
            const state = getStepState(idx, currentStageIdx, isCompleted);

            return (
              <div
                key={phase.key}
                className={`pm-lifecycle-chip state-${state}`}
                onMouseEnter={(e) => handleMouseEnter(e, phase, state)}
                onMouseLeave={handleMouseLeave}
              >
                <span className="pm-chip-text">{phase.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <ProgressTooltip
        title={activeTooltip?.title}
        description={activeTooltip?.description}
        state={activeTooltip?.state}
        targetRect={activeTooltip?.targetRect}
        visible={!!activeTooltip}
      />
    </div>
  );
}

export default BusinessLifecycle;
