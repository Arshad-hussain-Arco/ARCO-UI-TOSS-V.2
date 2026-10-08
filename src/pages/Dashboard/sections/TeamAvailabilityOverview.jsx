import React, { memo } from 'react';
import { DepartmentAvailabilityCard } from './DepartmentAvailabilityCard';
import { MonthlyLeaveTrendsChart } from './MonthlyLeaveTrendsChart';

function TeamAvailabilityOverviewComponent({ departmentStats = [], trendData, isLoading, isManager }) {
  return (
    <div className={isManager ? "dc-span-12" : "dc-span-8"} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '12px' }}>
      <DepartmentAvailabilityCard departmentStats={departmentStats} isLoading={isLoading} />
      {isManager && <MonthlyLeaveTrendsChart trendData={trendData} isLoading={isLoading} />}
    </div>
  );
}

export const TeamAvailabilityOverview = memo(TeamAvailabilityOverviewComponent);
export default TeamAvailabilityOverview;
