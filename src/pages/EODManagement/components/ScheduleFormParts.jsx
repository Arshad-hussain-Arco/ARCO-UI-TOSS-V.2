import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search, Target, X } from 'lucide-react';

/**
 * Building blocks of the schedule form (the calendar popup, the icon dropdown with search, the job picker). They come from Krishna's
 * ScheduleNewModal and keep his styling (the eod-* classes in EODManagementPage.css); only the form around them is new.
 */

export function InteractiveCalendarPicker({ selectedDate, onSelectDate }) {
  const [viewDate, setViewDate] = useState(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  // Single letter headers matching Image 1: S M T W T F S
  const singleLetterDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month filler days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({ date: d, isCurrentMonth: false, dayNum: daysInPrevMonth - i });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      days.push({ date: d, isCurrentMonth: true, dayNum: i });
    }

    // Next month filler days (to make 42 cells)
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, isCurrentMonth: false, dayNum: i });
    }

    return days;
  }, [year, month]);

  const today = new Date();
  const isSameDay = (d1, d2) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  return (
    <div className="eod-ref-calendar-picker">
      <div className="eod-ref-cal-nav">
        <button
          type="button"
          className="eod-ref-cal-arrow-btn"
          onClick={prevMonth}
          title="Previous month"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="eod-ref-cal-title">
          {monthNames[month]} {year}
        </span>
        <button
          type="button"
          className="eod-ref-cal-arrow-btn"
          onClick={nextMonth}
          title="Next month"
          aria-label="Next month"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="eod-ref-cal-weekdays">
        {singleLetterDays.map((letter, idx) => (
          <span key={`${letter}-${idx}`} className="eod-ref-cal-weekday">
            {letter}
          </span>
        ))}
      </div>

      <div className="eod-ref-cal-grid">
        {calendarDays.map((item, idx) => {
          const isSelected = isSameDay(item.date, selectedDate);
          const isTodayDate = isSameDay(item.date, today);

          return (
            <button
              key={idx}
              type="button"
              className={`eod-ref-cal-day-cell ${
                !item.isCurrentMonth ? 'is-outside' : ''
              } ${isSelected ? 'is-selected' : ''} ${isTodayDate ? 'is-today' : ''}`}
              onClick={() => onSelectDate(item.date)}
              title={item.date.toDateString()}
            >
              {item.dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Modern Custom Dropdown (flush seamless popup, zero gap)
 * Supports optional search filter (e.g. for Target Job) while keeping clean list for Env/Recurrence
 */

export function CustomDropdown({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select...',
  error,
  searchable = false,
  searchPlaceholder = 'Search...',
  allowClear = false,
  onClear,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedOption = useMemo(
    () =>
      options.find(
        (opt) =>
          opt.value === value ||
          String(opt.value) === String(value) ||
          (typeof opt.value === 'string' &&
            typeof value === 'string' &&
            opt.value.toLowerCase() === value.toLowerCase()),
      ),
    [options, value],
  );

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('pointerdown', handleOutsideClick);
      if (searchable) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 30);
      }
    } else {
      setSearchQuery('');
    }
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen, searchable]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter((opt) => {
      const matchLabel = opt.label && String(opt.label).toLowerCase().includes(q);
      const matchValue = opt.value && String(opt.value).toLowerCase().includes(q);
      const matchSubtext = opt.subtext && String(opt.subtext).toLowerCase().includes(q);
      const matchKeywords =
        opt.searchKeywords && String(opt.searchKeywords).toLowerCase().includes(q);
      return Boolean(matchLabel || matchValue || matchSubtext || matchKeywords);
    });
  }, [options, searchQuery, searchable]);

  return (
    <div className="eod-custom-dropdown-wrap" ref={containerRef}>
      <button
        id={id}
        type="button"
        className={`eod-custom-dropdown-trigger ${error ? 'error' : ''} ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="eod-custom-dropdown-trigger-content">
          {selectedOption?.icon && (
            <span
              className="eod-custom-dropdown-trigger-icon"
              style={selectedOption.color ? { color: selectedOption.color } : {}}
            >
              {selectedOption.icon}
            </span>
          )}
          <span className="eod-custom-dropdown-trigger-label">
            {selectedOption ? (
              selectedOption.label
            ) : (
              <span className="placeholder">{placeholder}</span>
            )}
          </span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {allowClear && selectedOption && (
            <span
              role="button"
              tabIndex={0}
              className="eod-custom-dropdown-clear-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (onClear) onClear();
                else onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  if (onClear) onClear();
                  else onChange('');
                }
              }}
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`eod-custom-dropdown-arrow ${isOpen ? 'rotated' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="eod-custom-dropdown-menu" role="listbox">
          {searchable && (
            <div className="eod-custom-dropdown-search">
              <Search size={12} className="eod-custom-dropdown-search-icon" />
              <input
                ref={searchInputRef}
                type="text"
                className="eod-custom-dropdown-search-input"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
              />
              {searchQuery && (
                <span
                  role="button"
                  tabIndex={0}
                  className="eod-custom-dropdown-search-clear"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      setSearchQuery('');
                    }
                  }}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </span>
              )}
            </div>
          )}

          <div className="eod-custom-dropdown-list">
            {filteredOptions.length === 0 ? (
              <div className="eod-custom-dropdown-empty">
                {searchable && searchQuery.trim() ? (
                  <button
                    type="button"
                    className="eod-custom-dropdown-item"
                    style={{ textAlign: 'left', width: '100%' }}
                    onClick={() => {
                      onChange(searchQuery.trim());
                      setIsOpen(false);
                    }}
                  >
                    <span className="eod-custom-dropdown-item-left">
                      <span
                        className="eod-custom-dropdown-item-icon"
                        style={{ color: '#2563eb', background: 'rgba(37, 99, 235, 0.1)' }}
                      >
                        <Target size={12} />
                      </span>
                      <span className="eod-custom-dropdown-item-text">
                        <span className="title">
                          Select custom job &quot;{searchQuery.trim()}&quot;
                        </span>
                      </span>
                    </span>
                  </button>
                ) : searchable ? (
                  'No matching target jobs found'
                ) : (
                  'No options available'
                )}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedOption?.value === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`eod-custom-dropdown-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                  >
                    <span className="eod-custom-dropdown-item-left">
                      {opt.icon && (
                        <span
                          className="eod-custom-dropdown-item-icon"
                          style={
                            !isSelected && opt.color
                              ? { color: opt.color, background: `${opt.color}15` }
                              : {}
                          }
                        >
                          {opt.icon}
                        </span>
                      )}
                      <span className="eod-custom-dropdown-item-text">
                        <span className="title">{opt.label}</span>
                        {opt.subtext && <span className="subtext">{opt.subtext}</span>}
                      </span>
                    </span>
                    {isSelected && <Check size={13} className="eod-custom-dropdown-check" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Custom Searchable Target Job Dropdown (Matching unified dropdown menu design)
 */

export function TargetJobPicker({
  id = 'eod-modal-target-job-select',
  value,
  onChange,
  error,
  availableJobs = [],
}) {
  const targetJobOptions = useMemo(() => {
    const base = availableJobs || [];
    const list = [...base];
    if (value && !list.some((j) => j.name === value)) {
      list.unshift({
        name: value,
        level: 1,
        group: 'Target',
        description: 'Selected target job',
      });
    }
    return list.map((j) => ({
      value: j.name,
      label: j.name,
      subtext: j.description
        ? `${j.group ? `${j.group} · ` : ''}${j.description}`
        : `Level ${j.level || 1} · ${j.group || 'Job'}`,
      icon: <Target size={12} />,
      color: '#2563eb',
      searchKeywords: `${j.group || ''} ${j.description || ''} ${j.name}`,
    }));
  }, [availableJobs, value]);

  return (
    <CustomDropdown
      id={id}
      value={value}
      onChange={onChange}
      options={targetJobOptions}
      placeholder="Select target job..."
      searchable
      searchPlaceholder="Search target jobs..."
      allowClear
      onClear={() => onChange('')}
      error={error}
    />
  );
}

/**
 * Main ScheduleNewModal Component
 */
