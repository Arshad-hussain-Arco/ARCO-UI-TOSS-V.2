import { useCallback, useEffect, useMemo, useState, useRef, Fragment } from 'react';
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
  Edit,
  Trash2,
  Loader2,
  X,
  RotateCcw
} from 'lucide-react';
import { CiPlay1 } from "react-icons/ci";
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { ResetButton } from '@components/ui/ResetButton/ResetButton';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { murexService } from '@services/murexService';
import { parseISO, getISOWeek, getDay } from 'date-fns';

import './MurexRuntimeTrendsPage.css';
import { dismissBackdrop } from '@utils/interactive';

/* ─── Plotly Chart Wrapper Component (CDN Auto-Loader) ────────── */
function PlotlyChart({ data, layout, config, onClick, style }) {
  const containerRef = useRef(null);
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
  }, [plotlyLoaded, data, layout, config, onClick]);

  if (!plotlyLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--text-tertiary)' }}>
        <RefreshCw size={14} className="eod-pulse-icon" style={{ marginRight: 8 }} /> Loading Plotly engine...
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 220, ...style }} />;
}

/* ─── Stacked Bar Chart Spec for Job Cards ─────────────────────── */
function buildJobStackedBarSpec(script) {
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
      font: { color: 'var(--text-secondary)', size: 10, family: 'Inter, system-ui, sans-serif' },
      xaxis: {
        tickfont: { size: 9 },
        showgrid: false,
        zeroline: false,
        tickangle: -30,
      },
      yaxis: {
        title: { text: 'Minutes', font: { size: 9, color: 'var(--text-tertiary)' } },
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
function JobCard({ script, onOpenDetail, onTogglePin }) {
  const [isOpen, setIsOpen] = useState(true);
  const barSpec = useMemo(() => buildJobStackedBarSpec(script), [script]);

  const avgRuntimeFmt = script.avgRuntime || '—';
  const minRtFmt = script.minRuntime != null ? `${script.minRuntime}m` : '—';
  const maxRtFmt = script.maxRuntime != null ? `${script.maxRuntime}m` : '—';
  const lastRunFmt = script.lastRun || '—';
  const outlierCount = (script.history || []).filter(h => h.status === 'error').length;
  const freqFmt = script.frequency != null ? `${script.frequency}/day` : '—';
  const trendPct = script.successRate != null ? `${script.successRate}%` : '—';
  const trendPositive = (script.successRate || 0) >= 80;
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
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* KPI Row inside each Job Card */}
      <div className="murex-kpi-row murex-job-kpi-row">
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Min Runtime</div>
          <div className="murex-kpi-value">{minRtFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Max Runtime</div>
          <div className="murex-kpi-value">{maxRtFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Avg Runtime</div>
          <div className="murex-kpi-value">{avgRuntimeFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Latest Run</div>
          <div className="murex-kpi-value">{lastRunFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Trend</div>
          <div className={`murex-kpi-value ${trendPositive ? 'trend-up' : 'trend-down'}`}>
            {trendPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trendPct}
          </div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Outliers</div>
          <div className={`murex-kpi-value ${outlierCount > 0 ? 'outlier' : ''}`}>
            {outlierCount}
          </div>
        </div>
      </div>

      {/* Card Body: Chart + Details Panel */}
      {isOpen && (
        <div className="murex-job-card-body">
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

              {/* Success Rate / Trend */}
              <div className="murex-job-metric-card">
                <div className={`murex-job-metric-icon ${trendPositive ? 'green' : 'red'}`}>
                  {trendPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                </div>
                <div className="murex-job-metric-info">
                  <span className="murex-job-metric-label">Success Rate</span>
                  <span className={`murex-job-metric-value ${trendPositive ? 'green' : 'red'}`}>{trendPct}</span>
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
        </div>
      )}
    </div>
  );
}

/* ─── Heatmap & Gantt Data Generators ─────────────────────────── */
function getScriptHeatmapSpec(script) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Extract all runs and map to ISO week and day
  const runs = (script.history || [])
    .filter(run => run.date && run.date !== 'Unknown Date')
    .map(run => {
      const dateObj = parseISO(run.date);
      if (isNaN(dateObj)) return null;

      const week = getISOWeek(dateObj);
      // getDay() returns 0 for Sunday, 1 for Monday. We want 0 for Mon, 6 for Sun.
      const jsDay = getDay(dateObj);
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1;
      return { ...run, week, dayIndex };
    })
    .filter(Boolean);

  // Find unique weeks and sort them
  const uniqueWeeks = [...new Set(runs.map(r => r.week))].sort((a, b) => a - b);
  const weeks = uniqueWeeks.length > 0 ? uniqueWeeks.map(w => `${w}`) : ['No Data'];

  // Initialize zMatrix and textMatrix
  const zMatrix = Array(7).fill(0).map(() => Array(weeks.length).fill(null));
  const textMatrix = Array(7).fill('').map(() => Array(weeks.length).fill(''));
  const annotations = [];

  // Helper for formatting date strings
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Group runs by day and week
  runs.forEach(run => {
    const wIdx = uniqueWeeks.indexOf(run.week);
    if (wIdx !== -1 && run.dayIndex >= 0 && run.dayIndex < 7) {
      if (zMatrix[run.dayIndex][wIdx] === null) {
        zMatrix[run.dayIndex][wIdx] = run.durationMin;
        textMatrix[run.dayIndex][wIdx] = run.durationFormatted;

        // Add date annotation perfectly in the top-right corner of the cell
        const dateObj = parseISO(run.date);
        if (!isNaN(dateObj)) {
          const dateString = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;
          annotations.push({
            x: wIdx + 0.47, // right edge
            y: run.dayIndex - 0.47, // top edge (because y is reversed)
            text: dateString,
            showarrow: false,
            font: { size: 10, color: 'var(--text-primary)' },
            xanchor: 'right',
            yanchor: 'top',
          });
        }

        // Outlier in the top-left corner
        if (run.isOutlier) {
          annotations.push({
            x: wIdx - 0.47, // left edge
            y: run.dayIndex - 0.47, // top edge
            text: '⚠️',
            showarrow: false,
            font: { size: 12 },
            xanchor: 'left',
            yanchor: 'top',
          });
        }
      } else {
        zMatrix[run.dayIndex][wIdx] = (zMatrix[run.dayIndex][wIdx] + run.durationMin) / 2;
        textMatrix[run.dayIndex][wIdx] += `<br>${run.durationFormatted}`;
      }
    }
  });

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
          tickfont: { size: 10, color: 'var(--text-secondary)' },
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
      font: { color: 'var(--text-primary)', size: 11, family: 'Inter, system-ui, sans-serif' },
      xaxis: { title: { text: 'ISO Week Number', font: { size: 11, color: 'var(--text-secondary)' } }, type: 'category' },
      yaxis: { title: { text: 'Day of Week', font: { size: 11, color: 'var(--text-secondary)' } }, autorange: 'reversed' },
      annotations: annotations,
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

function getRunGanttSpec(run) {
  const steps = run.steps.map((s) => s.name);
  steps.push('Total CPU', 'Total DB');

  const baseTimes = [];
  const dbTimes = [];
  const cpuTimes = [];
  const totalCpuTimes = [];
  const totalDbTimes = [];

  let currentStart = 0;
  let totalDb = 0;
  let totalCpu = 0;

  run.steps.forEach(step => {
    baseTimes.push(currentStart);
    dbTimes.push(step.dbTime);
    cpuTimes.push(step.cpuTime);
    totalCpuTimes.push(0);
    totalDbTimes.push(0);

    totalDb += step.dbTime;
    totalCpu += step.cpuTime;
    currentStart += (step.dbTime + step.cpuTime); // waterfall flows continuously
  });

  // For Total CPU bar
  baseTimes.push(0);
  dbTimes.push(0);
  cpuTimes.push(0);
  totalCpuTimes.push(totalCpu);
  totalDbTimes.push(0);

  // For Total DB bar
  baseTimes.push(0);
  dbTimes.push(0);
  cpuTimes.push(0);
  totalCpuTimes.push(0);
  totalDbTimes.push(totalDb);

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
        y: dbTimes,
        name: 'Database Time',
        type: 'bar',
        marker: { color: '#5c8aea' }, // cornflower blue
        text: dbTimes.map(formatNum),
        textposition: 'inside',
        textfont: { color: 'white' },
      },
      {
        x: steps,
        y: cpuTimes,
        name: 'CPU Time',
        type: 'bar',
        marker: { color: '#637081' }, // slate gray
        text: cpuTimes.map(formatNum),
        textposition: 'inside',
        textfont: { color: 'white' },
      },
      {
        x: steps,
        y: totalCpuTimes,
        name: 'Total CPU Time',
        type: 'bar',
        marker: { color: '#637081' },
        text: totalCpuTimes.map(formatNum),
        textposition: 'auto',
        textfont: { color: 'white' },
      },
      {
        x: steps,
        y: totalDbTimes,
        name: 'Total DB Time',
        type: 'bar',
        marker: { color: '#5c8aea' },
        text: totalDbTimes.map(formatNum),
        textposition: 'auto',
        textfont: { color: 'white' },
      },
    ],
    layout: {
      barmode: 'stack',
      margin: { t: 40, r: 20, b: 120, l: 60 },
      height: 400,
      autosize: true,
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      font: { color: 'var(--text-primary)', size: 10 },
      yaxis: { title: { text: 'Time (s)', font: { size: 10 } }, tickformat: ',' },
      xaxis: { tickangle: -45 },
      showlegend: true,
      legend: { orientation: 'h', y: 1.15, x: 0.5, xanchor: 'center' }
    },
  };
}

/** Murex batch runtime trends, heatmaps and per-script health. */
export function MurexRuntimeTrendsPage() {
  useDocumentTitle('Murex Runtime Trends');

  const fetchTrends = useCallback(() => murexService.getRuntimeTrends(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchTrends);

  const runtimeSummary = data?.summary;
  const runtimeTrendData = data?.trend ?? [];
  const hourlyHeatmap = data?.hourlyHeatmap ?? [];
  const monthlyHeatmap = data?.monthlyHeatmap ?? [];

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
  const [categorySearch, setCategorySearch] = useState('');

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

  const [activeTab, setActiveTab] = useState('runtime');
  const [timeRange, setTimeRange] = useState('30d'); // Default selected timeframe: 30d
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
    setTimeRange('30d');
  };

  const selectedScript = scripts.length > 0 ? scripts[0].id : '';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [scriptFilter, setScriptFilter] = useState('');
  const [showScriptDetail, setShowScriptDetail] = useState(false);
  const [detailScript, setDetailScript] = useState(null);
  const [expandedScriptIds, setExpandedScriptIds] = useState(() => new Set());
  const [selectedCellDetails, setSelectedCellDetails] = useState(null);
  const [expandedRunGanttIds, setExpandedRunGanttIds] = useState(() => new Set());
  const [isGanttLoading, setIsGanttLoading] = useState(false);

  const toggleExpandScript = (scriptId, e) => {
    e?.stopPropagation();
    setExpandedScriptIds((prev) => {
      const next = new Set(prev);
      if (next.has(scriptId)) next.delete(scriptId);
      else next.add(scriptId);
      return next;
    });
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
      setSelectedCellDetails(details);
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
            const runs = processData.labels.map((label, index) => {
              const stepsData = processData.steps[index];
              const formatDuration = (secs) => {
                const h = Math.floor(secs / 3600).toString().padStart(2, '0');
                const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
                const s = Math.floor(secs % 60).toString().padStart(2, '0');
                return `${h}:${m}:${s}`;
              };

              return {
                id: `${script.id}-run-${index}`,
                name: `Run ${index + 1} (${label})`,
                duration: formatDuration(processData.time_duration[index]),
                seconds: processData.time_duration[index],
                isOutlier: false,
                steps: stepsData.step.map((stepName, stepIndex) => ({
                  name: stepName,
                  dbTime: stepsData.db_time[stepIndex],
                  cpuTime: stepsData.cpu_time[stepIndex],
                  elapsed: stepsData.elapsed_time[stepIndex],
                }))
              };
            });

            setSelectedCellDetails({
              ...details,
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
    .filter(s => s.script_name.toLowerCase().includes(availableSearch.toLowerCase()));

  const renderedAssignedScripts = allKnownScripts
    .filter(s => categoryFormScripts.includes(s.script_name))
    .filter(s => s.script_name.toLowerCase().includes(categorySearch.toLowerCase()));

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
  if (error) {
    return (
      <ErrorState
        title="Runtime trends could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !runtimeSummary) {
    return <Loader message="Loading runtime trends…" />;
  }

  return (
    <div className="murex-runtime-page">


      {/* Tabs */}
      <div className="murex-tabs">
        <button
          className={`murex-tab ${activeTab === 'runtime' ? 'active' : ''}`}
          onClick={() => setActiveTab('runtime')}
        >
          Runtime Trends
        </button>
        <button
          className={`murex-tab ${activeTab === 'management' ? 'active' : ''}`}
          onClick={() => setActiveTab('management')}
        >
          Script Management
        </button>
      </div>

      {/* Tab Content */}
      <div className="murex-tab-content">
        {activeTab === 'runtime' ? (
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
                    {scripts.length}
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
                        color: isActive ? '#006838' : 'var(--text-secondary, #4b5563)',
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
              {(scripts.length > 5 ? scripts.slice(0, 3) : scripts).map((script) => (
                <JobCard
                  key={script.id}
                  script={script}
                  onOpenDetail={openScriptDetail}
                  onTogglePin={togglePin}
                />
              ))}
              {scripts.length === 0 && (
                <div className="murex-empty-state" style={{ padding: '40px 0' }}>
                  <BarChart3 size={28} style={{ opacity: 0.3 }} />
                  <p>No runtime data available</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="murex-management-tab">
            {/* Left Sidebar - Categories */}
            <div className="murex-category-sidebar">
              <div className="murex-category-search">
                <Search size={12} />
                <input
                  type="text"
                  placeholder="Search category..."
                  className="murex-category-search-input"
                />
              </div>

              <div className="murex-category-list">
                <button
                  className={`murex-category-item ${selectedCategory === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedCategory('all')}
                >
                  <span className="murex-category-name">All Scripts</span>
                  <span className="murex-category-count">{scripts.length}</span>
                </button>

                {remoteCategories.map((category) => (
                  <div 
                    key={category.id} 
                    className="murex-category-item-wrapper" 
                    style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}
                    onDragOver={(e) => {
                      if (category.id !== null) e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
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
                        {scripts.filter((s) => s.category === category.name).length}
                      </span>
                    </button>
                    {category.id !== null && (
                      <div style={{ display: 'flex', gap: '4px', marginLeft: '4px' }}>
                        <button
                          className="murex-icon-btn"
                          title="Edit Category"
                          onClick={(e) => handleEditCategory(category, e)}
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          className="murex-icon-btn error"
                          title="Delete Category"
                          onClick={(e) => handleDeleteCategory(category, e)}
                          style={{ color: 'var(--error-color)' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button 
                className="murex-add-category-btn" 
                onClick={handleAddCategory}
                style={{ backgroundColor: '#105e35', color: 'var(--surface-primary)', border: 'none', padding: '8px 16px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 500 }}
              >
                <Plus size={14} />
                <span>Add Category</span>
              </button>
            </div>

            {/* Main Script Table */}
            <div className="murex-script-table-section">
              <div className="murex-table-header">
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
                      <th className="murex-script-th">Avg Runtime</th>
                      <th className="murex-script-th">Status</th>
                      <th className="murex-script-th actions-col">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="murex-script-tbody">
                    {filteredScripts.map((script) => {
                      const isExpanded = expandedScriptIds.has(script.id);
                      const spec = getScriptHeatmapSpec(script);
                      return (
                        <Fragment key={script.id}>
                          <tr
                            className={`murex-script-row ${isExpanded ? 'expanded' : ''}`}
                            onClick={(e) => toggleExpandScript(script.id, e)}
                            draggable
                            onDragStart={(e) => e.dataTransfer.setData('text/plain', script.name)}
                          >
                            <td className="murex-script-td">
                              <div className="murex-script-name-cell" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CiPlay1 
                                  size={16} 
                                  style={{ 
                                    color: 'var(--primary-color)', 
                                    cursor: 'pointer',
                                    transition: 'transform 0.3s ease',
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                  }} 
                                  onClick={(e) => { e.stopPropagation(); toggleExpandScript(script.id, e); }}
                                />
                                {script.isPinned && <Pin size={12} className="murex-pinned-icon" />}
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
                            <td className="murex-script-td">{script.avgRuntime}</td>
                            <td className="murex-script-td">
                              <span className={`murex-status-badge ${script.status.toLowerCase()}`}>
                                {script.status}
                              </span>
                            </td>
                            <td className="murex-script-td actions-col">
                              <div className="murex-script-actions">
                                <button
                                  className={`murex-icon-btn ${script.isPinned ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePin(script.id);
                                  }}
                                  title="Pin Script"
                                >
                                  <Pin size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Child Row — Master-Detail Heatmap Accordion */}
                          {isExpanded && (
                            <tr className="murex-script-detail-row">
                              <td colSpan={6}>
                                <div className="murex-detail-accordion-content">
                                  <div className="murex-detail-accordion-header">
                                    <h4 className="murex-detail-title">
                                      <Activity size={14} style={{ color: '#005A36' }} />
                                      Runtime Heatmap & Execution Pattern — {script.name}
                                    </h4>
                                    <span className="murex-detail-subtitle">
                                      Click any date cell on the heatmap to view detailed execution runs & Gantt charts
                                    </span>
                                  </div>

                                  <div className="murex-detail-heatmap-wrapper">
                                    <PlotlyChart
                                      data={spec.data}
                                      layout={spec.layout}
                                      onClick={(e) => handleHeatmapCellClick(script, e)}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>

                {filteredScripts.length === 0 && (
                  <div className="murex-empty-state">
                    <Search size={24} />
                    <p>No scripts found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
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
          size="lg"
        >
          {isGanttLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px', color: 'var(--text-tertiary)' }}>
              <Loader2 className="spin" size={32} style={{ color: 'var(--primary-color)' }} />
              <p>Fetching Job Execution Details...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Summary Stats Grid */}
              <div className="murex-modal-summary-grid">
                <div className="murex-modal-summary-card">
                  <span className="murex-modal-card-label">Week</span>
                  <span className="murex-modal-card-val">{selectedCellDetails.week}</span>
                </div>
                <div className="murex-modal-summary-card">
                  <span className="murex-modal-card-label">Day</span>
                  <span className="murex-modal-card-val">{selectedCellDetails.day}</span>
                </div>
                <div className="murex-modal-summary-card">
                  <span className="murex-modal-card-label">Date</span>
                  <span className="murex-modal-card-val">{selectedCellDetails.date}</span>
                </div>
                <div className="murex-modal-summary-card">
                  <span className="murex-modal-card-label">Avg Duration</span>
                  <span className="murex-modal-card-val">{selectedCellDetails.avgDuration}</span>
                </div>
                <div className="murex-modal-summary-card">
                  <span className="murex-modal-card-label">Total Runs</span>
                  <span className="murex-modal-card-val">{selectedCellDetails.totalRuns}</span>
                </div>
                <div className={`murex-modal-summary-card ${selectedCellDetails.outliersCount > 0 ? 'warning' : ''}`}>
                  <span className="murex-modal-card-label">Outliers</span>
                  <span className={`murex-modal-card-val ${selectedCellDetails.outliersCount > 0 ? 'warning' : ''}`}>
                    {selectedCellDetails.outliersCount > 0 ? `⚠️ ${selectedCellDetails.outliersCount}` : '0'}
                  </span>
                </div>
              </div>

              {/* All Run Durations Section */}
              <div className="murex-modal-runs-section">
                <h4 className="murex-modal-runs-title">All Run Durations</h4>
                {selectedCellDetails.runs.map((run) => {
                  const isGanttOpen = expandedRunGanttIds.has(run.id);
                  const ganttSpec = getRunGanttSpec(run);
                  const totalDb = run.steps.reduce((a, b) => a + b.dbTime, 0);
                  const totalCpu = run.steps.reduce((a, b) => a + b.cpuTime, 0);

                  return (
                    <div key={run.id} className={`murex-run-item ${run.isOutlier ? 'outlier' : ''}`}>
                      <div className="murex-run-item-header">
                        <div className="murex-run-info-left">
                          <span className="murex-run-name">{run.name}</span>
                          <span className="murex-run-dur">{run.duration}</span>
                          {run.isOutlier && (
                            <span className="murex-run-badge-outlier">
                              <AlertTriangle size={10} /> Outlier
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          className="murex-gantt-toggle-btn"
                          onClick={() => toggleRunGantt(run.id)}
                        >
                          {isGanttOpen ? (
                            <>Hide Gantt <ChevronUp size={12} /></>
                          ) : (
                            <>Show Gantt <ChevronDown size={12} /></>
                          )}
                        </button>
                      </div>

                      {/* Gantt Chart Container */}
                      {isGanttOpen && (
                        <div className="murex-gantt-chart-container">
                          <div className="murex-gantt-summary-bar">
                            <span className="murex-gantt-step-count">{run.steps.length} Steps</span>
                            <span>Total DB: <strong>{totalDb.toLocaleString()}s</strong></span>
                            <span>Total CPU: <strong>{totalCpu.toLocaleString()}s</strong></span>
                            <span>Total Duration: <strong>{run.seconds.toLocaleString()}s</strong></span>
                          </div>

                          <PlotlyChart data={ganttSpec.data} layout={ganttSpec.layout} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
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
            <button className="con-drawer-btn con-drawer-btn-cancel" onClick={() => setShowCategoryModal(false)} disabled={isSavingCategory}>
              Cancel
            </button>
            <button className="con-drawer-btn con-drawer-btn-primary" onClick={handleSaveCategory} disabled={isSavingCategory}>
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
              value={categoryFormName}
              onChange={e => setCategoryFormName(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid var(--border-primary)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            />
          </div>
          <div className="murex-form-group">
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Description</label>
            <textarea
              value={categoryFormDescription}
              onChange={e => setCategoryFormDescription(e.target.value)}
              style={{ width: '100%', padding: '10px', border: '1px solid var(--border-primary)', borderRadius: '6px', background: 'var(--bg-primary)', color: 'var(--text-primary)', resize: 'vertical', minHeight: '80px' }}
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
                  placeholder="Search available scripts..."
                  value={availableSearch}
                  onChange={(e) => setAvailableSearch(e.target.value)}
                  style={{ paddingRight: '32px',  width: '100%', padding: '8px 8px 8px 30px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
                />
      {availableSearch && (
        <button type="button" className="search-clear-btn" onClick={() => setAvailableSearch('')}>
          <X size={14} />
        </button>
      )}
              </div>
              <div 
                className="murex-script-list-scroll" 
                style={{ border: '1px solid var(--border-color)', borderRadius: '6px', height: '250px', overflowY: 'auto', padding: '8px' }}
                onDragOver={(e) => e.preventDefault()}
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
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', cursor: 'grab' }}
                    >
                      <span>{script.script_name}</span>
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
                  placeholder="Search category scripts..."
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  style={{ paddingRight: '32px',  width: '100%', padding: '8px 8px 8px 30px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.85rem' }}
                />
                {categorySearch && (
                  <button type="button" className="search-clear-btn" onClick={() => setCategorySearch('')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div
                className="murex-script-list-scroll"
                style={{ border: '1px solid var(--border-color)', borderRadius: '6px', height: '250px', overflowY: 'auto', padding: '8px' }}
                onDragOver={(e) => e.preventDefault()}
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
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem', cursor: 'grab' }}
                    >
                      <span>{script.script_name}</span>
                      <button
                        onClick={() => toggleScriptAssignment(script.script_name, false)}
                        style={{ background: 'var(--c-danger)', color: 'white', border: 'none', borderRadius: '4px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                      >−</button>
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
            <button className="con-drawer-btn con-drawer-btn-cancel" onClick={() => setDeletingCategory(null)} disabled={isDeletingCategory}>
              Cancel
            </button>
            <button
              className="con-drawer-btn con-drawer-btn-primary"
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
