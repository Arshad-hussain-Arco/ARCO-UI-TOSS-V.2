import React from 'react';
import { Calendar, Compass } from 'lucide-react';
import { format, isSameYear, differenceInCalendarDays } from 'date-fns';

export function UpcomingHolidaysPanel({ holidays = [] }) {
  if (!holidays || holidays.length === 0) {
    return null;
  }

  const getRelativeDateBadge = (dateStr) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const hDate = new Date(dateStr);
      hDate.setHours(0, 0, 0, 0);
      
      const diffDays = differenceInCalendarDays(hDate, today);
      if (diffDays === 0) return { text: 'Today', tone: 'critical' };
      if (diffDays === 1) return { text: 'Tomorrow', tone: 'warning' };
      return { text: `In ${diffDays} Days`, tone: 'info' };
    } catch (e) {
      return null;
    }
  };

  return (
    <div style={{ padding: '14px', borderBottom: '1px solid var(--border-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', marginBottom: '12px' }}>
        <Calendar size={14} style={{ color: '#006838' }} />
        <h2 style={{ fontSize: '11px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Upcoming Holidays
        </h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
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

          const badge = getRelativeDateBadge(dateStr);

          // Badge colors
          let badgeBg = '#eff6ff';
          let badgeColor = '#1e40af';
          if (badge?.tone === 'critical') {
            badgeBg = '#fef2f2';
            badgeColor = '#b91c1c';
          } else if (badge?.tone === 'warning') {
            badgeBg = '#fef3c7';
            badgeColor = '#92400e';
          }

          return (
            <div 
              key={holiday.id || idx} 
              style={{ 
                padding: '8px 10px', 
                background: 'var(--surface-secondary)', 
                border: '1px solid var(--border-primary)', 
                borderRadius: '6px', 
                display: 'flex', 
                gap: '10px', 
                alignItems: 'center',
                height: '48px',
                boxSizing: 'border-box',
                transition: 'all 0.15s ease',
                cursor: 'default'
              }}
              className="dc-holiday-row-hover"
            >
              <div 
                style={{ 
                  background: '#fcfcfc', 
                  border: '1px solid var(--border-primary)',
                  color: '#006838', 
                  width: '26px', 
                  height: '26px', 
                  borderRadius: '6px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <Calendar size={12} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, minWidth: 0 }}>
                <div 
                  style={{ 
                    fontSize: '11px', 
                    fontWeight: 600, 
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {holiday.name || holiday.title || holiday.holiday_name || 'Holiday'}
                </div>
                <div style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{displayDate}</div>
              </div>
              {badge && (
                <span 
                  style={{ 
                    fontSize: '8px', 
                    fontWeight: 700, 
                    padding: '2px 6px', 
                    borderRadius: '4px', 
                    background: badgeBg, 
                    color: badgeColor, 
                    flexShrink: 0 
                  }}
                >
                  {badge.text}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default UpcomingHolidaysPanel;
