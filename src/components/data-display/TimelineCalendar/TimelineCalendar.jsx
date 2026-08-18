import { useMemo, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  format,
  getDaysInMonth,
  isSameDay,
  isToday,
  getDay,
} from 'date-fns';
import './TimelineCalendar.css';

/**
 * Enterprise Timeline Calendar with infinite-style dynamic date generation,
 * weekend/holiday highlights, and smooth horizontal scrolling.
 */
export function TimelineCalendar({
  year,
  month,
  selectedDate,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  leaveDates = new Set(),
  holidays = new Set(),
  weekendDays = [5, 6], // SA Standard: Fri(5), Sat(6)
}) {
  const scrollRef = useRef(null);

  // Generate days array for the selected year and month
  const daysList = useMemo(() => {
    const totalDays = getDaysInMonth(new Date(year, month));
    const result = [];

    for (let dayNum = 1; dayNum <= totalDays; dayNum++) {
      const dateObj = new Date(year, month, dayNum);
      const dateStr = format(dateObj, 'yyyy-MM-dd');
      const dayOfWeek = getDay(dateObj);
      const isWeekend = weekendDays.includes(dayOfWeek);
      const isHolidayDay = holidays.has(dateStr);
      const hasLeave = leaveDates.has(dateStr);

      result.push({
        dateObj,
        dateStr,
        dayNum,
        dayLabel: format(dateObj, 'EEE'),
        isWeekend,
        isHolidayDay,
        hasLeave,
        isCurrent: isToday(dateObj),
        isSelected: selectedDate ? isSameDay(dateObj, new Date(selectedDate)) : false,
      });
    }
    return result;
  }, [year, month, selectedDate, leaveDates, holidays, weekendDays]);

  // Scroll active day into view smooth when selectedDate changes
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('.tl-day-item.is-selected');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [selectedDate, month, year]);

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -240, behavior: 'smooth' });
    }
  };

  const handleScrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 240, behavior: 'smooth' });
    }
  };

  const monthLabel = format(new Date(year, month), 'MMMM yyyy');

  return (
    <div className="tl-container">
      {/* Timeline Controls Header */}
      <div className="tl-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}></div>

        <div className="tl-nav-group" style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, justifyContent: 'center' }}>
          <button className="tl-btn-nav" onClick={onPrevMonth} title="Previous Month" type="button">
            <ChevronLeft size={16} />
          </button>
          
          <div className="tl-month-info" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140, justifyContent: 'center' }}>
            <CalendarIcon size={16} className="tl-info-icon" />
            <span className="tl-month-title">{monthLabel}</span>
          </div>

          <button className="tl-btn-nav" onClick={onNextMonth} title="Next Month" type="button">
            <ChevronRight size={16} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          {onToday && (
            <button className="tl-btn-today" onClick={onToday} type="button">
              Today
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Timeline */}
      <div className="tl-scroll-wrapper">
        <button className="tl-arrow-btn left" onClick={handleScrollLeft} type="button">
          <ChevronLeft size={14} />
        </button>

        <div className="tl-track" ref={scrollRef}>
          {daysList.map((item) => {
            let itemClass = 'tl-day-item';
            if (item.isSelected) itemClass += ' is-selected';
            if (item.isCurrent) itemClass += ' is-today';
            if (item.isWeekend) itemClass += ' is-weekend';
            if (item.isHolidayDay) itemClass += ' is-holiday';

            return (
              <button
                key={item.dateStr}
                type="button"
                className={itemClass}
                onClick={() => onSelectDate(item.dateStr)}
                title={`${item.dayLabel}, ${format(item.dateObj, 'MMM d, yyyy')}${
                  item.isHolidayDay ? ' (Public Holiday)' : item.isWeekend ? ' (Weekend)' : ''
                }`}
              >
                <span className="tl-day-name">{item.dayLabel}</span>
                <span className="tl-day-num">{item.dayNum}</span>

                {/* Status Dot / Badges */}
                <div className="tl-indicators">
                  {item.hasLeave && <span className="tl-dot leave-dot" title="Leave Scheduled" />}
                  {item.isHolidayDay && (
                    <span className="tl-dot holiday-dot" title="Public Holiday" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button className="tl-arrow-btn right" onClick={handleScrollRight} type="button">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default TimelineCalendar;
