import React from 'react';
import { Calendar, Palmtree } from 'lucide-react';
import { format, isSameYear } from 'date-fns';

export function UpcomingHolidaysPanel({ holidays = [] }) {
  if (!holidays || holidays.length === 0) {
    return null;
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="dc-alerts-panel" style={{ borderBottom: 'none' }}>
      <div className="dc-alerts-header">
        <h2 className="dc-section-title" style={{ margin: 0 }}>Upcoming Holidays</h2>
        <Palmtree size={14} style={{ color: '#d97706' }} />
      </div>

      <div className="dc-alerts-list">
        {holidays.map((holiday, idx) => {
          let dateStr = holiday.dates && holiday.dates.length > 0 ? holiday.dates[0] : (holiday.date || holiday.start_date || holiday.holiday_date);
          let displayDate = dateStr;
          try {
            const d = new Date(dateStr);
            if (!isNaN(d)) {
              displayDate = isSameYear(d, new Date()) 
                ? format(d, 'EEE, MMM d') 
                : format(d, 'EEE, MMM d, yyyy');
            }
          } catch (e) {
            // fallback
          }

          return (
            <div key={holiday.id || idx} className="dc-alert-item" style={{ padding: '8px 10px', background: 'var(--surface-secondary)', border: '1px solid var(--border-primary)', borderRadius: '6px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div className="dc-alert-icon" style={{ background: '#fef3c7', color: '#d97706', width: '24px', height: '24px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Calendar size={12} />
              </div>
              <div className="dc-alert-content" style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div className="dc-alert-title" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>{holiday.name || holiday.title || holiday.holiday_name || 'Holiday'}</div>
                <div className="dc-alert-desc" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{displayDate}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
