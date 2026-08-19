import React, { useState, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { ChevronDown, ChevronUp } from 'lucide-react';

import { PlotlyChart, getRunGanttSpec } from './MurexRuntimeTrendsPage';
import { useTheme } from '@hooks/useTheme';
import './ScriptRunMonitor.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Helper math functions
const mean = (arr) => arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
const stddev = (arr) => {
  const m = mean(arr);
  return Math.sqrt(mean(arr.map(x => (x - m) ** 2)));
};
const percentile = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * s.length) - 1;
  return s[Math.max(0, idx)];
};
const linregSlope = (arr) => {
  const xs = arr.map((_, i) => i);
  const xm = mean(xs);
  const ym = mean(arr);
  let num = 0, den = 0;
  for (let i = 0; i < arr.length; i++) {
    num += (xs[i] - xm) * (arr[i] - ym);
    den += (xs[i] - xm) ** 2;
  }
  return den === 0 ? 0 : num / den;
};
const linregLine = (arr) => {
  const slope = linregSlope(arr);
  const xs = arr.map((_, i) => i);
  const xm = mean(xs);
  const ym = mean(arr);
  const intercept = ym - slope * xm;
  return xs.map(x => slope * x + intercept);
};
const fmtSec = (sec) => {
  if (sec < 60) return sec.toFixed(1) + 's';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
};
const hhmmss = (sec) => {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
};

// Extracts "HH:MM:SS" from a raw Murex CMP timestamp ("04-AUG-2026 20:40:14")
// or an ISO one ("2026-08-04T20:40:14"); returns null if unavailable.
const clockFromTimestamp = (ts) => {
  if (!ts) return null;
  const timePart = String(ts).trim().split(/[ T]/).pop();
  return timePart || null;
};

const RunCard = ({ run, index }) => {
  const [isOpen, setIsOpen] = useState(false);

  // cpuTime/dbTime/idleTime are real seconds from the API's
  // STEPS_TRANSFORMED (hms_to_seconds) - NOT milliseconds. This used to
  // divide everything by 1000, silently showing durations 1000x too small.
  const steps = run.steps || [];
  const totalCpuSec = steps.reduce((sum, s) => sum + (s.cpuTime || 0), 0);
  const totalDbSec = steps.reduce((sum, s) => sum + (s.dbTime || 0), 0);
  const totalIdleSec = steps.reduce((sum, s) => sum + (s.idleTime || 0), 0);

  // Use run.durationMin * 60 if total steps time is 0 (to have a fallback)
  const totalDurationSec = steps.length > 0 ? (totalCpuSec + totalDbSec + totalIdleSec) : (run.durationMin * 60);

  // Convert steps for Plotly function if needed
  const plotlyRun = {
    steps: steps.map(s => ({
      name: s.name,
      dbTime: s.dbTime || 0,
      cpuTime: s.cpuTime || 0,
      idleTime: s.idleTime || 0,
    }))
  };
  const { isDarkMode } = useTheme();
  const ganttTextColor = isDarkMode ? '#f8fafc' : '#111111';
  const ganttSpec = steps.length > 0 ? getRunGanttSpec(plotlyRun, ganttTextColor) : null;

  return (
    <div className="run-card">
      <div className="run-head" onClick={() => setIsOpen(!isOpen)}>
        <div className="run-head-left">
          <span className="run-name">Run {index + 1}</span>
          <span className="run-date">({run.date})</span>
          <span className="run-clock">{hhmmss(totalDurationSec)}</span>
        </div>
        <button className={`toggle-btn ${isOpen ? 'open' : ''}`}>
          <span className="chev">▾</span> {isOpen ? 'Hide Gantt' : 'Show Gantt'}
        </button>
      </div>
      {isOpen && (
        <div className="run-body">
          <div className="run-stats">
            <span className="step-chip">{steps.length} Steps</span>
            <span className="run-stat">Total Idle: <b>{totalIdleSec.toFixed(1)}s</b></span>
            <span className="run-stat">Total DB: <b>{totalDbSec.toFixed(1)}s</b></span>
            <span className="run-stat">Total CPU: <b>{totalCpuSec.toFixed(1)}s</b></span>
            <span className="run-stat">Total Duration: <b>{totalDurationSec.toFixed(1)}s</b></span>
          </div>
          <div style={{ position: 'relative', height: '400px', marginTop: '10px' }}>
            {ganttSpec ? (
              <PlotlyChart data={ganttSpec.data} layout={ganttSpec.layout} />
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--muted)' }}>
                No step-level breakdown available for this run.
              </div>
            )}
          </div>
          
          <div className="murex-run-table-container">
            <table className="murex-run-table">
              <thead>
                <tr>
                  <th>Step</th>
                  <th style={{ textAlign: 'right' }}>Idle / Wait</th>
                  <th style={{ textAlign: 'right' }}>CPU Time</th>
                  <th style={{ textAlign: 'right' }}>Database Time</th>
                  <th style={{ textAlign: 'right' }}>Step Total</th>
                  <th style={{ textAlign: 'right' }}>Start</th>
                  <th style={{ textAlign: 'right' }}>End</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((s, idx) => {
                  const idleSec = s.idleTime || 0;
                  const cpuSec = s.cpuTime || 0;
                  const dbSec = s.dbTime || 0;
                  const stepTotal = idleSec + cpuSec + dbSec;

                  // Prefer the step's own real timestamps; fall back to a
                  // cumulative offset (from the run's start) only when real
                  // timestamps aren't available (e.g. legacy/mock data).
                  let cumStart = 0;
                  for (let i = 0; i < idx; i++) {
                    cumStart += (steps[i].idleTime || 0) + (steps[i].cpuTime || 0) + (steps[i].dbTime || 0);
                  }
                  const cumEnd = cumStart + stepTotal;
                  const startDisplay = clockFromTimestamp(s.startTs) || `${cumStart.toLocaleString(undefined, { maximumFractionDigits: 1 })}s`;
                  const endDisplay = clockFromTimestamp(s.endTs) || `${cumEnd.toLocaleString(undefined, { maximumFractionDigits: 1 })}s`;

                  return (
                    <tr key={idx}>
                      <td>{s.name}</td>
                      <td className="num-cell">{idleSec.toLocaleString(undefined, { maximumFractionDigits: 1 })}s</td>
                      <td className="num-cell">{cpuSec.toLocaleString(undefined, { maximumFractionDigits: 1 })}s</td>
                      <td className="num-cell">{dbSec.toLocaleString(undefined, { maximumFractionDigits: 1 })}s</td>
                      <td className="num-cell">{stepTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })}s</td>
                      <td className="num-cell">{startDisplay}</td>
                      <td className="num-cell">{endDisplay}</td>
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <td>Total</td>
                  <td className="num-cell">{totalIdleSec.toLocaleString(undefined, { maximumFractionDigits: 1 })}s</td>
                  <td className="num-cell">{totalCpuSec.toLocaleString(undefined, { maximumFractionDigits: 1 })}s</td>
                  <td className="num-cell">{totalDbSec.toLocaleString(undefined, { maximumFractionDigits: 1 })}s</td>
                  <td className="num-cell">{totalDurationSec.toLocaleString(undefined, { maximumFractionDigits: 1 })}s</td>
                  <td className="num-cell">—</td>
                  <td className="num-cell">Completed: {hhmmss(totalDurationSec)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export const ScriptRunMonitor = ({ script, cellDetails }) => {
  // If cellDetails are provided (from heatmap click), we use its runs. Otherwise, use full script.history.
  const history = useMemo(() => {
    if (cellDetails && cellDetails.runs) {
      return cellDetails.runs.map((r, i) => ({
        date: cellDetails.date || 'Unknown',
        durationMin: r.seconds / 60,
        steps: (r.steps || []).map(s => ({
          name: s.name,
          // cpuTime/dbTime/idleTime/elapsed are all real seconds from the
          // API's STEPS_TRANSFORMED (hms_to_seconds) - NOT milliseconds.
          cpuTime: s.cpuTime,
          dbTime: s.dbTime,
          idleTime: s.idleTime || 0,
          elapsed: s.elapsed,
          startTs: s.startTs || null,
          endTs: s.endTs || null,
        }))
      }));
    }
    return [...(script.history || [])].reverse().map(r => ({
      ...r,
      steps: (r.steps || []).map(s => ({
        name: s.name,
        cpuTime: s.cpu_time,
        dbTime: s.db_time,
        idleTime: s.idle_time || 0,
        elapsed: s.elapsed_time,
        startTs: s.date_time_cmp || null,
        endTs: s.finished_time || null,
      }))
    }));
  }, [script.history, cellDetails]);
  
  // Convert all durations to seconds
  const durS = useMemo(() => history.map(h => (h.durationMin || 0) * 60), [history]);
  const n = durS.length;
  
  const avgDur = mean(durS);
  const p95Dur = percentile(durS, 95);
  const sd = stddev(durS);
  const slope = linregSlope(durS);
  const latest = durS[durS.length - 1] || 0;
  const deltaVsAvg = avgDur > 0 ? ((latest - avgDur) / avgDur) * 100 : 0;

  // Aggregate step metrics
  const stepAggregation = useMemo(() => {
    // Look for a run that actually has steps
    const runWithSteps = history.find(h => h.steps && h.steps.length > 1);
    if (!runWithSteps) return { names: [], avgElapsed: [], avgCpu: [], avgDb: [], avgIdle: [], maxElapsed: 0, bottleneckIdx: -1, dbShare: 0 };
    
    // Skip the first step "Checking"
    const stepNames = runWithSteps.steps.slice(1).map(s => s.name);
    
    // cpuTime/dbTime/idleTime/elapsed are already in seconds - see the
    // history mapping above (this used to divide by 1000, silently showing
    // durations 1000x too small for real API data).
    const avgElapsed = stepNames.map((_, i) => mean(history.map(r => (r.steps || [])[i + 1]?.elapsed || 0)));
    const avgCpu = stepNames.map((_, i) => mean(history.map(r => (r.steps || [])[i + 1]?.cpuTime || 0)));
    const avgDb = stepNames.map((_, i) => mean(history.map(r => (r.steps || [])[i + 1]?.dbTime || 0)));
    const avgIdle = stepNames.map((_, i) => mean(history.map(r => (r.steps || [])[i + 1]?.idleTime || 0)));
    
    const maxElapsed = Math.max(...avgElapsed, 0.1);
    const bottleneckIdx = avgElapsed.indexOf(maxElapsed);
    
    const sumDb = avgDb.reduce((a, b) => a + b, 0);
    const sumCpu = avgCpu.reduce((a, b) => a + b, 0);
    const dbShare = (sumDb + sumCpu) > 0 ? (sumDb / (sumDb + sumCpu)) * 100 : 0;

    return { names: stepNames, avgElapsed, avgCpu, avgDb, avgIdle, maxElapsed, bottleneckIdx, dbShare };
  }, [history]);

  const kpis = [
    { label: 'Latest run', value: fmtSec(latest), foot: `${deltaVsAvg >= 0 ? '+' : ''}${deltaVsAvg.toFixed(1)}% vs avg`, cls: deltaVsAvg >= 0 ? 'up' : 'down' },
    { label: 'Average duration', value: fmtSec(avgDur), foot: `${n} runs` },
    { label: 'P95 duration', value: fmtSec(p95Dur), foot: 'worst-case reference' },
    { label: 'Trend (slope)', value: `${slope >= 0 ? '+' : ''}${slope.toFixed(0)} s/run`, foot: slope >= 0 ? 'slowing down' : 'speeding up', cls: slope >= 0 ? 'up' : 'down' },
    { label: 'Std deviation', value: fmtSec(sd), foot: 'run-to-run spread' },
    { label: 'Runs logged', value: n, foot: `${history[0]?.date || 'N/A'}` },
    { label: 'Bottleneck step', value: stepAggregation.bottleneckIdx >= 0 ? stepAggregation.names[stepAggregation.bottleneckIdx]?.replace(/Step \d\/\d\s?/, '') : 'N/A', foot: stepAggregation.bottleneckIdx >= 0 ? `${fmtSec(stepAggregation.avgElapsed[stepAggregation.bottleneckIdx])} avg` : '', cls: 'up' },
    { label: 'DB vs CPU time', value: `${stepAggregation.dbShare.toFixed(0)}% DB`, foot: 'of total compute+db time' }
  ];

  const durationChartData = {
    labels: history.map((h, i) => `Run ${i + 1} (${h.date})`),
    datasets: [
      {
        label: 'Duration (s)',
        data: durS,
        borderColor: '#0F6E56',
        backgroundColor: 'rgba(15,110,86,0.08)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        borderWidth: 2
      },
      {
        label: 'Trend',
        data: linregLine(durS),
        borderColor: '#B5790C',
        borderWidth: 2,
        pointRadius: 0,
        borderDash: [5, 5]
      },
      {
        label: 'P95',
        data: durS.map(() => p95Dur),
        borderColor: '#A8371D',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0
      }
    ]
  };

  const durationChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { title: { display: true, text: 'Seconds' }, grid: { color: '#E4E2DA' }, min: 0 },
      x: { grid: { display: false } }
    }
  };

  const stepShareChartData = {
    labels: stepAggregation.names.map(s => s.replace(/Step \d\/\d\s?/, '')),
    datasets: [{
      data: stepAggregation.avgElapsed,
      backgroundColor: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7', '#e34948']
    }]
  };

  const stepShareChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '60%',
    plugins: { 
      legend: { 
        position: 'bottom', 
        labels: { boxWidth: 10, font: { size: 10.5 }, padding: 14 } 
      } 
    },
    layout: {
      padding: { top: 20, bottom: 10, left: 40, right: 40 }
    }
  };

  return (
    <div className="run-monitor-wrap">
      <header className="top">
        <div>
          <p className="job-title">{script.name}</p>
          <p className="job-sub"><span className="num">{n}</span> runs tracked · latest <span className="num">{history[history.length - 1]?.date}</span></p>
        </div>
        <span className="status-chip"><span className="dot"></span>{script.status === 'error' ? 'Failed' : 'Within SLA'}</span>
      </header>

      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div className="kpi" key={i}>
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-value">{k.value}</p>
            <p className={`kpi-foot ${k.cls || ''}`}>{k.foot}</p>
          </div>
        ))}
      </div>

      <section>
        <div className="section-head">
          <h2>Run duration over time</h2>
          <span className="section-note">Elapsed time per run, with trend and P95 reference</span>
        </div>
        <div className="panel">
          <div className="legend">
            <span><i style={{ background: '#0F6E56' }}></i>Duration</span>
            <span><i style={{ background: '#B5790C' }}></i>Trend line</span>
            <span><i style={{ background: '#A8371D' }}></i>P95 threshold</span>
          </div>
          <div style={{ position: 'relative', height: '260px' }}>
            <Line data={durationChartData} options={durationChartOptions} />
          </div>
        </div>
      </section>

      {stepAggregation.names.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Pipeline step breakdown</h2>
            <span className="section-note">Average idle/CPU/DB time per step, across all runs</span>
          </div>
          <div className="two-col">
            <div className="panel">
              <div className="legend">
                <span><i style={{ background: '#CBD5E1' }}></i>Idle / Wait</span>
                <span><i style={{ background: '#B5790C' }}></i>CPU time</span>
                <span><i style={{ background: '#0F6E56' }}></i>DB time</span>
              </div>
              <div id="ganttBody">
                {stepAggregation.names.map((name, i) => {
                  const elapsed = stepAggregation.avgElapsed[i] || 0;
                  const idlePct = elapsed > 0 ? (stepAggregation.avgIdle[i] / elapsed) * 100 : 0;
                  const cpuPct = elapsed > 0 ? (stepAggregation.avgCpu[i] / elapsed) * 100 : 0;
                  const dbPct = Math.max(0, 100 - idlePct - cpuPct);
                  const widthPct = (elapsed / stepAggregation.maxElapsed) * 100 || 0;
                  const isBottleneck = i === stepAggregation.bottleneckIdx;

                  return (
                    <div className="gantt-row" key={i}>
                      <div className="step-name">
                        <div>{i + 1}. {name.replace(/Step \d\/\d\s?/, '')}</div>
                        {isBottleneck && <div className="bottleneck-tag">SLOWEST</div>}
                      </div>
                      <div className="step-track">
                        <div className="step-seg" style={{ left: 0, width: `${(widthPct * idlePct) / 100}%`, background: '#CBD5E1' }}></div>
                        <div className="step-seg" style={{ left: `${(widthPct * idlePct) / 100}%`, width: `${(widthPct * cpuPct) / 100}%`, background: '#B5790C' }}></div>
                        <div className="step-seg" style={{ left: `${(widthPct * (idlePct + cpuPct)) / 100}%`, width: `${(widthPct * dbPct) / 100}%`, background: '#0F6E56' }}></div>
                      </div>
                      <div className="step-total">{fmtSec(stepAggregation.avgElapsed[i])}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="panel">
              <div style={{ position: 'relative', height: '290px' }}>
                <Doughnut data={stepShareChartData} options={stepShareChartOptions} />
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>Run log</h2>
          <span className="section-note">Expand a run for its step-by-step CPU / DB waterfall</span>
        </div>
        <div id="runLog">
          {history.map((run, i) => (
            <RunCard key={i} run={run} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
};
