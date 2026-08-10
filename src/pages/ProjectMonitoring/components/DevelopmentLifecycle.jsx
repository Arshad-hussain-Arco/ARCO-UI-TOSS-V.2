import React, { useState } from 'react';
import { DEVELOPMENT_PHASES } from '../utils/developmentLifecycleMap';
import { getStepState } from '../utils/statusMapper';
import ProgressTooltip from './ProgressTooltip';

export function DevelopmentLifecycle({ currentStageIdx = 0, isCompleted = false }) {
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
    <div className="pm-lifecycle-wrapper pm-development-view">
      <div className="pm-chips-stepper-scroll-wrap">
        <div className="pm-chips-stepper pm-dev-chips-stepper">
          {DEVELOPMENT_PHASES.map((phase, idx) => {
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

export default DevelopmentLifecycle;
