import React, { useState } from 'react';
import { CheckCircle, Plus } from 'lucide-react';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { Button, Dropdown, NumberInput, TimePicker } from '@components/common';

const WEEKDAYS = [
  { label: 'Mon', full: 'Monday' },
  { label: 'Tue', full: 'Tuesday' },
  { label: 'Wed', full: 'Wednesday' },
  { label: 'Thu', full: 'Thursday' },
  { label: 'Fri', full: 'Friday' },
  { label: 'Sat', full: 'Saturday' },
  { label: 'Sun', full: 'Sunday' },
];

const QUARTERS = [
  { label: 'Q1', months: 1,  range: 'Jan – Mar' },
  { label: 'Q2', months: 4,  range: 'Apr – Jun' },
  { label: 'Q3', months: 7,  range: 'Jul – Sep' },
  { label: 'Q4', months: 10, range: 'Oct – Dec' },
];

export function ScheduleModal({ isOpen, schedule, environments, onClose, onSave }) {
  const [form, setForm] = useState({
    id: schedule.id || '',
    envId: schedule.envId || environments[0]?.id || '',
    selectedDate: schedule.selectedDate || new Date(),
    selectedDays: Array.isArray(schedule.selectedDays)
      ? schedule.selectedDays
      : (schedule.dayOfWeek ? [schedule.dayOfWeek] : ['Monday']),
    selectedDayOfMonth: schedule.selectedDayOfMonth || 1,
    selectedQuarters: Array.isArray(schedule.selectedQuarters)
      ? schedule.selectedQuarters
      : [1, 4, 7, 10], // default: all quarters
    time: schedule.time || '22:00',
    recurrence: schedule.recurrence || 'Daily',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const isEdit = Boolean(form.id);

  const toggleDay = (dayFull) => {
    const current = form.selectedDays || [];
    let updated;
    if (current.includes(dayFull)) {
      if (current.length === 1) return; // Keep at least one day selected
      updated = current.filter((d) => d !== dayFull);
    } else {
      updated = [...current, dayFull];
    }
    setForm({ ...form, selectedDays: updated });
    if (errors.selectedDays) setErrors({ ...errors, selectedDays: null });
  };

  const toggleQuarter = (month) => {
    const current = form.selectedQuarters || [];
    let updated;
    if (current.includes(month)) {
      if (current.length === 1) return; // keep at least one quarter
      updated = current.filter((m) => m !== month);
    } else {
      updated = [...current, month].sort((a, b) => a - b);
    }
    setForm({ ...form, selectedQuarters: updated });
    if (errors.selectedQuarters) setErrors({ ...errors, selectedQuarters: null });
  };

  const validate = () => {
    const errs = {};
    if (!form.envId) errs.envId = 'Environment is required';
    if (form.recurrence === 'Custom / One-time' && !form.selectedDate) {
      errs.selectedDate = 'Schedule Date is required';
    }
    if (form.recurrence === 'Annually' && !form.selectedDate) {
      errs.selectedDate = 'Schedule Date is required';
    }
    if (form.recurrence === 'Weekly' && (!form.selectedDays || form.selectedDays.length === 0)) {
      errs.selectedDays = 'At least one day of week is required';
    }
    if (form.recurrence === 'Quarterly' && (!form.selectedQuarters || form.selectedQuarters.length === 0)) {
      errs.selectedQuarters = 'Select at least one quarter';
    }
    if ((form.recurrence === 'Monthly' || form.recurrence === 'Quarterly') &&
        (!form.selectedDayOfMonth || form.selectedDayOfMonth < 1 || form.selectedDayOfMonth > 28)) {
      errs.selectedDayOfMonth = 'Enter a valid day (1–28)';
    }
    if (!form.time) errs.time = 'Schedule Time is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setTimeout(() => {
      onSave({
        ...form,
        dayOfWeek: (form.selectedDays || []).join(', '),
      });
      setIsSaving(false);
    }, 250);
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Schedule' : 'Add New Schedule'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="eod-schedule-modal-form">
        <div className="eod-modal-field-group">
          {/* Environment Selection */}
          <div className="eod-modal-field">
            <label className="eod-modal-label">
              Environment <span className="req">*</span>
            </label>
            <Dropdown
              width="100%"
              value={String(form.envId)}
              placeholder="Select environment"
              onChange={(value) => {
                setForm({ ...form, envId: value });
                if (errors.envId) setErrors({ ...errors, envId: null });
              }}
              options={environments.map((env) => ({
                value: String(env.id),
                label: `${env.name} (${(env.status || 'idle').toUpperCase()})`,
              }))}
            />
            {errors.envId && <span className="eod-field-error">{errors.envId}</span>}
          </div>

          {/* Recurrence Selection */}
          <div className="eod-modal-field">
            <label className="eod-modal-label">
              Recurrence <span className="req">*</span>
            </label>
            <Dropdown
              width="100%"
              value={form.recurrence}
              onChange={(value) => {
                setForm({ ...form, recurrence: value });
                setErrors({});
              }}
              options={[
                { value: 'Daily', label: 'Daily' },
                { value: 'Weekly', label: 'Weekly' },
                { value: 'Monthly', label: 'Monthly' },
                { value: 'Quarterly', label: 'Quarterly' },
                { value: 'Annually', label: 'Annually' },
                { value: 'Custom / One-time', label: 'Custom / One-time' },
              ]}
            />
          </div>

          {/* Conditional Date / Weekday / Time Controls */}
          {form.recurrence === 'Custom / One-time' && (
            <div className="eod-modal-row2">
              <div className="eod-modal-field">
                <label className="eod-modal-label">
                  Schedule Date <span className="req">*</span>
                </label>
                <DatePicker
                  value={form.selectedDate}
                  onChange={(d) => {
                    setForm({ ...form, selectedDate: d });
                    if (errors.selectedDate) setErrors({ ...errors, selectedDate: null });
                  }}
                  placeholder="Select schedule date"
                  width="100%"
                />
                {errors.selectedDate && (
                  <span className="eod-field-error">{errors.selectedDate}</span>
                )}
              </div>

              <div className="eod-modal-field">
                <label className="eod-modal-label">
                  Schedule Time <span className="req">*</span>
                </label>
                <TimePicker
                  value={form.time}
                  errorText={errors.time}
                  onChange={(e) => {
                    setForm({ ...form, time: e.target.value });
                    if (errors.time) setErrors({ ...errors, time: null });
                  }}
                />
              </div>
            </div>
          )}

          {form.recurrence === 'Weekly' && (
            <div className="eod-modal-row2" style={{ alignItems: 'flex-start' }}>
              <div className="eod-modal-field" style={{ flex: 1.4 }}>
                <label className="eod-modal-label">
                  Day(s) of Week <span className="req">*</span>
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {WEEKDAYS.map(({ label, full }) => {
                    const isSelected = (form.selectedDays || []).includes(full);
                    return (
                      <button
                        key={full}
                        type="button"
                        onClick={() => toggleDay(full)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isSelected
                            ? '1px solid var(--c-primary, #005a36)'
                            : '1px solid var(--border-color, #e2e8f0)',
                          background: isSelected
                            ? 'var(--c-primary, #005a36)'
                            : 'var(--bg-secondary, #f8fafc)',
                          color: isSelected ? '#ffffff' : 'var(--text-primary, #1e293b)',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {errors.selectedDays && (
                  <span className="eod-field-error">{errors.selectedDays}</span>
                )}
              </div>

              <div className="eod-modal-field" style={{ flex: 1 }}>
                <label className="eod-modal-label">
                  Schedule Time <span className="req">*</span>
                </label>
                <TimePicker
                  value={form.time}
                  errorText={errors.time}
                  onChange={(e) => {
                    setForm({ ...form, time: e.target.value });
                    if (errors.time) setErrors({ ...errors, time: null });
                  }}
                />
              </div>
            </div>
          )}

          {/* Monthly — day of month + time */}
          {form.recurrence === 'Monthly' && (
            <div className="eod-modal-row2">
              <div className="eod-modal-field">
                <label className="eod-modal-label">
                  Day of Month <span className="req">*</span>
                  <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 4, fontSize: 11 }}>(1–28)</span>
                </label>
                <NumberInput
                  min={1}
                  max={28}
                  errorText={errors.selectedDayOfMonth}
                  value={form.selectedDayOfMonth}
                  onChange={(e) => {
                    setForm({ ...form, selectedDayOfMonth: parseInt(e.target.value, 10) || 1 });
                    if (errors.selectedDayOfMonth) setErrors({ ...errors, selectedDayOfMonth: null });
                  }}
                />
              </div>

              <div className="eod-modal-field">
                <label className="eod-modal-label">
                  Schedule Time <span className="req">*</span>
                </label>
                <TimePicker
                  value={form.time}
                  errorText={errors.time}
                  onChange={(e) => {
                    setForm({ ...form, time: e.target.value });
                    if (errors.time) setErrors({ ...errors, time: null });
                  }}
                />
              </div>
            </div>
          )}

          {/* Quarterly — quarter picker + day of month + time */}
          {form.recurrence === 'Quarterly' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Quarter toggle buttons */}
              <div className="eod-modal-field">
                <label className="eod-modal-label">
                  Quarter(s) <span className="req">*</span>
                </label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {QUARTERS.map(({ label, months, range }) => {
                    const isSelected = (form.selectedQuarters || []).includes(months);
                    return (
                      <button
                        key={months}
                        type="button"
                        onClick={() => toggleQuarter(months)}
                        style={{
                          flex: 1,
                          padding: '8px 6px',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isSelected
                            ? '1px solid var(--c-primary, #005a36)'
                            : '1px solid var(--border-color, #e2e8f0)',
                          background: isSelected
                            ? 'var(--c-primary, #005a36)'
                            : 'var(--bg-secondary, #f8fafc)',
                          color: isSelected ? '#ffffff' : 'var(--text-primary, #1e293b)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        <span>{label}</span>
                        <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{range}</span>
                      </button>
                    );
                  })}
                </div>
                {errors.selectedQuarters && <span className="eod-field-error">{errors.selectedQuarters}</span>}
              </div>

              {/* Day of month + time */}
              <div className="eod-modal-row2">
                <div className="eod-modal-field">
                  <label className="eod-modal-label">
                    Day of Month <span className="req">*</span>
                    <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 4, fontSize: 11 }}>(1–28)</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={28}
                    className={`eod-modal-input ${errors.selectedDayOfMonth ? 'error' : ''}`}
                    value={form.selectedDayOfMonth}
                    onChange={(e) => {
                      setForm({ ...form, selectedDayOfMonth: parseInt(e.target.value, 10) || 1 });
                      if (errors.selectedDayOfMonth) setErrors({ ...errors, selectedDayOfMonth: null });
                    }}
                  />
                  {errors.selectedDayOfMonth && <span className="eod-field-error">{errors.selectedDayOfMonth}</span>}
                </div>

                <div className="eod-modal-field">
                  <label className="eod-modal-label">
                    Schedule Time <span className="req">*</span>
                  </label>
                  <TimePicker
                    value={form.time}
                    errorText={errors.time}
                    onChange={(e) => {
                      setForm({ ...form, time: e.target.value });
                      if (errors.time) setErrors({ ...errors, time: null });
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Annually — specific date each year + time */}
          {form.recurrence === 'Annually' && (
            <div className="eod-modal-row2">
              <div className="eod-modal-field">
                <label className="eod-modal-label">
                  Date of Year <span className="req">*</span>
                </label>
                <DatePicker
                  value={form.selectedDate}
                  onChange={(d) => {
                    setForm({ ...form, selectedDate: d });
                    if (errors.selectedDate) setErrors({ ...errors, selectedDate: null });
                  }}
                  placeholder="Select annual date"
                  width="100%"
                />
                {errors.selectedDate && <span className="eod-field-error">{errors.selectedDate}</span>}
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                  Runs once a year on this date
                </span>
              </div>

              <div className="eod-modal-field">
                <label className="eod-modal-label">
                  Schedule Time <span className="req">*</span>
                </label>
                <TimePicker
                  value={form.time}
                  errorText={errors.time}
                  onChange={(e) => {
                    setForm({ ...form, time: e.target.value });
                    if (errors.time) setErrors({ ...errors, time: null });
                  }}
                />
              </div>
            </div>
          )}

          {/* Daily — time only */}
          {form.recurrence === 'Daily' && (
            <div className="eod-modal-field">
              <label className="eod-modal-label">
                Schedule Time <span className="req">*</span>
              </label>
              <TimePicker
                value={form.time}
                errorText={errors.time}
                onChange={(e) => {
                  setForm({ ...form, time: e.target.value });
                  if (errors.time) setErrors({ ...errors, time: null });
                }}
              />
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="eod-modal-footer">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSaving}
            leadingIcon={isSaving ? undefined : isEdit ? CheckCircle : Plus}
          >
            {isSaving ? 'Saving...' : isEdit ? 'Update Schedule' : 'Add Schedule'}
          </Button>
        </div>
      </form>
    </AdminModal>
  );
}

export default ScheduleModal;
