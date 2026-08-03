import React from 'react';

export function StatCard({ icon, iconClass, stripClass, value, label, live = false }) {
  return (
    <div className={`eod-stat-card ${stripClass}`}>
      <div className={`eod-stat-icon ${iconClass}`}>{icon}</div>
      <div className="eod-stat-body">
        <span className="eod-stat-value">{value}</span>
        <span className="eod-stat-label">{label}</span>
      </div>
      {live && (
        <div className="eod-live-badge">
          <span className="eod-pill-dot" />
          LIVE
        </div>
      )}
    </div>
  );
}

export default StatCard;
