import React from 'react';
import { getStatusFilterOptions } from '../utils/statusMapper';

export function StatusFilter({ value, onChange, mode = 'business' }) {
  const options = getStatusFilterOptions(mode);

  return (
    <div className="pm-status-filter-wrap">
      <select
        className="pm-filter-select pm-dynamic-status-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filter by project status"
      >
        <option value="">All Statuses ({mode === 'development' ? '17 Phases' : '7 Phases'})</option>
        {options.map((opt) => (
          <option key={opt.key} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default StatusFilter;
