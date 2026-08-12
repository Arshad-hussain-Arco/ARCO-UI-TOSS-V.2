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
  parseISO,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Calendar as CalendarIcon,
  FileQuestion,
} from 'lucide-react';
import 'react-day-picker/dist/style.css';
import '@components/forms/DatePicker/DatePicker.css';
import { PlotlyChart } from './MurexRuntimeTrendsPage';
import { overviewParsedData } from './overviewCsvParser';

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
  const availableDates = overviewParsedData.availableDates;
  const latestIsoDate = availableDates[availableDates.length - 1] || '2026-08-11';

  // Default date: latest available date in CSV (2026-08-11 -> 11 Aug 2026)
  const [selectedIsoDate, setSelectedIsoDate] = useState(latestIsoDate);
  const selectedDate = useMemo(() => parseISO(selectedIsoDate), [selectedIsoDate]);

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

  // Navigation handlers cycling strictly through available CSV dates
  const handlePrevDay = () => {
    const currentIdx = availableDates.indexOf(selectedIsoDate);
    if (currentIdx > 0) {
      const prevIso = availableDates[currentIdx - 1];
      setSelectedIsoDate(prevIso);
      setCurrentMonth(parseISO(prevIso));
    } else {
      const nextDate = subDays(selectedDate, 1);
      const isoStr = format(nextDate, 'yyyy-MM-dd');
      setSelectedIsoDate(isoStr);
      setCurrentMonth(nextDate);
    }
  };

  const handleNextDay = () => {
    const currentIdx = availableDates.indexOf(selectedIsoDate);
    if (currentIdx !== -1 && currentIdx < availableDates.length - 1) {
      const nextIso = availableDates[currentIdx + 1];
      setSelectedIsoDate(nextIso);
      setCurrentMonth(parseISO(nextIso));
    } else {
      const nextDate = addDays(selectedDate, 1);
      const isoStr = format(nextDate, 'yyyy-MM-dd');
      setSelectedIsoDate(isoStr);
      setCurrentMonth(nextDate);
    }
  };

  const handleSelectDate = (date) => {
    if (date) {
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

  // Extract CSV data for current selected ISO date
  const currentDayData = useMemo(() => {
    return overviewParsedData.dataByDate[selectedIsoDate] || { matrixJobs: [], timelineList: [] };
  }, [selectedIsoDate]);

  const matrixJobs = currentDayData.matrixJobs || [];
  const timelineList = currentDayData.timelineList || [];

  // 1. Build Dynamic Plotly Spec for "Job - Duration Matrix"
  const matrixChartSpec = useMemo(() => {
    if (!matrixJobs || matrixJobs.length === 0) {
      return null;
    }

    const allJobNames = matrixJobs.map((j) => j.name);
    const reversedJobNames = [...allJobNames].reverse();

    const yVals = [];
    const xVals = [];
    const baseVals = [];
    const customDataArr = [];

    matrixJobs.forEach((job) => {
      yVals.push(job.name);

      const startMs = job.start ? new Date(job.start.replace(' ', 'T')).getTime() : 0;
      const endMs = job.end ? new Date(job.end.replace(' ', 'T')).getTime() : startMs;
      const durationMs = Math.max(endMs - startMs, 2000); // minimum 2s bar for visibility

      xVals.push(durationMs);
      baseVals.push(job.start);
      customDataArr.push({
        name: job.name,
        rawScriptName: job.rawScriptName,
        rawStartTime: job.rawStartTime,
        rawEndTime: job.rawEndTime,
        durationStr: job.durationStr,
        timeCpu: job.timeCpu,
        timeSyb: job.timeSyb,
      });
    });

    const trace = {
      name: 'Job Duration',
      type: 'bar',
      orientation: 'h',
      showlegend: false,
      marker: {
        color: '#8B5CF6', // Purple/violet execution bar color
        line: { width: 0 },
      },
      y: yVals,
      x: xVals,
      base: baseVals,
      customdata: customDataArr,
      hovertemplate:
        '<b>Script: %{customdata.rawScriptName}</b><br><br>' +
        'Start: %{customdata.rawStartTime}<br>' +
        'End: %{customdata.rawEndTime}<br>' +
        'Duration: %{customdata.durationStr}<br>' +
        'CPU: %{customdata.timeCpu} | System: %{customdata.timeSyb}<extra></extra>',
      hoverlabel: {
        bgcolor: '#1E293B',
        font: { color: '#FFFFFF', family: 'Inter, system-ui, sans-serif', size: 11 },
        bordercolor: '#334155',
        align: 'left',
      },
    };

    // Build 24-hour tick values for the selected ISO date (00:00 to 24:00)
    const nextDayIso = format(addDays(selectedDate, 1), 'yyyy-MM-dd');
    const tickhours = ['00:00:00', '02:00:00', '04:00:00', '06:00:00', '08:00:00', '10:00:00', '12:00:00', '14:00:00', '16:00:00', '18:00:00', '20:00:00', '22:00:00'];
    const tickvals = tickhours.map((th) => `${selectedIsoDate} ${th}`);
    tickvals.push(`${nextDayIso} 00:00:00`);

    const ticktext = ['0:00', '2:00', '4:00', '6:00', '8:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00', '22:00', '24:00'];

    const hoveredJobName = hoveredMatrixIdx != null ? matrixJobs[hoveredMatrixIdx]?.name : null;
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

    const chartHeight = Math.max(160, matrixJobs.length * 40);

    const layout = {
      autosize: true,
      height: chartHeight + 35,
      margin: { t: 5, r: 12, b: 30, l: 12 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: themeColor, size: 11, family: 'Inter, system-ui, sans-serif' },
      barmode: 'overlay',
      bargap: 0.4,
      xaxis: {
        type: 'date',
        tickvals: tickvals,
        ticktext: ticktext,
        showgrid: true,
        gridcolor: 'rgba(226, 232, 240, 0.6)',
        zeroline: false,
        range: [`${selectedIsoDate} 00:00:00`, `${nextDayIso} 00:00:00`],
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

    return { data: [trace], layout, chartHeight };
  }, [themeColor, matrixJobs, hoveredMatrixIdx, selectedIsoDate, selectedDate]);

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
            <h3 className="murex-matrix-card-title">Job - Duration Matrix</h3>
            <div className="murex-matrix-card-subtitle">24-Hour Overview Window ({formattedDate})</div>
          </div>

          {matrixChartSpec ? (
            <div className="murex-matrix-container">
              {/* Left Column: Job Names */}
              <div
                className="murex-matrix-col-jobs"
                style={{ height: matrixChartSpec.chartHeight }}
              >
                {matrixJobs.map((job, idx) => (
                  <div
                    key={job.id}
                    className={`murex-matrix-row-label ${hoveredMatrixIdx === idx ? 'is-hovered' : ''}`}
                    style={{ height: 40 }}
                    onMouseEnter={() => setHoveredMatrixIdx(idx)}
                    onMouseLeave={() => setHoveredMatrixIdx(null)}
                    title={job.rawScriptName}
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
                      const idx = matrixJobs.findIndex((j) => j.name === yVal);
                      if (idx !== -1) setHoveredMatrixIdx(idx);
                    }
                  }}
                  onUnhover={() => setHoveredMatrixIdx(null)}
                  style={{ width: '100%', height: matrixChartSpec.layout.height }}
                />
              </div>

              {/* Right Column: Duration Values */}
              <div
                className="murex-matrix-col-durations"
                style={{ height: matrixChartSpec.chartHeight }}
              >
                {matrixJobs.map((job, idx) => (
                  <div
                    key={job.id}
                    className={`murex-matrix-row-duration ${hoveredMatrixIdx === idx ? 'is-hovered' : ''}`}
                    style={{ height: 40 }}
                    onMouseEnter={() => setHoveredMatrixIdx(idx)}
                    onMouseLeave={() => setHoveredMatrixIdx(null)}
                  >
                    <span className="murex-matrix-duration-text">{job.durationStr}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="murex-overview-empty-state">
              <FileQuestion size={28} className="murex-empty-icon" />
              <span>No EOD job executions recorded for {formattedDate}.</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. List of Data-Driven Collapsible EOD Job Timeline Accordions */}
      {timelineList.length > 0 ? (
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
