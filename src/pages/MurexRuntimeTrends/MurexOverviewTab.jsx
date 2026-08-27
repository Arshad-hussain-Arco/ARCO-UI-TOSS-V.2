import React, { useState, useMemo, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import {
  format,
  addMonths,
  setMonth as dateFnsSetMonth,
  setYear as dateFnsSetYear,
  getYear,
  getMonth,
  parseISO,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  FileQuestion,
  Clock,
  ListOrdered,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import 'react-day-picker/dist/style.css';
import '@components/forms/DatePicker/DatePicker.css';
import { PlotlyChart } from './MurexRuntimeTrendsPage';
import { murexService } from '@services/murexService';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr',
  'May', 'Jun', 'Jul', 'Aug',
  'Sep', 'Oct', 'Nov', 'Dec'
];

const YEARS_RANGE = Array.from({ length: 20 }, (_, i) => 2018 + i);

function useChartThemeColor() {
  const [themeColor, setThemeColor] = useState('#000000');
  useEffect(() => {
    const updateTheme = () => {
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      setThemeColor(isDark ? '#ffffff' : '#000000');
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return themeColor;
}

export function MurexOverviewTab() {
  const [availableDates, setAvailableDates] = useState([]);
  const [selectedIsoDate, setSelectedIsoDate] = useState(null);
  const selectedDate = useMemo(
    () => (selectedIsoDate ? parseISO(selectedIsoDate) : new Date()),
    [selectedIsoDate]
  );

  const [dayData, setDayData] = useState({ matrixJobs: [], timelineList: [] });
  const [isLoadingDates, setIsLoadingDates] = useState(true);
  const [isLoadingDay, setIsLoadingDay] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch the list of dates that have recorded runs, once, then default to the latest.
  useEffect(() => {
    let cancelled = false;
    setIsLoadingDates(true);
    murexService.getOverviewAvailableDates().then((dates) => {
      if (cancelled) return;
      setAvailableDates(dates);
      setSelectedIsoDate((prev) => prev || dates[dates.length - 1] || format(new Date(), 'yyyy-MM-dd'));
      setIsLoadingDates(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the run/step data for whichever date is currently selected.
  useEffect(() => {
    if (!selectedIsoDate) return;
    let cancelled = false;
    setIsLoadingDay(true);
    setLoadError(null);
    murexService.getOverviewTimeline(selectedIsoDate)
      .then((data) => {
        if (cancelled) return;
        setDayData(data || { matrixJobs: [], timelineList: [] });
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err);
        setDayData({ matrixJobs: [], timelineList: [] });
      })
      .finally(() => {
        if (!cancelled) setIsLoadingDay(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedIsoDate]);

  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => selectedDate);

  const [hoveredMatrixIdx, setHoveredMatrixIdx] = useState(null);
  const [hoveredTimelineRow, setHoveredTimelineRow] = useState(null);

  // Accordions expanded state map: all collapsed by default
  const [expandedAccordions, setExpandedAccordions] = useState({});

  const toggleAccordion = (id) => {
    setExpandedAccordions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const themeColor = useChartThemeColor();

  // Only dates the API actually has runs for are selectable - both via the
  // prev/next arrows and the calendar popover.
  const availableDatesSet = useMemo(() => new Set(availableDates), [availableDates]);
  const isDateAvailable = (date) => availableDatesSet.has(format(date, 'yyyy-MM-dd'));

  const selectedDateIdx = availableDates.indexOf(selectedIsoDate);
  const isAtFirstAvailableDate = selectedDateIdx <= 0;
  const isAtLastAvailableDate = selectedDateIdx === -1 || selectedDateIdx >= availableDates.length - 1;

  // Navigation handlers cycling strictly through available dates
  const handlePrevDay = () => {
    if (selectedDateIdx > 0) {
      const prevIso = availableDates[selectedDateIdx - 1];
      setSelectedIsoDate(prevIso);
      setCurrentMonth(parseISO(prevIso));
    }
  };

  const handleNextDay = () => {
    if (selectedDateIdx !== -1 && selectedDateIdx < availableDates.length - 1) {
      const nextIso = availableDates[selectedDateIdx + 1];
      setSelectedIsoDate(nextIso);
      setCurrentMonth(parseISO(nextIso));
    }
  };

  const handleSelectDate = (date) => {
    if (date && isDateAvailable(date)) {
      const isoStr = format(date, 'yyyy-MM-dd');
      setSelectedIsoDate(isoStr);
      setCurrentMonth(date);
      setIsOpen(false);
      setView('calendar');
    }
  };

  const navigateMonth = (direction) => {
    setCurrentMonth((prev) => addMonths(prev, direction));
  };

  const selectMonth = (monthIdx) => {
    setCurrentMonth((prev) => dateFnsSetMonth(prev, monthIdx));
    setView('calendar');
  };

  const selectYear = (yearNum) => {
    setCurrentMonth((prev) => dateFnsSetYear(prev, yearNum));
    setView('calendar');
  };

  const formattedDate = format(selectedDate, 'dd MMM yyyy');

  const matrixJobs = (dayData.matrixJobs || []).filter(job => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (job.name && job.name.toLowerCase().includes(q)) ||
      (job.rawScriptName && job.rawScriptName.toLowerCase().includes(q));
  });
  const timelineList = (dayData.timelineList || []).filter(timelineItem => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return timelineItem.jobInfo?.title?.toLowerCase().includes(q);
  });



  // 2. Helper to build Plotly Spec for EOD Job Timeline accordion items
  const buildTimelineChartSpec = (timelineItem) => {
    const allRowNames = timelineItem.rows.map((r) => r.name);
    const reversedRowNames = [...allRowNames].reverse();

    const traces = timelineItem.categories.map((cat) => {
      const yVals = [];
      const xVals = [];
      const baseVals = [];
      const customDataArr = [];

      timelineItem.rows.forEach((row) => {
        (row.segments || []).forEach((seg) => {
          if (seg.type === cat.key) {
            yVals.push(row.name);
            const startMs = seg.start ? new Date(seg.start.replace(' ', 'T')).getTime() : 0;
            const endMs = seg.end ? new Date(seg.end.replace(' ', 'T')).getTime() : startMs;
            const durationMs = Math.max(endMs - startMs, 1000);

            xVals.push(durationMs);
            baseVals.push(seg.start);
            customDataArr.push({
              scriptName: row.name,
              unit: row.unit,
              typeName: seg.typeName,
              durationStr: seg.durationFormatted,
              rawStart: seg.rawStart || seg.start,
              rawEnd: seg.rawEnd || seg.end,
            });
          }
        });
      });

      return {
        name: cat.name,
        type: 'bar',
        orientation: 'h',
        showlegend: false,
        marker: {
          color: cat.color,
          line: { width: 0 },
        },
        y: yVals,
        x: xVals,
        base: baseVals,
        customdata: customDataArr,
        hovertemplate:
          '<b>%{customdata.scriptName}</b><br><br>' +
          'Phase: %{customdata.typeName}<br>' +
          'Duration: %{customdata.durationStr}<br>' +
          'Start: %{customdata.rawStart}<br>' +
          'End: %{customdata.rawEnd}<extra></extra>',
        hoverlabel: {
          bgcolor: '#1E293B',
          font: { color: '#FFFFFF', family: 'Inter, system-ui, sans-serif', size: 11 },
          bordercolor: '#334155',
          align: 'left',
        },
      };
    });

    const shapes =
      hoveredTimelineRow != null
        ? [
          {
            type: 'rect',
            xref: 'paper',
            x0: 0,
            x1: 1,
            yref: 'y',
            y0: hoveredTimelineRow,
            y1: hoveredTimelineRow,
            fillcolor: 'rgba(241, 245, 249, 0.75)',
            line: { width: 0 },
            layer: 'below',
          },
        ]
        : [];

    const defaultRange = [`${selectedIsoDate} 00:00:00`, `${selectedIsoDate} 23:59:59`];
    const xRange = timelineItem.jobInfo.xRange || defaultRange;
    const chartHeight = Math.max(220, timelineItem.rows.length * 36 + 60);

    const layout = {
      autosize: true,
      height: chartHeight,
      margin: { t: 15, r: 25, b: 45, l: 200 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: themeColor, size: 11, family: 'Inter, system-ui, sans-serif' },
      barmode: 'overlay',
      bargap: 0.4,
      xaxis: {
        type: 'date',
        tickformat: '%H:%M',
        showgrid: true,
        gridcolor: 'rgba(226, 232, 240, 0.6)',
        zeroline: false,
        range: xRange,
        tickfont: { size: 11, color: '#64748B' },
      },
      yaxis: {
        type: 'category',
        categoryorder: 'array',
        categoryarray: reversedRowNames,
        showgrid: false,
        zeroline: false,
        tickfont: { size: 11, color: themeColor, weight: 600 },
        automargin: true,
      },
      shapes,
    };

    return { data: traces, layout };
  };

  if (isLoadingDates) {
    return (
      <div className="murex-overview-tab">
        <div className="murex-overview-empty-state">
          <Loader2 size={24} className="murex-empty-icon" style={{ animation: 'spin 1s linear infinite' }} />
          <span>Loading available dates…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="murex-overview-tab">
      {/* 1. Date Navigation Header */}
      <div className="murex-overview-header-bar">
        <div className="murex-date-nav-container">
          <button
            type="button"
            className="murex-date-arrow-btn"
            onClick={handlePrevDay}
            disabled={isAtFirstAvailableDate}
            title="Previous Day"
            aria-label="Previous Day"
          >
            <ChevronLeft size={16} />
          </button>

          <Popover.Root
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (open) {
                setCurrentMonth(selectedDate);
              } else {
                setView('calendar');
              }
            }}
          >
            <Popover.Trigger asChild>
              <button
                type="button"
                className="murex-date-display-btn"
                aria-label="Select Date"
              >
                <CalendarIcon size={14} className="murex-date-icon" />
                <span className="murex-date-text">{formattedDate}</span>
              </button>
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Content
                className="dp-content"
                sideOffset={6}
                align="center"
                avoidCollisions
              >
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
                  <DayPicker
                    mode="single"
                    month={currentMonth}
                    onMonthChange={setCurrentMonth}
                    selected={selectedDate}
                    onSelect={handleSelectDate}
                    disabled={(date) => !isDateAvailable(date)}
                    showOutsideDays
                    className="dp-calendar"
                    classNames={{
                      root: 'dp-root',
                      months: 'dp-months',
                      month: 'dp-month',
                      month_caption: 'dp-caption-hidden',
                      nav: 'dp-nav-hidden',
                      month_grid: 'dp-table',
                      weekdays: 'dp-head-row',
                      weekday: 'dp-head-cell',
                      week: 'dp-row',
                      day: 'dp-cell',
                      day_button: 'dp-day',
                      selected: 'dp-day-selected',
                      today: 'dp-day-today',
                      outside: 'dp-day-outside',
                      disabled: 'dp-day-disabled',
                      hidden: 'dp-day-hidden',
                    }}
                  />
                )}
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <button
            type="button"
            className="murex-date-arrow-btn"
            onClick={handleNextDay}
            disabled={isAtLastAvailableDate}
            title="Next Day"
            aria-label="Next Day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>



      {!isLoadingDay && loadError && (
        <div className="murex-overview-section">
          <div className="murex-overview-empty-state">
            <FileQuestion size={24} className="murex-empty-icon" />
            <span>Failed to load runtime data for {formattedDate}. Showing fallback data if available.</span>
          </div>
        </div>
      )}

      {/* 2. Job - Duration Matrix (New Tabular Layout) */}
      <div className="murex-overview-section">
        <div className="murex-overview-chart-card murex-matrix-card-new">
          {isLoadingDay ? (
            <div className="murex-overview-empty-state" style={{ minHeight: '300px' }}>
              <Loader2 size={24} className="murex-empty-icon" style={{ animation: 'spin 1s linear infinite' }} />
              <span>Loading runtime data for {formattedDate}…</span>
            </div>
          ) : (
            <>
              {(() => {
                // Calculate time lapse using the first job's start and last job's end
                let timeLapseNode = null;

                if (matrixJobs.length > 0) {
                  const times = matrixJobs.map(job => {
                    const startMs = job.start ? new Date(job.start.replace(' ', 'T')).getTime() : 0;
                    const endMs = job.end ? new Date(job.end.replace(' ', 'T')).getTime() : startMs;
                    return { startMs, endMs };
                  }).filter(t => t.startMs > 0);

                  if (times.length > 0) {
                    const globalMinMs = Math.min(...times.map(t => t.startMs));
                    const globalMaxMs = Math.max(...times.map(t => t.endMs));

                    const s = new Date(globalMinMs);
                    const e = new Date(globalMaxMs);

                    const pad = (n) => n.toString().padStart(2, '0');
                    const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

                    const startDateStr = s.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                    const endDateStr = e.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

                    const sDateOnly = new Date(s.getFullYear(), s.getMonth(), s.getDate());
                    const eDateOnly = new Date(e.getFullYear(), e.getMonth(), e.getDate());
                    const isNextDay = eDateOnly > sDateOnly;

                    timeLapseNode = (
                      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', columnGap: '8px', rowGap: '4px', alignItems: 'center', lineHeight: '1.2' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>START</span>
                        <span style={{ color: '#0284c7', fontSize: '10px', fontWeight: 600 }}>{startDateStr}</span>
                        <span style={{ fontSize: '11px', color: 'inherit', fontWeight: 600 }}>{formatTime(s)}</span>

                        <span style={{ fontSize: '10px', color: 'var(--text-tertiary, #94a3b8)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>END</span>
                        <span style={{ color: isNextDay ? '#dc2626' : '#0284c7', fontSize: '10px', fontWeight: 600 }}>{endDateStr}</span>
                        <span style={{ fontSize: '11px', color: 'inherit', fontWeight: 600 }}>{formatTime(e)}</span>
                      </div>
                    );
                  }
                }

                return (
                  <div className="murex-matrix-card-header" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '14px' }}>
                    {/* Left Section: Search */}
                    <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                      <div className="murex-search-wrapper" style={{ minWidth: '280px' }}>
                        <Search size={16} className="murex-search-icon" style={{ left: '10px' }} />
                        <input
                          type="text"
                          placeholder="Search jobs..."
                          className="murex-search-input"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            fontSize: '13px',
                            borderRadius: '6px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                          }}
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            className="search-clear-btn"
                            onClick={() => setSearchQuery('')}
                            style={{ right: '8px' }}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Middle Section: Heading */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                      <h3 className="murex-matrix-card-title" style={{ textAlign: 'center', margin: 0, marginBottom: '4px' }}>Job - Execution Timeline </h3>
                      <div className="murex-matrix-card-subtitle" style={{ textAlign: 'center' }}>
                        {formattedDate}
                      </div>
                    </div>

                    {/* Right Section: Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(14, 165, 233, 0.1)', padding: '4px 10px', borderRadius: '16px', border: '1px solid rgba(14, 165, 233, 0.2)', color: '#0284c7' }}>
                        <Clock size={12} style={{ alignSelf: 'flex-start', marginTop: '3px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px', opacity: 0.8 }}>Time elapsed</span>
                          {timeLapseNode || <span style={{ fontSize: '11px', fontWeight: 600 }}>24h window</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '16px', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#059669' }}>
                        <ListOrdered size={12} />
                        <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.2px' }}>
                          Total Jobs: {matrixJobs.length}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {matrixJobs.length > 0 ? (
                <div className="murex-matrix-list-container">
                  {/* Header Row */}
                  <div className="murex-matrix-list-header">
                    <div className="mxl-col mxl-col-job">JOB</div>
                    <div className="mxl-col mxl-col-timeline">TIMELINE</div>
                    <div className="mxl-col mxl-col-duration">DURATION</div>
                    <div className="mxl-col mxl-col-start">START</div>
                    <div className="mxl-col mxl-col-end">END</div>
                  </div>

                  {/* Data Rows */}
                  <div className="murex-matrix-list-body">
                    {(() => {
                      // Compute dynamic scale based on actual job times
                      const times = matrixJobs.map(job => {
                        const startMs = job.start ? new Date(job.start.replace(' ', 'T')).getTime() : 0;
                        const endMs = job.end ? new Date(job.end.replace(' ', 'T')).getTime() : startMs;
                        return { startMs, endMs };
                      }).filter(t => t.startMs > 0);

                      let globalMinMs = Math.min(...times.map(t => t.startMs));
                      let globalMaxMs = Math.max(...times.map(t => t.endMs));

                      // Add 30 minutes padding to both sides
                      if (globalMinMs && globalMaxMs && globalMaxMs > globalMinMs) {
                        globalMinMs -= 30 * 60 * 1000;
                        globalMaxMs += 30 * 60 * 1000;
                      } else {
                        // Fallback to 24h
                        globalMinMs = new Date(`${selectedIsoDate}T00:00:00`).getTime();
                        globalMaxMs = globalMinMs + (24 * 60 * 60 * 1000);
                      }

                      const totalSpanMs = globalMaxMs - globalMinMs;

                      // Save globally for footer
                      window.__murexGlobalMinMs = globalMinMs;
                      window.__murexGlobalMaxMs = globalMaxMs;

                      return matrixJobs.map((job, idx) => {
                        const jobStartMs = job.start ? new Date(job.start.replace(' ', 'T')).getTime() : globalMinMs;
                        const jobEndMs = job.end ? new Date(job.end.replace(' ', 'T')).getTime() : jobStartMs;

                        const durationMs = Math.max(jobEndMs - jobStartMs, 60 * 1000);
                        const leftPerc = Math.max(0, Math.min(100, ((jobStartMs - globalMinMs) / totalSpanMs) * 100));
                        const widthPerc = Math.min(100 - leftPerc, (durationMs / totalSpanMs) * 100);

                        // Formatted dates for Start - End column
                        const s = new Date(jobStartMs);
                        const e = new Date(jobEndMs);

                        const pad = (n) => n.toString().padStart(2, '0');
                        const formatTime = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

                        const startDateStr = s.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
                        const endDateStr = e.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

                        const sDateOnly = new Date(s.getFullYear(), s.getMonth(), s.getDate());
                        const eDateOnly = new Date(e.getFullYear(), e.getMonth(), e.getDate());
                        const isNextDay = eDateOnly > sDateOnly;

                        return (
                          <div
                            key={job.id}
                            className="murex-matrix-list-row"
                            onMouseEnter={() => setHoveredMatrixIdx(idx)}
                            onMouseLeave={() => setHoveredMatrixIdx(null)}
                            title={job.rawScriptName}
                          >
                            <div className="mxl-col mxl-col-job">
                              <span className="mxl-job-name">{job.name}</span>
                            </div>
                            <div className="mxl-col mxl-col-timeline">
                              <div className="mxl-timeline-track">
                                <div
                                  className="mxl-timeline-bar"
                                  style={{
                                    left: `${leftPerc}%`,
                                    width: `${Math.max(widthPerc, 0.5)}%`
                                  }}
                                />
                              </div>
                            </div>
                            <div className="mxl-col mxl-col-duration">
                              <span className="mxl-duration-text">
                                {job.durationStr?.replace(/m/g, 'm ').replace(/s/g, 's').trim()}
                              </span>
                            </div>
                            <div className="mxl-col mxl-col-start">
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', lineHeight: '1.2', fontWeight: 600 }}>
                                <span style={{ color: '#0284c7', fontSize: '10px' }}>{startDateStr}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatTime(s)}</span>
                              </div>
                            </div>
                            <div className="mxl-col mxl-col-end">
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', lineHeight: '1.2', fontWeight: 600 }}>
                                <span style={{ color: isNextDay ? '#dc2626' : '#0284c7', fontSize: '10px' }}>{endDateStr}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatTime(e)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                  {/* Total Duration Row (Always visible) */}
                  {matrixJobs.length > 0 && (() => {
                    const minMs = window.__murexGlobalMinMs;
                    const maxMs = window.__murexGlobalMaxMs;
                    const totalSpanMs = maxMs - minMs;

                    if (!minMs || !maxMs || totalSpanMs <= 0) return null;

                    const times = matrixJobs.map(job => {
                      const startMs = job.start ? new Date(job.start.replace(' ', 'T')).getTime() : 0;
                      const endMs = job.end ? new Date(job.end.replace(' ', 'T')).getTime() : startMs;
                      return { startMs, endMs };
                    }).filter(t => t.startMs > 0);

                    const trueMinMs = Math.min(...times.map(t => t.startMs));
                    const trueMaxMs = Math.max(...times.map(t => t.endMs));

                    const leftPerc = Math.max(0, ((trueMinMs - minMs) / totalSpanMs) * 100);
                    const widthPerc = Math.min(100 - leftPerc, ((trueMaxMs - trueMinMs) / totalSpanMs) * 100);

                    const diffMs = trueMaxMs - trueMinMs;
                    const h = Math.floor(diffMs / 3600000);
                    const m = Math.floor((diffMs % 3600000) / 60000);
                    const s = Math.floor((diffMs % 60000) / 1000);
                    const durationStr = `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;

                    return (
                      <div className="murex-matrix-list-row mxl-total-row" style={{ backgroundColor: 'var(--bg-tertiary, #f8fafc)', borderTop: '2px solid var(--border-secondary, #e2e8f0)', borderBottom: '1px solid var(--border-secondary, #e2e8f0)', fontWeight: 600, padding: '12px 18px 12px 12px' }}>
                        <div className="mxl-col mxl-col-job" style={{ color: 'var(--text-primary, #0f172a)' }}>
                          Total Time Duration
                        </div>
                        <div className="mxl-col mxl-col-timeline">
                          <div className="mxl-timeline-track" style={{ backgroundColor: 'transparent' }}>
                            <div
                              className="mxl-timeline-bar"
                              style={{
                                left: `${leftPerc}%`,
                                width: `${Math.max(widthPerc, 0.5)}%`,
                                backgroundColor: 'var(--brand-primary, #6366f1)',
                                opacity: 0.85
                              }}
                            />
                          </div>
                        </div>
                        <div className="mxl-col mxl-col-duration" style={{ color: 'var(--brand-primary, #6366f1)' }}>
                          <span className="mxl-total-duration-text">{durationStr}</span>
                        </div>
                        <div className="mxl-col mxl-col-start"></div>
                        <div className="mxl-col mxl-col-end"></div>
                      </div>
                    );
                  })()}

                  {/* X-Axis Footer */}
                  <div className="murex-matrix-list-footer">
                    <div className="mxl-col mxl-col-job"></div>
                    <div className="mxl-col mxl-col-timeline" style={{ position: 'relative', height: '24px', paddingTop: '4px' }}>
                      {/* Dynamic background ticks */}
                      {(() => {
                        const ticks = [];
                        const hourMs = 60 * 60 * 1000;

                        const minMs = window.__murexGlobalMinMs;
                        const maxMs = window.__murexGlobalMaxMs;

                        if (!minMs || !maxMs) return null;

                        const totalSpanHours = (maxMs - minMs) / hourMs;
                        let tickIntervalMs = hourMs;
                        // If span is large, show every 2 or 3 hours to prevent overlapping
                        if (totalSpanHours > 12) tickIntervalMs = 3 * hourMs;
                        else if (totalSpanHours > 8) tickIntervalMs = 2 * hourMs;

                        let currentTick = Math.ceil(minMs / tickIntervalMs) * tickIntervalMs;

                        while (currentTick <= maxMs) {
                          const leftPerc = ((currentTick - minMs) / (maxMs - minMs)) * 100;
                          const timeLabel = new Date(currentTick).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

                          ticks.push(
                            <div
                              key={currentTick}
                              style={{
                                position: 'absolute',
                                left: `${leftPerc}%`,
                                transform: 'translateX(-50%)',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                color: 'var(--text-tertiary, #94a3b8)',
                                fontSize: '10px',
                                fontWeight: 500
                              }}
                            >
                              <div style={{ height: '4px', width: '1px', backgroundColor: 'var(--border-primary, #cbd5e1)', marginBottom: '2px' }} />
                              <span>{timeLabel}</span>
                            </div>
                          );
                          currentTick += tickIntervalMs;
                        }
                        return ticks;
                      })()}
                    </div>
                    <div className="mxl-col mxl-col-duration"></div>
                    <div className="mxl-col mxl-col-start"></div>
                    <div className="mxl-col mxl-col-end"></div>
                  </div>
                </div>
              ) : (
                <div className="murex-overview-empty-state">
                  <FileQuestion size={28} className="murex-empty-icon" />
                  <span>No EOD job executions recorded for {formattedDate}.</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 3. List of Data-Driven Collapsible EOD Job Timeline Accordions */}
      {!isLoadingDay && timelineList.length > 0 ? (
        timelineList.map((timelineItem) => {
          const isExpanded = !!expandedAccordions[timelineItem.id];
          const chartSpec = buildTimelineChartSpec(timelineItem);

          return (
            <div key={timelineItem.id} className="murex-overview-section">
              <div className={`murex-timeline-accordion-card ${isExpanded ? 'is-expanded' : ''}`}>
                {/* Accordion Header */}
                <div
                  className="murex-timeline-accordion-header"
                  onClick={() => toggleAccordion(timelineItem.id)}
                >
                  <div className="murex-timeline-accordion-header-left">
                    <h3 className="murex-overview-job-title">{timelineItem.jobInfo.title}</h3>
                    <div className="murex-overview-job-meta">
                      <span>{timelineItem.jobInfo.startTimeStr} — {timelineItem.jobInfo.endTimeStr}</span>
                      <span className="murex-meta-dot">•</span>
                      <span>Duration: <strong>{timelineItem.jobInfo.durationStr}</strong></span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="murex-timeline-accordion-chevron-btn"
                    aria-label={isExpanded ? 'Collapse timeline' : 'Expand timeline'}
                  >
                    {isExpanded ? (
                      <ChevronUp size={18} className="murex-chevron-icon" />
                    ) : (
                      <ChevronDown size={18} className="murex-chevron-icon" />
                    )}
                  </button>
                </div>

                {/* Accordion Body: Legend + Plotly Chart */}
                {isExpanded && (
                  <div className="murex-timeline-accordion-body">
                    {/* Legend */}
                    <div className="murex-overview-legend">
                      {timelineItem.categories.map((cat) => (
                        <div key={cat.key} className="murex-overview-legend-item">
                          <span className="murex-overview-legend-dot" style={{ backgroundColor: cat.color }} />
                          <span className="murex-overview-legend-text">{cat.name}</span>
                        </div>
                      ))}
                    </div>

                    {/* Plotly Timeline Chart */}
                    <div className="murex-overview-plotly-wrapper" style={{ minHeight: chartSpec.layout.height }}>
                      <PlotlyChart
                        data={chartSpec.data}
                        layout={chartSpec.layout}
                        config={{ responsive: true, displayModeBar: false }}
                        onHover={(ev) => ev?.points?.[0] && setHoveredTimelineRow(ev.points[0].y)}
                        onUnhover={() => setHoveredTimelineRow(null)}
                        style={{ width: '100%', height: chartSpec.layout.height }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <div className="murex-overview-section">
          <div className="murex-timeline-accordion-card">
            <div className="murex-overview-empty-state">
              <FileQuestion size={24} className="murex-empty-icon" />
              <span>No EOD job timelines recorded for {formattedDate}.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MurexOverviewTab;
