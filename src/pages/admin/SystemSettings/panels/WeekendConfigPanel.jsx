import { memo, useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { settingsService } from '@services/settingsService';

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
function WeekendConfigPanelComponent() {
  const toast = useToast();
  const [selectedDays, setSelectedDays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getWeekendConfig();
      if (res && res.weekendDays) {
        const days = res.weekendDays.map(index => DAYS_OF_WEEK[index]);
        setSelectedDays(days);
      }
    } catch (error) {
      console.error('Failed to fetch weekend config:', error);
      toast.error('Failed to load weekend configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (day) => {
    const next = selectedDays.includes(day)
      ? selectedDays.filter((d) => d !== day)
      : [...selectedDays, day];
    setSelectedDays(next);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const indices = selectedDays.map(day => DAYS_OF_WEEK.indexOf(day));
      await settingsService.updateWeekendConfig({ weekendDays: indices });
      toast.success('Weekend configuration updated successfully');
    } catch (error) {
      console.error('Failed to update weekend config:', error);
      toast.error('Failed to update weekend configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ss-form-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Loader2 className="spinner" size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="ss-form-card">
      <div className="ss-panel-header">
        <h2 className="ss-panel-title">📅 Weekend Configuration</h2>
      </div>

      <form
        onSubmit={handleSave}
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
          <button type="submit" className="ss-btn-update" disabled={saving}>
            {saving ? <Loader2 size={16} className="spinner" style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
            {saving ? 'Updating...' : 'Update'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const WeekendConfigPanel = memo(WeekendConfigPanelComponent);
export default WeekendConfigPanel;
