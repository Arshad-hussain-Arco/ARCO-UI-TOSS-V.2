// Shared helpers/constants for the Leave Configuration admin page and its tabs.

export const WORK_SCHEDULE_OPTIONS = {
  schedules: [
    { value: 'MON_FRI', label: 'Monday to Friday' },
    { value: 'MON_SAT', label: 'Monday to Saturday' },
    { value: 'SUN_THU', label: 'Sunday to Thursday' },
    { value: 'CUSTOM', label: 'Custom' },
  ],
  custom_weekend_days: {
    description: 'Weekday numbers used in custom_weekend_days (Mon=0 ... Sun=6).',
    days: [
      { value: 0, label: 'Monday' },
      { value: 1, label: 'Tuesday' },
      { value: 2, label: 'Wednesday' },
      { value: 3, label: 'Thursday' },
      { value: 4, label: 'Friday' },
      { value: 5, label: 'Saturday' },
      { value: 6, label: 'Sunday' },
    ],
  },
};

export function getScheduleLabel(value) {
  const match = WORK_SCHEDULE_OPTIONS.schedules.find((s) => s.value === value);
  return match ? match.label : value;
}

export function formatCustomWeekendDays(days) {
  const dayMap = new Map(WORK_SCHEDULE_OPTIONS.custom_weekend_days.days.map((d) => [d.value, d.label]));
  return (days || []).map((d) => dayMap.get(d) || d).join(', ');
}

/** Format raw date string (e.g. '2026-02-22') into 'MMM DD, YYYY' (e.g. 'Feb 22, 2026'). */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const normalized = value.includes('T') ? value : `${value}T00:00:00`;
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

export function toDateInputValue(dateValue) {
  if (!dateValue) return '';
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function computeDayOfWeek(dateStr) {
  if (!dateStr) return '';
  const d = parseDateValue(dateStr);
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

export function computeStatus(dateStr) {
  if (!dateStr) return 'Upcoming';
  const date = parseDateValue(dateStr);
  if (!date || Number.isNaN(date.getTime())) return 'Upcoming';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  return targetDate.getTime() < today.getTime() ? 'Past' : 'Upcoming';
}

/** Empty combined leave-type-with-policy form, matching the /hr/leave-types-with-policy/ payload. */
export function emptyCombinedForm() {
  return {
    code: '',
    name: '',
    description: '',
    category: 'ACTUAL',
    payment_type: 'PAID',
    max_quota_days: '',
    max_days_per_application: '',
    display_order: 0,
    notes: '',
    policy_notes: '',

    gender_restriction: '',
    requires_approval: true,
    is_active: true,

    entitled_days: '',
    min_notice_days: 0,
    max_consecutive: '',
    accrual_type: 'NONE',
    proration_type: 'MONTHLY',
    is_carry_forward_allowed: false,
    max_carry_forward: 0,
    carry_forward_expiry_months: '',
    allow_negative: false,
    max_negative_days: 0,
    effective_from: toDateInputValue(new Date()),
    effective_to: '',
  };
}

/** Map a combined API row ({ code, name, leave_type, policy }) into the flat form the modal edits. */
export function combinedRowToForm(row) {
  const lt = row.leave_type || {};
  const p = row.policy || {};
  return {
    code: row.code || lt.code || '',
    name: row.name || lt.name || '',
    description: lt.description || '',
    category: lt.category || 'ACTUAL',
    payment_type: lt.payment_type || 'PAID',
    max_quota_days: lt.max_quota_days ?? '',
    max_days_per_application: lt.max_days_per_application ?? '',
    display_order: lt.display_order ?? 0,
    notes: lt.notes || '',
    policy_notes: p.notes || '',

    gender_restriction: lt.gender_restriction || '',
    requires_approval: lt.requires_approval ?? true,
    is_active: lt.is_active ?? true,

    entitled_days: p.entitled_days ?? '',
    min_notice_days: p.min_notice_days ?? 0,
    max_consecutive: p.max_consecutive ?? '',
    accrual_type: p.accrual_type || 'NONE',
    proration_type: p.proration_type || 'MONTHLY',
    is_carry_forward_allowed: p.is_carry_forward_allowed ?? false,
    max_carry_forward: p.max_carry_forward ?? 0,
    carry_forward_expiry_months: p.carry_forward_expiry_months ?? '',
    allow_negative: p.allow_negative ?? false,
    max_negative_days: p.max_negative_days ?? 0,
    effective_from: p.effective_from || toDateInputValue(new Date()),
    effective_to: p.effective_to || '',
  };
}

/** Build the API payload from the form, numeric-coercing and dropping empty-string optionals to null. */
export function combinedFormToPayload(form) {
  const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    description: form.description,
    category: form.category,
    payment_type: form.payment_type,
    max_quota_days: numOrNull(form.max_quota_days),
    max_days_per_application: numOrNull(form.max_days_per_application),
    display_order: Number(form.display_order) || 0,
    notes: form.notes,
    policy_notes: form.policy_notes,

    gender_restriction: form.gender_restriction,
    requires_approval: form.requires_approval,
    is_active: form.is_active,

    entitled_days: numOrNull(form.entitled_days),
    min_notice_days: Number(form.min_notice_days) || 0,
    max_consecutive: numOrNull(form.max_consecutive),
    accrual_type: form.accrual_type,
    proration_type: form.proration_type,
    is_carry_forward_allowed: form.is_carry_forward_allowed,
    max_carry_forward: form.is_carry_forward_allowed ? Number(form.max_carry_forward) || 0 : 0,
    carry_forward_expiry_months: form.is_carry_forward_allowed
      ? numOrNull(form.carry_forward_expiry_months)
      : null,
    allow_negative: form.allow_negative,
    max_negative_days: form.allow_negative ? Number(form.max_negative_days) || 0 : 0,
    effective_from: form.effective_from || null,
    effective_to: form.effective_to || null,
  };
}

/** Required on the backend: code, name, entitled_days (see hr_admin serializers/views). */
export function validateCombinedForm(form) {
  const errors = {};
  if (!form.code.trim()) errors.code = 'Code is required.';
  if (!form.name.trim()) errors.name = 'Name is required.';
  if (form.entitled_days === '' || form.entitled_days === null) {
    errors.entitled_days = 'Entitled Days is required.';
  } else if (Number.isNaN(Number(form.entitled_days))) {
    errors.entitled_days = 'Entitled Days must be a number.';
  }
  return errors;
}
