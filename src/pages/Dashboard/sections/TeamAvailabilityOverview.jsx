import React, { memo } from 'react';
import { DepartmentAvailabilityCard } from './DepartmentAvailabilityCard';
import { MonthlyLeaveTrendsChart } from './MonthlyLeaveTrendsChart';

function TeamAvailabilityOverviewComponent({ departmentStats = [] }) {
  return (
    <div className="dc-span-12" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '12px' }}>
      <DepartmentAvailabilityCard departmentStats={departmentStats} />
      <MonthlyLeaveTrendsChart />
    </div>
  );
}

export const TeamAvailabilityOverview = memo(TeamAvailabilityOverviewComponent);
export default TeamAvailabilityOverview;
