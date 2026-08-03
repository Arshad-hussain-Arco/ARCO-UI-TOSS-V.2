import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { BUSINESS_PHASES } from '../utils/businessLifecycleMap';
import { getStepState } from '../utils/statusMapper';
import ProgressTooltip from './ProgressTooltip';

export function BusinessLifecycle({ currentStageIdx = 0, isCompleted = false }) {
  const [activeTooltip, setActiveTooltip] = useState(null);

  const handleMouseEnter = (e, phase, state, idx) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      title: phase.label,
      subtitle: `Stage ${idx + 1} of 7`,
      description: phase.description,
      state,
      position: {
        x: rect.left + rect.width / 2 - 100,
        y: rect.top - 70,
      },
    });
  };

  const handleMouseLeave = () => {
    setActiveTooltip(null);
  };

  return (
    <div className="pm-lifecycle-wrapper pm-business-view">
      <div className="pm-stepper-container">
        {BUSINESS_PHASES.map((phase, idx) => {
          const state = getStepState(idx, currentStageIdx, isCompleted);
          const isFirst = idx === 0;
          const isLast = idx === BUSINESS_PHASES.length - 1;

          return (
            <div
              key={phase.key}
              className={`pm-step-item state-${state} ${isFirst ? 'is-first' : ''} ${isLast ? 'is-last' : ''}`}
              onMouseEnter={(e) => handleMouseEnter(e, phase, state, idx)}
              onMouseLeave={handleMouseLeave}
            >
              {/* Connected Chevron / Pipe background block */}
              <div className="pm-step-segment">
                <div className="pm-step-icon-wrap">
                  {state === 'completed' ? (
                    <Check size={11} className="pm-step-check" />
                  ) : (
                    <span className="pm-step-number">{idx + 1}</span>
                  )}
                </div>
                <span className="pm-step-label" title={phase.label}>
                  {phase.label}
                </span>
              </div>

              {/* Arrow connector divider unless last */}
              {!isLast && <div className="pm-step-arrow-divider" />}
            </div>
          );
        })}
      </div>

      {/* Hover tooltip */}
      <ProgressTooltip
        title={activeTooltip?.title}
        subtitle={activeTooltip?.subtitle}
        description={activeTooltip?.description}
        state={activeTooltip?.state}
        position={activeTooltip?.position}
        visible={!!activeTooltip}
      />
    </div>
  );
}

export default BusinessLifecycle;
