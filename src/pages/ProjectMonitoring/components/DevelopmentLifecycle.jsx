import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { DEVELOPMENT_PHASES } from '../utils/developmentLifecycleMap';
import { getStepState } from '../utils/statusMapper';
import ProgressTooltip from './ProgressTooltip';

export function DevelopmentLifecycle({ currentStageIdx = 0, isCompleted = false }) {
  const [activeTooltip, setActiveTooltip] = useState(null);

  const handleMouseEnter = (e, phase, state, idx) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      title: phase.label,
      subtitle: `Stage ${idx + 1} of 17 — ${phase.shortLabel}`,
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
    <div className="pm-lifecycle-wrapper pm-development-view">
      <div className="pm-stepper-scroll-container">
        <div className="pm-stepper-container pm-dev-stepper">
          {DEVELOPMENT_PHASES.map((phase, idx) => {
            const state = getStepState(idx, currentStageIdx, isCompleted);
            const isFirst = idx === 0;
            const isLast = idx === DEVELOPMENT_PHASES.length - 1;

            return (
              <div
                key={phase.key}
                className={`pm-step-item pm-dev-step-item state-${state} ${isFirst ? 'is-first' : ''} ${isLast ? 'is-last' : ''}`}
                onMouseEnter={(e) => handleMouseEnter(e, phase, state, idx)}
                onMouseLeave={handleMouseLeave}
              >
                <div className="pm-step-segment">
                  <div className="pm-step-icon-wrap">
                    {state === 'completed' ? (
                      <Check size={10} className="pm-step-check" />
                    ) : (
                      <span className="pm-step-number">{idx + 1}</span>
                    )}
                  </div>
                  <span className="pm-step-label" title={phase.label}>
                    {phase.shortLabel}
                  </span>
                </div>

                {!isLast && <div className="pm-step-arrow-divider" />}
              </div>
            );
          })}
        </div>
      </div>

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

export default DevelopmentLifecycle;
