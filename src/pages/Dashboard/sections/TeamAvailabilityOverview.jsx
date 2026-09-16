import React, { memo } from 'react';
import { DepartmentAvailabilityCard } from './DepartmentAvailabilityCard';
import { MonthlyLeaveTrendsChart } from './MonthlyLeaveTrendsChart';

function TeamAvailabilityOverviewComponent({ departmentStats = [], trendData, isLoading }) {
  return (
    <div className="dc-span-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '12px' }}>
      <DepartmentAvailabilityCard departmentStats={departmentStats} isLoading={isLoading} />
      <MonthlyLeaveTrendsChart trendData={trendData} isLoading={isLoading} />
    </div>
  );
}

export const TeamAvailabilityOverview = memo(TeamAvailabilityOverviewComponent);
export default TeamAvailabilityOverview;
