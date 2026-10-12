import { env } from '@config/env';

export function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

// Resolve a photo field (base64 or relative/absolute URL) into a usable src string
export function resolvePhotoUrl(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const v = raw.replace(/\s+/g, '');
  if (!v) return '';
  if (v.startsWith('data:image')) return v;
  if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('blob:')) return v;
  if (v.startsWith('/')) {
    const apiOrigin = env.apiBaseUrl;
    return `${apiOrigin}${v}`;
  }
  // Assume raw base64
  return `data:image/jpeg;base64,${v}`;
}

export function isWeekend(date, weekendDays = [5, 6]) {
  const day = date.getDay();
  return weekendDays.includes(day);
}

// holidaySet holds 'YYYY-MM-DD' strings (local calendar date, matching the
// dates returned by /leaves/holidays/) — a plain Set, not Date objects, so
// membership checks don't have to worry about time-of-day/timezone drift.
export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isHoliday(date, holidaySet) {
  return !!holidaySet && holidaySet.has(toDateKey(date));
}

export function countBusinessDays(start, end, weekendDays = [5, 6], holidaySet = null) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e || s > e) return 0;

  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (!isWeekend(cur, weekendDays) && !isHoliday(cur, holidaySet)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

const DEFAULT_PRI_PCT = 0.7;
const DEFAULT_ADD_PCT = 0.3;

// Builds a name -> TeamId lookup from every PRIMARY developer's own row in
// the current dataset. Needed because an additional developer's row only
// carries their OWN TeamId (e.g. Bob's "Front End"), not the primary
// developer's team (e.g. Alice's "Backend") whose pri/add contribution %
// should actually govern the split of that assignment's effort.
export function buildPrimaryTeamByName(assignments = []) {
  const map = new Map();
  assignments.forEach(item => {
    if (!item.IsAssignedProgrammer) return;
    const name = (item.EmployeeName || '').trim().toLowerCase();
    if (name && item.TeamId != null) {
      map.set(name, item.TeamId);
    }
  });
  return map;
}

// Resolves the {pri, add} contribution fractions (0-1) that should govern
// this record's split, from the PRIMARY developer's own team — falling
// back to the 70/30 default when the team is unresolvable or has no
// configured percentages (teamPercentMap is keyed by TeamId -> {pri, add}).
function resolveContributionPct(record, teamPercentMap, primaryTeamByName) {
  let primaryTeamId = record.IsAssignedProgrammer ? record.TeamId : null;
  if (primaryTeamId == null && primaryTeamByName) {
    const key = (record.Assigned_Developer || '').trim().toLowerCase();
    primaryTeamId = primaryTeamByName.get(key) ?? null;
  }

  const pct = primaryTeamId != null && teamPercentMap ? teamPercentMap.get(primaryTeamId) : null;
  if (!pct || !Number.isFinite(pct.pri) || !Number.isFinite(pct.add)) {
    return { pri: DEFAULT_PRI_PCT, add: DEFAULT_ADD_PCT };
  }
  return pct;
}

// The backend emits ONE CapacityPlanningRecord per additional developer
// (in addition to the primary developer's own record), and every one of
// those records still carries the full original Assigned_Developer /
// Additional_Developers strings. So `record` here is always exactly ONE
// person's own row — this returns that row's own MDs share, never a list
// of other people's shares (previously this synthesized entries for every
// name in Additional_Developers on EVERY row, double/triple-counting them
// whenever their own row was processed too).
//
// The primary/additional split percentage comes from the primary
// developer's own team (LMS_TEAMS.pri_dev_contr_per / add_dev_contr_per,
// configured per-team on the Teams screen) via teamPercentMap + primary
// TeamByName, not a fixed constant — teams with no configured percentages
// fall back to the historical 70/30 default.
export function calculateDeveloperMDs(record, teamPercentMap = null, primaryTeamByName = null) {
  const effort = Number(record.Effort_in_MDs) || 0;
  const isProg = !!record.IsAssignedProgrammer;
  const primaryDev = (record.Assigned_Developer || '').trim();

  let addDevCount = 0;
  if (record.Additional_Developers) {
    const rawDevs = record.Additional_Developers.split(/[,\n]+/)
      .map(name => name.trim())
      .filter(Boolean);

    const uniqueDevs = Array.from(new Set(rawDevs)).filter(name => {
      return name.toLowerCase() !== primaryDev.toLowerCase();
    });

    addDevCount = uniqueDevs.length;
  }

  const hasAddDevs = addDevCount > 0;
  if (!hasAddDevs) {
    return isProg ? effort : 0;
  }

  const { pri, add } = resolveContributionPct(record, teamPercentMap, primaryTeamByName);

  if (isProg) {
    return effort * pri;
  }

  return (effort * add) / addDevCount;
}

export function calculateRemainingPercentage(start, end, referenceDate = new Date()) {
  const s = parseDate(start);
  const e = parseDate(end);
  const ref = parseDate(referenceDate);
  if (!s || !e || !ref) return 0;
  if (ref < s) return 1;
  if (ref > e) return 0;
  const total = e.getTime() - s.getTime();
  if (total === 0) return 0;
  return (e.getTime() - ref.getTime()) / total;
}

export function calculateProratedEffort(start, end, effortMDs, windowDays, referenceDate = new Date(), weekendDays = [5, 6], holidaySet = null) {
  const s = parseDate(start);
  const e = parseDate(end);
  const ref = parseDate(referenceDate);
  if (!s || !e || !ref || effortMDs <= 0) return 0;

  const windowEnd = new Date(ref);
  windowEnd.setDate(windowEnd.getDate() + windowDays - 1);

  const overlapStart = new Date(Math.max(ref.getTime(), s.getTime()));
  const overlapEnd = new Date(Math.min(e.getTime(), windowEnd.getTime()));

  if (overlapStart > overlapEnd) return 0;

  const totalBiz = countBusinessDays(s, e, weekendDays, holidaySet);
  if (totalBiz === 0) return 0;

  const overlapBiz = countBusinessDays(overlapStart, overlapEnd, weekendDays, holidaySet);
  return effortMDs * (overlapBiz / totalBiz);
}

export function processCapacityData(assignments, weekendDays = [5, 6], referenceDate = new Date(), holidaySet = null, teamPercentMap = null) {
  const employeesMap = new Map();
  const primaryTeamByName = buildPrimaryTeamByName(assignments);

  assignments.forEach(item => {
    const start = item.Start_Date;
    const end = item.End_Date;
    const isProg = !!item.IsAssignedProgrammer;

    // This row is always exactly one person's own record — either the
    // primary developer's, or one specific additional developer's (the
    // backend emits a separate record per additional developer).
    const ownMDs = calculateDeveloperMDs(item, teamPercentMap, primaryTeamByName);

    const name = item.EmployeeName || 'Unassigned';
    const empId = item.EmpId || name;
    const teamId = item.TeamId || 'unassigned';
    const teamName = item.TeamName || 'Unassigned Team';

    const remaining = calculateRemainingPercentage(start, end, referenceDate);
    const occ7 = calculateProratedEffort(start, end, ownMDs, 7, referenceDate, weekendDays, holidaySet);
    const occ30 = calculateProratedEffort(start, end, ownMDs, 30, referenceDate, weekendDays, holidaySet);
    const occ90 = calculateProratedEffort(start, end, ownMDs, 90, referenceDate, weekendDays, holidaySet);

    if (!employeesMap.has(empId)) {
      employeesMap.set(empId, {
        id: empId,
        name,
        photo: resolvePhotoUrl(item.Photo_URL || item.EmpPhoto || item.EmployeePhoto || item.photo || ''),
        teamId,
        teamName,
        role: isProg ? 'Primary Developer' : 'Additional Developer',
        next7Days: { occupied: 0 },
        next30Days: { occupied: 0 },
        next90Days: { occupied: 0 },
        assignments: []
      });
    }

    const emp = employeesMap.get(empId);
    emp.next7Days.occupied += occ7;
    emp.next30Days.occupied += occ30;
    emp.next90Days.occupied += occ90;

    emp.assignments.push({
      summary: item.Summary || 'No Summary',
      status: item.Status || 'N/A',
      startDate: item.Start_Date,
      endDate: item.End_Date,
      effort: ownMDs,
      role: isProg ? 'Primary Developer' : 'Additional Developer',
      roleIcon: isProg ? 'Primary' : 'Additional',
      remainingPercent: remaining,
      project: item.Project || '',
      assignedDeveloper: item.Assigned_Developer || '',
      additionalDevelopers: item.Additional_Developers || '',
      isAssignedProgrammer: isProg,
      isUnmatchedDeveloper: !!item.IsUnmatchedDeveloper
    });
  });
  
  // Convert map to array and calculate available days for each timeframe
  const result = Array.from(employeesMap.values()).map(emp => {
    const ref = parseDate(referenceDate);
    
    const end7 = new Date(ref);
    end7.setDate(end7.getDate() + 6);
    const total7 = countBusinessDays(ref, end7, weekendDays, holidaySet);

    const end30 = new Date(ref);
    end30.setDate(end30.getDate() + 29);
    const total30 = countBusinessDays(ref, end30, weekendDays, holidaySet);

    const end90 = new Date(ref);
    end90.setDate(end90.getDate() + 89);
    const total90 = countBusinessDays(ref, end90, weekendDays, holidaySet);
    
    emp.next7Days.available = Math.max(0, total7 - emp.next7Days.occupied);
    emp.next30Days.available = Math.max(0, total30 - emp.next30Days.occupied);
    emp.next90Days.available = Math.max(0, total90 - emp.next90Days.occupied);
    
    return emp;
  });
  
  return result;
}
