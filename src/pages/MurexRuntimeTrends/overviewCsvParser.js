import rawCsvContent from './MX_EOD_RUNTIME_STATISTICS.csv?raw';

/**
 * Utility functions for parsing time and date strings from MX_EOD_RUNTIME_STATISTICS.csv
 */

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
  const secs = sec % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m${secs > 0 ? ` ${secs}s` : ''}`;
  }
  if (mins > 0) {
    return `${mins}m${secs > 0 ? ` ${secs}s` : ''}`;
  }
  return `${secs}s`;
}

export function parseCsvDateToIso(dateCmp) {
  // Converts "31/07/26" -> "2026-07-31"
  if (!dateCmp) return null;
  const parts = dateCmp.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    let year = parts[2];
    if (year.length === 2) year = '20' + year;
    return `${year}-${month}-${day}`;
  }
  return null;
}

const MONTH_MAP = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
};

export function parseCsvTimestampToPlotly(dateTimeStr, fallbackBaseDateStr) {
  // Converts "31-JUL-2026 23:48:22" or "01-AUG-2026 00:02:11" -> "2026-07-31 23:48:22"
  if (!dateTimeStr) return null;
  const parts = dateTimeStr.trim().split(' ');
  if (parts.length < 2) return null;

  const dateParts = parts[0].split('-');
  if (dateParts.length !== 3) return null;

  const day = dateParts[0].padStart(2, '0');
  const monthName = dateParts[1].toUpperCase();
  const monthIdx = MONTH_MAP[monthName];
  if (monthIdx === undefined) return null;
  const monthNum = String(monthIdx + 1).padStart(2, '0');
  const year = dateParts[2];

  const timeStr = parts[1];
  return `${year}-${monthNum}-${day} ${timeStr}`;
}

/**
 * Main Overview CSV Parser
 */
export function parseOverviewCsvData(csvText = rawCsvContent) {
  if (!csvText) return { availableDates: [], dataByDate: {} };

  const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return { availableDates: [], dataByDate: {} };

  const rawRows = lines.slice(1).map((line, idx) => {
    const parts = line.split(',');
    const dateCmp = parts[0] ? parts[0].trim() : '';
    const dateTimeCmp = parts[1] ? parts[1].trim() : '';
    const scriptName = parts[2] ? parts[2].trim() : '';
    const comment = parts[3] ? parts[3].trim() : '';
    const startEnd = parts[4] ? parts[4].trim() : '';
    const timeCpu = parts[5] ? parts[5].trim() : '';
    const timeSyb = parts[6] ? parts[6].trim() : '';
    const timeElap = parts[7] ? parts[7].trim() : '';
    const finishedTime = parts[8] ? parts[8].trim() : '';

    const isoDate = parseCsvDateToIso(dateCmp);

    return {
      id: idx,
      dateCmp,
      isoDate,
      dateTimeCmp,
      scriptName,
      comment,
      startEnd,
      timeCpu,
      timeSyb,
      timeElap,
      finishedTime,
    };
  });

  // Extract unique ISO dates and sort chronologically
  const uniqueIsoDates = Array.from(new Set(rawRows.map((r) => r.isoDate).filter(Boolean))).sort();

  const dataByDate = {};

  uniqueIsoDates.forEach((isoDate) => {
    const dateRows = rawRows.filter((r) => r.isoDate === isoDate);

    // 1. Process "Job - Duration Matrix" Executions
    // Overall script executions have comment == "Script [SCRPT_NAME]" and startEnd == "END" (or matching pair)
    const overallEndRows = dateRows.filter(
      (r) => r.startEnd === 'END' && r.comment === `Script [${r.scriptName}]`
    );

    // Track occurrences of same script name to display NCB_REP_FEED2_NSC (#1), NCB_REP_FEED2_NSC (#2), etc.
    const scriptCounts = {};
    overallEndRows.forEach((r) => {
      scriptCounts[r.scriptName] = (scriptCounts[r.scriptName] || 0) + 1;
    });

    const scriptSeenCounts = {};

    const matrixJobs = overallEndRows.map((r, idx) => {
      scriptSeenCounts[r.scriptName] = (scriptSeenCounts[r.scriptName] || 0) + 1;
      const count = scriptCounts[r.scriptName];
      const displayName =
        count > 1 ? `${r.scriptName} (#${scriptSeenCounts[r.scriptName]})` : r.scriptName;

      const durationSec = parseTimeStringToSeconds(r.timeElap);
      const durationStr = formatDurationSeconds(durationSec);

      const startPlotly = parseCsvTimestampToPlotly(r.dateTimeCmp, isoDate);
      const endPlotly = parseCsvTimestampToPlotly(r.finishedTime, isoDate);

      const startTimeStr = r.dateTimeCmp ? r.dateTimeCmp.split(' ')[1] || '' : '';
      const endTimeStr = r.finishedTime ? r.finishedTime.split(' ')[1] || '' : '';

      return {
        id: `matrix_job_${r.scriptName}_${idx}`,
        name: displayName,
        rawScriptName: r.scriptName,
        start: startPlotly,
        end: endPlotly,
        rawStartTime: r.dateTimeCmp,
        rawEndTime: r.finishedTime,
        startTimeStr,
        endTimeStr,
        durationSec,
        durationStr,
        timeCpu: r.timeCpu || '00:00:00',
        timeSyb: r.timeSyb || '00:00:00',
      };
    });

    // 2. Process "EOD Job Timeline Accordions"
    const scriptSeenCountsTL = {};

    const timelineList = overallEndRows.map((overallRow, idx) => {
      const scName = overallRow.scriptName;
      scriptSeenCountsTL[scName] = (scriptSeenCountsTL[scName] || 0) + 1;
      const count = scriptCounts[scName];
      const displayName = count > 1 ? `${scName} (#${scriptSeenCountsTL[scName]})` : scName;

      // Filter step END rows strictly between this overall run's start and end time
      const startPlotly = parseCsvTimestampToPlotly(overallRow.dateTimeCmp, isoDate);
      const endPlotly = parseCsvTimestampToPlotly(overallRow.finishedTime, isoDate);
      const overallStartMs = new Date(startPlotly.replace(' ', 'T')).getTime();
      const overallEndMs = new Date(endPlotly.replace(' ', 'T')).getTime();

      const scRows = dateRows.filter((r) => r.scriptName === scName);
      
      const stepRows = scRows.filter((r) => {
        if (r.startEnd !== 'END' || r.comment === `Script [${scName}]`) return false;
        
        const stepEndPlotly = parseCsvTimestampToPlotly(r.finishedTime, isoDate);
        if (!stepEndPlotly) return false;
        
        const stepEndMs = new Date(stepEndPlotly.replace(' ', 'T')).getTime();
        // Allow a small 60-second margin for CSV timestamp inaccuracies
        return stepEndMs >= overallStartMs - 60000 && stepEndMs <= overallEndMs + 60000;
      });

      const startTimeStr = overallRow.dateTimeCmp || '';
      const endTimeStr = overallRow.finishedTime || '';
      const durationSec = parseTimeStringToSeconds(overallRow.timeElap);
      const durationStr = formatDurationSeconds(durationSec);

      const categories = [
        { key: 'overall', name: 'Overall Job', color: '#3B82F6' },
        { key: 'cpu', name: 'Time_CPU', color: '#EC4899' },
        { key: 'syb', name: 'Time_Syb', color: '#00B4D8' },
        { key: 'idle', name: 'Idle / Wait', color: '#CBD5E1' },
      ];

      // Build overall row
      const parsedRows = [];

      parsedRows.push({
        id: `overall_${scName}_${idx}`,
        name: `${displayName} (overall)`,
        unit: `${scName}_OVERALL`,
        segments: [
          {
            type: 'overall',
            typeName: 'Overall Job',
            start: startPlotly,
            end: endPlotly,
            durationSec,
            durationFormatted: durationStr,
            rawStart: overallRow.dateTimeCmp,
            rawEnd: overallRow.finishedTime,
          },
        ],
      });

      // Build step rows
      stepRows.forEach((step, sIdx) => {
        let stepName = step.comment.replace(`Script [${scName}] : `, '').trim();
        if (!stepName) stepName = `Step #${sIdx + 1}`;

        const startPlotly = parseCsvTimestampToPlotly(step.dateTimeCmp, isoDate);
        const endPlotly = parseCsvTimestampToPlotly(step.finishedTime, isoDate);

        const cpuSec = parseTimeStringToSeconds(step.timeCpu);
        const sybSec = parseTimeStringToSeconds(step.timeSyb);
        const totalSec = parseTimeStringToSeconds(step.timeElap);
        const idleSec = Math.max(0, totalSec - (cpuSec + sybSec));

        const segments = [];
        const startMs = new Date(startPlotly.replace(' ', 'T')).getTime();

        // Idle segment
        if (idleSec > 0) {
          const idleEndMs = startMs + idleSec * 1000;
          segments.push({
            type: 'idle',
            typeName: 'Idle / Wait',
            start: startPlotly,
            end: formatPlotlyDateFromMs(idleEndMs),
            durationSec: idleSec,
            durationFormatted: formatDurationSeconds(idleSec),
          });
        }

        // CPU segment
        if (cpuSec > 0) {
          const cpuStartMs = startMs + idleSec * 1000;
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

        // Syb segment
        if (sybSec > 0) {
          const sybStartMs = startMs + (idleSec + cpuSec) * 1000;
          const sybEndMs = sybStartMs + sybSec * 1000;
          segments.push({
            type: 'syb',
            typeName: 'Time_Syb',
            start: formatPlotlyDateFromMs(sybStartMs),
            end: endPlotly || formatPlotlyDateFromMs(sybEndMs),
            durationSec: sybSec,
            durationFormatted: formatDurationSeconds(sybSec),
          });
        }

        parsedRows.push({
          id: `step_${scName}_${sIdx}`,
          name: stepName,
          unit: scName,
          segments,
        });
      });

      // Compute minimum start and maximum end for chart X range
      let minMs = Infinity;
      let maxMs = -Infinity;
      parsedRows.forEach((r) => {
        r.segments.forEach((seg) => {
          if (seg.start) {
            const sMs = new Date(seg.start.replace(' ', 'T')).getTime();
            if (!isNaN(sMs)) minMs = Math.min(minMs, sMs);
          }
          if (seg.end) {
            const eMs = new Date(seg.end.replace(' ', 'T')).getTime();
            if (!isNaN(eMs)) maxMs = Math.max(maxMs, eMs);
          }
        });
      });

      let xRange = null;
      if (minMs !== Infinity && maxMs !== -Infinity) {
        const padMs = 5 * 60 * 1000; // 5 minutes padding
        xRange = [formatPlotlyDateFromMs(minMs - padMs), formatPlotlyDateFromMs(maxMs + padMs)];
      }

      return {
        id: `timeline_${scName}`,
        jobInfo: {
          title: `${scName} Timeline`,
          scriptName: scName,
          startTimeStr,
          endTimeStr,
          durationStr,
          baseDate: isoDate,
          xRange,
        },
        categories,
        rows: parsedRows,
      };
    });

    dataByDate[isoDate] = {
      date: isoDate,
      matrixJobs,
      timelineList,
    };
  });

  return { availableDates: uniqueIsoDates, dataByDate };
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

// Export parsed singleton data object for Overview Tab
export const overviewParsedData = parseOverviewCsvData(rawCsvContent);
