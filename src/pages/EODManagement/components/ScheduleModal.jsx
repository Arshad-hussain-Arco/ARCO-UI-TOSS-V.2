import React, { useState } from 'react';
import { RefreshCw, CheckCircle, Plus } from 'lucide-react';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';

const WEEKDAYS = [
  { label: 'Mon', full: 'Monday' },
  { label: 'Tue', full: 'Tuesday' },
  { label: 'Wed', full: 'Wednesday' },
  { label: 'Thu', full: 'Thursday' },
  { label: 'Fri', full: 'Friday' },
  { label: 'Sat', full: 'Saturday' },
  { label: 'Sun', full: 'Sunday' },
];

export function ScheduleModal({ isOpen, schedule, environments, onClose, onSave }) {
  const [form, setForm] = useState({
    id: schedule.id || '',
    envId: schedule.envId || environments[0]?.id || '',
    selectedDate: schedule.selectedDate || new Date(),
    selectedDays: Array.isArray(schedule.selectedDays)
      ? schedule.selectedDays
      : (schedule.dayOfWeek ? [schedule.dayOfWeek] : ['Monday']),
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

  const validate = () => {
    const errs = {};
    if (!form.envId) errs.envId = 'Environment is required';
    if (form.recurrence === 'Custom / One-time' && !form.selectedDate) {
      errs.selectedDate = 'Schedule Date is required';
    }
    if (form.recurrence === 'Weekly' && (!form.selectedDays || form.selectedDays.length === 0)) {
      errs.selectedDays = 'At least one day of week is required';
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
            <select
              className={`eod-modal-input ${errors.envId ? 'error' : ''}`}
              value={form.envId}
              onChange={(e) => {
                setForm({ ...form, envId: e.target.value });
                if (errors.envId) setErrors({ ...errors, envId: null });
              }}
            >
              <option value="" disabled>
                Select environment
              </option>
              {environments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name} ({(env.status || 'idle').toUpperCase()})
                </option>
              ))}
            </select>
            {errors.envId && <span className="eod-field-error">{errors.envId}</span>}
          </div>

          {/* Recurrence Selection */}
          <div className="eod-modal-field">
            <label className="eod-modal-label">
              Recurrence <span className="req">*</span>
            </label>
            <select
              className="eod-modal-input"
              value={form.recurrence}
              onChange={(e) => {
                setForm({ ...form, recurrence: e.target.value });
                setErrors({});
              }}
            >
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Custom / One-time">Custom / One-time</option>
            </select>
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
                <input
                  type="time"
                  className={`eod-modal-input ${errors.time ? 'error' : ''}`}
                  value={form.time}
                  onChange={(e) => {
                    setForm({ ...form, time: e.target.value });
                    if (errors.time) setErrors({ ...errors, time: null });
                  }}
                />
                {errors.time && <span className="eod-field-error">{errors.time}</span>}
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
                <input
                  type="time"
                  className={`eod-modal-input ${errors.time ? 'error' : ''}`}
                  value={form.time}
                  onChange={(e) => {
                    setForm({ ...form, time: e.target.value });
                    if (errors.time) setErrors({ ...errors, time: null });
                  }}
                />
                {errors.time && <span className="eod-field-error">{errors.time}</span>}
              </div>
            </div>
          )}

          {form.recurrence === 'Daily' && (
            <div className="eod-modal-field">
              <label className="eod-modal-label">
                Schedule Time <span className="req">*</span>
              </label>
              <input
                type="time"
                className={`eod-modal-input ${errors.time ? 'error' : ''}`}
                value={form.time}
                onChange={(e) => {
                  setForm({ ...form, time: e.target.value });
                  if (errors.time) setErrors({ ...errors, time: null });
                }}
              />
              {errors.time && <span className="eod-field-error">{errors.time}</span>}
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="eod-modal-footer">
          <button
            type="button"
            className="eod-modal-btn cancel"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button type="submit" className="eod-modal-btn primary-green" disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw size={12} className="eod-pulse-icon" /> Saving...
              </>
            ) : isEdit ? (
              <>
                <CheckCircle size={12} /> Update Schedule
              </>
            ) : (
              <>
                <Plus size={12} /> Add Schedule
              </>
            )}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}

export default ScheduleModal;
