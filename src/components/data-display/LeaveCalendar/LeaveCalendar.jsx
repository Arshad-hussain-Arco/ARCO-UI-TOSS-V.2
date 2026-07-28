import { useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
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

function LeaveCalendar({ year, month, events, onPrevMonth, onNextMonth }) {
  // Sync calendar date with parent state
  const currentDate = new Date(year, month, 1);

  // Map our internal event structure to react-big-calendar's expected shape
  const mappedEvents = useMemo(() => {
    return events.map((ev) => {
      // The current system uses string dates like '2026-03-22'
      // We parse them into Date objects for start and end
      const eventDate = new Date(ev.date);
      return {
        title: ev.employeeName ? `${ev.type} - ${ev.employeeName}` : ev.type,
        start: eventDate,
        end: eventDate,
        allDay: true,
        resource: ev,
      };
    });
  }, [events]);

  const handleNavigate = (newDate, view, action) => {
    if (action === 'PREV' && onPrevMonth) onPrevMonth();
    if (action === 'NEXT' && onNextMonth) onNextMonth();
  };

  const eventStyleGetter = (event) => {
    const status = event.resource?.status || 'default';
    return {
      className: `rbc-event-${status}`
    };
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
        popup
      />
    </div>
  );
}

export { LeaveCalendar };
export default LeaveCalendar;
