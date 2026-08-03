import React, { useState } from 'react';
import { Check } from 'lucide-react';
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
      position: {
        x: rect.left + rect.width / 2 - 100,
        y: rect.top - 60,
      },
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
                {state === 'completed' && <Check size={11} className="pm-chip-check-icon" />}
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
        position={activeTooltip?.position}
        visible={!!activeTooltip}
      />
    </div>
  );
}

export default BusinessLifecycle;
