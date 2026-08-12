import React, { useState, useMemo, useEffect } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import {
  format,
  addDays,
  subDays,
  addMonths,
  setMonth as dateFnsSetMonth,
  setYear as dateFnsSetYear,
  getYear,
  getMonth,
  isToday,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
} from 'lucide-react';
import 'react-day-picker/dist/style.css';
import '@components/forms/DatePicker/DatePicker.css';
import { PlotlyChart } from './MurexRuntimeTrendsPage';
import {
  mockJobDurationMatrixData,
  mockOverviewTimelineList,
} from './mockOverviewTimelineData';

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
  // Default date: 12 Aug 2026
  const [selectedDate, setSelectedDate] = useState(() => new Date(2026, 7, 12));
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => new Date(2026, 7, 12));

  const [hoveredMatrixIdx, setHoveredMatrixIdx] = useState(null);
  const [hoveredTimelineRow, setHoveredTimelineRow] = useState(null);

  // Map of expanded accordion state: all accordions collapsed by default
  const [expandedAccordions, setExpandedAccordions] = useState({});

  const toggleAccordion = (id) => {
    setExpandedAccordions((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const themeColor = useChartThemeColor();

  const handlePrevDay = () => {
    setSelectedDate((prev) => {
      const next = subDays(prev, 1);
      setCurrentMonth(next);
      return next;
    });
  };

  const handleNextDay = () => {
    setSelectedDate((prev) => {
      const next = addDays(prev, 1);
      setCurrentMonth(next);
      return next;
    });
  };

  const handleSelectDate = (date) => {
    if (date) {
      setSelectedDate(date);
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

  // 1. Build Plotly Spec for "Job - Duration Matrix"
  const matrixChartSpec = useMemo(() => {
    const allJobNames = mockJobDurationMatrixData.jobs.map((j) => j.name);
    const reversedJobNames = [...allJobNames].reverse();

    const yVals = [];
    const xVals = [];
    const baseVals = [];
    const customDataArr = [];

    mockJobDurationMatrixData.jobs.forEach((job) => {
      yVals.push(job.name);
      const startMs = new Date(job.start.replace(' ', 'T')).getTime();
      const endMs = new Date(job.end.replace(' ', 'T')).getTime();
      const durationMs = endMs - startMs;

      xVals.push(durationMs);
      baseVals.push(job.start);
      customDataArr.push({
        name: job.name,
        startTimeStr: job.startTimeStr,
        endTimeStr: job.endTimeStr,
        durationStr: job.durationStr,
      });
    });

    const trace = {
      name: 'Job Duration',
      type: 'bar',
      orientation: 'h',
      showlegend: false,
      marker: {
        color: '#8B5CF6',
        line: { width: 0 },
      },
      y: yVals,
      x: xVals,
      base: baseVals,
      customdata: customDataArr,
      hovertemplate:
        '<b>%{customdata.name}</b><br><br>' +
        'Time: %{customdata.startTimeStr} - %{customdata.endTimeStr}<br>' +
        'Duration: %{customdata.durationStr}<extra></extra>',
      hoverlabel: {
        bgcolor: '#1E293B',
        font: { color: '#FFFFFF', family: 'Inter, system-ui, sans-serif', size: 11 },
        bordercolor: '#334155',
        align: 'left',
      },
    };

    const tickvals = [
      '2026-07-12 00:00:00', '2026-07-12 02:00:00', '2026-07-12 04:00:00',
      '2026-07-12 06:00:00', '2026-07-12 08:00:00', '2026-07-12 10:00:00',
      '2026-07-12 12:00:00', '2026-07-12 14:00:00', '2026-07-12 16:00:00',
      '2026-07-12 18:00:00', '2026-07-12 20:00:00', '2026-07-12 22:00:00',
      '2026-07-13 00:00:00'
    ];
    const ticktext = ['0:00', '2:00', '4:00', '6:00', '8:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '24:00'];

    const hoveredJobName = hoveredMatrixIdx != null ? mockJobDurationMatrixData.jobs[hoveredMatrixIdx]?.name : null;
    const shapes =
      hoveredJobName != null
        ? [
            {
              type: 'rect',
              xref: 'paper',
              x0: 0,
              x1: 1,
              yref: 'y',
              y0: hoveredJobName,
              y1: hoveredJobName,
              fillcolor: 'rgba(241, 245, 249, 0.85)',
              line: { width: 0 },
              layer: 'below',
            },
          ]
        : [];

    const layout = {
      autosize: true,
      height: 195,
      margin: { t: 5, r: 12, b: 30, l: 12 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: themeColor, size: 11, family: 'Inter, system-ui, sans-serif' },
      barmode: 'overlay',
      bargap: 0.45,
      xaxis: {
        type: 'date',
        tickvals: tickvals,
        ticktext: ticktext,
        showgrid: true,
        gridcolor: 'rgba(226, 232, 240, 0.6)',
        zeroline: false,
        range: ['2026-07-12 00:00:00', '2026-07-13 00:00:00'],
        tickfont: { size: 10, color: '#64748B' },
      },
      yaxis: {
        type: 'category',
        categoryorder: 'array',
        categoryarray: reversedJobNames,
        showgrid: false,
        showticklabels: false,
        zeroline: false,
      },
      shapes,
    };

    return { data: [trace], layout };
  }, [themeColor, hoveredMatrixIdx]);

  // 2. Helper to build Plotly Spec for any EOD Job Timeline dataset
  const buildTimelineChartSpec = (timelineData) => {
    const allRowNames = timelineData.rows.map((r) => r.name);
    const reversedRowNames = [...allRowNames].reverse();

    const traces = timelineData.categories.map((cat) => {
      const yVals = [];
      const xVals = [];
      const baseVals = [];
      const customDataArr = [];

      timelineData.rows.forEach((row) => {
        (row.segments || []).forEach((seg) => {
          if (seg.type === cat.key) {
            yVals.push(row.name);
            const startMs = new Date(seg.start.replace(' ', 'T')).getTime();
            const endMs = new Date(seg.end.replace(' ', 'T')).getTime();
            const durationMs = Math.max(endMs - startMs, 1000);

            xVals.push(durationMs);
            baseVals.push(seg.start);
            customDataArr.push({
              scriptName: row.name,
              unit: row.unit,
              typeName: seg.typeName,
              durationStr: seg.durationFormatted,
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
          'Unit: %{customdata.unit}<br>' +
          '%{customdata.typeName}: %{customdata.durationStr}<extra></extra>',
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

    const defaultRange = ['2026-07-12 23:20:00', '2026-07-13 00:58:00'];
    const xRange = timelineData.jobInfo.xRange || defaultRange;
    const chartHeight = Math.max(220, timelineData.rows.length * 40 + 80);

    const layout = {
      autosize: true,
      height: chartHeight,
      margin: { t: 15, r: 25, b: 45, l: 160 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: themeColor, size: 11, family: 'Inter, system-ui, sans-serif' },
      barmode: 'overlay',
      bargap: 0.45,
      xaxis: {
        type: 'date',
        tickformat: '%H:%M',
        dtick: 600000,
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

  return (
    <div className="murex-overview-tab">
      {/* 1. Date Navigation Header */}
      <div className="murex-overview-header-bar">
        <div className="murex-date-nav-container">
          <button
            type="button"
            className="murex-date-arrow-btn"
            onClick={handlePrevDay}
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
            disabled={isToday(selectedDate)}
            title="Next Day"
            aria-label="Next Day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* 2. CHART 1: Job - Duration Matrix (Unified Card with Centered Header) */}
      <div className="murex-overview-section">
        <div className="murex-overview-chart-card murex-matrix-card">
          {/* Centered Card Header */}
          <div className="murex-matrix-card-header">
            <h3 className="murex-matrix-card-title">{mockJobDurationMatrixData.header.title}</h3>
            <div className="murex-matrix-card-subtitle">{mockJobDurationMatrixData.header.subtitle}</div>
          </div>

          <div className="murex-matrix-container">
            {/* Left Column: Job Names */}
            <div className="murex-matrix-col-jobs">
              {mockJobDurationMatrixData.jobs.map((job, idx) => (
                <div
                  key={job.id}
                  className={`murex-matrix-row-label ${hoveredMatrixIdx === idx ? 'is-hovered' : ''}`}
                  onMouseEnter={() => setHoveredMatrixIdx(idx)}
                  onMouseLeave={() => setHoveredMatrixIdx(null)}
                >
                  <span className="murex-matrix-job-name">{job.name}</span>
                </div>
              ))}
            </div>

            {/* Middle Column: 24-Hour Plotly Timeline */}
            <div className="murex-matrix-col-timeline">
              <PlotlyChart
                data={matrixChartSpec.data}
                layout={matrixChartSpec.layout}
                config={{ responsive: true, displayModeBar: false }}
                onHover={(ev) => {
                  if (ev?.points?.[0]) {
                    const yVal = ev.points[0].y;
                    const idx = mockJobDurationMatrixData.jobs.findIndex((j) => j.name === yVal);
                    if (idx !== -1) setHoveredMatrixIdx(idx);
                  }
                }}
                onUnhover={() => setHoveredMatrixIdx(null)}
                style={{ width: '100%', height: 195 }}
              />
            </div>

            {/* Right Column: Duration Values */}
            <div className="murex-matrix-col-durations">
              {mockJobDurationMatrixData.jobs.map((job, idx) => (
                <div
                  key={job.id}
                  className={`murex-matrix-row-duration ${hoveredMatrixIdx === idx ? 'is-hovered' : ''}`}
                  onMouseEnter={() => setHoveredMatrixIdx(idx)}
                  onMouseLeave={() => setHoveredMatrixIdx(null)}
                >
                  <span className="murex-matrix-duration-text">{job.durationStr}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. List of Collapsible EOD Job Timeline Accordions */}
      {mockOverviewTimelineList.map((timelineItem) => {
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
      })}
    </div>
  );
}

export default MurexOverviewTab;
