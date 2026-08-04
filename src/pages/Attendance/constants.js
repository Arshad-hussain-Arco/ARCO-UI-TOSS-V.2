export const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
export const MONTH_OPTIONS = MONTH_NAMES.map((label, value) => ({ label, value: String(value) }));
export const YEAR_OPTIONS = Array.from({ length: 10 }, (_, i) => {
  const y = new Date().getFullYear() - 4 + i;
  return { label: String(y), value: String(y) };
});

/**
 * Attendance status code → display config.
 * Used for cell badges AND legends section.
 */
export const ATTENDANCE_CODE_MAP = [
  { code: 'P',   label: 'Present',           color: '#22c55e', bg: '#f0fdf4', darkBg: '#14532d' },
  { code: 'A',   label: 'Absent',            color: '#ef4444', bg: '#fef2f2', darkBg: '#7f1d1d' },
  { code: 'SL',  label: 'Sick Leave',        color: '#f97316', bg: '#fff7ed', darkBg: '#7c2d12' },
  { code: 'AL',  label: 'Annual Leave',      color: '#3b82f6', bg: '#eff6ff', darkBg: '#1e3a8a' },
  { code: 'CL',  label: 'Casual Leave',      color: '#8b5cf6', bg: '#f5f3ff', darkBg: '#4c1d95' },
  { code: 'WFH', label: 'Work From Home',    color: '#06b6d4', bg: '#ecfeff', darkBg: '#164e63' },
  { code: 'WW',  label: 'Weekend Work',      color: '#d97706', bg: '#fffbeb', darkBg: '#78350f' },
  { code: 'CO',  label: 'Comp Off',          color: '#7c3aed', bg: '#ede9fe', darkBg: '#4c1d95' },
  { code: 'ML',  label: 'Maternity Leave',   color: '#ec4899', bg: '#fdf2f8', darkBg: '#831843' },
  { code: 'OW',  label: 'Offshore Work',     color: '#0ea5e9', bg: '#f0f9ff', darkBg: '#075985' },
  { code: 'LWP', label: 'Leave Without Pay', color: '#dc2626', bg: '#fef2f2', darkBg: '#7f1d1d' },
  { code: 'OD',  label: 'On Duty',           color: '#059669', bg: '#ecfdf5', darkBg: '#064e3b' },
  { code: 'HD',  label: 'Half Day',          color: '#ca8a04', bg: '#fefce8', darkBg: '#713f12' },
  { code: 'HO',  label: 'Holiday',           color: '#9333ea', bg: '#faf5ff', darkBg: '#581c87' },
  { code: 'WE',  label: 'Weekend',           color: '#6b7280', bg: '#f9fafb', darkBg: '#1f2937' },
];

export const CODE_LOOKUP = Object.fromEntries(ATTENDANCE_CODE_MAP.map(c => [c.code, c]));

// Codes that render as plain coloured text (no badge background/border)
export const PLAIN_TEXT_CODES = new Set(['P', 'WFH', 'WE', 'A', 'OD']);
