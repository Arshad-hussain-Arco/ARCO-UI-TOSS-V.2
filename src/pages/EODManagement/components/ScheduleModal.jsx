import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, Plus, Loader2 } from 'lucide-react';
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

const QUARTERS = [
  { label: 'Q1', months: 1,  range: 'Jan – Mar' },
  { label: 'Q2', months: 4,  range: 'Apr – Jun' },
  { label: 'Q3', months: 7,  range: 'Jul – Sep' },
  { label: 'Q4', months: 10, range: 'Oct – Dec' },
];

const MONTHS = [
  { value: 1, label: 'January', days: 31 },
  { value: 2, label: 'February', days: 29 },
  { value: 3, label: 'March', days: 31 },
  { value: 4, label: 'April', days: 30 },
  { value: 5, label: 'May', days: 31 },
  { value: 6, label: 'June', days: 30 },
  { value: 7, label: 'July', days: 31 },
  { value: 8, label: 'August', days: 31 },
  { value: 9, label: 'September', days: 30 },
  { value: 10, label: 'October', days: 31 },
  { value: 11, label: 'November', days: 30 },
  { value: 12, label: 'December', days: 31 },
];


export function ScheduleModal({ isOpen, schedule, environments, onClose, onSave }) {
  const initialDate = schedule?.selectedDate ? new Date(schedule.selectedDate) : new Date();

  const [form, setForm] = useState({
    id: schedule?.id || '',
    envId: schedule?.envId || environments[0]?.id || '',
    selectedDate: schedule?.selectedDate || new Date(),
    selectedMonth: schedule?.selectedMonth || (initialDate.getMonth() + 1),
    selectedDayOfMonth: schedule?.selectedDayOfMonth !== undefined ? schedule.selectedDayOfMonth : (initialDate.getDate() || 1),
    selectedDays: Array.isArray(schedule?.selectedDays)
      ? schedule.selectedDays
      : (schedule?.dayOfWeek ? [schedule.dayOfWeek] : ['Monday']),
    selectedQuarters: Array.isArray(schedule?.selectedQuarters)
      ? schedule.selectedQuarters
      : [1, 4, 7, 10], // default: all quarters
    time: schedule?.time || '22:00',
    recurrence: schedule?.recurrence || 'Daily',
  });

  useEffect(() => {
    if (isOpen && schedule) {
      const initDate = schedule.selectedDate ? new Date(schedule.selectedDate) : new Date();
      setForm({
        id: schedule.id || '',
        envId: schedule.envId || environments[0]?.id || '',
        selectedDate: schedule.selectedDate || new Date(),
        selectedMonth: schedule.selectedMonth || (initDate.getMonth() + 1),
        selectedDayOfMonth: schedule.selectedDayOfMonth !== undefined ? schedule.selectedDayOfMonth : (initDate.getDate() || 1),
        selectedDays: Array.isArray(schedule.selectedDays)
          ? schedule.selectedDays
          : (schedule.dayOfWeek ? [schedule.dayOfWeek] : ['Monday']),
        selectedQuarters: Array.isArray(schedule.selectedQuarters)
          ? schedule.selectedQuarters
          : [1, 4, 7, 10],
        time: schedule.time || '22:00',
        recurrence: schedule.recurrence || 'Daily',
      });
      setErrors({});
    }
  }, [isOpen, schedule, environments]);

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
    if (form.recurrence === 'Annually') {
      const monObj = MONTHS.find((m) => m.value === form.selectedMonth);
      const maxDays = monObj ? monObj.days : 31;
      if (!form.selectedMonth || form.selectedMonth < 1 || form.selectedMonth > 12) {
        errs.selectedMonth = 'Select a valid month';
      }
      if (form.selectedDayOfMonth !== 'L' &&
          (!form.selectedDayOfMonth || form.selectedDayOfMonth < 1 || form.selectedDayOfMonth > maxDays)) {
        errs.selectedDayOfMonth = `Enter a day between 1 and ${maxDays}`;
      }
    }
    if (form.recurrence === 'Weekly' && (!form.selectedDays || form.selectedDays.length === 0)) {
      errs.selectedDays = 'At least one day of week is required';
    }
    if (form.recurrence === 'Quarterly' && (!form.selectedQuarters || form.selectedQuarters.length === 0)) {
      errs.selectedQuarters = 'Select at least one quarter';
    }
    if ((form.recurrence === 'Monthly' || form.recurrence === 'Quarterly') &&
        form.selectedDayOfMonth !== 'L' &&
        (!form.selectedDayOfMonth || form.selectedDayOfMonth < 1 || form.selectedDayOfMonth > 31)) {
      errs.selectedDayOfMonth = 'Enter a valid day (1–31)';
    }
    if (!form.time) errs.time = 'Schedule Time is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const currYear = new Date().getFullYear();
    const annualDate = form.recurrence === 'Annually'
      ? new Date(currYear, (form.selectedMonth || 1) - 1, form.selectedDayOfMonth || 1)
      : form.selectedDate;

    setIsSaving(true);
    try {
      await onSave({
        ...form,
        selectedDate: annualDate,
        dayOfWeek: (form.selectedDays || []).join(', '),
      });
    } finally {
      setIsSaving(false);
    }
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
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annually">Annually</option>
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

          {/* Monthly — day of month + time */}
          {form.recurrence === 'Monthly' && (
            <div className="eod-modal-row2">
              <div className="eod-modal-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="eod-modal-label">
                    Day of Month <span className="req">*</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#005a36', cursor: 'pointer', fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={form.selectedDayOfMonth === 'L'}
                      onChange={(e) => {
                        setForm({ ...form, selectedDayOfMonth: e.target.checked ? 'L' : 1 });
                        if (errors.selectedDayOfMonth) setErrors({ ...errors, selectedDayOfMonth: null });
                      }}
                    />
                    <span>Last Day of Month (L)</span>
                  </label>
                </div>
                {form.selectedDayOfMonth === 'L' ? (
                  <input
                    type="text"
                    className="eod-modal-input"
                    value="Last Day of Month (L)"
                    disabled
                    style={{ background: 'var(--bg-secondary, #f8fafc)', color: '#005a36', fontWeight: 600 }}
                  />
                ) : (
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className={`eod-modal-input ${errors.selectedDayOfMonth ? 'error' : ''}`}
                    value={form.selectedDayOfMonth}
                    onChange={(e) => {
                      setForm({ ...form, selectedDayOfMonth: parseInt(e.target.value, 10) || 1 });
                      if (errors.selectedDayOfMonth) setErrors({ ...errors, selectedDayOfMonth: null });
                    }}
                  />
                )}
                {errors.selectedDayOfMonth && <span className="eod-field-error">{errors.selectedDayOfMonth}</span>}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="eod-modal-label">
                      Day of Month <span className="req">*</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#005a36', cursor: 'pointer', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={form.selectedDayOfMonth === 'L'}
                        onChange={(e) => {
                          setForm({ ...form, selectedDayOfMonth: e.target.checked ? 'L' : 1 });
                          if (errors.selectedDayOfMonth) setErrors({ ...errors, selectedDayOfMonth: null });
                        }}
                      />
                      <span>Last Day of Month (L)</span>
                    </label>
                  </div>
                  {form.selectedDayOfMonth === 'L' ? (
                    <input
                      type="text"
                      className="eod-modal-input"
                      value="Last Day of Quarter (L)"
                      disabled
                      style={{ background: 'var(--bg-secondary, #f8fafc)', color: '#005a36', fontWeight: 600 }}
                    />
                  ) : (
                    <input
                      type="number"
                      min={1}
                      max={31}
                      className={`eod-modal-input ${errors.selectedDayOfMonth ? 'error' : ''}`}
                      value={form.selectedDayOfMonth}
                      onChange={(e) => {
                        setForm({ ...form, selectedDayOfMonth: parseInt(e.target.value, 10) || 1 });
                        if (errors.selectedDayOfMonth) setErrors({ ...errors, selectedDayOfMonth: null });
                      }}
                    />
                  )}
                  {errors.selectedDayOfMonth && <span className="eod-field-error">{errors.selectedDayOfMonth}</span>}
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
            </div>
          )}

          {/* Annually — Month + Day of Month + Time */}
          {form.recurrence === 'Annually' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="eod-modal-row2">
                <div className="eod-modal-field">
                  <label className="eod-modal-label">
                    Month <span className="req">*</span>
                  </label>
                  <select
                    className={`eod-modal-input ${errors.selectedMonth ? 'error' : ''}`}
                    value={form.selectedMonth}
                    onChange={(e) => {
                      const mon = parseInt(e.target.value, 10);
                      const monObj = MONTHS.find((m) => m.value === mon);
                      const maxDays = monObj ? monObj.days : 31;
                      setForm({
                        ...form,
                        selectedMonth: mon,
                        selectedDayOfMonth: Math.min(form.selectedDayOfMonth || 1, maxDays),
                      });
                      if (errors.selectedMonth) setErrors({ ...errors, selectedMonth: null });
                    }}
                  >
                    {MONTHS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  {errors.selectedMonth && <span className="eod-field-error">{errors.selectedMonth}</span>}
                </div>

                <div className="eod-modal-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="eod-modal-label">
                      Day of Month <span className="req">*</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#005a36', cursor: 'pointer', fontWeight: 500 }}>
                      <input
                        type="checkbox"
                        checked={form.selectedDayOfMonth === 'L'}
                        onChange={(e) => {
                          setForm({ ...form, selectedDayOfMonth: e.target.checked ? 'L' : 1 });
                          if (errors.selectedDayOfMonth) setErrors({ ...errors, selectedDayOfMonth: null });
                        }}
                      />
                      <span>Last Day of Month (L)</span>
                    </label>
                  </div>
                  {form.selectedDayOfMonth === 'L' ? (
                    <input
                      type="text"
                      className="eod-modal-input"
                      value={`Last Day of ${MONTHS.find((m) => m.value === form.selectedMonth)?.label || 'Month'} (L)`}
                      disabled
                      style={{ background: 'var(--bg-secondary, #f8fafc)', color: '#005a36', fontWeight: 600 }}
                    />
                  ) : (
                    <input
                      type="number"
                      min={1}
                      max={MONTHS.find((m) => m.value === form.selectedMonth)?.days || 31}
                      className={`eod-modal-input ${errors.selectedDayOfMonth ? 'error' : ''}`}
                      value={form.selectedDayOfMonth}
                      onChange={(e) => {
                        setForm({ ...form, selectedDayOfMonth: parseInt(e.target.value, 10) || 1 });
                        if (errors.selectedDayOfMonth) setErrors({ ...errors, selectedDayOfMonth: null });
                      }}
                    />
                  )}
                  {errors.selectedDayOfMonth && <span className="eod-field-error">{errors.selectedDayOfMonth}</span>}
                </div>
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
                <span style={{ fontSize: 11, color: '#64748b', marginTop: 4, display: 'block' }}>
                  Runs once a year on {form.selectedDayOfMonth === 'L' ? `Last Day of ${MONTHS.find((m) => m.value === form.selectedMonth)?.label}` : `${MONTHS.find((m) => m.value === form.selectedMonth)?.label} ${form.selectedDayOfMonth}`}
                </span>
              </div>
            </div>
          )}

          {/* Daily — time only */}
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
          <button type="submit" className="eod-modal-btn primary-green" disabled={isSaving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isSaving ? (
              <>
                <Loader2 size={16} className="spin-animation" /> Saving...
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
