import React, { memo } from 'react';
import { DepartmentAvailabilityCard } from './DepartmentAvailabilityCard';
import { MonthlyLeaveTrendsChart } from './MonthlyLeaveTrendsChart';

// hasSideCard: a card (e.g. Upcoming Holidays) sits beside this one, so it
// takes 8 of 12 columns instead of the whole row.
function TeamAvailabilityOverviewComponent({ departmentStats = [], trendData, isLoading, isManager, hasSideCard = false }) {
  return (
    <div className={isManager || !hasSideCard ? "dc-span-12" : "dc-span-8"} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '12px' }}>
      <DepartmentAvailabilityCard departmentStats={departmentStats} isLoading={isLoading} />
      {isManager && <MonthlyLeaveTrendsChart trendData={trendData} isLoading={isLoading} />}
    </div>
  );
}

export const TeamAvailabilityOverview = memo(TeamAvailabilityOverviewComponent);
export default TeamAvailabilityOverview;
