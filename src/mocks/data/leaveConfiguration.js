/** Leave-allocation configuration, grouped by team. */
export const LEAVE_CONFIG_TEAMS = [
  {
    id: 'management',
    name: 'Management',
    stats: { avgCarryOver: 12.5, totalCompOff: 8, teamUtilization: 85 },
    consultants: [
      {
        id: 'c1',
        name: 'Daniel Carter',
        role: 'Manager',
        team: 'Management',
        metrics: { carryOver: 15, compOff: 5, weekendWork: 2, sickLeave: 2, totalAvailable: 22 },
      },
      {
        id: 'c2',
        name: 'Sarah Jenkins',
        role: 'Consultant',
        team: 'Management',
        metrics: { carryOver: 10, compOff: 3, weekendWork: 0, sickLeave: 4, totalAvailable: 17 },
      },
    ],
  },
  {
    id: 'frontend',
    name: 'Frontend Engineering',
    stats: { avgCarryOver: 8.2, totalCompOff: 15, teamUtilization: 92 },
    consultants: [
      {
        id: 'c3',
        name: 'Sofia Martinez',
        role: 'Manager',
        team: 'Frontend',
        metrics: { carryOver: 12, compOff: 8, weekendWork: 4, sickLeave: 1, totalAvailable: 25 },
      },
      {
        id: 'c4',
        name: 'James Chen',
        role: 'Consultant',
        team: 'Frontend',
        metrics: { carryOver: 6, compOff: 2, weekendWork: 6, sickLeave: 3, totalAvailable: 17 },
      },
      {
        id: 'c5',
        name: 'Maria Rodriguez',
        role: 'Consultant',
        team: 'Frontend',
        metrics: { carryOver: 8, compOff: 5, weekendWork: 2, sickLeave: 0, totalAvailable: 15 },
      },
    ],
  },
  {
    id: 'backend',
    name: 'Backend Systems',
    stats: { avgCarryOver: 9.5, totalCompOff: 12, teamUtilization: 88 },
    consultants: [
      {
        id: 'c6',
        name: 'Ahmed Khan',
        role: 'Manager',
        team: 'Backend',
        metrics: { carryOver: 14, compOff: 6, weekendWork: 8, sickLeave: 2, totalAvailable: 30 },
      },
      {
        id: 'c7',
        name: 'David Kim',
        role: 'Consultant',
        team: 'Backend',
        metrics: { carryOver: 5, compOff: 3, weekendWork: 4, sickLeave: 5, totalAvailable: 17 },
      },
    ],
  },
];

/** Figures shown in the banner across the top of the page. */
export const LEAVE_CONFIG_SUMMARY = [
  { id: 'carry-over', label: 'Avg Carry Over', value: '10.4 Days', iconKey: 'briefcase' },
  { id: 'comp-off', label: 'Active Comp Offs', value: '35 Total', iconKey: 'clock' },
  { id: 'weekend', label: 'Pending Weekend Credits', value: '12 Days', iconKey: 'calendar' },
  { id: 'utilization', label: 'System Utilization', value: '88.5%', iconKey: 'trending' },
];

/** Denominator for the per-card allocation progress bar. */
export const LEAVE_ALLOCATION_MAX_DAYS = 30;
