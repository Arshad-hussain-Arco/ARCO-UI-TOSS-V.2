/**
 * Layered DAG graph layout algorithm for the Cockpit Flow tab.
 * Barycentric sweeps reduce edge crossings between levels.
 */

export const GRAPH_CONFIG = {
  nodeW: 140,
  nodeH: 30,
  gapX: 20,
  gapY: 34,
  padX: 48,
  padY: 36,
  minScale: 0.1,
  maxScale: 2.5,
  startScale: 0.5,
  readableScale: 0.75,
};

export function computeLayout(jobs, opts = {}) {
  const { nodeW, nodeH, gapX, gapY, padX, padY } = { ...GRAPH_CONFIG, ...opts };
  const sweeps = opts.sweeps ?? 6;
  const step = nodeW + gapX;

  const byName = new Map(jobs.map((j) => [j.name, j]));

  // Dynamically calculate topological DAG levels from local predecessors
  // to ensure parallel branches render neatly on the same level.
  const computedLevels = new Map();
  for (const j of jobs) {
    const localPreds = (j.predecessors || []).filter((p) => byName.has(p));
    if (localPreds.length === 0) {
      computedLevels.set(j.name, 1);
    }
  }

  let changed = true;
  let iter = 0;
  while (changed && iter < 100) {
    changed = false;
    iter += 1;
    for (const j of jobs) {
      const localPreds = (j.predecessors || []).filter((p) => byName.has(p));
      if (localPreds.length > 0) {
        let maxP = 0;
        for (const p of localPreds) {
          maxP = Math.max(maxP, computedLevels.get(p) || 0);
        }
        const newL = maxP > 0 ? maxP + 1 : 1;
        if (computedLevels.get(j.name) !== newL) {
          computedLevels.set(j.name, newL);
          changed = true;
        }
      }
    }
  }

  const rowsByLevel = new Map();
  for (const j of jobs) {
    const lv = computedLevels.get(j.name) || j.level || 1;
    if (!rowsByLevel.has(lv)) rowsByLevel.set(lv, []);
    rowsByLevel.get(lv).push(j.name);
  }
  const levels = [...rowsByLevel.keys()].sort((a, b) => a - b);
  const rows = levels.map((lv) => ({ level: lv, names: rowsByLevel.get(lv) }));

  const slot = new Map();
  const reslot = (row) => row.names.forEach((n, i) => slot.set(n, i - (row.names.length - 1) / 2));
  rows.forEach(reslot);

  const mean = (names) => {
    const xs = names.filter((n) => slot.has(n)).map((n) => slot.get(n));
    return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  };
  const order = (row, neighbours) => {
    const keyed = row.names.map((n, i) => ({ n, i, b: mean(neighbours(byName.get(n))) }));
    keyed.sort((a, b) => (a.b ?? slot.get(a.n)) - (b.b ?? slot.get(b.n)) || a.i - b.i);
    row.names = keyed.map((k) => k.n);
    reslot(row);
  };
  for (let s = 0; s < sweeps; s++) {
    for (let r = 1; r < rows.length; r++) {
      order(rows[r], (j) => (j?.predecessors || []).filter((p) => byName.has(p)));
    }
    for (let r = rows.length - 2; r >= 0; r--) {
      order(rows[r], (j) => (j?.successors || []).filter((s) => byName.has(s)));
    }
  }

  const widest = Math.max(1, ...rows.map((r) => r.names.length));
  const innerW = widest * step - gapX;
  const width = innerW + padX * 2;
  const height = padY * 2 + rows.length * nodeH + (rows.length - 1) * gapY;

  const nodes = new Map();
  rows.forEach((row, ri) => {
    const rowW = row.names.length * step - gapX;
    const x0 = padX + (innerW - rowW) / 2;
    const y = padY + ri * (nodeH + gapY);
    row.y = y;
    row.names.forEach((name, i) => {
      nodes.set(name, { name, x: x0 + i * step, y, w: nodeW, h: nodeH, level: row.level, row: ri });
    });
  });

  const edges = [];
  for (const j of jobs) {
    const to = nodes.get(j.name);
    for (const p of j.predecessors || []) {
      const from = nodes.get(p);
      if (!from || !to) continue;
      const x1 = from.x + nodeW / 2;
      const y1 = from.y + nodeH;
      const x2 = to.x + nodeW / 2;
      const y2 = to.y;
      const dy = Math.min(120, Math.max(18, Math.abs(y2 - y1) * 0.4));
      edges.push({ from: p, to: j.name, d: `M${x1},${y1} C${x1},${y1 + dy} ${x2},${y2 - dy} ${x2},${y2}` });
    }
  }
  return { nodes, edges, rows, width, height, nodeW, nodeH };
}

export function closure(startName, index, key) {
  const seen = new Set();
  const stack = [startName];
  while (stack.length) {
    const n = stack.pop();
    for (const next of index.get(n)?.[key] || []) {
      if (!seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}

export function fitTransform(layout, box, { min = GRAPH_CONFIG.minScale, max = 1, margin = 24 } = {}) {
  const k = Math.min(max, Math.max(min, Math.min((box.w - margin * 2) / layout.width, (box.h - margin * 2) / layout.height)));
  return { k, x: (box.w - layout.width * k) / 2, y: Math.max(margin, (box.h - layout.height * k) / 2) };
}
