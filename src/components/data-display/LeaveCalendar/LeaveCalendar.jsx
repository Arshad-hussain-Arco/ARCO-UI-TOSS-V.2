import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './LeaveCalendar.css';

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
    <div className="custom-calendar-toolbar" style={{ display: 'flex', justifyContent: 'center', marginTop: '20px', marginBottom: '24px' }}>
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

function LeaveCalendar({ year, month, events, onPrevMonth, onNextMonth, dayFlags }) {
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
    const status = event.resource?.status || 'default';
    const customClass = event.resource?.className || '';
    return {
      className: `rbc-event-${status} ${customClass}`.trim()
    };
  };

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
    <div className="leave-calendar-container">
      <Calendar
        localizer={localizer}
        events={mappedEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: 600 }}
        views={['month']}
        date={currentDate}
        onNavigate={handleNavigate}
        eventPropGetter={eventStyleGetter}
        dayPropGetter={dayPropGetter}
        components={{
          toolbar: CustomToolbar
        }}
        popup
      />
      <div className="leave-calendar-legend">
        <span className="leave-calendar-legend-item">
          <span className="leave-calendar-legend-dot leave-calendar-legend-dot--approved" />
          Approved
        </span>
        <span className="leave-calendar-legend-item">
          <span className="leave-calendar-legend-dot leave-calendar-legend-dot--pending" />
          Pending
        </span>
        <span className="leave-calendar-legend-item">
          <span className="leave-calendar-legend-dot leave-calendar-legend-dot--rejected" />
          Rejected
        </span>
        <span className="leave-calendar-legend-item">
          <span className="leave-calendar-legend-dot leave-calendar-legend-dot--cancelled" />
          Cancelled / Self-Rejected
        </span>
        <span className="leave-calendar-legend-item">
          <span className="leave-calendar-legend-dot leave-calendar-legend-dot--holiday" />
          Holiday
        </span>
        <span className="leave-calendar-legend-item">
          <span className="leave-calendar-legend-dot leave-calendar-legend-dot--weekend" />
          Weekend
        </span>
      </div>
    </div>
  );
}

export { LeaveCalendar };
export default LeaveCalendar;
