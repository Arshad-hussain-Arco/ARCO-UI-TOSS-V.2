import React from 'react';
import { Activity, CheckCircle, AlertCircle, Clock, Pause } from 'lucide-react';

export function StatusBadge({ status }) {
  const icons = {
    running: <Activity size={9} />,
    completed: <CheckCircle size={9} />,
    failed: <AlertCircle size={9} />,
    idle: <Clock size={9} />,
    paused: <Pause size={9} />,
  };

  const safeStatus = status || 'idle';

  return (
    <span className={`eod-badge ${safeStatus}`}>
      {icons[safeStatus] || <Clock size={9} />}
      {safeStatus.charAt(0).toUpperCase() + safeStatus.slice(1)}
    </span>
  );
}

export default StatusBadge;
