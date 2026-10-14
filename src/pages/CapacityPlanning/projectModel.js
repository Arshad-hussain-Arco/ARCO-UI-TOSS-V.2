import { parseDate, calculateProratedEffort } from './dateMath.js';

// Shared Project -> CR -> Developer model behind both Project View and Gantt
// View. A project (the `Project` string) owns one or more CRs; every CR has
// its OWN summary, status, dates and effort. Nothing is ever copied from one
// CR up to the project, so project-level numbers are only sums of CR numbers.

const WINDOWS = [7, 30, 90];

function sameDay(a, b) {
  return a.getTime() === b.getTime();
}

// 'ok' | 'unscheduled' (missing start/end) | 'invalid' (end before start)
export function getScheduleState(startObj, endObj) {
  if (!startObj || !endObj) return 'unscheduled';
  if (endObj < startObj) return 'invalid';
  return 'ok';
}

// Calendar-day overlap of a CR's own span with the next N days.
function overlapsWindow(startObj, endObj, refObj, windowDays) {
  if (!startObj || !endObj || !refObj || endObj < startObj) return false;
  const windowEnd = new Date(refObj);
  windowEnd.setDate(windowEnd.getDate() + windowDays - 1);
  const overlapStart = new Date(Math.max(refObj.getTime(), startObj.getTime()));
  const overlapEnd = new Date(Math.min(endObj.getTime(), windowEnd.getTime()));
  return overlapStart <= overlapEnd;
}

function crKeyOf(a) {
  return a.crId != null && a.crId !== ''
    ? `cr:${a.crId}`
    : `nocr:${a.summary || ''}|${a.startDate || ''}|${a.endDate || ''}`;
}

/**
 * @param consultants  output of processCapacityData (employees with assignments)
 * @param opts { timeframe, referenceDate, weekendDays, holidaySet }
 * @returns projects[] -> crs[] -> developers[]
 */
export function buildProjectModel(consultants, opts = {}) {
  const {
    timeframe = 30,
    referenceDate = new Date(),
    weekendDays = [5, 6],
    holidaySet = null,
  } = opts;
  const ref = parseDate(referenceDate);
  const projects = new Map();

  (consultants || []).forEach(c => {
    (c.assignments || []).forEach(a => {
      const project = a.project ? a.project.trim() : '';
      const crKey = crKeyOf(a);
      const projectKey = project || `nocr-project:${crKey}`;

      if (!projects.has(projectKey)) {
        projects.set(projectKey, { key: projectKey, project, crMap: new Map() });
      }
      const p = projects.get(projectKey);

      if (!p.crMap.has(crKey)) {
        const startObj = parseDate(a.startDate);
        const endObj = parseDate(a.endDate);
        p.crMap.set(crKey, {
          key: `${projectKey}||${crKey}`,
          crId: a.crId != null && a.crId !== '' ? a.crId : null,
          summary: a.summary,
          status: a.status,
          startDate: a.startDate,
          endDate: a.endDate,
          startObj,
          endObj,
          scheduleState: getScheduleState(startObj, endObj),
          developers: [],
          devKeys: new Set(),
        });
      }
      const cr = p.crMap.get(crKey);

      // Skip an exact repeat of the same developer in the same role on the
      // same CR (duplicate source rows) so effort is never counted twice.
      const devKey = `${c.id}|${a.isAssignedProgrammer ? 'P' : 'A'}`;
      if (cr.devKeys.has(devKey)) return;
      cr.devKeys.add(devKey);

      const effort = Number(a.effort) || 0;
      cr.developers.push({
        empId: c.id,
        name: c.name,
        photo: c.photo || '',
        teamName: c.teamName,
        isAssignedProgrammer: !!a.isAssignedProgrammer,
        isUnmatchedDeveloper: !!a.isUnmatchedDeveloper,
        effort,
        proratedEffort: calculateProratedEffort(
          a.startDate, a.endDate, effort, timeframe, referenceDate, weekendDays, holidaySet
        ),
      });
    });
  });

  return Array.from(projects.values()).map(p => {
    const crs = Array.from(p.crMap.values()).map(cr => {
      const { devKeys, ...rest } = cr;
      const developers = cr.developers.sort((x, y) => {
        if (x.isAssignedProgrammer !== y.isAssignedProgrammer) return x.isAssignedProgrammer ? -1 : 1;
        return (x.name || '').localeCompare(y.name || '');
      });
      const out = {
        ...rest,
        developers,
        totalEffort: developers.reduce((s, d) => s + d.effort, 0),
        totalProratedEffort: developers.reduce((s, d) => s + d.proratedEffort, 0),
      };
      WINDOWS.forEach(w => {
        out[`overlaps${w}`] = overlapsWindow(cr.startObj, cr.endObj, ref, w);
      });
      return out;
    }).sort(compareCrsByStart);
    return { key: p.key, project: p.project, crs };
  });
}

// Scheduled CRs by start date (then end date); unscheduled/invalid last.
export function compareCrsByStart(a, b) {
  const aOk = a.scheduleState === 'ok';
  const bOk = b.scheduleState === 'ok';
  if (aOk !== bOk) return aOk ? -1 : 1;
  if (aOk && bOk) {
    if (!sameDay(a.startObj, b.startObj)) return a.startObj - b.startObj;
    if (!sameDay(a.endObj, b.endObj)) return a.endObj - b.endObj;
  }
  return String(a.crId ?? '').localeCompare(String(b.crId ?? ''), undefined, { numeric: true });
}

// Each person once per project, no matter how many of its CRs they appear on.
function uniqueDevelopers(crs) {
  const seen = new Map();
  crs.forEach(cr => cr.developers.forEach(d => {
    if (!seen.has(d.empId)) seen.set(d.empId, { empId: d.empId, name: d.name, photo: d.photo });
  }));
  return Array.from(seen.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}

/**
 * Applies search + CR-level predicate and recomputes project aggregates from
 * the CRs that remain.
 *  - query matching the project string keeps ALL of its CRs (still subject to
 *    `crFilter`); otherwise only CRs whose ID, summary or a developer matches.
 *  - `crFilter(cr)` is the stage / window predicate, applied per CR.
 *  - a project with no remaining CR is dropped.
 */
export function filterProjectModel(projects, { query = '', crFilter = null } = {}) {
  const q = (query || '').toLowerCase().trim();
  const result = [];
  projects.forEach(p => {
    const projectMatches = !q || p.project.toLowerCase().includes(q);
    const crs = p.crs.filter(cr => {
      if (!projectMatches) {
        const hit =
          String(cr.crId ?? '').toLowerCase().includes(q) ||
          (cr.summary || '').toLowerCase().includes(q) ||
          cr.developers.some(d => (d.name || '').toLowerCase().includes(q));
        if (!hit) return false;
      }
      return crFilter ? crFilter(cr) : true;
    });
    if (crs.length === 0) return;
    result.push({
      ...p,
      crs,
      developers: uniqueDevelopers(crs),
      developerCount: uniqueDevelopers(crs).length,
      totalEffort: crs.reduce((s, cr) => s + cr.totalEffort, 0),
      totalProratedEffort: crs.reduce((s, cr) => s + cr.totalProratedEffort, 0),
    });
  });
  return result;
}

// Why a CR's prorated effort displays as 0.0 MDs (display only; mirrors the
// guards in calculateProratedEffort). null only when it displays as non-zero,
// so a zero is never left without an explanation.
export function getZeroEffortReason(startDate, endDate, proratedEffort, referenceDate, windowDays, rawEffort) {
  if (proratedEffort >= 0.05) return null; // shows as non-zero at 1 decimal
  if (rawEffort !== undefined && !(rawEffort > 0)) return 'No effort is assigned';
  const start = parseDate(startDate);
  if (!start) return "Planned Start Date Doesn't Exist";
  const end = parseDate(endDate);
  if (!end) return "Planned End Date Doesn't Exist";
  if (end < start) return 'End date is before the start date';
  const ref = parseDate(referenceDate);
  if (ref && end < ref) return 'End Date Has Passed';
  if (proratedEffort > 0) return 'Only a fraction of a day falls in this window';
  if (ref) {
    const windowEnd = new Date(ref);
    windowEnd.setDate(windowEnd.getDate() + windowDays - 1);
    if (start > windowEnd) return 'Project starts after the selected window';
  }
  return 'No working days fall in this window (weekends or holidays only)';
}

/**
 * Gantt layout from already-filtered projects. Bars use each CR's own dates;
 * the axis spans the earliest valid CR start to the latest valid CR end among
 * the visible CRs (and today). Unscheduled/invalid CRs get no bar.
 */
export function buildGanttLayout(projects, referenceDate = new Date()) {
  const ref = parseDate(referenceDate);
  const scheduled = projects.flatMap(p => p.crs.filter(cr => cr.scheduleState === 'ok'));

  const earliest = p => {
    const ok = p.crs.filter(cr => cr.scheduleState === 'ok');
    return ok.length ? Math.min(...ok.map(cr => cr.startObj.getTime())) : Infinity;
  };
  const ordered = [...projects].sort((a, b) => {
    const ea = earliest(a);
    const eb = earliest(b);
    if (ea !== eb) return ea === Infinity ? 1 : eb === Infinity ? -1 : ea - eb;
    return a.project.localeCompare(b.project);
  });

  if (scheduled.length === 0) {
    return { projects: ordered.map(p => ({ ...p, crs: p.crs.map(cr => ({ ...cr, bar: null })) })), todayPct: null, monthTicks: [] };
  }

  let minStart = ref ? ref.getTime() : Infinity;
  let maxEnd = ref ? ref.getTime() : -Infinity;
  scheduled.forEach(cr => {
    if (cr.startObj.getTime() < minStart) minStart = cr.startObj.getTime();
    if (cr.endObj.getTime() > maxEnd) maxEnd = cr.endObj.getTime();
  });
  const rangeStart = new Date(new Date(minStart).getFullYear(), new Date(minStart).getMonth(), 1);
  const rangeEnd = new Date(new Date(maxEnd).getFullYear(), new Date(maxEnd).getMonth() + 1, 0);
  const totalMs = rangeEnd.getTime() - rangeStart.getTime();
  const pct = d => (totalMs > 0 ? ((d.getTime() - rangeStart.getTime()) / totalMs) * 100 : 0);

  const withBars = ordered.map(p => ({
    ...p,
    crs: p.crs.map(cr => {
      if (cr.scheduleState !== 'ok') return { ...cr, bar: null };
      const left = pct(cr.startObj);
      const right = pct(cr.endObj);
      return { ...cr, bar: { leftPct: Math.max(0, left), widthPct: Math.max(0.6, right - left) } };
    }),
  }));

  const monthTicks = [];
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (cursor <= rangeEnd) {
    monthTicks.push({
      label: cursor.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      leftPct: pct(cursor),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return { projects: withBars, todayPct: ref ? pct(ref) : null, monthTicks };
}
