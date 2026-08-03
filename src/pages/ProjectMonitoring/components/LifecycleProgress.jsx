import React from 'react';
import BusinessLifecycle from './BusinessLifecycle';
import DevelopmentLifecycle from './DevelopmentLifecycle';
import { getBusinessStageInfo } from '../utils/businessLifecycleMap';
import { getDevelopmentStageInfo } from '../utils/developmentLifecycleMap';

export function LifecycleProgress({ status, mode = 'business' }) {
  const isDev = mode === 'development';

  const bizInfo = getBusinessStageInfo(status);
  const devInfo = getDevelopmentStageInfo(status);

  // Only project-level completed/closed statuses mark ALL stages as completed.
  // Stage statuses like "Development Completed" or "UAT Completed" should NOT mark the whole project as completed.
  const lowerStatus = (status || '').trim().toLowerCase();
  const isCompleted =
    lowerStatus === 'completed' ||
    lowerStatus === 'closed' ||
    lowerStatus === 'done';

  return (
    <div className={`pm-lifecycle-progress-container mode-${mode}`}>
      <div className="pm-lifecycle-animator">
        {isDev ? (
          <DevelopmentLifecycle
            currentStageIdx={devInfo.index}
            isCompleted={isCompleted}
          />
        ) : (
          <BusinessLifecycle
            currentStageIdx={bizInfo.index}
            isCompleted={isCompleted}
          />
        )}
      </div>
    </div>
  );
}

export default LifecycleProgress;
