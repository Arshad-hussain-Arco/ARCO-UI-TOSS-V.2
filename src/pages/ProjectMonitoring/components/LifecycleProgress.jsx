import React from 'react';
import BusinessLifecycle from './BusinessLifecycle';
import DevelopmentLifecycle from './DevelopmentLifecycle';
import { getBusinessStageInfo } from '../utils/businessLifecycleMap';
import { getDevelopmentStageInfo } from '../utils/developmentLifecycleMap';

export function LifecycleProgress({ status, mode = 'business' }) {
  const isDev = mode === 'development';

  const bizInfo = getBusinessStageInfo(status);
  const devInfo = getDevelopmentStageInfo(status);

  const isCompleted =
    (status || '').toLowerCase().includes('completed') ||
    (status || '').toLowerCase().includes('close');

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
