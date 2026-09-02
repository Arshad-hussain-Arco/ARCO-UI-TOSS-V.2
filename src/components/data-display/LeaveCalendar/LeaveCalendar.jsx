import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { CalendarDays, ChevronLeft, ChevronRight, CheckCircle2, Check, Clock, XCircle, X, Ban, Gift, CalendarOff } from 'lucide-react';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './LeaveCalendar.css';

const PREDEFINED_COLORS = {
  'annual leave': '#3b82f6',
  'sick leave': '#ef4444',
  'compensatory off': '#8b5cf6',
  'offshore work': '#065f46',
  'weekend work': '#737373',
  'work from home': '#65a30d',
  'paternity leave': '#db2777',
  'visa purpose': '#f59e0b',
  'holiday': '#0891b2',
};

const LEAVE_PALETTE = [
  '#3b82f6', '#ef4444', '#8b5cf6', '#065f46', '#f59e0b', 
  '#db2777', '#65a30d', '#737373', '#14b8a6', '#eab308', 
  '#a855f7', '#0284c7', '#ea580c', '#4f46e5', '#0891b2'
];

function getColorForLeaveType(typeStr) {
  if (!typeStr) return '#3174ad';
  const lower = typeStr.toLowerCase().trim();
  if (PREDEFINED_COLORS[lower]) return PREDEFINED_COLORS[lower];
  
  // Simple string hash for dynamic colors
  let hash = 0;
  for (let i = 0; i < lower.length; i++) {
    hash = lower.charCodeAt(i) + ((hash << 5) - hash);
  }
  return LEAVE_PALETTE[Math.abs(hash) % LEAVE_PALETTE.length];
}

const CustomEvent = ({ event }) => {
  const status = (event.resource?.status || '').toLowerCase();
  const rawType = (event.resource?.leave_type || event.resource?.leaveType || event.resource?.type || '').toLowerCase();
  const isHoliday = rawType.includes('holiday') || event.resource?.isHoliday || event.resource?.is_holiday || event.title?.toLowerCase().includes('holiday');

  let StatusIcon = null;
  if (isHoliday) {
    StatusIcon = Gift;
  } else if (status === 'approved') {
    StatusIcon = Check;
  } else if (status === 'pending') {
    StatusIcon = Clock;
  } else if (status === 'rejected') {
    StatusIcon = X;
  } else if (status === 'cancelled' || status === 'self_rejected' || status === 'self-rejected') {
    StatusIcon = Ban;
  }

  return (
    <div className="custom-rbc-event">
      {StatusIcon && <StatusIcon size={12} className="custom-rbc-event-icon" />}
      <span className="custom-rbc-event-title">{event.title}</span>
    </div>
  );
};

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const CustomToolbar = (toolbar) => {
  const goToBack = () => {
    toolbar.onNavigate('PREV');
  };

  const goToNext = () => {
    toolbar.onNavigate('NEXT');
  };

  return (
    <div className="custom-calendar-toolbar" style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button 
          type="button" 
          onClick={goToBack} 
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-primary)', border: '1px solid var(--border-primary)', 
            cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', 
            borderRadius: '6px', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s ease',
            width: '28px', height: '28px'
          }}
          onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--c-primary)'; e.currentTarget.style.color = 'var(--c-primary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <ChevronLeft size={16} />
        </button>
        
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '8px', 
          border: '1px solid var(--border-primary)', borderRadius: '6px', 
          padding: '4px 16px', background: 'var(--surface-primary)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <span style={{ fontSize: '14px', margin: 0, fontWeight: '700', color: 'var(--c-primary-dark, #0369a1)' }}>
            {toolbar.label}
          </span>
        </div>

        <button 
          type="button" 
          onClick={goToNext} 
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--surface-primary)', border: '1px solid var(--border-primary)', 
            cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', 
            borderRadius: '6px', boxShadow: 'var(--shadow-sm)', transition: 'all 0.2s ease',
            width: '28px', height: '28px'
          }}
          onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--c-primary)'; e.currentTarget.style.color = 'var(--c-primary)'; }}
          onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

function LeaveCalendar({ year, month, events, onPrevMonth, onNextMonth, dayFlags, className, style }) {
  // Sync calendar date with parent state
  const currentDate = new Date(year, month, 1);

  const mappedEvents = useMemo(() => {
    return events.map((ev) => {
      let start, end;
      if (ev.start_date && ev.end_date) {
        const sDate = typeof ev.start_date === 'string' && ev.start_date.length === 10 ? ev.start_date + 'T00:00:00' : ev.start_date;
        const eDate = typeof ev.end_date === 'string' && ev.end_date.length === 10 ? ev.end_date + 'T00:00:00' : ev.end_date;
        start = new Date(sDate);
        end = new Date(eDate);
        // React Big Calendar considers the end date as exclusive for multi-day events if they are allDay
        // We MUST add 1 day to the end date for proper rendering of full day events (even single-day ones)
        end.setDate(end.getDate() + 1);
      } else {
        if (typeof ev.date === 'number') {
          start = new Date(year, month, ev.date);
        } else {
          start = new Date(ev.date);
        }
        end = new Date(start);
        end.setDate(end.getDate() + 1);
      }

      return {
        // Title is composed upstream (employee name + leave type); fall
        // back to whatever fields are available for events built elsewhere.
        title: ev.title || (ev.employeeName ? `${ev.employeeName} - ${ev.leave_type || ev.type}` : (ev.leave_type || ev.type)),
        start,
        end,
        allDay: true,
        resource: ev,
      };
    });
  }, [events, year, month]);

  const handleNavigate = (newDate, view, action) => {
    if (action === 'PREV' && onPrevMonth) onPrevMonth();
    if (action === 'NEXT' && onNextMonth) onNextMonth();
  };

  const eventStyleGetter = (event) => {
    let rawType = event.resource?.leave_type || event.resource?.leaveType || event.resource?.type || 'default';
    if (event.resource?.isHoliday || event.resource?.is_holiday || rawType.toLowerCase().includes('holiday')) {
      rawType = 'holiday';
    }
    const safeType = rawType.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const customClass = event.resource?.className || '';
    const dynamicColor = getColorForLeaveType(rawType);
    
    return {
      className: `rbc-type-${safeType} custom-bg-event ${customClass}`.trim(),
      style: {
        backgroundColor: dynamicColor,
        borderColor: dynamicColor,
        color: '#fff'
      }
    };
  };

  const uniqueLeaveTypes = useMemo(() => {
    const typesMap = new Map();
    mappedEvents.forEach(ev => {
      let rawType = ev.resource?.leave_type || ev.resource?.leaveType || ev.resource?.type || 'Other';
      if (ev.resource?.isHoliday || ev.resource?.is_holiday || rawType.toLowerCase().includes('holiday')) {
        rawType = 'Holiday';
      }
      
      // Capitalize properly if needed, but we'll use rawType as the key
      if (!typesMap.has(rawType.toLowerCase().trim())) {
        typesMap.set(rawType.toLowerCase().trim(), rawType);
      }
    });
    // Return sorted array of original display names
    return Array.from(typesMap.values()).sort((a, b) => a.localeCompare(b));
  }, [mappedEvents]);

  // Uses real per-employee weekend/holiday flags (dayFlags, keyed by
  // yyyy-MM-dd, from the team-employee-calendars API) when available —
  // falls back to the Sat/Sun-only-if-nothing-loaded-yet Fri/Sat guess
  // otherwise so the grid doesn't render unstyled before the fetch lands.
  const dayPropGetter = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const flags = dayFlags?.[dateStr];
    if (flags) {
      if (flags.isHoliday) return { className: 'rbc-day-holiday' };
      if (flags.isWeekend) return { className: 'rbc-day-weekend' };
      return {};
    }
    const dow = date.getDay();
    if (dow === 5 || dow === 6) {
      return { className: 'rbc-day-weekend' };
    }
    return {};
  };

  return (
    <div className={`leave-calendar-container ${className || ''}`} style={style}>
      <Calendar
        localizer={localizer}
        events={mappedEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 550, minHeight: 550 }}
        views={['month']}
        date={currentDate}
        onNavigate={handleNavigate}
        eventPropGetter={eventStyleGetter}
        dayPropGetter={dayPropGetter}
        components={{
          toolbar: CustomToolbar,
          event: CustomEvent
        }}
        popup
      />
      <div className="leave-calendar-legend">
        <div className="leave-calendar-legend-row types-row">
          {uniqueLeaveTypes.map(type => (
            <span key={type} className="leave-calendar-legend-item">
              <span className="legend-color-box" style={{ backgroundColor: getColorForLeaveType(type) }}></span>
              {type}
            </span>
          ))}
        </div>
        <div className="leave-calendar-legend-row status-row">
          <span className="leave-calendar-legend-item"><Check size={14} style={{ color: 'var(--text-tertiary)' }} />Approved</span>
          <span className="leave-calendar-legend-item"><Clock size={14} style={{ color: 'var(--text-tertiary)' }} />Pending</span>
          <span className="leave-calendar-legend-item"><X size={14} style={{ color: 'var(--text-tertiary)' }} />Rejected</span>
          <span className="leave-calendar-legend-item"><Ban size={14} style={{ color: 'var(--text-tertiary)' }} />Cancelled/self-rejected</span>
          <span className="leave-calendar-legend-item"><Gift size={14} style={{ color: 'var(--text-tertiary)' }} />Holiday</span>
          <span className="leave-calendar-legend-item"><CalendarOff size={14} style={{ color: 'var(--text-tertiary)' }} />Weekend</span>
        </div>
      </div>
    </div>
  );
}

export { LeaveCalendar };
export default LeaveCalendar;
