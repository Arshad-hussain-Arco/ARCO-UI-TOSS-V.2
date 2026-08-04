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
    const apiOrigin = (typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api')
      : 'http://127.0.0.1:8000/api').replace(/\/api\/?$/, '');
    return `${apiOrigin}${v}`;
  }
  // Assume raw base64
  return `data:image/jpeg;base64,${v}`;
}

export function isWeekend(date, weekendDays = [5, 6]) {
  const day = date.getDay();
  return weekendDays.includes(day);
}

export function countBusinessDays(start, end, weekendDays = [5, 6]) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e || s > e) return 0;
  
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (!isWeekend(cur, weekendDays)) {
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export function calculateDeveloperMDs(record) {
  const effort = Number(record.Effort_in_MDs) || 0;
  const isProg = !!record.IsAssignedProgrammer;
  const primaryDev = (record.Assigned_Developer || '').trim();
  
  let addDevs = [];
  if (record.Additional_Developers) {
    const rawDevs = record.Additional_Developers.split(',')
      .map(name => name.trim())
      .filter(Boolean);
      
    const uniqueDevs = Array.from(new Set(rawDevs)).filter(name => {
      return name.toLowerCase() !== primaryDev.toLowerCase();
    });
    
    addDevs = uniqueDevs;
  }
  
  const hasAddDevs = addDevs.length > 0;
  
  let primaryMDs = 0;
  let splitMDs = 0;
  
  if (isProg) {
    primaryMDs = hasAddDevs ? effort * 0.7 : effort;
  } else {
    primaryMDs = 0;
  }
  
  if (hasAddDevs) {
    splitMDs = (effort * 0.3) / addDevs.length;
  }
  
  return {
    primaryMDs,
    additionalDevs: addDevs.map(name => ({ name, effort: splitMDs }))
  };
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

export function calculateProratedEffort(start, end, effortMDs, windowDays, referenceDate = new Date(), weekendDays = [5, 6]) {
  const s = parseDate(start);
  const e = parseDate(end);
  const ref = parseDate(referenceDate);
  if (!s || !e || !ref || effortMDs <= 0) return 0;
  
  const windowEnd = new Date(ref);
  windowEnd.setDate(windowEnd.getDate() + windowDays - 1);
  
  const overlapStart = new Date(Math.max(ref.getTime(), s.getTime()));
  const overlapEnd = new Date(Math.min(e.getTime(), windowEnd.getTime()));
  
  if (overlapStart > overlapEnd) return 0;
  
  const totalBiz = countBusinessDays(s, e, weekendDays);
  if (totalBiz === 0) return 0;
  
  const overlapBiz = countBusinessDays(overlapStart, overlapEnd, weekendDays);
  return effortMDs * (overlapBiz / totalBiz);
}

export function processCapacityData(assignments, weekendDays = [5, 6], referenceDate = new Date()) {
  const employeesMap = new Map();
  
  assignments.forEach(item => {
    const start = item.Start_Date;
    const end = item.End_Date;
    const isProg = !!item.IsAssignedProgrammer;
    
    // Parse effort
    const { primaryMDs, additionalDevs } = calculateDeveloperMDs(item);
    
    // Calculate details for primary developer
    const primaryName = item.EmployeeName || 'Unassigned';
    const primaryEmpId = item.EmpId || primaryName;
    const teamId = item.TeamId || 'unassigned';
    const teamName = item.TeamName || 'Unassigned Team';
    
    const primaryRemaining = calculateRemainingPercentage(start, end, referenceDate);
    const primary7 = calculateProratedEffort(start, end, primaryMDs, 7, referenceDate, weekendDays);
    const primary30 = calculateProratedEffort(start, end, primaryMDs, 30, referenceDate, weekendDays);
    const primary90 = calculateProratedEffort(start, end, primaryMDs, 90, referenceDate, weekendDays);
    
    if (!employeesMap.has(primaryEmpId)) {
      employeesMap.set(primaryEmpId, {
        id: primaryEmpId,
        name: primaryName,
        photo: resolvePhotoUrl(item.Photo_URL || item.EmpPhoto || item.EmployeePhoto || item.photo || ''),
        teamId,
        teamName,
        role: isProg ? 'Primary Developer' : 'Tester',
        next7Days: { occupied: 0 },
        next30Days: { occupied: 0 },
        next90Days: { occupied: 0 },
        assignments: []
      });
    }
    
    const primaryEmp = employeesMap.get(primaryEmpId);
    primaryEmp.next7Days.occupied += primary7;
    primaryEmp.next30Days.occupied += primary30;
    primaryEmp.next90Days.occupied += primary90;
    
    primaryEmp.assignments.push({
      summary: item.Summary || 'No Summary',
      status: item.Status || 'N/A',
      startDate: item.Start_Date,
      endDate: item.End_Date,
      effort: primaryMDs,
      role: isProg ? 'Primary Developer' : 'Tester',
      roleIcon: isProg ? 'Primary' : 'Tester',
      remainingPercent: primaryRemaining,
      project: item.Project || '',
      assignedDeveloper: item.Assigned_Developer || '',
      additionalDevelopers: item.Additional_Developers || '',
      isAssignedProgrammer: isProg,
      isUnmatchedDeveloper: !!item.IsUnmatchedDeveloper
    });
    
    // Additional developers
    additionalDevs.forEach(addDev => {
      const name = addDev.name;
      const addEmpId = name; 
      
      const addRemaining = calculateRemainingPercentage(start, end, referenceDate);
      const add7 = calculateProratedEffort(start, end, addDev.effort, 7, referenceDate, weekendDays);
      const add30 = calculateProratedEffort(start, end, addDev.effort, 30, referenceDate, weekendDays);
      const add90 = calculateProratedEffort(start, end, addDev.effort, 90, referenceDate, weekendDays);
      
      if (!employeesMap.has(addEmpId)) {
        employeesMap.set(addEmpId, {
          id: addEmpId,
          name,
          teamId,
          teamName,
          role: 'Additional Developer',
          next7Days: { occupied: 0 },
          next30Days: { occupied: 0 },
          next90Days: { occupied: 0 },
          assignments: []
        });
      }
      
      const addEmp = employeesMap.get(addEmpId);
      addEmp.next7Days.occupied += add7;
      addEmp.next30Days.occupied += add30;
      addEmp.next90Days.occupied += add90;
      
      addEmp.assignments.push({
        summary: item.Summary || 'No Summary',
        status: item.Status || 'N/A',
        startDate: item.Start_Date,
        endDate: item.End_Date,
        effort: addDev.effort,
        role: 'Additional Developer',
        roleIcon: 'Additional',
        remainingPercent: addRemaining,
        project: item.Project || '',
        assignedDeveloper: item.Assigned_Developer || '',
        additionalDevelopers: item.Additional_Developers || '',
        isAssignedProgrammer: false,
        isUnmatchedDeveloper: !!item.IsUnmatchedDeveloper
      });
    });
  });
  
  // Convert map to array and calculate available days for each timeframe
  const result = Array.from(employeesMap.values()).map(emp => {
    const ref = parseDate(referenceDate);
    
    const end7 = new Date(ref);
    end7.setDate(end7.getDate() + 6);
    const total7 = countBusinessDays(ref, end7, weekendDays);
    
    const end30 = new Date(ref);
    end30.setDate(end30.getDate() + 29);
    const total30 = countBusinessDays(ref, end30, weekendDays);
    
    const end90 = new Date(ref);
    end90.setDate(end90.getDate() + 89);
    const total90 = countBusinessDays(ref, end90, weekendDays);
    
    emp.next7Days.available = Math.max(0, total7 - emp.next7Days.occupied);
    emp.next30Days.available = Math.max(0, total30 - emp.next30Days.occupied);
    emp.next90Days.available = Math.max(0, total90 - emp.next90Days.occupied);
    
    return emp;
  });
  
  return result;
}
