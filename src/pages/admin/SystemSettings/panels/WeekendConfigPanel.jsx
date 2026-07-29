import { memo, useState } from 'react';
import { Save } from 'lucide-react';

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * TAB 5: Weekend Configuration
 * Checklist for days of the week, with Friday & Saturday checked by default.
 */
function WeekendConfigPanelComponent({ weekend, onToggleDay, onSave, isSaving }) {
  // Local state initialized with Friday and Saturday checked by default
  const [selectedDays, setSelectedDays] = useState(
    weekend?.selectedDays || ['Friday', 'Saturday'],
  );

  const handleCheckboxChange = (day) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    setSelectedDays(next);
    if (onToggleDay) onToggleDay(day);
  };

  return (
    <div className="ss-form-card">
      <div className="ss-panel-header">
        <h2 className="ss-panel-title">📅 Weekend Configuration</h2>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (onSave) onSave();
        }}
        style={{ padding: '24px' }}
      >
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px' }}>
          Select the days of the week that should be designated as weekends in the system.
        </p>

        {/* Checkbox Group */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {DAYS_OF_WEEK.map((day) => {
            const isChecked = selectedDays.includes(day);
            return (
              <label
                key={day}
                htmlFor={`weekend-day-${day}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  userSelect: 'none',
                }}
              >
                <input
                  id={`weekend-day-${day}`}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleCheckboxChange(day)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: 'var(--c-primary)',
                    cursor: 'pointer',
                  }}
                />
                <span>{day}</span>
              </label>
            );
          })}
        </div>

        {/* Form Action: Primary Update Button */}
        <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'flex-start' }}>
          <button type="submit" className="ss-btn-update" disabled={isSaving}>
            <Save size={16} />
            {isSaving ? 'Updating...' : 'Update'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const WeekendConfigPanel = memo(WeekendConfigPanelComponent);
export default WeekendConfigPanel;
