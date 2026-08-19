/**
 * Shapes the flat run+step payload returned by
 * GET /api/core/runtime-file/overview/ into the matrixJobs/timelineList
 * structures MurexOverviewTab.jsx renders. The backend intentionally stays
 * UI-shape-agnostic (see script_manager.views.RuntimeFileOverviewView) so
 * all display-only concerns - duplicate-name numbering, Plotly timestamp
 * strings, idle/cpu/syb segment layout - live here.
 *
 * Timestamps arrive in two different formats from the API:
 *   - run_start / run_end: ISO 8601 ("2026-08-04T20:40:14")
 *   - step date_time_cmp / finished_time: raw Murex format
 *     ("04-AUG-2026 20:40:14")
 * toPlotlyTimestamp() normalizes either into "YYYY-MM-DD HH:MM:SS" so the
 * rest of the chart-building code (and Plotly itself) only ever deals with
 * one format.
 */

const MONTH_MAP = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};
const MONTH_NAMES_UPPER = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export function parseTimeStringToSeconds(timeStr) {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}

export function formatDurationSeconds(sec) {
  if (sec === undefined || sec === null || isNaN(sec) || sec <= 0) return '0s';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = Math.round(sec % 60);

  if (hrs > 0) {
    return `${hrs}h ${mins}m${secs > 0 ? ` ${secs}s` : ''}`;
  }
  if (mins > 0) {
    return `${mins}m${secs > 0 ? ` ${secs}s` : ''}`;
  }
  return `${secs}s`;
}

/** "04-AUG-2026 20:40:14" -> "2026-08-04 20:40:14" */
function fromMurexCmpFormat(value) {
  const parts = value.trim().split(' ');
  if (parts.length < 2) return null;

  const dateParts = parts[0].split('-');
  if (dateParts.length !== 3) return null;

  const day = dateParts[0].padStart(2, '0');
  const monthIdx = MONTH_MAP[dateParts[1].toUpperCase()];
  if (monthIdx === undefined) return null;
  const monthNum = String(monthIdx + 1).padStart(2, '0');
  const year = dateParts[2];

  return `${year}-${monthNum}-${day} ${parts[1]}`;
}

/** Accepts either ISO ("2026-08-04T20:40:14") or Murex-CMP format, returns "YYYY-MM-DD HH:MM:SS" */
export function toPlotlyTimestamp(value) {
  if (!value) return null;
  const trimmed = String(value).trim();

  if (/^\d{2}-[A-Za-z]{3}-\d{4}/.test(trimmed)) {
    return fromMurexCmpFormat(trimmed);
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.replace('T', ' ').slice(0, 19);
  }

  return null;
}

/** Any accepted timestamp format -> "DD-MMM-YYYY HH:MM:SS" for display, matching the Murex CMP convention */
function toDisplayCmp(value) {
  const plotly = toPlotlyTimestamp(value);
  if (!plotly) return '';
  const [datePart, timePart] = plotly.split(' ');
  const [year, month, day] = datePart.split('-');
  const monthName = MONTH_NAMES_UPPER[Number(month) - 1] || month;
  return `${day}-${monthName}-${year} ${timePart || ''}`.trim();
}

function plotlyToMs(plotlyStr) {
  if (!plotlyStr) return null;
  const ms = new Date(plotlyStr.replace(' ', 'T')).getTime();
  return isNaN(ms) ? null : ms;
}

function formatPlotlyDateFromMs(ms) {
  const d = new Date(ms);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hrs = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hrs}:${mins}:${secs}`;
}

const TIMELINE_CATEGORIES = [
  { key: 'overall', name: 'Overall Job', color: '#3B82F6' },
  { key: 'cpu', name: 'Time_CPU', color: '#EC4899' },
  { key: 'syb', name: 'Time_Syb', color: '#00B4D8' },
  { key: 'idle', name: 'Idle / Wait', color: '#CBD5E1' },
];

/**
 * @param {Array} runs - the API's `data` array for one day: each
 *   { script_name, run_start, run_end, duration_sec, steps: [{ step,
 *     date_time_cmp, finished_time, idle_sec, cpu_sec, db_sec, elapsed_sec }] }
 * @param {string} isoDate - "YYYY-MM-DD", used only as a fallback base date
 * @returns {{ matrixJobs: Array, timelineList: Array }}
 */
export function shapeOverviewRuns(runs = [], isoDate) {
  const scriptCounts = {};
  runs.forEach((r) => {
    scriptCounts[r.script_name] = (scriptCounts[r.script_name] || 0) + 1;
  });

  const matrixSeenCounts = {};
  const matrixJobs = runs.map((run, idx) => {
    matrixSeenCounts[run.script_name] = (matrixSeenCounts[run.script_name] || 0) + 1;
    const count = scriptCounts[run.script_name];
    const displayName = count > 1
      ? `${run.script_name} (#${matrixSeenCounts[run.script_name]})`
      : run.script_name;

    const startPlotly = toPlotlyTimestamp(run.run_start);
    const endPlotly = toPlotlyTimestamp(run.run_end);
    const durationSec = run.duration_sec || 0;

    return {
      id: `matrix_job_${run.script_name}_${idx}`,
      name: displayName,
      rawScriptName: run.script_name,
      start: startPlotly,
      end: endPlotly,
      rawStartTime: startPlotly,
      rawEndTime: endPlotly,
      startTimeStr: startPlotly ? startPlotly.split(' ')[1] || '' : '',
      endTimeStr: endPlotly ? endPlotly.split(' ')[1] || '' : '',
      durationSec,
      durationStr: formatDurationSeconds(durationSec),
    };
  });

  const timelineSeenCounts = {};
  const timelineList = runs.map((run, idx) => {
    timelineSeenCounts[run.script_name] = (timelineSeenCounts[run.script_name] || 0) + 1;
    const count = scriptCounts[run.script_name];
    const displayName = count > 1
      ? `${run.script_name} (#${timelineSeenCounts[run.script_name]})`
      : run.script_name;

    const startPlotly = toPlotlyTimestamp(run.run_start);
    const endPlotly = toPlotlyTimestamp(run.run_end);
    const durationSec = run.duration_sec || 0;

    const parsedRows = [
      {
        id: `overall_${run.script_name}_${idx}`,
        name: `${displayName} (overall)`,
        unit: `${run.script_name}_OVERALL`,
        segments: [
          {
            type: 'overall',
            typeName: 'Overall Job',
            start: startPlotly,
            end: endPlotly,
            durationSec,
            durationFormatted: formatDurationSeconds(durationSec),
            rawStart: toDisplayCmp(run.run_start),
            rawEnd: toDisplayCmp(run.run_end),
          },
        ],
      },
    ];

    (run.steps || []).forEach((step, sIdx) => {
      const stepName = step.step || `Step #${sIdx + 1}`;
      const stepStartPlotly = toPlotlyTimestamp(step.date_time_cmp);
      const stepEndPlotly = toPlotlyTimestamp(step.finished_time);
      const stepStartMs = plotlyToMs(stepStartPlotly);

      const idleSec = step.idle_sec || 0;
      const cpuSec = step.cpu_sec || 0;
      const sybSec = step.db_sec || 0;

      const segments = [];

      if (stepStartMs !== null) {
        if (idleSec > 0) {
          const idleEndMs = stepStartMs + idleSec * 1000;
          segments.push({
            type: 'idle',
            typeName: 'Idle / Wait',
            start: stepStartPlotly,
            end: formatPlotlyDateFromMs(idleEndMs),
            durationSec: idleSec,
            durationFormatted: formatDurationSeconds(idleSec),
          });
        }

        if (cpuSec > 0) {
          const cpuStartMs = stepStartMs + idleSec * 1000;
          const cpuEndMs = cpuStartMs + cpuSec * 1000;
          segments.push({
            type: 'cpu',
            typeName: 'Time_CPU',
            start: formatPlotlyDateFromMs(cpuStartMs),
            end: formatPlotlyDateFromMs(cpuEndMs),
            durationSec: cpuSec,
            durationFormatted: formatDurationSeconds(cpuSec),
          });
        }

        if (sybSec > 0) {
          const sybStartMs = stepStartMs + (idleSec + cpuSec) * 1000;
          const sybEndMs = sybStartMs + sybSec * 1000;
          segments.push({
            type: 'syb',
            typeName: 'Time_Syb',
            start: formatPlotlyDateFromMs(sybStartMs),
            end: stepEndPlotly || formatPlotlyDateFromMs(sybEndMs),
            durationSec: sybSec,
            durationFormatted: formatDurationSeconds(sybSec),
          });
        }
      }

      parsedRows.push({
        id: `step_${run.script_name}_${sIdx}`,
        name: stepName,
        unit: run.script_name,
        segments,
      });
    });

    let minMs = Infinity;
    let maxMs = -Infinity;
    parsedRows.forEach((r) => {
      r.segments.forEach((seg) => {
        const sMs = plotlyToMs(seg.start);
        if (sMs !== null) minMs = Math.min(minMs, sMs);
        const eMs = plotlyToMs(seg.end);
        if (eMs !== null) maxMs = Math.max(maxMs, eMs);
      });
    });

    let xRange = null;
    if (minMs !== Infinity && maxMs !== -Infinity) {
      const padMs = 5 * 60 * 1000;
      xRange = [formatPlotlyDateFromMs(minMs - padMs), formatPlotlyDateFromMs(maxMs + padMs)];
    }

    return {
      id: `timeline_${run.script_name}_${idx}`,
      jobInfo: {
        title: `${run.script_name} Timeline`,
        scriptName: run.script_name,
        startTimeStr: toDisplayCmp(run.run_start),
        endTimeStr: toDisplayCmp(run.run_end),
        durationStr: formatDurationSeconds(durationSec),
        baseDate: isoDate,
        xRange,
      },
      categories: TIMELINE_CATEGORIES,
      rows: parsedRows,
    };
  });

  return { matrixJobs, timelineList };
}
