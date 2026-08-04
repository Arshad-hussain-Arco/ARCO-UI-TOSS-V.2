import { parseISO, getISOWeek, getDay } from 'date-fns';

/** Stacked bar chart spec for a job card's mini runtime trend. */
export function buildJobStackedBarSpec(script) {
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
        marker: { color: '#EF4444', size: 8, symbol: 'circle', line: { color: '#fff', width: 1.5 } },
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
      font: { color: '#64748b', size: 10, family: 'Inter, system-ui, sans-serif' },
      xaxis: {
        tickfont: { size: 9 },
        showgrid: false,
        zeroline: false,
        tickangle: -30,
      },
      yaxis: {
        title: { text: 'Minutes', font: { size: 9, color: '#94a3b8' } },
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

/** Heatmap spec for a script's per-day runtime pattern. */
export function getScriptHeatmapSpec(script) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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

  const uniqueWeeks = [...new Set(runs.map(r => r.week))].sort((a, b) => a - b);
  const weeks = uniqueWeeks.length > 0 ? uniqueWeeks.map(w => `${w}`) : ['No Data'];

  const zMatrix = Array(7).fill(0).map(() => Array(weeks.length).fill(null));
  const textMatrix = Array(7).fill('').map(() => Array(weeks.length).fill(''));
  const annotations = [];

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  runs.forEach(run => {
    const wIdx = uniqueWeeks.indexOf(run.week);
    if (wIdx !== -1 && run.dayIndex >= 0 && run.dayIndex < 7) {
      if (zMatrix[run.dayIndex][wIdx] === null) {
        zMatrix[run.dayIndex][wIdx] = run.durationMin;
        textMatrix[run.dayIndex][wIdx] = run.durationFormatted;

        const dateObj = parseISO(run.date);
        if (!isNaN(dateObj)) {
          const dateString = `${monthNames[dateObj.getMonth()]} ${dateObj.getDate()}`;
          annotations.push({
            x: wIdx + 0.47,
            y: run.dayIndex - 0.47,
            text: dateString,
            showarrow: false,
            font: { size: 10, color: '#334155' },
            xanchor: 'right',
            yanchor: 'top',
          });
        }

        if (run.isOutlier) {
          annotations.push({
            x: wIdx - 0.47,
            y: run.dayIndex - 0.47,
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
          [1.0, '#991b1b'],
        ],
        colorbar: {
          title: 'Avg Duration (s)',
          titleside: 'top',
          thickness: 14,
          len: 0.9,
          tickfont: { size: 10, color: '#64748b' },
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
      font: { color: '#334155', size: 11, family: 'Inter, system-ui, sans-serif' },
      xaxis: { title: { text: 'ISO Week Number', font: { size: 11, color: '#64748b' } }, type: 'category' },
      yaxis: { title: { text: 'Day of Week', font: { size: 11, color: '#64748b' } }, autorange: 'reversed' },
      annotations: annotations,
    },
  };
}

/** Mocked per-cell execution details shown before the real API response arrives. */
export function getCellExecutionDetails(script, weekLabel, dayLabel) {
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

/** Gantt/waterfall chart spec for a single run's step breakdown. */
export function getRunGanttSpec(run) {
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

  baseTimes.push(0);
  dbTimes.push(0);
  cpuTimes.push(0);
  totalCpuTimes.push(totalCpu);
  totalDbTimes.push(0);

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
        marker: { color: '#5c8aea' },
        text: dbTimes.map(formatNum),
        textposition: 'inside',
        textfont: { color: 'white' },
      },
      {
        x: steps,
        y: cpuTimes,
        name: 'CPU Time',
        type: 'bar',
        marker: { color: '#637081' },
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
      font: { color: '#334155', size: 10 },
      yaxis: { title: { text: 'Time (s)', font: { size: 10 } }, tickformat: ',' },
      xaxis: { tickangle: -45 },
      showlegend: true,
      legend: { orientation: 'h', y: 1.15, x: 0.5, xanchor: 'center' }
    },
  };
}

export function getCategoryColor(category) {
  const colors = {
    ETL: '#3b82f6',
    Backup: '#10b981',
    'Alert Check': '#f59e0b',
    Cleanup: '#8b5cf6',
    'Data Sync': '#06b6d4',
  };
  return colors[category];
}

export function getHealthColor(health) {
  const colors = {
    Healthy: '#10b981',
    Warning: '#f59e0b',
    Critical: '#ef4444',
  };
  return colors[health];
}

export function getHeatmapColor(runtime) {
  if (runtime === 0) return '#f3f4f6';
  if (runtime < 50) return '#dbeafe';
  if (runtime < 80) return '#93c5fd';
  if (runtime < 100) return '#3b82f6';
  return '#1e40af';
}

export function getMonthlyHeatmapColor(executions) {
  if (executions === 0) return '#f3f4f6';
  if (executions < 5) return '#dbeafe';
  if (executions < 10) return '#93c5fd';
  if (executions < 12) return '#3b82f6';
  return '#1e40af';
}

export function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours}h ${mins}m`;
}
