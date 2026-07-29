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

  const mappedEvents = useMemo(() => {
    return events.map((ev) => {
      let start, end;
      if (ev.start_date && ev.end_date) {
        start = new Date(ev.start_date);
        end = new Date(ev.end_date);
        // React Big Calendar considers the end date as exclusive for multi-day events if they are allDay
        // But since we might just want it to span inclusive, we can add 1 day to end for visual correctness in month view
        if (start.getTime() !== end.getTime()) {
           end.setDate(end.getDate() + 1);
        }
      } else {
        if (typeof ev.date === 'number') {
          start = new Date(year, month, ev.date);
        } else {
          start = new Date(ev.date);
        }
        end = start;
      }

      return {
        title: ev.employeeName ? `${ev.leave_type || ev.type} - ${ev.employeeName}` : (ev.title || ev.leave_type || ev.type),
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
