/**
 * Cockpit Data Source: Provides seed data matching the UI screenshots
 * (Run #10 SIT Finished and Run #1 DEV Running/Needs attention)
 * and connects with live backend APIs (eodSchedulerService).
 */

// Group color mapping matching the orchestrator design
export const GROUP_COLORS = {
  'INTRADAY': '#3b82f6',
  'PRE-EOD': '#10b981',
  'MARKET-DATA': '#8b5cf6',
  'TRADE-FEEDS': '#06b6d4',
  'EOD-CORE': '#f59e0b',
  'REPORTS': '#ec4899',
  'ACCOUNTING': '#6366f1',
  'COLLATERAL': '#14b8a6',
};

export const getGroupColor = (group) => GROUP_COLORS[group] || '#64748b';

// Group job counts from screenshot 0
export const APPLICATION_GROUPS = [
  { group: 'INTRADAY', state: 'good', jobs: '8 / 0 / 0', total: 8, success: 8, failed: 0, running: 0 },
  { group: 'PRE-EOD', state: 'good', jobs: '8 / 0 / 0', total: 8, success: 8, failed: 0, running: 0 },
  { group: 'MARKET-DATA', state: 'good', jobs: '57 / 0 / 0', total: 57, success: 57, failed: 0, running: 0 },
  { group: 'TRADE-FEEDS', state: 'good', jobs: '29 / 0 / 0', total: 29, success: 29, failed: 0, running: 0 },
  { group: 'EOD-CORE', state: 'good', jobs: '12 / 0 / 0', total: 12, success: 12, failed: 0, running: 0 },
];

// Helper to generate 309 realistic jobs matching levels 1-40 from murex_eod_full.xml
export function generateBatchDefinition() {
  const jobs = [];
  const levelJobCounts = {
    1: 1, 2: 7, 3: 1, 4: 1, 5: 2, 6: 1, 7: 1, 8: 1, 9: 30, 10: 30,
    11: 21, 12: 2, 13: 2, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1,
    21: 1, 22: 1, 23: 1, 24: 1, 25: 1, 26: 1, 27: 21, 28: 14, 29: 14, 30: 10,
    31: 4, 32: 3, 33: 10, 34: 3, 35: 1, 36: 1, 37: 1, 38: 1, 39: 1, 40: 1,
  };

  const keyJobNames = [
    'CHK_MX_SERVICES', 'INTRA_LIMIT_CHECK', 'INTRA_MD_SNAPSHOT', 'INTRA_POS_TO_ALM',
    'INTRA_FX_NOP', 'INTRA_PAYMENTS_MON', 'INTRA_PL_FLASH', 'CHK_DB_TABLESPACE',
    'FO_EOD_CUTOFF', 'LOCK_MX_USERS', 'DB_BACKUP_PRE_EOD', 'CHK_PENDING_DEALS',
    'FW_RATES_EUR', 'FW_RATES_GBP', 'FW_RATES_SAR', 'FW_RATES_USD', 'FW_RATES_AED',
    'MLC_EXPOSURE_CALC', 'ACC_POS'
  ];

  const jobsByLevel = {};
  for (let lv = 1; lv <= 40; lv++) jobsByLevel[lv] = [];

  let jobIndex = 0;
  for (let lv = 1; lv <= 40; lv++) {
    const count = levelJobCounts[lv] || 1;
    for (let c = 0; c < count; c++) {
      let name;
      let group;
      if (jobIndex < keyJobNames.length && c === 0) {
        name = keyJobNames[jobIndex];
      } else {
        name = `JOB_${lv < 10 ? '0' : ''}${lv}_${String.fromCharCode(65 + (c % 26))}${c >= 26 ? Math.floor(c / 26) : ''}`;
      }

      if (lv <= 3) group = 'INTRADAY';
      else if (lv <= 8) group = 'PRE-EOD';
      else if (lv <= 13) group = 'MARKET-DATA';
      else if (lv <= 26) group = 'TRADE-FEEDS';
      else group = 'EOD-CORE';

      const job = {
        name,
        group,
        level: lv,
        action: 'run',
        command: `/opt/murex/scripts/${name.toLowerCase()}.sh`,
        target: 'srv-murex-app-01',
        predecessors: [],
        successors: [],
      };
      jobs.push(job);
      jobsByLevel[lv].push(job);
      jobIndex++;
    }
  }

  // Ensure exact total of 309 jobs
  while (jobs.length < 309) {
    const lv = 27 + (jobs.length % 5);
    const job = {
      name: `MX_POST_CALC_${jobs.length}`,
      group: 'EOD-CORE',
      level: lv,
      action: 'run',
      command: `/opt/murex/scripts/post_calc.sh`,
      target: 'srv-murex-app-01',
      predecessors: [],
      successors: [],
    };
    jobs.push(job);
    jobsByLevel[lv].push(job);
  }

  // Connect adjacent levels with real reciprocal edges
  for (let lv = 2; lv <= 40; lv++) {
    const prev = jobsByLevel[lv - 1];
    const curr = jobsByLevel[lv];
    if (!prev?.length || !curr?.length) continue;
    curr.forEach((cj, i) => {
      const p = prev[i % prev.length];
      if (!cj.predecessors.includes(p.name)) cj.predecessors.push(p.name);
      if (!p.successors.includes(cj.name)) p.successors.push(cj.name);
    });
  }

  return {
    file: {
      id: 10,
      name: 'murex_eod_full_20261027_1344.xml',
      checksum: 'e7c9b3f12a84',
      imported_at: '2026-10-27T13:44:00Z',
    },
    job_count: 309,
    level_count: 40,
    jobs: jobs.slice(0, 309),
  };
}

// Pre-built static definition
export const SAMPLE_DEFINITION = generateBatchDefinition();

// Seed for Run #10 (SIT Finished) - Screenshot 0
export function getRun10Data() {
  const baseDef = SAMPLE_DEFINITION;
  const startedAt = '2026-10-28 11:31:00';
  const endedAt = '2026-10-28 11:34:00';
  const startTimeMs = Date.parse('2026-10-28T11:31:00Z');

  const jobs = baseDef.jobs.map((j, idx) => {
    const offset = Math.floor((idx / 309) * 170000);
    const jobStart = new Date(startTimeMs + offset).toISOString();
    const durationMs = 1000 + ((idx * 37) % 5000);
    const jobEnd = new Date(startTimeMs + offset + durationMs).toISOString();
    return {
      name: j.name,
      group: j.group,
      level: j.level,
      status: 'Done',
      action: 'run',
      attempt: 1,
      started_at: jobStart,
      ended_at: jobEnd,
      exit_code: 0,
      duration_seconds: Math.round(durationMs / 1000),
      command: j.command,
      target: j.target,
    };
  });

  return {
    id: 10,
    environment: 'sit',
    status: 'Finished',
    started_at: '2026-10-28T11:31:00Z',
    ended_at: '2026-10-28T11:34:00Z',
    file_name: 'murex_eod_full_20261027_1344.xml',
    took: '02:59',
    options: { simulate_all: true, simulated: true },
    counts: {
      total: 309,
      done: 309,
      failed: 0,
      running: 0,
      on_hold: 0,
      waiting: 0,
      skipped: 0,
      killed: 0,
      queued: 0,
    },
    jobs,
  };
}

// Seed for Run #1 (DEV Needs attention / Running) - Screenshots 1 & 2
export function getRun1Data() {
  const baseDef = SAMPLE_DEFINITION;
  const startTimeMs = Date.parse('2026-11-09T18:25:32Z');

  const jobs = baseDef.jobs.map((j, idx) => {
    const offset = Math.floor((idx / 309) * 240000);
    const jobStart = new Date(startTimeMs + offset).toISOString();
    let durationMs = 2000;
    if (j.name === 'FW_RATES_EUR' || j.name === 'FW_RATES_GBP' || j.name === 'FW_RATES_SAR' || j.name === 'FW_RATES_USD') {
      durationMs = 6000;
    } else if (j.name === 'MLC_EXPOSURE_CALC' || j.name === 'ACC_POS' || j.name === 'CHK_MX_SERVICES') {
      durationMs = 3000;
    } else if (j.name === 'CHK_DB_TABLESPACE') {
      durationMs = 1000;
    }

    const jobEnd = new Date(startTimeMs + offset + durationMs).toISOString();

    let status = 'Done';
    if (idx === 308) {
      status = 'On hold';
    } else if (idx >= 292) {
      status = 'Waiting';
    }

    return {
      name: j.name,
      group: j.group,
      level: j.level,
      status,
      action: status === 'On hold' ? 'hold' : 'run',
      attempt: 1,
      started_at: (status === 'Waiting' || status === 'On hold') ? null : jobStart,
      ended_at: (status === 'Waiting' || status === 'On hold') ? null : jobEnd,
      exit_code: status === 'Done' ? 0 : null,
      duration_seconds: Math.round(durationMs / 1000),
      command: j.command,
      target: j.target,
    };
  });

  return {
    id: 1,
    environment: 'dev',
    status: 'Needs attention',
    sub_status: 'Running',
    started_at: '2026-11-09T18:25:32Z',
    ended_at: null,
    file_name: 'murex_eod_full_20261027_1344.xml',
    took: '04:08 so far',
    options: { simulate_all: false },
    counts: {
      total: 309,
      done: 292,
      failed: 0,
      running: 0,
      on_hold: 1,
      waiting: 16,
      skipped: 0,
      killed: 0,
      queued: 0,
    },
    jobs,
  };
}

export const PAST_RUNS_LIST = [
  { id: 10, environment: 'sit', status: 'Finished', started_at: '2026-10-28T11:31:00Z', ended_at: '2026-10-28T11:34:00Z', total_jobs: 309 },
  { id: 9, environment: 'sit', status: 'Finished', started_at: '2026-10-27T11:30:15Z', ended_at: '2026-10-27T11:33:45Z', total_jobs: 309 },
  { id: 8, environment: 'sit', status: 'Finished', started_at: '2026-10-26T11:31:02Z', ended_at: '2026-10-26T11:34:10Z', total_jobs: 309 },
  { id: 1, environment: 'dev', status: 'Needs attention', started_at: '2026-11-09T18:25:32Z', ended_at: null, total_jobs: 309 },
];

/**
 * Loads run data from live backend eodSchedulerService.
 * Returns null if no run exists yet.
 */
export async function loadCockpitRun(environment = 'sit', runId = null, useDemo = false) {
  if (useDemo) {
    if (runId === 1 || (runId == null && String(environment).toLowerCase() === 'dev')) {
      return getRun1Data();
    }
    return getRun10Data();
  }

  try {
    const { eodSchedulerService } = await import('@services/eodSchedulerService');
    const data = await eodSchedulerService.getCockpitRun(environment, runId);
    if (data && data.jobs) {
      return data;
    }
  } catch (err) {
    // 404 means no run yet in this environment
    if (err?.response?.status === 404) {
      return null;
    }
  }

  return null;
}

export async function loadCockpitDefinition(environment = 'sit', useDemo = false) {
  if (useDemo) {
    return SAMPLE_DEFINITION;
  }

  try {
    const { eodSchedulerService } = await import('@services/eodSchedulerService');
    const data = await eodSchedulerService.getCockpitDefinition(environment);
    if (data && data.jobs && data.jobs.length > 0) {
      return data;
    }
  } catch (err) {
    if (err?.response?.status === 404) {
      return null;
    }
  }

  return null;
}
