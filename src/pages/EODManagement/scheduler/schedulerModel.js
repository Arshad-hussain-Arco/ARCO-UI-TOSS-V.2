/**
 * Pure logic of the Scheduler tab (no React, no network): graph layout, status tones, error grouping, approval state and small validators.
 * Kept separate so it can be tested with node's built-in runner (npm run test:scheduler).
 */

export const NODE_WIDTH = 190;
export const NODE_HEIGHT = 54;
const X_GAP = 80;
const Y_GAP = 30;

/**
 * Deterministic layered layout (no graph library): a node's column is the length of the longest dependency path leading to it; rows inside a
 * column are ordered by the average row of the node's predecessors, then by definition order. Cycle-safe: affected nodes stop climbing after
 * |nodes| passes.
 */
export function layeredLayout(nodes, edges) {
  const ids = nodes.map((n) => n.id);
  const known = new Set(ids);
  const preds = new Map(ids.map((id) => [id, []]));
  for (const e of edges) {
    if (known.has(e.source) && known.has(e.target) && e.source !== e.target) {
      const list = preds.get(e.target);
      if (!list.includes(e.source)) list.push(e.source);
    }
  }
  const layer = new Map(ids.map((id) => [id, 0]));
  for (let pass = 0; pass < ids.length; pass += 1) {
    let changed = false;
    for (const id of ids) {
      for (const p of preds.get(id)) {
        if (layer.get(id) < layer.get(p) + 1) {
          layer.set(id, layer.get(p) + 1);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  const order = new Map(ids.map((id, i) => [id, i]));
  const columns = new Map();
  for (const id of ids) columns.set(layer.get(id), [...(columns.get(layer.get(id)) ?? []), id]);
  const row = new Map();
  const out = {};
  for (const col of [...columns.keys()].sort((a, b) => a - b)) {
    const members = columns.get(col);
    const bary = (id) => {
      const rows = preds
        .get(id)
        .filter((p) => row.has(p))
        .map((p) => row.get(p));
      return rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : order.get(id);
    };
    members.sort((a, b) => bary(a) - bary(b) || order.get(a) - order.get(b));
    members.forEach((id, i) => {
      row.set(id, i);
      out[id] = { x: col * (NODE_WIDTH + X_GAP), y: i * (NODE_HEIGHT + Y_GAP) };
    });
  }
  return out;
}

/** Width and height of the drawing that holds a layout. */
export function graphBounds(layout) {
  const pts = Object.values(layout);
  if (!pts.length) return { width: 0, height: 0 };
  return {
    width: Math.max(...pts.map((p) => p.x)) + NODE_WIDTH,
    height: Math.max(...pts.map((p) => p.y)) + NODE_HEIGHT,
  };
}

/** An edge is dashed blue for a condition, solid grey for a plain dependency, red when it only fires on failure. */
export function edgeStyle(edge) {
  const color = edge.branch === 'FAILURE' ? 'danger' : edge.kind === 'CONDITION' ? 'info' : 'muted';
  return { tone: color, dashed: edge.kind === 'CONDITION' };
}

/** Tone (css class suffix) of one job's status in a run. */
export function jobTone(status) {
  switch (status) {
    case 'SUCCESS':
      return 'good';
    case 'FAILED':
    case 'TIMED_OUT':
      return 'bad';
    case 'RUNNING':
      return 'run';
    case 'PENDING':
      return 'wait';
    case 'SKIPPED':
    case 'CANCELLED':
      return 'off';
    default:
      return 'idle';
  }
}

/** Tone of a whole run. RECOVERED means every failure was covered by a branch; INTERRUPTED means the engine stopped (never resumed). */
export function runTone(status) {
  switch (status) {
    case 'SUCCESS':
    case 'RECOVERED':
      return 'good';
    case 'RUNNING':
      return 'run';
    case 'FAILED':
    case 'INTERRUPTED':
      return 'bad';
    case 'SKIPPED':
    case 'CANCELLED':
      return 'off';
    default:
      return 'idle';
  }
}

/** Colour state of every graph node for a run: {jobName: {label, tone}}. Without a run the nodes show nothing. */
export function nodeStates(runDetail) {
  const out = {};
  for (const j of runDetail?.jobs ?? [])
    out[j.job] = { label: String(j.status || '').toLowerCase(), tone: jobTone(j.status) };
  return out;
}

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return '—';
  const s = Math.max(0, Math.round(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : m
      ? `${m}m ${String(r).padStart(2, '0')}s`
      : `${r}s`;
}

/** Seconds between two backend timestamps ("YYYY-MM-DD HH:MM:SS.mmm", local time); null when either is missing. */
export function secondsBetween(start, end) {
  if (!start || !end) return null;
  const a = Date.parse(String(start).replace(' ', 'T'));
  const b = Date.parse(String(end).replace(' ', 'T'));
  return Number.isNaN(a) || Number.isNaN(b) ? null : (b - a) / 1000;
}

/**
 * The same problem reported for many jobs is shown once: "F/JOB1: INCOND 'X' ..." and "F/JOB2: INCOND 'X' ..." become one entry with a count.
 */
export function groupMessages(messages) {
  const groups = new Map();
  for (const raw of messages ?? []) {
    const text = String(raw);
    const m = /^([^:]{1,200}?):\s(.*)$/s.exec(text);
    const who = m && m[1].includes('/') ? m[1] : null;
    const what = who ? m[2] : text;
    const g = groups.get(what) ?? { text: what, count: 0, where: [] };
    g.count += 1;
    if (who && g.where.length < 5) g.where.push(who);
    groups.set(what, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

/**
 * What the approval bar should say and allow. `view` is the workflow review from the backend.
 * states: none (nothing uploaded), blocked (errors), pending (reviewable, not approved), approved.
 */
export function approvalState(view, hasPermission) {
  if (!view?.loaded)
    return { state: 'none', label: 'No workflow uploaded', canApprove: false, canRun: false };
  const errors = view.errors?.length ?? 0;
  if (errors)
    return {
      state: 'blocked',
      label: `${errors} problem(s) must be fixed before approval`,
      canApprove: false,
      canRun: false,
    };
  if (!view.approved) {
    return {
      state: 'pending',
      label: 'Reviewed, not approved',
      canApprove: Boolean(hasPermission?.('EOD_SCHEDULER_APPROVE')),
      canRun: false,
    };
  }
  return {
    state: 'approved',
    label: 'Approved',
    canApprove: false,
    canRun: Boolean(hasPermission?.('EOD_SCHEDULER_EXECUTE')),
  };
}

export function targetLabel(target) {
  if (!target) return '—';
  if (!target.ok) return `Not runnable (${target.code})`;
  return `${target.username}@${target.host}:${target.port}`;
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isHHMM = (text) => HHMM.test(String(text ?? ''));

const FINGERPRINT = /^SHA256:[A-Za-z0-9+/]{43}$/;
export const isFingerprint = (text) => FINGERPRINT.test(String(text ?? '').trim());

const ENV_CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,49}$/;
export const isEnvironmentCode = (text) => ENV_CODE.test(String(text ?? ''));

/** The settings that differ from what is stored, ready for a PATCH (nothing sent for unchanged fields). */
export function settingsChanges(original, draft, keys) {
  const out = {};
  for (const k of keys) {
    if (JSON.stringify(original?.[k]) !== JSON.stringify(draft?.[k])) out[k] = draft[k];
  }
  return out;
}

/** Parse the "variables" box: a JSON object of text values. Returns {value} or {error}. */
export function parseVariables(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return { value: {} };
  try {
    const value = JSON.parse(trimmed);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return { error: 'Variables must be a JSON object, for example {"NAME": "value"}.' };
    for (const v of Object.values(value))
      if (typeof v !== 'string') return { error: 'Every variable value must be text.' };
    return { value };
  } catch {
    return { error: 'Variables are not valid JSON.' };
  }
}

/** Rows of the job table for one folder, filtered by a search text (job name, target or command). */
export function filterJobs(jobs, query) {
  const q = String(query ?? '')
    .trim()
    .toLowerCase();
  if (!q) return jobs;
  return jobs.filter((j) =>
    [j.name, j.command, targetLabel(j.target), j.schedule].some((v) =>
      String(v ?? '')
        .toLowerCase()
        .includes(q),
    ),
  );
}

/**
 * What the environment bar should warn about, from the environment record the API returns ({enabled, engine: {mode, publish_error, heartbeat}}).
 * tones: bad (nothing will run), warn (will not run until something is started), info (works, but not the production set-up).
 */
export function engineNotice(environment) {
  if (!environment || !environment.enabled) return null;
  const engine = environment.engine;
  if (!engine) {
    return {
      tone: 'warn',
      text: 'No engine is serving this environment, so Run all now and the scheduler do nothing. Start one: python manage.py run_eod_engine',
    };
  }
  if (engine.mode === 'refusing') {
    return {
      tone: 'bad',
      text: 'An engine is serving this environment but is not set up to run jobs: EOD_SCHEDULER_EXECUTION_MODE is not set on the engine. Every job would fail with "no SSH launcher is configured".',
    };
  }
  if (engine.publish_error) {
    return {
      tone: 'bad',
      text: `The engine cannot reach the job queue (${engine.publish_error}). Jobs stay pending and fail after 15 minutes until the broker is reachable.`,
    };
  }
  if (engine.mode === 'inline') {
    return {
      tone: 'info',
      text: 'Development mode: the engine itself runs commands over SSH (no Celery worker). Use queue mode with workers in production.',
    };
  }
  return null;
}
