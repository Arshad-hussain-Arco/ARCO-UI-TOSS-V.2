/**
 * Logic for KPI tiles, distribution ring, and job status trend calculations.
 */

const SUCCESS = new Set(['Done']);
const FAILED = new Set(['Failed', 'Killed']);
const LIVE = new Set(['Running', 'Queued']);
export const STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400];

export const share = (n, total) => (total ? Math.round((n / total) * 1000) / 10 : 0);

/** Axis ticks for a chart whose largest value is `max`: [0, step, 2*step ...] */
export function niceTicks(max, target = 4) {
  const m = Math.max(1, Math.ceil(max));
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => m / s <= target) ?? 1000;
  const ticks = [];
  for (let t = 0; t < m + step; t += step) {
    ticks.push(t);
    if (t >= m) break;
  }
  return ticks;
}

export function tiles(c = {}, runStatus = null) {
  const counts = {
    total: c.total ?? 0,
    done: c.done ?? 0,
    skipped: c.skipped ?? 0,
    failed: c.failed ?? 0,
    killed: c.killed ?? 0,
    running: c.running ?? 0,
    queued: c.queued ?? 0,
    on_hold: c.on_hold ?? 0,
    waiting: c.waiting ?? 0,
  };

  const total = counts.total || 0;
  const completed = counts.done;
  const failed = counts.failed + counts.killed;
  const running = counts.running + counts.queued;
  const waiting = counts.waiting + counts.skipped;
  const holdSub = runStatus === 'Needs attention' ? 'need an operator' : (counts.on_hold ? 'on hold' : '0 on hold');

  const t = (key, label, value, sub, tone) => ({ key, label, value, pct: share(value, total), sub, tone });
  return [
    { key: 'total', label: 'TOTAL JOBS', value: total, pct: null, sub: `${(waiting + counts.on_hold).toLocaleString()} not started yet`, tone: 'accent' },
    t('completed', 'COMPLETED', completed, `${share(completed, total)}% done`, 'ok'),
    t('failed', 'FAILED', failed, `${share(failed, total)}% failed`, 'bad'),
    t('running', 'RUNNING', running, `${running} running now`, 'warn'),
    t('hold', 'ON HOLD', counts.on_hold, holdSub, 'hold'),
    t('waiting', 'WAITING', waiting, 'for their turn', 'idle'),
  ];
}

export function distribution(c = {}) {
  const total = c.total || 0;
  return [
    { label: 'Done', value: c.done || 0, pct: share(c.done || 0, total), color: 'var(--st-done, #16a34a)' },
    { label: 'Skipped', value: c.skipped || 0, pct: share(c.skipped || 0, total), color: 'var(--st-skipped, #aab3c1)' },
    { label: 'Running', value: c.running || 0, pct: share(c.running || 0, total), color: 'var(--st-running, #f59e0b)' },
    { label: 'Queued', value: c.queued || 0, pct: share(c.queued || 0, total), color: 'var(--st-queued, #0ea5e9)' },
    { label: 'Failed', value: c.failed || 0, pct: share(c.failed || 0, total), color: 'var(--st-failed, #dc2626)' },
    { label: 'Killed', value: c.killed || 0, pct: share(c.killed || 0, total), color: 'var(--st-killed, #475569)' },
    { label: 'On hold', value: c.on_hold || 0, pct: share(c.on_hold || 0, total), color: 'var(--st-on-hold, #7c3aed)' },
    { label: 'Waiting', value: c.waiting || 0, pct: share(c.waiting || 0, total), color: 'var(--st-waiting, #8a94a6)' },
  ].filter((r) => r.value > 0);
}

export function trend(jobs = [], run = {}, now = Date.now(), max = 18) {
  const start = Date.parse(run?.started_at);
  if (!Number.isFinite(start)) {
    return { stepSeconds: 10, buckets: [] };
  }
  const jobEnds = jobs.filter((j) => j.ended_at).map((j) => Date.parse(j.ended_at));
  const maxJobEnd = jobEnds.length ? Math.max(...jobEnds) : start + 60000;

  let end;
  if (run?.ended_at) {
    end = Date.parse(run.ended_at);
  } else if (run?.took && typeof run.took === 'string') {
    const match = run.took.match(/(\d+):(\d+)/);
    if (match) {
      const tookSec = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
      end = start + tookSec * 1000;
    } else {
      end = maxJobEnd;
    }
  } else if (now > start && (now - start) < 86400000) {
    end = Math.max(now, maxJobEnd);
  } else {
    end = maxJobEnd;
  }

  const span = Math.max(10000, end - start);
  const stepSeconds = STEPS.find((s) => Math.ceil(span / (s * 1000)) <= max) ?? 10;
  const n = Math.max(1, Math.min(max, Math.ceil(span / (stepSeconds * 1000))));
  const buckets = Array.from({ length: n }, (_, i) => ({
    from: start + i * stepSeconds * 1000,
    to: start + (i + 1) * stepSeconds * 1000,
    success: 0,
    failed: 0,
    running: 0,
  }));
  const at = (iso) => {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return 0;
    const idx = Math.floor((t - start) / (stepSeconds * 1000));
    return Math.min(n - 1, Math.max(0, idx));
  };

  for (const j of jobs) {
    if (SUCCESS.has(j.status) && j.ended_at) buckets[at(j.ended_at)].success++;
    else if (FAILED.has(j.status) && j.ended_at) buckets[at(j.ended_at)].failed++;
    else if (LIVE.has(j.status) && j.started_at) buckets[at(j.started_at)].running++;
  }
  return { stepSeconds, buckets };
}

export function groupRows(jobs = [], groupOfFn = (name) => 'EOD-CORE') {
  const map = new Map();
  for (const j of jobs) {
    const g =
      j.group ||
      (typeof groupOfFn === 'function' ? groupOfFn(j.name) || groupOfFn(j) : 'EOD-CORE') ||
      'EOD-CORE';
    if (!map.has(g)) {
      map.set(g, {
        name: g,
        group: g,
        total: 0,
        ok: 0,
        success: 0,
        failed: 0,
        running: 0,
        on_hold: 0,
        skipped: 0,
        waiting: 0,
        first: j.level ?? 999,
      });
    }
    const r = map.get(g);
    r.total++;
    r.first = Math.min(r.first, j.level ?? r.first);

    const st = (j.status || '').toUpperCase();
    if (['DONE', 'SUCCESS', 'FINISHED', 'OK'].includes(st)) {
      r.ok++;
      r.success++;
    } else if (['FAILED', 'ERROR', 'NOTOK', 'KILLED', 'ABORTED'].includes(st)) {
      r.failed++;
    } else if (['RUNNING', 'ACTIVE', 'QUEUED', 'SUBMITTED'].includes(st)) {
      r.running++;
    } else if (['ON HOLD', 'ON_HOLD', 'HOLD'].includes(st)) {
      r.on_hold++;
    } else if (['SKIPPED', 'IGNORED'].includes(st)) {
      r.skipped++;
    } else {
      r.waiting++;
    }
  }
  return [...map.values()]
    .map((r) => {
      const pct = r.total > 0 ? Math.round((r.ok / r.total) * 100) : 0;
      let state = 'waiting';
      if (r.failed > 0) state = 'bad';
      else if (r.running > 0) state = 'run';
      else if (r.on_hold > 0) state = 'hold';
      else if (r.total > 0 && r.ok === r.total) state = 'good';
      else if (r.ok > 0) state = 'partial';

      return {
        ...r,
        group: r.name,
        pct,
        state,
        jobs: `${r.ok} / ${r.failed} / ${r.running}`,
      };
    })
    .sort((a, b) => a.first - b.first || a.name.localeCompare(b.name));
}

export function upcoming(jobs = [], limit = 5) {
  return jobs
    .filter((j) => j.status === 'Waiting' || j.status === 'On hold' || j.status === 'Skipped')
    .slice(0, limit)
    .map((j) => ({ name: j.name, group: j.group || 'EOD-CORE', level: j.level || 1, status: j.status }));
}

export function runningRows(jobs = [], limit = 5) {
  return jobs
    .filter((j) => LIVE.has(j.status))
    .slice(0, limit)
    .map((j) => ({ name: j.name, group: j.group || 'EOD-CORE', status: j.status, started_at: j.started_at }));
}

export function failureRows(jobs = [], limit = 5) {
  return jobs
    .filter((j) => FAILED.has(j.status))
    .slice(0, limit)
    .map((j) => ({ name: j.name, group: j.group || 'EOD-CORE', status: j.status, error_message: j.error_message || 'Job exited with non-zero exit code' }));
}
