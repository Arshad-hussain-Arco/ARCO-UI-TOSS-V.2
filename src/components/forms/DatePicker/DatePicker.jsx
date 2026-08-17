import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import {
  format,
  addMonths,
  setMonth as dateFnsSetMonth,
  setYear as dateFnsSetYear,
  getYear,
  getMonth,
} from 'date-fns';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import 'react-day-picker/dist/style.css';
import './DatePicker.css';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr',
  'May', 'Jun', 'Jul', 'Aug',
  'Sep', 'Oct', 'Nov', 'Dec'
];

const YEARS_RANGE = Array.from({ length: 20 }, (_, i) => 2018 + i); // 2018 to 2037

export function DatePicker({
  mode = 'single',
  value,
  onChange,
  onMonthChange,
  minDate,
  maxDate,
  // Optional predicate — (date) => boolean — for disabling individual
  // dates beyond the min/max range (e.g. non-working days for an
  // Actual/Nominal leave boundary). Merged into the same disabled matcher
  // array react-day-picker uses for minDate/maxDate; named differently
  // from `disabled` below since that prop already means "disable the
  // whole picker".
  isDateDisabled,
  placeholder = 'Select date',
  disabled = false,
  className = '',
  width = 'auto',
  showClear = true,
  isLoading = false,
  ...props
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('calendar'); // 'calendar' | 'months' | 'years'
  const [currentMonth, setCurrentMonth] = useState(
    value ? (mode === 'range' ? value.from || new Date() : value) : new Date()
  );

  const displayValue = () => {
    if (!value) return placeholder;

    if (mode === 'single') {
      return format(value, 'PPP');
    }

    if (mode === 'range') {
      if (value.from && value.to) {
        return `${format(value.from, 'PP')} - ${format(value.to, 'PP')}`;
      }
      if (value.from) {
        return `${format(value.from, 'PP')} - ...`;
      }
      return placeholder;
    }
  };

  const handleClear = (e) => {
    if (e) e.stopPropagation();
    onChange(mode === 'range' ? { from: undefined, to: undefined } : undefined);
  };

  const handleSelect = (selected) => {
    onChange(selected);
    if (mode === 'single' && selected) {
      setIsOpen(false);
      setView('calendar');
    }
  };

  const navigateMonth = (direction) => {
    setCurrentMonth((prev) => {
      const next = addMonths(prev, direction);
      if (onMonthChange) onMonthChange(next);
      return next;
    });
  };

  const selectMonth = (monthIdx) => {
    setCurrentMonth((prev) => {
      const next = dateFnsSetMonth(prev, monthIdx);
      if (onMonthChange) onMonthChange(next);
      return next;
    });
    setView('calendar');
  };

  const selectYear = (yearNum) => {
    setCurrentMonth((prev) => {
      const next = dateFnsSetYear(prev, yearNum);
      if (onMonthChange) onMonthChange(next);
      return next;
    });
    setView('calendar');
  };

  return (
    <Popover.Root
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) setView('calendar');
      }}
    >
      <Popover.Trigger asChild disabled={disabled}>
        <button
          className={`dp-trigger ${className} ${!value ? 'dp-trigger-empty' : ''}`}
          style={{ width }}
          type="button"
        >
          <CalendarIcon size={14} className="dp-icon-left" />
          <span className="dp-value">{displayValue()}</span>
          {showClear && value && (
            <button
              type="button"
              className="dp-clear"
              onClick={handleClear}
              aria-label="Clear date"
            >
              <X size={14} />
            </button>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content className="dp-content" sideOffset={6} align="start" avoidCollisions>
          {/* Unified Enterprise Header */}
          <div className="dp-custom-header">
            <button
              type="button"
              className="dp-nav-btn"
              onClick={() => navigateMonth(-1)}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="dp-header-selectors">
              <button
                type="button"
                className={`dp-header-btn ${view === 'months' ? 'is-active' : ''}`}
                onClick={() => setView(view === 'months' ? 'calendar' : 'months')}
              >
                {format(currentMonth, 'MMMM')}
              </button>
              <button
                type="button"
                className={`dp-header-btn ${view === 'years' ? 'is-active' : ''}`}
                onClick={() => setView(view === 'years' ? 'calendar' : 'years')}
              >
                {format(currentMonth, 'yyyy')}
              </button>
            </div>

            <button
              type="button"
              className="dp-nav-btn"
              onClick={() => navigateMonth(1)}
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Views */}
          {view === 'months' && (
            <div className="dp-grid-selector month-grid">
              {MONTH_NAMES.map((name, idx) => {
                const isSelected = getMonth(currentMonth) === idx;
                return (
                  <button
                    key={name}
                    type="button"
                    className={`dp-grid-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => selectMonth(idx)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'years' && (
            <div className="dp-grid-selector year-grid">
              {YEARS_RANGE.map((yr) => {
                const isSelected = getYear(currentMonth) === yr;
                return (
                  <button
                    key={yr}
                    type="button"
                    className={`dp-grid-option ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => selectYear(yr)}
                  >
                    {yr}
                  </button>
                );
              })}
            </div>
          )}

          {view === 'calendar' && (
            <div style={{ position: 'relative' }}>
              <DayPicker
                mode={mode}
                month={currentMonth}
                onMonthChange={(m) => {
                  setCurrentMonth(m);
                  if (onMonthChange) onMonthChange(m);
                }}
                selected={value}
                onSelect={handleSelect}
                disabled={(() => {
                  const matchers = [];
                  if (minDate || maxDate) matchers.push({ before: minDate, after: maxDate });
                  if (isDateDisabled) matchers.push(isDateDisabled);
                  return matchers.length ? matchers : false;
                })()}
                showOutsideDays
                className="dp-calendar"
                classNames={{
                  root: 'dp-root',
                  months: 'dp-months',
                  month: 'dp-month',
                  month_caption: 'dp-caption-hidden', // Hide rdp caption
                  nav: 'dp-nav-hidden', // Hide rdp nav
                  month_grid: 'dp-table',
                  weekdays: 'dp-head-row',
                  weekday: 'dp-head-cell',
                  week: 'dp-row',
                  day: 'dp-cell',
                  day_button: 'dp-day',
                  range_start: 'dp-day-range-start',
                  range_end: 'dp-day-range-end',
                  selected: 'dp-day-selected',
                  today: 'dp-day-today',
                  outside: 'dp-day-outside',
                  disabled: 'dp-day-disabled',
                  hidden: 'dp-day-hidden',
                  range_middle: 'dp-day-range-middle'
                }}
                {...props}
              />
              {isLoading && (
                <div className="dp-loading-overlay">
                  <div className="dp-spinner" />
                </div>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export default DatePicker;
