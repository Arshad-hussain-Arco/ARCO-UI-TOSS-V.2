/**
 * Operations dashboard fixtures.
 *
 * Presentation concerns (icon components, CSS colour tokens) deliberately stay in
 * the page — a real API would return exactly the fields below, keyed by `iconKey`
 * so the UI decides how to draw them.
 */
export const DASHBOARD_SUMMARY = {
  kpis: [
    {
      id: 'total-consultants',
      iconKey: 'users',
      count: 132,
      label: 'Total Consultants',
      subtext: 'Updated 5 mins ago',
      color: 'blue',
    },
    {
      id: 'present-today',
      iconKey: 'building',
      count: 94,
      label: 'Present Today',
      subtext: 'Updated 5 mins ago',
      color: 'green',
      trend: 'up',
    },
    {
      id: 'on-leave',
      iconKey: 'clock',
      count: 26,
      label: 'On Leave',
      subtext: 'Updated 5 mins ago',
      color: 'amber',
    },
    {
      id: 'work-from-home',
      iconKey: 'home',
      count: 12,
      label: 'Work From Home',
      subtext: 'Updated 5 mins ago',
      color: 'blue',
    },
    {
      id: 'inactive',
      iconKey: 'userMinus',
      count: 10,
      label: 'Inactive',
      subtext: 'Updated 5 mins ago',
      color: 'grey',
    },
  ],

  systemHealth: {
    murexJobs: { total: 48, failed: 3 },
    eodStatus: { completed: 19, total: 21, running: 2 },
    avgRuntime: { time: '1h 46m', change: '+6%', trend: 'up' },
  },

  runtimeTrend: [
    { day: 'Mon', runtime: 105, failed: 1 },
    { day: 'Tue', runtime: 98, failed: 0 },
    { day: 'Wed', runtime: 112, failed: 2 },
    { day: 'Thu', runtime: 108, failed: 1 },
    { day: 'Fri', runtime: 115, failed: 3 },
    { day: 'Sat', runtime: 102, failed: 0 },
    { day: 'Sun', runtime: 106, failed: 1 },
  ],

  runtimeInsights: {
    longest: { script: 'SETTLEMENT_BATCH_07', duration: '2h 12m' },
    mostFailed: 'FX_RECON_03',
    slaThreshold: 110,
  },

  leaveDistribution: [
    { type: 'Planned Leave', count: 12, color: '#2563eb' },
    { type: 'Sick Leave', count: 9, color: '#f59e0b' },
    { type: 'Comp Off', count: 5, color: '#7c3aed' },
  ],

  upcomingLeaves: [
    { id: 'ul-1', name: 'Sofia Martinez', date: '06 Feb', type: 'Planned' },
    { id: 'ul-2', name: 'Ahmed Al-Rashid', date: '07 Feb', type: 'Sick' },
    { id: 'ul-3', name: 'Daniel Wong', date: '09–11 Feb', type: 'Planned' },
    { id: 'ul-4', name: 'Priya Sharma', date: '10 Feb', type: 'Comp Off' },
    { id: 'ul-5', name: 'Rajesh Kumar', date: '12 Feb', type: 'Planned' },
  ],

  attendanceStatus: [
    { label: 'Present', percentage: 71, count: 94 },
    { label: 'Work From Home', percentage: 9, count: 12 },
    { label: 'On Leave', percentage: 20, count: 26 },
  ],

  capacityByTeam: [
    { team: 'Backend', utilization: 92 },
    { team: 'Data Innovators', utilization: 78 },
    { team: 'DevOps', utilization: 85 },
    { team: 'Frontend', utilization: 69 },
    { team: 'UI/UX', utilization: 81 },
  ],

  projectRisk: { active: 28, atRisk: 6, breached: 2 },

  projectsByStatus: [
    { id: 'p-1', name: 'NEOM Core Banking', status: 'on-track' },
    { id: 'p-2', name: 'Digital FX Platform', status: 'at-risk' },
    { id: 'p-3', name: 'Settlement Automation', status: 'breached' },
    { id: 'p-4', name: 'Payment Gateway Integration', status: 'on-track' },
    { id: 'p-5', name: 'Customer Portal Enhancement', status: 'at-risk' },
    { id: 'p-6', name: 'API Modernization', status: 'on-track' },
  ],

  documents: {
    total: 364,
    uploadedThisWeek: 21,
    mostViewed: [
      'NEOM_System_Architecture.pdf',
      'CR_Status_Feb_2026.xlsx',
      'Runtime_Trends_Jan_2026.pdf',
    ],
  },

  recentActivity: [
    { id: 'a-1', action: 'WO file uploaded by Lucas Brown', time: '2 mins ago', type: 'upload' },
    { id: 'a-2', action: 'CR mapping updated by Fatima Noor', time: '15 mins ago', type: 'update' },
    { id: 'a-3', action: 'Runtime trends file imported', time: '1 hour ago', type: 'import' },
    { id: 'a-4', action: 'New project documentation added', time: '2 hours ago', type: 'upload' },
  ],

  alerts: [
    {
      id: 'al-1',
      text: 'Backend team over capacity',
      severity: 'critical',
      iconKey: 'alertTriangle',
    },
    { id: 'al-2', text: '2 scripts breached SLA', severity: 'critical', iconKey: 'alertCircle' },
    { id: 'al-3', text: '3 consultants missing attendance', severity: 'warning', iconKey: 'clock' },
    { id: 'al-4', text: '1 leave request pending approval', severity: 'info', iconKey: 'calendar' },
  ],

  quickStats: [
    { id: 'qs-1', label: 'Match Rate', value: '42.9%', tone: 'green' },
    { id: 'qs-2', label: 'Pending Review', value: '3 items', tone: 'amber' },
    { id: 'qs-3', label: 'System Uptime', value: '99.8%', tone: 'green' },
  ],
};

/** Options for the dashboard's date-range filter. */
export const DASHBOARD_DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'custom', label: 'Custom Range' },
];
