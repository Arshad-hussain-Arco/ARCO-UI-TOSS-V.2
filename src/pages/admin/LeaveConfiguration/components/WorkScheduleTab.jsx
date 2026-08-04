import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

import { useToast } from '@hooks/useToast';
import { leaveService } from '@services/leaveService';

import { WORK_SCHEDULE_OPTIONS, formatCustomWeekendDays, getScheduleLabel } from '../utils';

export function WorkScheduleTab() {
  const toast = useToast();

  const [selectedCustomDays, setSelectedCustomDays] = useState([]);
  const [workScheduleSummary, setWorkScheduleSummary] = useState(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchSummary = async () => {
      setIsSummaryLoading(true);
      try {
        const data = await leaveService.getWorkScheduleSummary();
        if (active) {
          setWorkScheduleSummary(data);
          // Pre-select the currently applied weekend days so the checkboxes reflect
          // the org's current assignment as soon as the tab opens.
          if (data?.meta?.distinct_schedules === 1) {
            const group = data.results[0];
            setSelectedCustomDays(
              group.work_schedule === 'CUSTOM' ? group.custom_weekend_days || [] : [],
            );
          }
        }
      } catch (err) {
        console.error('Failed to load work schedule summary:', err);
        if (active) setWorkScheduleSummary(null);
      } finally {
        if (active) setIsSummaryLoading(false);
      }
    };
    fetchSummary();
    return () => { active = false; };
  }, []);

  const handleApplyWorkSchedule = async () => {
    try {
      if (selectedCustomDays.length === 0) {
        toast.error('Please select at least one weekend day');
        return;
      }
      const payload = { work_schedule: 'CUSTOM', custom_weekend_days: selectedCustomDays };
      await leaveService.bulkUpdateEmployeeProfiles(payload, { all: true });
      toast.success('Work schedule applied successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Failed to apply work schedule');
    }
  };

  return (
    <div className="lc-card-panel">
      <div style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#0f172a', marginBottom: '16px' }}>Work Schedule Settings</h3>

        {isSummaryLoading && (
          <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>Loading current schedule…</div>
        )}

        {!isSummaryLoading && workScheduleSummary?.meta?.distinct_schedules > 1 && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', color: '#b45309', marginBottom: '8px' }}>
              Employees are currently split across multiple schedules. Applying below will set everyone to the selected days.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {workScheduleSummary.results.map((group, idx) => (
                <div
                  key={`${group.work_schedule}-${idx}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 16px', backgroundColor: '#f9fafb', border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                      {getScheduleLabel(group.work_schedule)}
                    </span>
                    {group.work_schedule === 'CUSTOM' && group.custom_weekend_days && (
                      <span style={{ fontSize: '13px', color: '#334155', marginLeft: '8px' }}>
                        ({formatCustomWeekendDays(group.custom_weekend_days)})
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                    {group.employee_count} employee{group.employee_count === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="ss-modal-form-group">
            <label className="ss-modal-label">Select Weekend Days</label>
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              {WORK_SCHEDULE_OPTIONS.custom_weekend_days?.description || 'Select the days that constitute a weekend.'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {(WORK_SCHEDULE_OPTIONS.custom_weekend_days?.days || []).map((day) => (
                <label key={day.value} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedCustomDays.includes(day.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedCustomDays([...selectedCustomDays, day.value]);
                      } else {
                        setSelectedCustomDays(selectedCustomDays.filter(d => d !== day.value));
                      }
                    }}
                    style={{ accentColor: '#3b82f6', width: '16px', height: '16px' }}
                  />
                  <span style={{ fontSize: '14px', color: '#334155' }}>{day.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
          <button
            type="button"
            className="lc-btn-primary"
            onClick={handleApplyWorkSchedule}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Check size={16} />
            Apply Work Schedule
          </button>
        </div>
      </div>
    </div>
  );
}

export default WorkScheduleTab;
