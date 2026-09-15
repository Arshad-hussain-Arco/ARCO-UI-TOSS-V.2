import { useCallback, useEffect, useMemo, useState, useRef, useImperativeHandle, forwardRef, Fragment } from 'react';
import {
  Download,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Eye,
  ChevronDown,
  ChevronUp,
  Pin,
  Plus,
  AlertTriangle,
  Clock,
  Activity,
  Calendar,
  BarChart3,
  SlidersHorizontal,
  Edit,
  Trash,
  Loader2,
  X,
  RotateCcw
} from 'lucide-react';
import { CiPlay1 } from "react-icons/ci";
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Skeleton } from '@components/feedback/Skeleton/Skeleton';
import { Select } from '@components/forms/Select/Select';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { ResetButton } from '@components/ui/ResetButton/ResetButton';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { murexService } from '@services/murexService';
import { parseISO, getISOWeek, getDay, format as formatDate, isValid } from 'date-fns';

import './MurexRuntimeTrendsPage.css';
import { dismissBackdrop } from '@utils/interactive';
import { useDebounce } from '@hooks/useDebounce';
import { ScriptRunMonitor } from './ScriptRunMonitor';
import { MurexOverviewTab } from './MurexOverviewTab';

// The categories API returns last_run as raw ISO-8601 ("2026-08-18T00:00:00Z");
// this renders it as a readable date instead of showing that string verbatim.
function formatLastRun(isoString) {
  if (!isoString) return 'N/A';
  const parsed = parseISO(isoString);
  if (!isValid(parsed)) return 'N/A';
  return formatDate(parsed, 'dd MMM yyyy');
}

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

/* ─── Plotly Chart Wrapper Component (CDN Auto-Loader) ────────── */
export const PlotlyChart = forwardRef(function PlotlyChart({ data, layout, config, onClick, onHover, onUnhover, style }, forwardedRef) {
  const containerRef = useRef(null);
  useImperativeHandle(forwardedRef, () => containerRef.current, []);
  const [plotlyLoaded, setPlotlyLoaded] = useState(Boolean(window.Plotly));

  useEffect(() => {
    if (window.Plotly) {
      setPlotlyLoaded(true);
      return;
    }
    const existing = document.getElementById('plotly-script');
    if (existing) {
      existing.addEventListener('load', () => setPlotlyLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.id = 'plotly-script';
    script.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
    script.async = true;
    script.onload = () => setPlotlyLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!plotlyLoaded || !containerRef.current || !window.Plotly) return;

    const el = containerRef.current;
    window.Plotly.newPlot(el, data, layout, {
      responsive: true,
      displayModeBar: false,
      ...config,
    });

    if (onClick) {
      el.removeAllListeners?.('plotly_click');
      el.on('plotly_click', onClick);
    }

    if (onHover) {
      el.removeAllListeners?.('plotly_hover');
      el.on('plotly_hover', onHover);
    }

    if (onUnhover) {
      el.removeAllListeners?.('plotly_unhover');
      el.on('plotly_unhover', onUnhover);
    }

    const handleResize = () => {
      if (window.Plotly && el) {
        window.Plotly.Plots.resize(el);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.Plotly && el) {
        window.Plotly.purge(el);
      }
    };
  }, [plotlyLoaded, data, layout, config, onClick, onHover, onUnhover]);

  if (!plotlyLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--text-tertiary)' }}>
        <RefreshCw size={14} className="eod-pulse-icon" style={{ marginRight: 8 }} /> Loading Plotly engine...
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 220, ...style }} />;
});

/* ─── Stacked Bar Chart Spec for Job Cards ─────────────────────── */
function buildJobStackedBarSpec(script, themeColor = '#000000') {
  const trendData = script.trendData || [];
  const history = script.history || [];
  const avgMin = script.minRuntime || 0;
  const avgMax = script.maxRuntime || 0;
  const avgRuntimeMin = (avgMin + avgMax) / 2 || 1;
  const threshold = avgRuntimeMin * 1.8;

  // Build date labels: prefer history dates, fallback to Day-N
  const dates = trendData.map((_, i) => {
    const h = history[history.length - 1 - i]; // history is most-recent-first
    if (h?.date) {
      const d = new Date(h.date);
      if (!isNaN(d.getTime())) {
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
      return h.date;
    }
    return `Day ${i + 1}`;
  }).reverse();

  const vals = [...trendData].reverse();

  // Split each bar into 3 stacked segments (base 60%, standard 30%, remainder)
  const seg1 = vals.map(v => Math.round(v * 0.60));
  const seg2 = vals.map(v => Math.round(v * 0.28));
  const seg3 = vals.map(v => Math.round(v * 0.12));

  // Outlier markers where value > threshold
  const outlierX = dates.filter((_, i) => vals[i] > threshold);
  const outlierY = vals.filter(v => v > threshold);

  // Build custom hover text
  const hoverText = vals.map((v, i) => {
    const isOut = v > threshold;
    const hh = String(Math.floor(v / 60)).padStart(2, '0');
    const mm = String(Math.floor(v % 60)).padStart(2, '0');
    const ss = String(Math.floor((v * 60) % 60)).padStart(2, '0');
    return `<b>${dates[i]}</b><br>Duration: ${hh}:${mm}:${ss}${isOut ? '<br><span style="color:#EF4444">⚠️ Outlier</span>' : ''}`;
  });

  return {
    data: [
      {
        x: dates,
        y: seg1,
        type: 'bar',
        name: 'Base Run',
        marker: { color: '#1E3A8A' },
        hovertemplate: '%{customdata}<extra></extra>',
        customdata: hoverText,
      },
      {
        x: dates,
        y: seg2,
        type: 'bar',
        name: 'Standard',
        marker: { color: '#3B82F6' },
        hoverinfo: 'skip',
        showlegend: false,
      },
      {
        x: dates,
        y: seg3,
        type: 'bar',
        name: 'Tail',
        marker: { color: '#93C5FD' },
        hoverinfo: 'skip',
        showlegend: false,
      },
      ...(outlierX.length > 0 ? [{
        x: outlierX,
        y: outlierY,
        type: 'scatter',
        mode: 'markers',
        name: '⚠️ Outlier',
        marker: { color: '#EF4444', size: 8, symbol: 'circle', line: { color: 'var(--surface-primary)', width: 1.5 } },
        hovertemplate: '<b>%{x}</b><br>⚠️ Outlier: %{y:.0f}m<extra></extra>',
      }] : []),
    ],
    layout: {
      barmode: 'stack',
      bargap: 0.55,
      margin: { t: 18, r: 20, b: 48, l: 52 },
      height: 200,
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: themeColor, size: 10, family: 'Inter, system-ui, sans-serif' },
      xaxis: {
        tickfont: { size: 9 },
        showgrid: false,
        zeroline: false,
        tickangle: -30,
      },
      yaxis: {
        title: { text: 'Minutes', font: { size: 9, color: themeColor } },
        tickfont: { size: 9 },
        gridcolor: 'rgba(148,163,184,0.15)',
        zeroline: false,
      },
      shapes: [
        {
          type: 'line',
          x0: 0,
          x1: 1,
          xref: 'paper',
          y0: threshold,
          y1: threshold,
          yref: 'y',
          line: { color: '#EF4444', width: 1.5, dash: 'dash' },
        },
      ],
      annotations: [
        {
          x: 1,
          xref: 'paper',
          y: threshold,
          yref: 'y',
          text: 'Upper Threshold',
          showarrow: false,
          xanchor: 'right',
          font: { size: 9, color: '#EF4444' },
          bgcolor: 'rgba(239,68,68,0.08)',
          borderpad: 2,
        },
      ],
      legend: {
        orientation: 'h',
        y: -0.35,
        x: 0,
        font: { size: 9 },
      },
    },
  };
}

/* ─── JobCard Component ─────────────────────────────────────────── */
function JobCard({ script, timeRange, onOpenDetail, onTogglePin }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [scriptDetails, setScriptDetails] = useState(null);
  const themeColor = useChartThemeColor();

  const scriptWithDetails = useMemo(() => {
    return { ...script, ...(scriptDetails || {}) };
  }, [script, scriptDetails]);

  const barSpec = useMemo(() => buildJobStackedBarSpec(scriptWithDetails, themeColor), [scriptWithDetails, themeColor]);

  const handleToggle = async () => {
    if (!isOpen) {
      setIsOpen(true);
      if (!scriptDetails) {
        setIsLoading(true);
        try {
          const details = await murexService.fetchScriptTimeseries(script.id);
          setScriptDetails(details);
        } catch (err) {
          console.error("Failed to fetch script details:", err);
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      setIsOpen(false);
    }
  };

  const avgRuntimeFmt = script.avgRuntime || '—';
  const minRtFmt = script.minRuntimeFormatted || '—';
  const maxRtFmt = script.maxRuntimeFormatted || '—';
  const p95Fmt = script.p95DurationFormatted || '—';
  const runCountFmt = script.runCount || '—';
  const trendSlopeFmt = script.trendSlope != null ? String(script.trendSlope) : '—';
  const lastRunFmt = script.lastRun || '—';
  const outlierCount = scriptDetails ? (scriptDetails.history || []).filter(h => h.status === 'error').length : 0;
  const freqFmt = scriptDetails?.calculatedFrequency || (script.frequency != null ? `${script.frequency}/day` : '—');

  const trendObj = scriptDetails?.calculatedTrend;
  const trendPct = trendObj ? `${trendObj.percentage.toFixed(1)}%` : '—';
  const trendDirection = trendObj?.direction || 'stable';
  const trendIsBetter = trendDirection === 'down' || trendDirection === 'stable';
  const minMaxRatio =
    script.maxRuntime > 0 ? Math.min((script.minRuntime / script.maxRuntime) * 100, 100) : 0;

  const healthColor =
    script.health === 'Healthy' ? 'var(--c-success)' :
      script.health === 'Warning' ? 'var(--c-warning)' : 'var(--c-danger)';

  return (
    <div className="murex-job-card">
      {/* Card Header */}
      <div className="murex-job-card-header">
        <div className="murex-job-card-title-group">
          <Activity size={14} className="murex-job-card-icon" />
          <span className="murex-job-card-name">{script.name}</span>
        </div>
        <div className="murex-job-card-header-right">
          <span className="murex-job-cat-tag">{script.category}</span>
          <span
            className="murex-job-health-badge"
            style={{ background: healthColor }}
          >
            {(script.health || 'Unknown').toUpperCase()}
          </span>
          <button
            className={`murex-icon-btn ${script.isPinned ? 'active' : ''}`}
            title="Pin Job"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin && onTogglePin(script.id);
            }}
          >
            <Pin size={12} />
          </button>
          <button
            className="murex-icon-btn"
            title="Toggle Details"
            onClick={handleToggle}
          >
            {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* KPI Row inside each Job Card */}
      <div className="murex-kpi-row murex-job-kpi-row">
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Latest Run</div>
          <div className="murex-kpi-value">{lastRunFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Run Count</div>
          <div className="murex-kpi-value">{runCountFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Avg Duration</div>
          <div className="murex-kpi-value">{avgRuntimeFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">P95 Duration</div>
          <div className="murex-kpi-value">{p95Fmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Min Duration</div>
          <div className="murex-kpi-value">{minRtFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Max Duration</div>
          <div className="murex-kpi-value">{maxRtFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Trend Slope</div>
          <div className={`murex-kpi-value ${script.trendSlope < 0 ? 'trend-down' : 'trend-up'}`}>
            {script.trendSlope < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
            {trendSlopeFmt}
          </div>
        </div>
      </div>

      {/* Card Body: Chart + Details Panel */}
      {isOpen && (
        <div className="murex-job-card-body">
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', width: '100%', gap: '16px', color: 'var(--text-tertiary)' }}>
              <Loader2 className="spin" size={32} style={{ color: 'var(--primary-color)' }} />
              <p>Fetching Full Runtime History...</p>
            </div>
          ) : (
            <>
              {/* Left: Stacked Bar Chart */}
              <div className="murex-job-chart-area">
                <PlotlyChart
                  data={barSpec.data}
                  layout={barSpec.layout}
                  style={{ minHeight: 200 }}
                />
              </div>

              {/* Right: Stats Panel */}
              <div className="murex-job-details-panel">
                {/* 2×2 Metric Grid */}
                <div className="murex-job-metric-grid">
                  {/* Avg Runtime */}
                  <div className="murex-job-metric-card">
                    <div className="murex-job-metric-icon blue">
                      <Clock size={13} />
                    </div>
                    <div className="murex-job-metric-info">
                      <span className="murex-job-metric-label">Avg Runtime</span>
                      <span className="murex-job-metric-value blue">{avgRuntimeFmt}</span>
                    </div>
                  </div>

                  {/* Performance Trend */}
                  <div className="murex-job-metric-card">
                    <div className={`murex-job-metric-icon ${trendIsBetter ? 'green' : 'red'}`}>
                      {trendDirection === 'up' ? <TrendingUp size={13} /> : (trendDirection === 'down' ? <TrendingDown size={13} /> : <Activity size={13} />)}
                    </div>
                    <div className="murex-job-metric-info">
                      <span className="murex-job-metric-label">Recent Shift</span>
                      <span className={`murex-job-metric-value ${trendIsBetter ? 'green' : 'red'}`}>
                        {trendDirection === 'stable' ? 'Stable' : trendPct}
                      </span>
                    </div>
                  </div>

                  {/* Frequency */}
                  <div className="murex-job-metric-card">
                    <div className="murex-job-metric-icon purple">
                      <Calendar size={13} />
                    </div>
                    <div className="murex-job-metric-info">
                      <span className="murex-job-metric-label">Frequency</span>
                      <span className="murex-job-metric-value purple">{freqFmt}</span>
                    </div>
                  </div>

                  {/* Outliers */}
                  <div className="murex-job-metric-card">
                    <div className={`murex-job-metric-icon ${outlierCount > 0 ? 'red' : 'green'}`}>
                      <AlertTriangle size={13} />
                    </div>
                    <div className="murex-job-metric-info">
                      <span className="murex-job-metric-label">Outliers</span>
                      <span className={`murex-job-metric-value ${outlierCount > 0 ? 'red' : 'green'}`}>
                        {outlierCount > 0 ? `⚠️ ${outlierCount}` : '0'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Last Run Row */}
                <div className="murex-job-last-run">
                  <Clock size={11} className="murex-job-last-run-icon" />
                  <span className="murex-job-last-run-label">Last Run</span>
                  <span className="murex-job-last-run-val">{lastRunFmt}</span>
                </div>

                {/* Min / Max Range Bar */}
                <div className="murex-job-minmax-wrap">
                  <div className="murex-job-minmax-header">
                    <span className="murex-job-minmax-label">Min vs Max Runtime</span>
                  </div>
                  <div className="murex-job-minmax-bar">
                    <div
                      className="murex-job-minmax-fill"
                      style={{ width: `${minMaxRatio}%` }}
                    />
                  </div>
                  <div className="murex-job-minmax-values">
                    <span className="murex-job-minmax-min">⬇ {minRtFmt}</span>
                    <span className="murex-job-minmax-max">⬆ {maxRtFmt}</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Heatmap & Gantt Data Generators ─────────────────────────── */
function getScriptHeatmapSpec(script, themeColor = '#000000') {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Extract all runs and map to ISO week and day. Sorted oldest-first by
  // each run's actual timestamp so that when a cell holds multiple runs
  // (same day), they list in chronological order rather than relying on
  // script.history already arriving in that order.
  const runs = (script.history || [])
    .filter(run => run.date && run.date !== 'Unknown Date')
    .map(run => {
      const dateObj = parseISO(run.date);
      if (isNaN(dateObj)) return null;

      const week = getISOWeek(dateObj);
      // getDay() returns 0 for Sunday, 1 for Monday. We want 0 for Mon, 6 for Sun.
      const jsDay = getDay(dateObj);
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
      return { ...run, week, dayIndex, dateMs: dateObj.getTime() };
    })
    .filter(Boolean)
    .sort((a, b) => a.dateMs - b.dateMs);

  // Find unique weeks and sort them
  const uniqueWeeks = [...new Set(runs.map(r => r.week))].sort((a, b) => a - b);
  const weeks = uniqueWeeks.length > 0 ? uniqueWeeks.map(w => `${w}`) : ['No Data'];

  // Initialize zMatrix, textMatrix, and durationsGrid
  const zMatrix = Array(7).fill(0).map(() => Array(weeks.length).fill(null));
  const textMatrix = Array(7).fill('').map(() => Array(weeks.length).fill(''));
  const monthGrid = Array(7).fill(null).map(() => Array(weeks.length).fill(null));
  const durationsGrid = Array.from({ length: 7 }, () => Array.from({ length: weeks.length }, () => []));
  const outliersCountGrid = Array.from({ length: 7 }, () => Array.from({ length: weeks.length }, () => 0));
  const textColorMatrix = Array.from({ length: 7 }, () => Array.from({ length: weeks.length }, () => '#000000'));
  const annotations = [];
  const shapes = [];
  const dateAnnotationsGrid = Array.from({ length: 7 }, () => Array.from({ length: weeks.length }, () => null));

  // Helper for formatting date strings
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Group runs by day and week
  runs.forEach(run => {
    const wIdx = uniqueWeeks.indexOf(run.week);
    if (wIdx !== -1 && run.dayIndex >= 0 && run.dayIndex < 7) {
      durationsGrid[run.dayIndex][wIdx].push(run.durationFormatted);

      if (run.isOutlier) {
        outliersCountGrid[run.dayIndex][wIdx]++;
      }

      if (zMatrix[run.dayIndex][wIdx] === null) {
        zMatrix[run.dayIndex][wIdx] = run.durationMin;

        const dateObj = parseISO(run.date);
        if (!isNaN(dateObj)) {
          monthGrid[run.dayIndex][wIdx] = dateObj.getMonth();
          const dateString = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;
          dateAnnotationsGrid[run.dayIndex][wIdx] = {
            x: wIdx + 0.47,
            y: run.dayIndex - 0.47,
            text: dateString,
          };
        }
      } else {
        zMatrix[run.dayIndex][wIdx] = (zMatrix[run.dayIndex][wIdx] + run.durationMin) / 2;
      }
    }
  });

  // Push date annotations now that outliersCountGrid is fully known, so their color matches the cell text
  for (let d = 0; d < 7; d++) {
    for (let w = 0; w < weeks.length; w++) {
      const dateAnnotation = dateAnnotationsGrid[d][w];
      if (dateAnnotation) {
        const isOutlierCell = outliersCountGrid[d][w] > 0;
        annotations.push({
          x: dateAnnotation.x,
          y: dateAnnotation.y,
          text: dateAnnotation.text,
          showarrow: false,
          font: { size: 10, color: isOutlierCell ? '#ffffff' : '#000000' },
          xanchor: 'right',
          yanchor: 'top',
        });
      }
    }
  }

  // Build textMatrix, count badges, and outlier icons
  for (let w = 0; w < weeks.length; w++) {
    for (let d = 0; d < 7; d++) {
      const cellRuns = durationsGrid[d][w];
      if (cellRuns.length > 0) {
        let cellText = '';
        if (cellRuns.length > 3) {
          cellText = cellRuns.slice(0, 3).join('<br>') + '<br>. . .';
          // Add green circle badge for count - a pixel-sized shape keeps it a true circle
          // regardless of the cell's data-space aspect ratio (bgcolor+borderpad on text
          // produces an oval once the digits' width differs from the font's line height).
          shapes.push({
            type: 'circle',
            xref: 'x',
            yref: 'y',
            xsizemode: 'pixel',
            ysizemode: 'pixel',
            xanchor: w + 0.45,
            yanchor: d + 0.35,
            x0: -7,
            x1: 7,
            y0: -7,
            y1: 7,
            fillcolor: '#16a34a',
            line: { color: '#16a34a' },
          });
          annotations.push({
            x: w + 0.45,
            y: d + 0.35,
            text: `<b>${cellRuns.length}</b>`,
            showarrow: false,
            font: { size: 9, color: 'white' },
            xanchor: 'center',
            yanchor: 'middle',
          });
        } else {
          cellText = cellRuns.join('<br>');
        }

        // Apply white color and ⚠️ if cell has any outliers
        const outlierCount = outliersCountGrid[d][w];
        if (outlierCount > 0) {
          textColorMatrix[d][w] = '#ffffff';
          cellText = `<span style="color: white;">${cellText}</span>`;
          
          annotations.push({
            x: w - 0.47,
            y: d - 0.47,
            text: `⚠️ <b>${outlierCount}</b>`,
            showarrow: false,
            font: { size: 11, color: '#ffffff' },
            xanchor: 'left',
            yanchor: 'top',
          });
        }
        textMatrix[d][w] = cellText;
      }
    }
  }

  // Function to get the first non-null month in a week column
  const getPredominantMonth = (colIdx) => {
    for (let d = 0; d < 7; d++) {
      if (monthGrid[d][colIdx] !== null) return monthGrid[d][colIdx];
    }
    return null;
  };

  for (let w = 1; w < weeks.length; w++) {
    const prevMonth = getPredominantMonth(w - 1);
    const currMonth = getPredominantMonth(w);

    // If the primary month of this week is different from the previous week, draw a straight vertical line
    if (prevMonth !== null && currMonth !== null && prevMonth !== currMonth) {
      shapes.push({
        type: 'line',
        x0: w - 0.5,
        x1: w - 0.5,
        y0: -0.5,
        y1: 6.5, // Covers all 7 days (0 to 6)
        line: { color: themeColor, width: 1.5, dash: 'dash' }
      });
    }
  }

  return {
    weeks,
    days,
    zMatrix,
    data: [
      {
        z: zMatrix,
        x: weeks,
        y: days,
        text: textMatrix,
        texttemplate: '%{text}',
        textfont: { color: textColorMatrix, size: 11 },
        type: 'heatmap',
        colorscale: [
          [0.0, '#fef08a'],
          [0.3, '#fdba74'],
          [0.6, '#ea580c'],
          [1.0, 'var(--c-danger)'],
        ],
        colorbar: {
          title: 'Avg Duration (s)',
          titleside: 'top',
          thickness: 14,
          len: 0.9,
          tickfont: { size: 10, color: themeColor },
        },
        hoverongaps: false,
        hovertemplate: '<b>%{x}</b><br>Day: %{y}<br>Avg Duration: %{z}m<extra></extra>',
      },
    ],
    layout: {
      margin: { t: 25, r: 90, b: 60, l: 50 },
      height: 550,
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: themeColor, size: 11, family: 'Inter, system-ui, sans-serif' },
      xaxis: {
        title: { text: 'ISO Week Number', font: { size: 11, color: themeColor } },
        type: 'category',
        showgrid: false,
        zeroline: false
      },
      yaxis: {
        title: { text: 'Day of Week', font: { size: 11, color: themeColor } },
        autorange: 'reversed',
        showgrid: false,
        zeroline: false
      },
      annotations: annotations,
      shapes: shapes,
    },
  };
}

function getCellExecutionDetails(script, weekLabel, dayLabel) {
  return {
    scriptName: script.name,
    category: script.category,
    week: weekLabel || 'Week 38',
    day: dayLabel || 'Thu',
    date: '2026-02-19',
    avgDuration: '49:39:10',
    totalRuns: 2,
    outliersCount: 1,
    runs: [
      {
        id: `${script.id}-run-1`,
        name: 'Run 1',
        duration: '26:31:51',
        seconds: 95511,
        isOutlier: false,
        steps: [
          { name: 'Checking', dbTime: 1000, cpuTime: 2000 },
          { name: 'Step 1/7 [BACKUP]', dbTime: 13011, cpuTime: 1500 },
          { name: 'Step 2/7 [COMPUTE]', dbTime: 6293, cpuTime: 1200 },
          { name: 'Step 3/7 [TRANSFORM]', dbTime: 7563, cpuTime: 1500 },
          { name: 'Step 4/7 [SORT]', dbTime: 18152, cpuTime: 8125 },
          { name: 'Step 5/7 [OPTIMIZE]', dbTime: 12005, cpuTime: 4329 },
          { name: 'Step 6/7 [JOIN]', dbTime: 6245, cpuTime: 2000 },
          { name: 'Step 7/7 [FINALIZE]', dbTime: 6065, cpuTime: 4523 },
        ],
      },
      {
        id: `${script.id}-run-2`,
        name: 'Run 2',
        duration: '31:09:49',
        seconds: 112189,
        isOutlier: true,
        steps: [
          { name: 'Checking', dbTime: 1500, cpuTime: 2500 },
          { name: 'Step 1/7 [BACKUP]', dbTime: 15011, cpuTime: 2000 },
          { name: 'Step 2/7 [COMPUTE]', dbTime: 8293, cpuTime: 1500 },
          { name: 'Step 3/7 [TRANSFORM]', dbTime: 9563, cpuTime: 1800 },
          { name: 'Step 4/7 [SORT]', dbTime: 21152, cpuTime: 9125 },
          { name: 'Step 5/7 [OPTIMIZE]', dbTime: 14005, cpuTime: 5329 },
          { name: 'Step 6/7 [JOIN]', dbTime: 8245, cpuTime: 2500 },
          { name: 'Step 7/7 [FINALIZE]', dbTime: 7065, cpuTime: 2601 },
        ],
      },
    ],
  };
}

export function getRunGanttSpec(run, themeColor = '#000000') {
  const steps = run.steps.map((s) => s.name);
  steps.push('Total CPU', 'Total DB', 'Total Idle');

  const baseTimes = [];
  const idleTimes = [];
  const dbTimes = [];
  const cpuTimes = [];
  const totalCpuTimes = [];
  const totalDbTimes = [];
  const totalIdleTimes = [];

  let currentStart = 0;
  let totalDb = 0;
  let totalCpu = 0;
  let totalIdle = 0;

  run.steps.forEach(step => {
    const idleTime = step.idleTime || 0;
    baseTimes.push(currentStart);
    idleTimes.push(idleTime);
    dbTimes.push(step.dbTime);
    cpuTimes.push(step.cpuTime);
    totalCpuTimes.push(0);
    totalDbTimes.push(0);
    totalIdleTimes.push(0);

    totalDb += step.dbTime;
    totalCpu += step.cpuTime;
    totalIdle += idleTime;
    // waterfall flows continuously: idle (waiting) happens first, then the
    // step's own active cpu+db work
    currentStart += (idleTime + step.dbTime + step.cpuTime);
  });

  // For Total CPU bar
  baseTimes.push(0);
  idleTimes.push(0);
  dbTimes.push(0);
  cpuTimes.push(0);
  totalCpuTimes.push(totalCpu);
  totalDbTimes.push(0);
  totalIdleTimes.push(0);

  // For Total DB bar
  baseTimes.push(0);
  idleTimes.push(0);
  dbTimes.push(0);
  cpuTimes.push(0);
  totalCpuTimes.push(0);
  totalDbTimes.push(totalDb);
  totalIdleTimes.push(0);

  // For Total Idle bar
  baseTimes.push(0);
  idleTimes.push(0);
  dbTimes.push(0);
  cpuTimes.push(0);
  totalCpuTimes.push(0);
  totalDbTimes.push(0);
  totalIdleTimes.push(totalIdle);

  const formatNum = (num) => num > 0 ? num.toLocaleString() + 's' : '';

  return {
    data: [
      {
        x: steps,
        y: baseTimes,
        type: 'bar',
        marker: { color: 'rgba(0,0,0,0)' },
        hoverinfo: 'none',
        showlegend: false,
      },
      {
        x: steps,
        y: idleTimes,
        name: 'Idle / Wait',
        type: 'bar',
        marker: { color: '#cbd5e1' }, // light slate, matches Overview tab's idle color
        textposition: 'none',
        hovertemplate: '<b>%{x}</b><br>Idle / Wait: %{y}s<extra></extra>',
      },
      {
        x: steps,
        y: dbTimes,
        name: 'Database Time',
        type: 'bar',
        marker: { color: '#5c8aea' }, // cornflower blue
        textposition: 'none',
        hovertemplate: '<b>%{x}</b><br>Database Time: %{y}s<extra></extra>',
      },
      {
        x: steps,
        y: cpuTimes,
        name: 'CPU Time',
        type: 'bar',
        marker: { color: '#637081' }, // slate gray
        textposition: 'none',
        hovertemplate: '<b>%{x}</b><br>CPU Time: %{y}s<extra></extra>',
      },
      {
        x: steps,
        y: totalCpuTimes,
        name: 'Total CPU Time',
        type: 'bar',
        marker: { color: '#637081' },
        textposition: 'none',
        hovertemplate: '<b>%{x}</b><br>Total CPU Time: %{y}s<extra></extra>',
      },
      {
        x: steps,
        y: totalDbTimes,
        name: 'Total DB Time',
        type: 'bar',
        marker: { color: '#5c8aea' },
        textposition: 'none',
        hovertemplate: '<b>%{x}</b><br>Total DB Time: %{y}s<extra></extra>',
      },
      {
        x: steps,
        y: totalIdleTimes,
        name: 'Total Idle Time',
        type: 'bar',
        marker: { color: '#cbd5e1' },
        textposition: 'none',
        hovertemplate: '<b>%{x}</b><br>Total Idle Time: %{y}s<extra></extra>',
      },
    ],
    layout: {
      barmode: 'stack',
      margin: { t: 40, r: 20, b: 80, l: 80 },
      height: 400,
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: themeColor, size: 10 },
      yaxis: { title: { text: 'Time (s)', font: { size: 10 } }, tickformat: ',' },
      xaxis: { tickangle: 35, automargin: true },
      showlegend: true,
      legend: { orientation: 'h', y: 1.15, x: 0.5, xanchor: 'center' }
    },
  };
}

/** Murex batch runtime trends, heatmaps and per-script health. */

/* ── Overview Skeleton Layout ───────────────────────────────────────────── */
function OverviewSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Date picker skeleton (centered) */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <Skeleton height={36} width={160} style={{ borderRadius: '6px' }} />
      </div>

      {/* Main card skeleton */}
      <div style={{ background: 'var(--surface-primary)', border: '1px solid var(--border-secondary)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {/* Header Title + Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Skeleton height={24} width={250} />
          <Skeleton height={24} width={80} style={{ borderRadius: '12px' }} />
        </div>

        {/* 4 Stats Cards Row */}
        <div style={{ display: 'flex', border: '1px solid var(--border-primary)', borderRadius: '8px', overflow: 'hidden', background: 'var(--surface-secondary)' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ flex: 1, padding: '16px', borderRight: i < 3 ? '1px solid var(--border-primary)' : 'none', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Skeleton height={32} width={32} style={{ borderRadius: '8px' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <Skeleton height={12} width="40%" />
                <Skeleton height={16} width="70%" />
              </div>
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <div>
           <Skeleton height={36} width={280} style={{ borderRadius: '6px' }} />
        </div>

        {/* Gantt Chart Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--border-secondary)', paddingBottom: '12px' }}>
             <Skeleton height={14} width="15%" />
             <Skeleton height={14} width="40%" />
             <div style={{ display: 'flex', gap: '24px', width: '35%', justifyContent: 'flex-end' }}>
               <Skeleton height={14} width="25%" />
               <Skeleton height={14} width="25%" />
               <Skeleton height={14} width="25%" />
             </div>
          </div>
          {/* Data Rows */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' }}>
              <Skeleton height={16} width="20%" />
              <div style={{ width: '40%', padding: '0 24px' }}>
                <Skeleton height={8} width={`${40 + (i * 10 % 50)}%`} style={{ marginLeft: `${(i * 15) % 30}%`, borderRadius: '4px' }} />
              </div>
              <div style={{ display: 'flex', gap: '24px', width: '35%', justifyContent: 'flex-end' }}>
                <Skeleton height={16} width="25%" />
                <Skeleton height={16} width="25%" />
                <Skeleton height={16} width="25%" />
              </div>
            </div>
          ))}
          {/* Footer total row */}
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '2px solid var(--border-secondary)' }}>
             <Skeleton height={18} width="20%" />
             <div style={{ width: '40%', padding: '0 24px' }}>
                <Skeleton height={8} width="100%" style={{ borderRadius: '4px' }} />
             </div>
             <div style={{ display: 'flex', justifyContent: 'flex-end', width: '35%' }}>
                <Skeleton height={20} width="40%" />
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}

/* ── Dynamic Skeleton Layout ────────────────────────────────────────────── */
function TrendsSkeleton() {
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Filter Bar Skeleton */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Skeleton height={32} width={200} style={{ borderRadius: '6px' }} />
          <Skeleton height={20} width={120} />
          <Skeleton height={32} width={80} style={{ borderRadius: '6px' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Skeleton height={32} width={120} style={{ borderRadius: '6px' }} />
        </div>
      </div>

      {/* Vertical Stack of Job Card Skeletons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ background: 'var(--surface-primary)', border: '1px solid var(--border-secondary)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            {/* Job Card Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton height={20} width={20} />
                <Skeleton height={20} width={150} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton height={24} width={120} style={{ borderRadius: '12px' }} />
                <Skeleton height={24} width={70} style={{ borderRadius: '12px' }} />
                <Skeleton height={24} width={24} />
              </div>
            </div>
            
            {/* KPI Row */}
            <div style={{ display: 'flex', padding: '16px 20px', gap: '24px', alignItems: 'center', background: 'var(--surface-secondary)' }}>
              {Array.from({ length: 7 }).map((_, j) => (
                <div key={j} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', borderRight: j < 6 ? '1px solid var(--border-primary)' : 'none', paddingRight: j < 6 ? '24px' : '0' }}>
                  <Skeleton height={12} width="60%" />
                  <Skeleton height={16} width="80%" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Management Tab Skeleton ───────────────────────────────────────────── */
function ManagementSkeleton() {
  return (
    <div className="murex-management-tab">
      {/* Category sidebar skeleton */}
      <div className="murex-category-sidebar">
        <div className="murex-category-search" style={{ pointerEvents: 'none' }}>
          <Search size={12} />
          <Skeleton height={28} width="100%" />
        </div>
        <div className="murex-category-list">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ padding: '8px 12px' }}>
              <Skeleton height={20} width={`${70 - i * 5}%`} />
            </div>
          ))}
        </div>
      </div>
      {/* Script table skeleton */}
      <div className="murex-script-table-section">
        <div className="murex-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton height={20} width={120} />
          <Skeleton height={32} width={200} />
        </div>
        <div className="murex-script-table-container">
          <table className="murex-script-table">
            <thead className="murex-script-thead">
              <tr>
                <th className="murex-script-th">Script Name</th>
                <th className="murex-script-th">Category</th>
                <th className="murex-script-th">Last Run</th>
                <th className="murex-script-th">Status</th>
                <th className="murex-script-th actions-col">Actions</th>
              </tr>
            </thead>
            <tbody className="murex-script-tbody">
              {Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="murex-script-row">
                  <td className="murex-script-td"><Skeleton height={18} width="80%" /></td>
                  <td className="murex-script-td"><Skeleton height={22} width={80} style={{ borderRadius: '12px' }} /></td>
                  <td className="murex-script-td"><Skeleton height={18} width="60%" /></td>
                  <td className="murex-script-td"><Skeleton height={22} width={60} style={{ borderRadius: '12px' }} /></td>
                  <td className="murex-script-td actions-col"><Skeleton height={18} width={24} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function MurexRuntimeTrendsPage() {
  useDocumentTitle('Murex Runtime Trends');
  const themeColor = useChartThemeColor();
  const { hasPermission } = useAuth();
  const canCreateCategory = hasPermission('MUREX_SCRIPT_CATEGORY_CREATE');
  const canEditCategory = hasPermission('MUREX_SCRIPT_CATEGORY_EDIT');
  const canDeleteCategory = hasPermission('MUREX_SCRIPT_CATEGORY_DELETE');

  const [timeRange, setTimeRange] = useState('7d'); // Default selected timeframe: 7d

  const fetchTrends = useCallback(() => murexService.getRuntimeTrends(timeRange), [timeRange]);
  const { data, isLoading, error, refetch } = useAsync(fetchTrends);

  const isFirstRender = useRef(true);
  useEffect(() => {
    setScriptDetailsMap({});
    setExpandedScriptIds(new Set());
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    refetch();
  }, [timeRange, refetch]);

  const runtimeSummary = data?.summary;
  const runtimeTrendData = data?.trend ?? [];

  /**
   * Pinning is a client-side preference layered over the loaded scripts, so it
   * survives a refetch without the service needing to persist it.
   */
  const [pinnedScriptIds, setPinnedScriptIds] = useState(() => new Set());

  // Category Management State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormDescription, setCategoryFormDescription] = useState('');
  const [categoryFormScripts, setCategoryFormScripts] = useState([]); // Array of script names
  const [availableSearch, setAvailableSearch] = useState('');
  const debouncedAvailableSearch = useDebounce(availableSearch, 500);
  const [categorySearch, setCategorySearch] = useState('');
  const debouncedCategorySearch = useDebounce(categorySearch, 500);

  const [remoteCategoriesData, setRemoteCategoriesData] = useState([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(true);

  const fetchCategories = useCallback(async () => {
    setIsLoadingCategories(true);
    try {
      const data = await murexService.getCategories();
      setRemoteCategoriesData(data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    } finally {
      setIsLoadingCategories(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const remoteCategories = Array.isArray(remoteCategoriesData) ? remoteCategoriesData : [];
  const filteredCategories = useMemo(() => {
    if (!debouncedCategorySearch.trim()) return remoteCategories;
    const q = debouncedCategorySearch.toLowerCase();
    return remoteCategories.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [remoteCategories, debouncedCategorySearch]);

  const scripts = useMemo(
    () =>
      (data?.scripts ?? []).map((script) => {
        // Find explicit remote category that contains this script
        const matchingCategory = remoteCategories.find(c =>
          c.scripts && c.scripts.some(s => s.script_name === script.name)
        );
        return {
          ...script,
          category: matchingCategory ? matchingCategory.name : 'Unassigned Scripts',
          isPinned: pinnedScriptIds.has(script.id),
        };
      }),
    [data, pinnedScriptIds, remoteCategories],
  );

  const managementScripts = useMemo(() => {
    const scriptsMap = new Map();
    remoteCategories.forEach(cat => {
      (cat.scripts || []).forEach(s => {
        if (!scriptsMap.has(s.script_name)) {
          // last_run/status come straight from the Script model (populated
          // by _sync_scripts() on runtime-file upload) - null/blank here
          // means this script has never appeared in an uploaded runtime
          // file, not that the API failed to return it.
          scriptsMap.set(s.script_name, {
            id: s.script_name,
            name: s.script_name,
            category: cat.name || 'Unassigned Scripts',
            isPinned: pinnedScriptIds.has(s.script_name),
            lastRun: formatLastRun(s.last_run),
            status: s.status || 'N/A',
            health: 'Unknown',
            trendSlope: 0,
            totalExecutions: 0,
            minRuntimeFormatted: 'N/A',
            maxRuntimeFormatted: 'N/A',
            p95DurationFormatted: 'N/A',
          });
        }
      });
    });
    return Array.from(scriptsMap.values());
  }, [remoteCategories, pinnedScriptIds]);

  const [activeTab, setActiveTab] = useState('overview');

  const [filterScriptName, setFilterScriptName] = useState('All');
  const [filterRuntimeChecked, setFilterRuntimeChecked] = useState(true);
  const [filterRuntimeType, setFilterRuntimeType] = useState('Min vs Max');
  const [filterRuntimeOperator, setFilterRuntimeOperator] = useState('>');
  const [filterRuntimeValue, setFilterRuntimeValue] = useState('1');
  const [filterRuntimeUnit, setFilterRuntimeUnit] = useState('Minute');

  const handleResetFilters = () => {
    setFilterScriptName('All');
    setFilterRuntimeChecked(true);
    setFilterRuntimeType('Min vs Max');
    setFilterRuntimeOperator('>');
    setFilterRuntimeValue('1');
    setFilterRuntimeUnit('Minute');
    setTimeRange('7d');
  };

  const selectedScript = scripts.length > 0 ? scripts[0].id : '';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [scriptFilter, setScriptFilter] = useState('');
  const [showScriptDetail, setShowScriptDetail] = useState(false);
  const [detailScript, setDetailScript] = useState(null);
  const [expandedScriptIds, setExpandedScriptIds] = useState(() => new Set());
  const [scriptDetailsMap, setScriptDetailsMap] = useState({});
  const [loadingScriptIds, setLoadingScriptIds] = useState(() => new Set());
  const [selectedCellDetails, setSelectedCellDetails] = useState(null);
  const [expandedRunGanttIds, setExpandedRunGanttIds] = useState(() => new Set());
  const heatmapRefs = useRef({});

  const handleDownloadHeatmap = useCallback((scriptId, scriptName) => {
    const node = heatmapRefs.current[scriptId];
    if (!node || !window.Plotly) return;
    window.Plotly.downloadImage(node, {
      format: 'png',
      filename: `${scriptName}-runtime-heatmap`,
      scale: 2,
    });
  }, []);
  const [isGanttLoading, setIsGanttLoading] = useState(false);

  const toggleExpandScript = async (scriptId, e) => {
    e?.stopPropagation();

    setExpandedScriptIds((prev) => {
      const next = new Set(prev);
      if (next.has(scriptId)) {
        next.delete(scriptId);
      } else {
        next.add(scriptId);
      }
      return next;
    });

    if (!scriptDetailsMap[scriptId] && !loadingScriptIds.has(scriptId)) {
      setLoadingScriptIds(prev => new Set(prev).add(scriptId));
      try {
        const details = await murexService.fetchScriptTimeseries(scriptId);
        setScriptDetailsMap(prev => ({
          ...prev,
          [scriptId]: details
        }));
      } catch (err) {
        console.error("Failed to fetch script details:", err);
      } finally {
        setLoadingScriptIds(prev => {
          const next = new Set(prev);
          next.delete(scriptId);
          return next;
        });
      }
    }
  };

  const toggleRunGantt = (runId) => {
    setExpandedRunGanttIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId);
      else next.add(runId);
      return next;
    });
  };

  const handleHeatmapCellClick = async (script, eventData) => {
    if (eventData?.points?.[0]) {
      const pt = eventData.points[0];
      const details = getCellExecutionDetails(script, pt.x, pt.y);
      setSelectedCellDetails({ ...details, scriptObj: script });
      setExpandedRunGanttIds(new Set());
      setIsGanttLoading(true);

      // Find the exact date corresponding to this cell
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const ptDayIndex = days.indexOf(pt.y);
      const ptWeek = parseInt(pt.x, 10);

      const matchingRun = (script.history || []).find(run => {
        if (!run.date || run.date === 'Unknown Date') return false;
        const dateObj = parseISO(run.date);
        if (isNaN(dateObj)) return false;
        const week = getISOWeek(dateObj);
        const jsDay = getDay(dateObj);
        const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
        return week === ptWeek && dayIndex === ptDayIndex;
      });

      if (matchingRun) {
        // Dispatch payload to backend with exact date label
        const payload = { script_name: script.name, label: matchingRun.date };
        try {
          const response = await murexService.fetchRuntimeDetails(payload);
          const processData = response.data?.[script.name];
          if (processData && processData.labels && processData.steps) {
            const allDurations = processData.time_duration || [];
            // Must match the outlier rule used to build script.history in murexService.js
            // (runDurationMin > avgRuntimeMin * 2), otherwise the per-run "Outlier" flags here
            // won't agree with the "⚠️ count" badge shown on the heatmap cell.
            let overallAvgSecs = 0;
            if (script.history && script.history.length > 0) {
              const totalMins = script.history.reduce((acc, h) => acc + (h.durationMin || 0), 0);
              overallAvgSecs = (totalMins / script.history.length) * 60;
            } else {
              overallAvgSecs = allDurations.length ? allDurations.reduce((a, b) => a + b, 0) / allDurations.length : 0;
            }
            const outlierThreshold = overallAvgSecs * 2;

            const runs = processData.labels.map((label, index) => {
              const stepsData = processData.steps[index];
              const formatDuration = (secs) => {
                const h = Math.floor(secs / 3600).toString().padStart(2, '0');
                const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
                const s = Math.floor(secs % 60).toString().padStart(2, '0');
                return `${h}:${m}:${s}`;
              };
              
              const currentRunSecs = processData.time_duration[index] || 0;

              return {
                id: `${script.id}-run-${index}`,
                name: `Run ${index + 1} (${label})`,
                duration: formatDuration(currentRunSecs),
                seconds: currentRunSecs,
                isOutlier: currentRunSecs > outlierThreshold,
                steps: stepsData.step.map((stepName, stepIndex) => ({
                  name: stepName,
                  dbTime: stepsData.db_time[stepIndex],
                  cpuTime: stepsData.cpu_time[stepIndex],
                  elapsed: stepsData.elapsed_time[stepIndex],
                  idleTime: stepsData.idle_time?.[stepIndex] ?? 0,
                  startTs: stepsData.date_time_cmp?.[stepIndex] ?? null,
                  endTs: stepsData.finished_time?.[stepIndex] ?? null,
                }))
              };
            });

            setSelectedCellDetails({
              ...details,
              scriptObj: script,
              date: matchingRun.date,
              totalRuns: runs.length,
              avgDuration: runs.length > 0
                ? new Date((runs.reduce((acc, r) => acc + r.seconds, 0) / runs.length) * 1000).toISOString().substr(11, 8)
                : '00:00:00',
              outliersCount: runs.filter(r => r.isOutlier).length,
              runs: runs
            });
          }
        } catch (err) {
          console.error("Failed to fetch exact run details:", err);
        } finally {
          setIsGanttLoading(false);
        }
      } else {
        setIsGanttLoading(false);
      }
    }
  };
  const categoryCounts = {
    ETL: scripts.filter((s) => s.category === 'ETL').length,
    Backup: scripts.filter((s) => s.category === 'Backup').length,
    'Alert Check': scripts.filter((s) => s.category === 'Alert Check').length,
    Cleanup: scripts.filter((s) => s.category === 'Cleanup').length,
    'Data Sync': scripts.filter((s) => s.category === 'Data Sync').length,
  };
  const filteredScripts = scripts
    .filter((s) => selectedCategory === 'all' || s.category === selectedCategory)
    .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

  const filteredManagementScripts = managementScripts
    .filter((s) => selectedCategory === 'all' || s.category === selectedCategory)
    .filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

  const selectedScriptData = scripts.find((s) => s.id === selectedScript);
  const togglePin = (scriptId) => {
    setPinnedScriptIds((current) => {
      const next = new Set(current);
      if (next.has(scriptId)) {
        next.delete(scriptId);
      } else {
        next.add(scriptId);
      }
      return next;
    });
  };

  const handleAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormName('');
    setCategoryFormDescription('');
    setCategoryFormScripts([]);
    setAvailableSearch('');
    setCategorySearch('');
    setShowCategoryModal(true);
  };

  const handleEditCategory = (cat, e) => {
    e.stopPropagation();
    setEditingCategory(cat);
    setCategoryFormName(cat.name);
    setCategoryFormDescription(cat.description || '');
    setCategoryFormScripts((cat.scripts || []).map(s => s.script_name));
    setAvailableSearch('');
    setCategorySearch('');
    setShowCategoryModal(true);
  };

  const allKnownScripts = useMemo(() => {
    const unassigned = remoteCategories.find(c => c.id === null)?.scripts || [];
    const currentCatScripts = editingCategory?.scripts || [];
    return [...unassigned, ...currentCatScripts];
  }, [remoteCategories, editingCategory]);

  const renderedAvailableScripts = allKnownScripts
    .filter(s => !categoryFormScripts.includes(s.script_name))
    .filter(s => s.script_name.toLowerCase().includes(debouncedAvailableSearch.toLowerCase()));

  const renderedAssignedScripts = allKnownScripts
    .filter(s => categoryFormScripts.includes(s.script_name))
    .filter(s => s.script_name.toLowerCase().includes(debouncedCategorySearch.toLowerCase()));

  const toggleScriptAssignment = (scriptName, assign) => {
    if (assign) {
      setCategoryFormScripts(prev => [...prev, scriptName]);
    } else {
      setCategoryFormScripts(prev => prev.filter(name => name !== scriptName));
    }
  };



  const [deletingCategory, setDeletingCategory] = useState(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const handleDeleteCategory = (cat, e) => {
    e.stopPropagation();
    setDeletingCategory(cat);
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsDeletingCategory(true);
    try {
      const res = await murexService.deleteCategory(deletingCategory.id);
      if (res?.categories) {
        setRemoteCategoriesData(res.categories);
      } else {
        fetchCategories();
      }
      if (selectedCategory === deletingCategory.name) {
        setSelectedCategory('all');
      }
    } catch (err) {
      console.error('Failed to delete category', err);
    } finally {
      setIsDeletingCategory(false);
      setDeletingCategory(null);
    }
  };

  const handleSaveCategory = async () => {
    if (!categoryFormName.trim()) return;
    setIsSavingCategory(true);
    try {
      const originalScripts = (editingCategory?.scripts || []).map(s => s.script_name);

      const payload = {
        name: categoryFormName.trim(),
        description: categoryFormDescription.trim(),
        assign_scripts: categoryFormScripts.filter(name => !originalScripts.includes(name)),
        unassign_scripts: originalScripts.filter(name => !categoryFormScripts.includes(name))
      };

      let res;
      if (editingCategory) {
        res = await murexService.updateCategory(editingCategory.id, payload);
      } else {
        res = await murexService.createCategory(payload);
      }

      if (res?.categories) {
        setRemoteCategoriesData(res.categories);
      } else {
        fetchCategories();
      }
      setShowCategoryModal(false);
    } catch (err) {
      console.error('Failed to save category', err);
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleAssignScriptDirectly = async (scriptName, targetCategory) => {
    if (!targetCategory || targetCategory.id === null) return;
    try {
      const payload = {
        name: targetCategory.name,
        description: targetCategory.description || '',
        assign_scripts: [scriptName],
        unassign_scripts: []
      };
      const res = await murexService.updateCategory(targetCategory.id, payload);
      if (res?.categories) {
        setRemoteCategoriesData(res.categories);
      } else {
        fetchCategories();
      }
    } catch (err) {
      console.error('Failed to assign script to category', err);
    }
  };

  const openScriptDetail = (script) => {
    setDetailScript(script);
    setShowScriptDetail(true);
  };
  const getCategoryColor = (category) => {
    const colors = {
      ETL: 'var(--c-info)',
      Backup: 'var(--c-success)',
      'Alert Check': 'var(--c-warning)',
      Cleanup: '#8b5cf6',
      'Data Sync': '#06b6d4',
    };
    return colors[category];
  };
  const getHealthColor = (health) => {
    const colors = {
      Healthy: 'var(--c-success)',
      Warning: 'var(--c-warning)',
      Critical: 'var(--c-danger)',
    };
    return colors[health];
  };
  const getHeatmapColor = (runtime) => {
    if (runtime === 0) return 'var(--bg-tertiary)';
    if (runtime < 50) return '#dbeafe';
    if (runtime < 80) return '#93c5fd';
    if (runtime < 100) return 'var(--c-info)';
    return '#1e40af';
  };
  const getMonthlyHeatmapColor = (executions) => {
    if (executions === 0) return 'var(--bg-tertiary)';
    if (executions < 5) return '#dbeafe';
    if (executions < 10) return '#93c5fd';
    if (executions < 12) return 'var(--c-info)';
    return '#1e40af';
  };
  const formatMinutes = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };
  return (
    <div className="murex-runtime-page">

      {/* Tabs */}
      <div className="murex-tabs">
        <div
          className={`murex-tab ${activeTab === 'overview' ? 'active' : ''}`}
          data-active={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
        >
          <BarChart3 className="murex-tab-icon" />
          <span className="murex-tab-label">Overview</span>
        </div>
        <div
          className={`murex-tab ${activeTab === 'runtime' ? 'active' : ''}`}
          data-active={activeTab === 'runtime'}
          onClick={() => setActiveTab('runtime')}
        >
          <Clock className="murex-tab-icon" />
          <span className="murex-tab-label">Runtime Trends</span>
        </div>
        <div
          className={`murex-tab ${activeTab === 'management' ? 'active' : ''}`}
          data-active={activeTab === 'management'}
          onClick={() => setActiveTab('management')}
        >
          <SlidersHorizontal className="murex-tab-icon" />
          <span className="murex-tab-label">Script Management</span>
        </div>
      </div>

      {/* Tab Content */}
      <div className="murex-tab-content">
        {error ? (
          <ErrorState
            title="Runtime trends could not be loaded"
            description={error.message}
            onRetry={refetch}
          />
        ) : (
          <>
        {activeTab === 'overview' && (
          isLoading || !runtimeSummary ? <OverviewSkeleton /> : <MurexOverviewTab />
        )}
        {activeTab === 'runtime' && (
          isLoading || !runtimeSummary ? <TrendsSkeleton /> : (
          <div className="murex-runtime-tab">
            {/* Unified Compact Filter Bar */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              background: 'var(--surface-primary, #ffffff)',
              border: '1px solid var(--border-primary, #e5e7eb)',
              borderRadius: '8px',
              gap: '12px',
              marginBottom: '14px',
              flexWrap: 'nowrap',
              overflowX: 'auto'
            }}>
              {/* Left Controls Group */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'nowrap' }}>
                {/* Element 1: Script Names Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #4b5563)' }}>
                    Filter by ScriptNames:
                  </span>
                  <select
                    value={filterScriptName}
                    onChange={(e) => setFilterScriptName(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-primary, #d1d5db)',
                      background: 'var(--bg-primary, #ffffff)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="All">All</option>
                    {scripts.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <span style={{
                    background: '#d1fae5',
                    color: '#065f46',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 700
                  }}>
                    {scripts.filter(script => filterScriptName === 'All' || script.name === filterScriptName).length}
                  </span>
                </div>

                {/* Element 2: Runtime Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  <input
                    type="checkbox"
                    checked={filterRuntimeChecked}
                    onChange={(e) => setFilterRuntimeChecked(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary, #4b5563)' }}>
                    Filter by Runtime:
                  </span>
                  <select
                    value={filterRuntimeType}
                    onChange={(e) => setFilterRuntimeType(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-primary, #d1d5db)',
                      background: 'var(--bg-primary, #ffffff)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Min vs Max">Min vs Max</option>
                    <option value="Average">Average</option>
                  </select>
                  <select
                    value={filterRuntimeOperator}
                    onChange={(e) => setFilterRuntimeOperator(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-primary, #d1d5db)',
                      background: 'var(--bg-primary, #ffffff)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value="=">=</option>
                  </select>
                  <input
                    type="number"
                    value={filterRuntimeValue}
                    onChange={(e) => setFilterRuntimeValue(e.target.value)}
                    style={{
                      width: '45px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-primary, #d1d5db)',
                      background: 'var(--bg-primary, #ffffff)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      textAlign: 'center'
                    }}
                  />
                  <select
                    value={filterRuntimeUnit}
                    onChange={(e) => setFilterRuntimeUnit(e.target.value)}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-primary, #d1d5db)',
                      background: 'var(--bg-primary, #ffffff)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Minute">Minute</option>
                    <option value="Second">Second</option>
                    <option value="Hour">Hour</option>
                  </select>
                </div>

                {/* Element 3: Reset Button */}
                <ResetButton
                  onClick={handleResetFilters}
                  style={{ height: '24px' }}
                />
              </div>

              {/* Right Timeframe Pills */}
              <div style={{
                display: 'flex',
                background: 'var(--bg-tertiary, #f3f4f6)',
                borderRadius: '6px',
                padding: '2px',
                gap: '2px',
                flexShrink: 0
              }}>
                {['7d', '15d', '30d'].map((range) => {
                  const isActive = timeRange === range;
                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setTimeRange(range)}
                      style={{
                        padding: '3px 10px',
                        border: 'none',
                        background: isActive ? 'var(--surface-primary, #ffffff)' : 'transparent',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        color: isActive ? ' var(--c-primary)' : 'var(--text-secondary, #4b5563)',
                        cursor: 'pointer',
                        boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.12s ease'
                      }}
                    >
                      {range}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Per-Job Unified Cards */}
            <div className="murex-job-cards-list">
              {(() => {
                const overviewFilteredScripts = scripts.filter(script => filterScriptName === 'All' || script.name === filterScriptName);
                return (
                  <>
                    {overviewFilteredScripts.map((script) => (
                      <JobCard
                        key={`${script.id}-${timeRange}`}
                        script={script}
                        timeRange={timeRange}
                        onOpenDetail={openScriptDetail}
                        onTogglePin={togglePin}
                      />
                    ))}
                    {overviewFilteredScripts.length === 0 && (
                      <div className="murex-empty-state" style={{ padding: '40px 0' }}>
                        <BarChart3 size={28} style={{ opacity: 0.3 }} />
                        <p>No runtime data available</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ))}
        {activeTab === 'management' && (
          isLoading || isLoadingCategories ? <ManagementSkeleton /> : (
          <div className="murex-management-tab">
            {/* Left Sidebar - Categories */}
            <div className="murex-category-sidebar">
              <div className="murex-category-search">
                <Search size={12} />
                <input
                  type="text"
                  placeholder="Search category..."
                  className="murex-category-search-input"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                />
                {categorySearch && (
                  <button type="button" className="search-clear-btn" onClick={() => setCategorySearch('')} style={{ padding: 0 }}>
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="murex-category-list">
                {(!debouncedCategorySearch.trim() || 'all scripts'.includes(debouncedCategorySearch.toLowerCase())) && (
                  <button
                    className={`murex-category-item ${selectedCategory === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedCategory('all')}
                  >
                    <span className="murex-category-name">All Scripts</span>
                    <span className="murex-category-count">{managementScripts.length}</span>
                  </button>
                )}

                {filteredCategories.map((category) => (
                  <div
                    key={category.id}
                    className="murex-category-item-wrapper"
                    style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}
                    onDragOver={(e) => {
                      if (category.id !== null && canEditCategory) e.preventDefault();
                    }}
                    onDragEnter={(e) => {
                      if (category.id !== null && canEditCategory) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!canEditCategory) return;
                      const scriptName = e.dataTransfer.getData('text/plain');
                      if (scriptName && category.id !== null) {
                        handleAssignScriptDirectly(scriptName, category);
                      }
                    }}
                  >
                    <button
                      className={`murex-category-item ${selectedCategory === category.name ? 'active' : ''}`}
                      onClick={() => setSelectedCategory(category.name)}
                      style={{ borderLeft: `3px solid ${getCategoryColor(category.name) || 'var(--primary-color)'}`, flex: 1 }}
                    >
                      <span className="murex-category-name">{category.name}</span>
                      <span className="murex-category-count">
                        {managementScripts.filter((s) => s.category === category.name).length}
                      </span>
                    </button>
                    {category.id !== null && (canEditCategory || canDeleteCategory) && (
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                        {canEditCategory && (
                          <button
                            className="murex-icon-btn"
                            title="Edit Category"
                            onClick={(e) => handleEditCategory(category, e)}
                          >
                            <Edit size={12} />
                          </button>
                        )}
                        {canDeleteCategory && (
                          <button
                            className="murex-icon-btn error"
                            title="Delete Category"
                            onClick={(e) => handleDeleteCategory(category, e)}
                            style={{ color: 'var(--error-color)' }}
                          >
                            <Trash size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {filteredCategories.length === 0 && (!debouncedCategorySearch.trim() || !'all scripts'.includes(debouncedCategorySearch.toLowerCase())) && (
                  <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                    No categories found.
                  </div>
                )}
              </div>

              {canCreateCategory && (
                <button
                  className="murex-add-category-btn"
                  onClick={handleAddCategory}
                  style={{ backgroundColor: '#006633', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}
                >
                  <Plus size={14} />
                  <span>Add Category</span>
                </button>
              )}
            </div>

            {/* Main Script Table */}
            <div className="murex-script-table-section">
              <div className="murex-table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Scripts <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: 500 }}>({filteredManagementScripts.length})</span>
                </div>
                <div className="murex-search-wrapper">
                  <Search size={12} className="murex-search-icon" />
                  <input
                    type="text"
                    placeholder="Search scripts..."
                    className="murex-search-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingRight: '32px' }} />
                  {searchQuery && (
                    <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div className="murex-script-table-container">
                <table className="murex-script-table">
                  <thead className="murex-script-thead">
                    <tr>
                      <th className="murex-script-th">Script Name</th>
                      <th className="murex-script-th">Category</th>
                      <th className="murex-script-th">Last Run</th>
                      <th className="murex-script-th">Status</th>
                      <th className="murex-script-th actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="murex-script-tbody">
                    {filteredManagementScripts.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-tertiary)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <Activity size={32} style={{ opacity: 0.3 }} />
                            <p style={{ fontSize: '14px', margin: 0 }}>No scripts found for the selected time range or category.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredManagementScripts.map((script) => {
                        const isExpanded = expandedScriptIds.has(script.id);
                        const isLoading = loadingScriptIds.has(script.id);
                        const scriptWithDetails = { ...script, ...(scriptDetailsMap[script.id] || {}) };
                        const spec = getScriptHeatmapSpec(scriptWithDetails, themeColor);
                        return (
                          <Fragment key={script.id}>
                            <tr
                              className={`murex-script-row ${isExpanded ? 'expanded' : ''} ${script.status.toLowerCase() === 'inactive' ? 'inactive-row' : ''}`}
                              onClick={(e) => {
                                if (script.status.toLowerCase() !== 'inactive') {
                                  toggleExpandScript(script.id, e);
                                }
                              }}
                              style={{ cursor: script.status.toLowerCase() === 'inactive' ? 'grab' : 'pointer' }}
                              draggable
                              onDragStart={(e) => e.dataTransfer.setData('text/plain', script.name)}
                            >
                              <td className="murex-script-td">
                                <div className="murex-script-name-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <button
                                    className={`murex-icon-btn ${script.isPinned ? 'active' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePin(script.id);
                                    }}
                                    title={script.isPinned ? "Unpin Script" : "Pin Script"}
                                    style={{ padding: 0, margin: 0, height: 'auto', border: 'none', background: 'transparent' }}
                                  >
                                    <Pin size={14} style={{ fill: script.isPinned ? 'currentColor' : 'none' }} />
                                  </button>
                                  <span>{script.name}</span>
                                </div>
                              </td>
                              <td className="murex-script-td">
                                <span
                                  className="murex-category-tag"
                                  style={{ background: getCategoryColor(script.category) }}
                                >
                                  {script.category}
                                </span>
                              </td>
                              <td className="murex-script-td">{script.lastRun}</td>
                              <td className="murex-script-td">
                                <span className={`murex-status-badge ${script.status.toLowerCase()}`}>
                                  {script.status}
                                </span>
                              </td>
                              <td className="murex-script-td actions-col">
                                <div className="murex-script-actions">
                                  <button
                                    className="murex-icon-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (script.status.toLowerCase() !== 'inactive') {
                                        toggleExpandScript(script.id, e);
                                      }
                                    }}
                                    disabled={script.status.toLowerCase() === 'inactive'}
                                    style={{
                                      opacity: script.status.toLowerCase() === 'inactive' ? 0.3 : 1,
                                      cursor: script.status.toLowerCase() === 'inactive' ? 'not-allowed' : 'pointer'
                                    }}
                                    title={script.status.toLowerCase() === 'inactive' ? "Cannot view details for inactive scripts" : (isExpanded ? "Collapse Details" : "View Details")}
                                  >
                                    <CiPlay1
                                      size={16}
                                      style={{
                                        color: 'var(--primary-color)',
                                        transition: 'transform 0.3s ease',
                                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                      }}
                                    />
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {/* Expanded Child Row — Master-Detail Heatmap Accordion */}
                            {isExpanded && (
                              <tr className="murex-script-detail-row">
                                <td colSpan={5}>
                                  <div className="murex-detail-accordion-content">
                                    <div className="murex-detail-accordion-header">
                                      <div>
                                        <h4 className="murex-detail-title">
                                          <Activity size={14} style={{ color: '#005A36' }} />
                                          Runtime Heatmap & Execution Pattern — {script.name}
                                        </h4>
                                        <span className="murex-detail-subtitle">
                                          Click any date cell on the heatmap to view detailed execution runs & Gantt charts
                                        </span>
                                      </div>
                                      {!isLoading && (
                                        <button
                                          type="button"
                                          className="murex-heatmap-download-btn"
                                          onClick={() => handleDownloadHeatmap(script.id, script.name)}
                                          title="Download heatmap as PNG"
                                        >
                                          <Download size={14} />
                                          Download
                                        </button>
                                      )}
                                    </div>
                                    {isLoading ? (
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: '16px', color: 'var(--text-tertiary)' }}>
                                        <Loader2 className="spin" size={32} style={{ color: 'var(--primary-color)' }} />
                                        <p>Fetching Full Runtime History...</p>
                                      </div>
                                    ) : (
                                      <div className="murex-detail-heatmap-wrapper">
                                        <PlotlyChart
                                          ref={(node) => { heatmapRefs.current[script.id] = node; }}
                                          data={spec.data}
                                          layout={spec.layout}
                                          onClick={(e) => handleHeatmapCellClick(scriptWithDetails, e)}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      }))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          )
        )}
          </>
        )}
      </div>

      {/* Job Execution Details Modal */}
      {selectedCellDetails && (
        <AdminModal
          isOpen={Boolean(selectedCellDetails)}
          onClose={() => setSelectedCellDetails(null)}
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Job Execution Details</span>
              <span className="murex-modal-script-badge">{selectedCellDetails.scriptName}</span>
            </div>
          }
          size="xl"
        >
          {isGanttLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px', color: 'var(--text-tertiary)' }}>
              <Loader2 className="spin" size={32} style={{ color: 'var(--primary-color)' }} />
              <p>Fetching Job Execution Details...</p>
            </div>
          ) : (
            <ScriptRunMonitor script={selectedCellDetails.scriptObj} cellDetails={selectedCellDetails} />
          )}
        </AdminModal>
      )}
      {/* Category Management Modal */}
      <AdminModal
        isOpen={showCategoryModal}
        onClose={() => !isSavingCategory && setShowCategoryModal(false)}
        title={editingCategory ? 'Edit Category' : 'Create a New Category'}
        size={editingCategory ? 'lg' : 'md'}
        footer={
          <>
            <button className="murex-btn murex-btn-cancel" onClick={() => setShowCategoryModal(false)} disabled={isSavingCategory}>
              Cancel
            </button>
            <button className="murex-btn murex-btn-primary" onClick={handleSaveCategory} disabled={isSavingCategory}>
              {isSavingCategory ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  {editingCategory ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                editingCategory ? 'Save Changes' : 'Create Category'
              )}
            </button>
          </>
        }
      >
        <div className="murex-category-form-grid" style={{ display: 'grid', gridTemplateColumns: editingCategory ? '1fr 1fr' : '1fr', gap: '20px' }}>
          <div className="murex-form-group">
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Category Name *</label>
            <input
              type="text"
              className="murex-form-input"
              value={categoryFormName}
              onChange={e => setCategoryFormName(e.target.value)}
            />
          </div>
          <div className="murex-form-group">
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Description</label>
            <textarea
              className="murex-form-input"
              value={categoryFormDescription}
              onChange={e => setCategoryFormDescription(e.target.value)}
              style={{ resize: 'vertical', minHeight: '80px' }}
            />
          </div>
        </div>

        {editingCategory && (
          <div className="murex-dual-list-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
            {/* Available Scripts */}
            <div className="murex-script-list-pane">
              <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary)' }}>Available Scripts ({renderedAvailableScripts.length})</h4>
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  className="murex-form-input"
                  placeholder="Search available scripts..."
                  value={availableSearch}
                  onChange={(e) => setAvailableSearch(e.target.value)}
                  style={{ paddingLeft: '32px', paddingRight: '32px', fontSize: '0.85rem' }}
                />
                {availableSearch && (
                  <button type="button" className="search-clear-btn" onClick={() => setAvailableSearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div
                className="murex-script-list-scroll murex-form-input"
                style={{ height: '250px', overflowY: 'auto', padding: '8px' }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const scriptName = e.dataTransfer.getData('text/plain');
                  if (scriptName && categoryFormScripts.includes(scriptName)) {
                    toggleScriptAssignment(scriptName, false);
                  }
                }}
              >
                {renderedAvailableScripts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px' }}>No scripts found</div>
                ) : (
                  renderedAvailableScripts.map(script => (
                    <div
                      key={script.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', script.script_name)}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={(e) => e.preventDefault()}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', cursor: 'grab' }}
                    >
                      <span style={{ pointerEvents: 'none' }}>{script.script_name}</span>
                      <button onClick={() => toggleScriptAssignment(script.script_name, true)} style={{ background: 'var(--c-success)', color: 'white', border: 'none', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Category Scripts */}
            <div className="murex-script-list-pane">
              <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary)' }}>Category Scripts ({renderedAssignedScripts.length})</h4>
              <div style={{ position: 'relative', marginBottom: '10px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                <input
                  type="text"
                  className="murex-form-input"
                  placeholder="Search category scripts..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  style={{ paddingLeft: '32px', paddingRight: '32px', fontSize: '0.85rem' }}
                />
                {categorySearch && (
                  <button type="button" className="search-clear-btn" onClick={() => setCategorySearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div
                className="murex-script-list-scroll murex-form-input"
                style={{ height: '250px', overflowY: 'auto', padding: '8px' }}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const scriptName = e.dataTransfer.getData('text/plain');
                  if (scriptName && !categoryFormScripts.includes(scriptName)) {
                    toggleScriptAssignment(scriptName, true);
                  }
                }}
              >
                {renderedAssignedScripts.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '20px' }}>No scripts assigned</div>
                ) : (
                  renderedAssignedScripts.map(script => (
                    <div
                      key={script.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', script.script_name)}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={(e) => e.preventDefault()}
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', cursor: 'grab' }}
                    >
                      <span style={{ pointerEvents: 'none' }}>{script.script_name}</span>
                      <button
                        onClick={() => toggleScriptAssignment(script.script_name, false)}
                        style={{ background: 'var(--c-danger)', color: 'white', border: 'none', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >-</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </AdminModal>

      {/* ── Delete Category Confirmation Modal ── */}
      <AdminModal
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        title="Delete Category"
        size="sm"
        footer={
          <>
            <button className="murex-btn murex-btn-cancel" onClick={() => setDeletingCategory(null)} disabled={isDeletingCategory}>
              Cancel
            </button>
            <button
              className="murex-btn murex-btn-primary"
              onClick={confirmDeleteCategory}
              disabled={isDeletingCategory}
              style={{ background: 'var(--c-danger)' }}
            >
              {isDeletingCategory ? (
                <>
                  <Loader2 size={16} className="spin-animation" />
                  Deleting...
                </>
              ) : 'Delete'}
            </button>
          </>
        }
      >
        <div style={{ textAlign: 'center', padding: '10px' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid var(--c-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto', color: 'var(--c-warning)' }}>
            <AlertTriangle size={24} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Confirm Deletion</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Are you sure you want to delete the category<br />
            <strong>{deletingCategory?.name}</strong>?
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            All scripts within this category will become uncategorized.
          </p>
        </div>
      </AdminModal>
    </div>
  );
}
export default MurexRuntimeTrendsPage;
