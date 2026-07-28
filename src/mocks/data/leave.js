/**
 * Leave calendar fixtures: the signed-in user's own leave days and the team-wide
 * leave events the shared calendar overlays.
 */
export const MY_LEAVE_EVENTS = [
  { date: 5, title: 'End of Meet', type: 'leave', status: 'approved' },
  { date: 8, title: 'Annual Leave', type: 'leave', status: 'approved' },
  { date: 9, title: 'Annual Leave', type: 'leave', status: 'approved' },
];
export const TEAM_LEAVE_EVENTS = [
  { date: '2025-12-08', type: 'Annual Leave', status: 'pending', employeeName: 'Rajesh Kumar' },
  { date: '2025-12-09', type: 'Annual Leave', status: 'pending', employeeName: 'Rajesh Kumar' },
  { date: '2025-12-10', type: 'Sick Leave', status: 'pending', employeeName: 'Priya Sharma' },
  { date: '2025-12-11', type: 'Sick Leave', status: 'pending', employeeName: 'Priya Sharma' },
  { date: '2025-12-12', type: 'Comp Off', status: 'pending', employeeName: 'Sneha Reddy' },
  { date: '2025-12-15', type: 'Annual Leave', status: 'pending', employeeName: 'Amit Patel' },
  { date: '2025-12-16', type: 'Annual Leave', status: 'pending', employeeName: 'Amit Patel' },
  { date: '2025-12-17', type: 'Annual Leave', status: 'pending', employeeName: 'Amit Patel' },
  { date: '2025-12-18', type: 'Annual Leave', status: 'pending', employeeName: 'Amit Patel' },
  { date: '2025-12-19', type: 'Annual Leave', status: 'pending', employeeName: 'Amit Patel' },
  { date: '2025-12-22', type: 'Annual Leave', status: 'pending', employeeName: 'Vikram Singh' },
  { date: '2025-12-23', type: 'Annual Leave', status: 'pending', employeeName: 'Vikram Singh' },
  { date: '2025-12-24', type: 'Annual Leave', status: 'pending', employeeName: 'Vikram Singh' },
];
