/**
 * Timeline utilities for Gantt chart, critical chain calculation, and time ticks.
 */

const ms = (iso) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

export function runBars(runJobs, now = Date.now()) {
  const bars = [];
  const list = runJobs instanceof Map ? [...runJobs.values()] : Array.isArray(runJobs) ? runJobs : [];
  for (const j of list) {
    const start = ms(j.started_at);
    if (start == null) continue;
    const ended = ms(j.ended_at);
    const running = ended == null && (j.status === 'Running' || j.status === 'Queued');
    bars.push({
      name: j.name,
      level: j.level || 1,
      status: j.status,
      attempt: j.attempt || 1,
      start,
      end: ended ?? (running ? Math.max(now, start) : start),
      running,
    });
  }
  bars.sort((a, b) => a.start - b.start || a.level - b.level || a.name.localeCompare(b.name));
  return bars;
}

export function criticalChain(defIndex, runJobs) {
  const jobMap = runJobs instanceof Map ? runJobs : new Map((Array.isArray(runJobs) ? runJobs : []).map((j) => [j.name, j]));
  const end = (n) => ms(jobMap.get(n)?.ended_at);
  const start = (n) => ms(jobMap.get(n)?.started_at);

  let last = null;
  for (const j of jobMap.values()) {
    const e = ms(j.ended_at);
    if (e != null && start(j.name) != null && (last == null || e > end(last))) {
      last = j.name;
    }
  }
  if (!last) return { names: [], busyMs: 0, spanMs: 0, gapMs: 0 };

  const timed = (n) => start(n) != null && end(n) != null;
  const gates = (n, seen2 = new Set()) => {
    const out = [];
    const predecessors = defIndex?.get?.(n)?.predecessors || [];
    for (const p of predecessors) {
      if (seen2.has(p)) continue;
      seen2.add(p);
      if (timed(p)) out.push(p);
      else out.push(...gates(p, seen2));
    }
    return out;
  };

  const chain = [last];
  const seen = new Set(chain);
  for (let cur = last; ;) {
    const s = start(cur);
    let gate = null;
    for (const p of gates(cur)) {
      if (seen.has(p) || end(p) > s) continue;
      if (gate == null || end(p) > end(gate)) gate = p;
    }
    if (!gate) break;
    chain.push(gate);
    seen.add(gate);
    cur = gate;
  }
  chain.reverse();
  const busyMs = chain.reduce((sum, n) => sum + Math.max(0, (end(n) || 0) - (start(n) || 0)), 0);
  const spanMs = (end(chain[chain.length - 1]) || 0) - (start(chain[0]) || 0);
  return { names: chain, busyMs, spanMs, gapMs: Math.max(0, spanMs - busyMs) };
}

export function tickStep(totalMs, target = 8) {
  const steps = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 21600, 43200].map((s) => s * 1000);
  return steps.find((s) => totalMs / s <= target) ?? steps[steps.length - 1];
}

export function clock(msValue) {
  const t = Math.max(0, Math.round((msValue || 0) / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

export const dur = (msVal) => {
  if (msVal < 1000) return '<1s';
  if (msVal < 60000) return `${Math.round(msVal / 1000)}s`;
  return clock(msVal);
};

export const wall = (t) => {
  try {
    return new Date(t).toLocaleTimeString([], { hour12: false });
  } catch {
    return '';
  }
};
