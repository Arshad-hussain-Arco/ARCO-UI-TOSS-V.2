/**
 * Capacity planning fixtures: per-consultant availability over the next 7, 30 and
 * 90 days, their allocations, and the seven-point utilisation trend the sparkline
 * renders.
 */
export const CAPACITY_SOURCES = {
  woFile: '2026-02-03 09:15',
  crFile: '2026-02-03 08:45',
};
export const CAPACITY_CONSULTANTS = [
  {
    id: '1',
    name: 'Rajesh Kumar',
    team: 'Development',
    role: 'Senior Developer',
    utilization: 'optimal',
    next7Days: { occupied: 32, available: 8 },
    next30Days: { occupied: 120, available: 40 },
    next90Days: { occupied: 340, available: 140 },
    upcomingAllocations: [
      {
        project: 'Banking Portal Redesign',
        hours: 80,
        startDate: '2026-02-04',
        endDate: '2026-02-28',
      },
      { project: 'API Integration', hours: 40, startDate: '2026-03-01', endDate: '2026-03-15' },
    ],
    trendData: [45, 60, 75, 80, 85, 75, 80],
  },
  {
    id: '2',
    name: 'Priya Sharma',
    team: 'Development',
    role: 'Full Stack Developer',
    utilization: 'overbooked',
    next7Days: { occupied: 42, available: -2 },
    next30Days: { occupied: 170, available: -10 },
    next90Days: { occupied: 500, available: -20 },
    upcomingAllocations: [
      {
        project: 'Mobile App Development',
        hours: 120,
        startDate: '2026-02-03',
        endDate: '2026-03-15',
      },
      { project: 'Code Review Tasks', hours: 50, startDate: '2026-02-10', endDate: '2026-03-31' },
    ],
    trendData: [85, 90, 95, 105, 105, 102, 105],
  },
  {
    id: '3',
    name: 'Amit Patel',
    team: 'Development',
    role: 'Frontend Developer',
    utilization: 'low',
    next7Days: { occupied: 16, available: 24 },
    next30Days: { occupied: 60, available: 100 },
    next90Days: { occupied: 180, available: 300 },
    upcomingAllocations: [
      {
        project: 'UI Component Library',
        hours: 60,
        startDate: '2026-02-05',
        endDate: '2026-02-28',
      },
    ],
    trendData: [30, 35, 40, 38, 40, 37, 40],
  },
  {
    id: '4',
    name: 'Sneha Reddy',
    team: 'QA',
    role: 'QA Lead',
    utilization: 'optimal',
    next7Days: { occupied: 35, available: 5 },
    next30Days: { occupied: 135, available: 25 },
    next90Days: { occupied: 380, available: 100 },
    upcomingAllocations: [
      {
        project: 'Test Automation Framework',
        hours: 100,
        startDate: '2026-02-03',
        endDate: '2026-03-20',
      },
      {
        project: 'Regression Testing',
        hours: 35,
        startDate: '2026-02-15',
        endDate: '2026-02-28',
      },
    ],
    trendData: [70, 75, 82, 85, 88, 87, 85],
  },
  {
    id: '5',
    name: 'Vikram Singh',
    team: 'QA',
    role: 'Test Engineer',
    utilization: 'optimal',
    next7Days: { occupied: 30, available: 10 },
    next30Days: { occupied: 125, available: 35 },
    next90Days: { occupied: 350, available: 130 },
    upcomingAllocations: [
      {
        project: 'Payment Gateway Testing',
        hours: 80,
        startDate: '2026-02-04',
        endDate: '2026-03-10',
      },
      { project: 'Security Testing', hours: 45, startDate: '2026-03-01', endDate: '2026-03-25' },
    ],
    trendData: [65, 70, 75, 78, 75, 77, 75],
  },
  {
    id: '6',
    name: 'Ananya Iyer',
    team: 'Design',
    role: 'UI/UX Designer',
    utilization: 'low',
    next7Days: { occupied: 20, available: 20 },
    next30Days: { occupied: 80, available: 80 },
    next90Days: { occupied: 240, available: 240 },
    upcomingAllocations: [
      {
        project: 'Dashboard Redesign',
        hours: 80,
        startDate: '2026-02-10',
        endDate: '2026-03-15',
      },
    ],
    trendData: [40, 45, 50, 48, 50, 50, 50],
  },
  {
    id: '7',
    name: 'Karthik Menon',
    team: 'Design',
    role: 'UX Researcher',
    utilization: 'optimal',
    next7Days: { occupied: 33, available: 7 },
    next30Days: { occupied: 130, available: 30 },
    next90Days: { occupied: 360, available: 120 },
    upcomingAllocations: [
      {
        project: 'User Research Study',
        hours: 90,
        startDate: '2026-02-03',
        endDate: '2026-03-05',
      },
      { project: 'Usability Testing', hours: 40, startDate: '2026-03-10', endDate: '2026-03-30' },
    ],
    trendData: [70, 75, 78, 82, 83, 81, 82],
  },
  {
    id: '8',
    name: 'Deepa Nair',
    team: 'Operations',
    role: 'DevOps Engineer',
    utilization: 'overbooked',
    next7Days: { occupied: 44, available: -4 },
    next30Days: { occupied: 175, available: -15 },
    next90Days: { occupied: 510, available: -30 },
    upcomingAllocations: [
      {
        project: 'Infrastructure Migration',
        hours: 140,
        startDate: '2026-02-03',
        endDate: '2026-03-30',
      },
      {
        project: 'CI/CD Pipeline Setup',
        hours: 35,
        startDate: '2026-02-15',
        endDate: '2026-02-28',
      },
    ],
    trendData: [95, 100, 105, 108, 110, 109, 110],
  },
];

/** Team order shown in the grouped view. */
export const CAPACITY_TEAMS = ['Development', 'QA', 'Design', 'Operations'];

/** Time ranges offered by the range selector, in days. */
export const CAPACITY_TIME_RANGES = [7, 30, 90];
