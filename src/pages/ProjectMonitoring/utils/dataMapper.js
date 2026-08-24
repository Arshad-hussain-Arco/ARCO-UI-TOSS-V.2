import { mapStatusToIds, PMStatus, PMStatusGroups } from './staticData';

/**
 * Dynamic calculation and data mapping utilities for Project Monitoring and Breaches
 * Authoritative implementation matching PROJECT_MONITORING_REQUIREMENTS.md
 */

const NOT_AVAILABLE_LABEL = 'Not Available';

/**
 * Parses date string or returns null
 */
export function parseDate(dateVal) {
  if (!dateVal) return null;
  if (dateVal instanceof Date) return isNaN(dateVal.getTime()) ? null : dateVal;
  const str = String(dateVal).trim();
  if (!str || str.length <= 1) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Standardizes Work Order API response items (result1)
 */
export function mapWorkOrderRecord(wo) {
  const woIdInt = wo.Wo_Id ? parseInt(wo.Wo_Id, 10) : 0;
  const statusStr = (wo.Status || '').trim();
  const { statusId, statusGroup } = mapStatusToIds(statusStr);
  
  let dependsOn = (wo.Depends_On || wo.DependsOn || '').trim();
  if (dependsOn.length <= 1) {
    dependsOn = NOT_AVAILABLE_LABEL;
  }

  return {
    ...wo,
    Wo_Id: woIdInt,
    Ipm_Number: wo.Ipm_Number || '',
    Summary: wo.Summary || '',
    Work_Order_Type: wo.Work_Order_Type || 'Project',
    Status: statusStr,
    StatusId: statusId,
    StatusGroup: statusGroup,
    Priority: wo.Priority || 'Medium',
    IT_Delivery_Lead: wo.IT_Delivery_Lead || 'unassigned',
    Backup_IT_Delivery_Lead: wo.Backup_IT_Delivery_Lead || 'unassigned',
    Product_Owner: wo.Product_Owner || 'unassigned',
    PMO_Project_Manager: wo.PMO_Project_Manager || 'unassigned',
    Owned_By: wo.Owned_By || 'unassigned',
    Requestor_Name: wo.Requestor_Name || 'unassigned',
    Start_Date: wo.Start_Date || '',
    Due_Date: wo.Due_Date || wo.End_Date || '',
    Clarity_Planned_Finish_Date: wo.Clarity_Planned_Finish_Date || '',
    Planned_DEV_completion_Date: wo.Planned_DEV_completion_Date || '',
    SIT_Received_date: wo.SIT_Received_date || '',
    UAT_Actual_End_Date: wo.UAT_Actual_End_Date || '',
    SIT_Lead: wo.SIT_Lead || 'unassigned',
    UAT_Lead: wo.UAT_Lead || 'unassigned',
    Depends_On: dependsOn,
    Last_Comment: wo.Last_Comment || '',
    Description: wo.Description || wo.Summary || '',
    Assigned_Developer: wo.Assigned_Developer || wo.assignedDeveloper || wo.developer || '',
    Additional_Developers: wo.Additional_Developers || wo.additionalDevelopers || wo.additionalDev || '',
  };
}

/**
 * Standardizes Change Request API response items (result2)
 */
export function mapChangeRequestRecord(cr) {
  const woIdInt = cr.Wo_Id ? parseInt(cr.Wo_Id, 10) : 0;
  const statusStr = (cr.Status || '').trim();

  return {
    ...cr,
    Id: cr.Id ? parseInt(cr.Id, 10) : 0,
    Wo_Id: woIdInt,
    Ipm_Number: cr.Ipm_Number || cr.ipmNumber || '',
    Summary: cr.Summary || cr.summary || '',
    Status: statusStr,
    Priority: cr.Priority || cr.priority || 'Medium',
    Start_Date: cr.Start_Date || cr.startDate || '',
    End_Date: cr.End_Date || cr.endDate || cr.Due_Date || cr.dueDate || '',
    Effort_in_MDs: cr.Effort_in_MDs !== undefined ? String(cr.Effort_in_MDs) : (cr.effortInMds !== undefined ? String(cr.effortInMds) : ''),
    Assigned_Developer: cr.Assigned_Developer || cr.assignedDeveloper || cr.developer || '',
    Additional_Developers: cr.Additional_Developers || cr.additionalDevelopers || cr.additionalDev || '',
    Project: cr.Project || cr.project || '',
  };
}

/**
 * Builds Project Type Radio list from projectData
 * Returns array of { id: string, label: string, count: number }
 */
export function calculateCategoryCounts(projectsList = []) {
  const countMap = new Map();

  projectsList.forEach((p) => {
    const key = p.Depends_On || NOT_AVAILABLE_LABEL;
    countMap.set(key, (countMap.get(key) || 0) + 1);
  });

  const sorted = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, count]) => ({ id, label: id, count }));

  return [
    { id: 'All Projects', label: 'All Projects', count: projectsList.length },
    ...sorted,
  ];
}

/**
 * Filters projects by selected Project Type radio option
 */
export function filterByCategory(project, selectedPM) {
  if (!selectedPM || selectedPM === 'All Projects') return true;
  return project.Depends_On === selectedPM;
}

/**
 * Standardized myFunc Team Role Grouping Engine (Cards 1 to 7)
 * - Cards 1-5 (itdl, po, backupItdl, sitLead, uatLead): Evaluate Work Orders dataset (result1)
 * - Cards 6-7 (developer, additionalDev): Evaluate Change Requests payload (result2) or Work Orders fallback
 * Exact Legacy myFunc reduction logic (No string splitting, raw property keys preserved)
 * Returns grouped array of { name: string, count: number, records: Array }
 */
export function calculateTeamRoleCounts(projectsList = [], changeRequestsList = [], roleField = 'itdl') {
  let actualWO = projectsList;
  let actualCR = changeRequestsList;
  let targetField = roleField;

  if (typeof changeRequestsList === 'string') {
    targetField = changeRequestsList;
    actualCR = [];
  }

  const isCRCard = targetField === 'developer' || targetField === 'additionalDev';
  
  let targetCollection = [];
  if (isCRCard) {
    if (Array.isArray(actualCR) && actualCR.length > 0) {
      targetCollection = actualCR;
    } else if (Array.isArray(projectsList) && projectsList.some((p) => p.Assigned_Developer || p.assignedDeveloper || p.developer || p.Additional_Developers || p.additionalDevelopers)) {
      targetCollection = projectsList;
    } else if (Array.isArray(actualWO) && actualWO.length > 0) {
      targetCollection = actualWO;
    }
  } else {
    targetCollection = Array.isArray(actualWO) ? actualWO : [];
  }

  const grouped = new Map();

  targetCollection.forEach((item) => {
    let rawVal = null;
    if (targetField === 'itdl') rawVal = item.IT_Delivery_Lead || item.itdl;
    else if (targetField === 'po') rawVal = item.Product_Owner || item.po;
    else if (targetField === 'backupItdl') rawVal = item.Backup_IT_Delivery_Lead || item.backupItdl;
    else if (targetField === 'sitLead') rawVal = item.SIT_Lead || item.sitLead;
    else if (targetField === 'uatLead') rawVal = item.UAT_Lead || item.uatLead;
    else if (targetField === 'developer') rawVal = item.Assigned_Developer || item.assignedDeveloper || item.developer || item.Developer;
    else if (targetField === 'additionalDev') rawVal = item.Additional_Developers || item.additionalDevelopers || item.Additional_Developer || item.additionalDev;

    let keyName = '';
    if (rawVal !== null && rawVal !== undefined) {
      const s = String(rawVal).trim();
      if (s && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined') {
        keyName = s;
      }
    }

    if (!grouped.has(keyName)) {
      grouped.set(keyName, []);
    }
    grouped.get(keyName).push(item);
  });

  const result = [];
  grouped.forEach((records, name) => {
    result.push({
      name: name || '',
      count: records.length,
      records,
    });
  });

  // Sort by count descending, then name ascending
  result.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return result;
}

/**
 * Calculates upcoming completion milestone metrics (Cards 8, 9, 10)
 * Strictly adhering to UPCOMING_COMPLETION_LEGACY_LOGIC.md:
 * - Card 8 (development): Evaluates Change Requests payload (End_Date)
 * - Card 9 (testing): Evaluates Work Orders payload (Due_Date)
 * - Card 10 (delivery): Evaluates Work Orders payload (UAT_Actual_End_Date)
 * Cumulative buckets: 15, 30, 45, 60 days
 */
export function calculateUpcomingCompletions(projectsList = [], changeRequestsList = [], type = 'development') {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getTargetDate = (item) => {
    if (type === 'development') {
      return parseDate(item.End_Date || item.endDate || item.Due_Date || item.dueDate);
    }
    if (type === 'testing') {
      return parseDate(item.Due_Date || item.dueDate || item.End_Date || item.endDate);
    }
    if (type === 'delivery') {
      return parseDate(item.UAT_Actual_End_Date || item.uatActualEndDate || item.Clarity_Planned_Finish_Date || item.Due_Date || item.dueDate);
    }
    return null;
  };

  let collection = [];
  if (type === 'development') {
    if (Array.isArray(changeRequestsList) && changeRequestsList.length > 0) {
      collection = changeRequestsList;
    } else {
      collection = Array.isArray(projectsList) ? projectsList : [];
    }
  } else {
    collection = Array.isArray(projectsList) ? projectsList : [];
  }

  const buckets = {
    b15: [],
    b30: [],
    b45: [],
    b60: [],
  };

  collection.forEach((item) => {
    const d = getTargetDate(item);
    if (!d) return;

    const targetCopy = new Date(d);
    targetCopy.setHours(0, 0, 0, 0);

    const diffDays = Math.round((targetCopy.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) {
      if (diffDays <= 15) buckets.b15.push(item);
      if (diffDays <= 30) buckets.b30.push(item);
      if (diffDays <= 45) buckets.b45.push(item);
      if (diffDays <= 60) buckets.b60.push(item);
    }
  });

  return {
    b15: { count: buckets.b15.length, records: buckets.b15 },
    b30: { count: buckets.b30.length, records: buckets.b30 },
    b45: { count: buckets.b45.length, records: buckets.b45 },
    b60: { count: buckets.b60.length, records: buckets.b60 },
  };
}

/**
 * Extracts latest comment section and checks if days since last comment exceeds threshold.
 * Exactly matches legacy extractLatestCommentWithDate implementation.
 */
export function extractLatestCommentWithDate(commentString, unCommentedForDays = 5) {
  if (typeof commentString !== 'string' || commentString.trim() === '') {
    return null;
  }

  let latestDate = null;
  let latestComment = null;

  // APPROACH 1: Try numbered comments first (e.g. "1. Oct 12, 2025 ... 2. Nov 05, 2025 ...")
  const commentSections = commentString.split(/(?:\n|^|\s{2,})(\d+\.)/g);

  if (commentSections.length > 2) {
    for (let i = 1; i < commentSections.length; i += 2) {
      if (i + 1 < commentSections.length) {
        const commentNumber = commentSections[i];
        const commentContent = commentSections[i + 1];
        const fullComment = commentNumber + commentContent;

        const dateMatches = commentContent.match(/([A-Z][a-z]{2} \d{1,2}, \d{4})/g);
        if (dateMatches && dateMatches.length > 0) {
          dateMatches.forEach((dateStr) => {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              if (!latestDate || date > latestDate) {
                latestDate = date;
                latestComment = fullComment.replace(/^\d+\.\s*/, '').trim();
              }
            }
          });
        }
      }
    }
  }

  // APPROACH 2: Fallback to free-form comment if no numbered comments found
  if (!latestDate) {
    const dateMatches = commentString.match(/([A-Z][a-z]{2} \d{1,2}, \d{4})/g);
    if (dateMatches && dateMatches.length > 0) {
      dateMatches.forEach((dateStr) => {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          if (!latestDate || date > latestDate) {
            latestDate = date;
            latestComment = commentString.trim();
          }
        }
      });
    }
  }

  if (latestDate) {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const todayDate = new Date(todayStr);

    const diffTime = Math.abs(todayDate - latestDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > unCommentedForDays) {
      return {
        latestComment: latestComment || commentString,
        latestDate: latestDate.toISOString().split('T')[0],
        daysSinceLastComment: diffDays,
      };
    }
  }

  return null;
}

/**
 * Helper: Legacy compatibility wrapper for extractLatestCommentDate
 */
export function extractLatestCommentDate(commentStr) {
  const info = extractLatestCommentWithDate(commentStr, 0);
  return info && info.latestDate ? new Date(info.latestDate) : null;
}

/**
 * Calculates dynamic breach metrics for governance cards (Cards 11, 12, 13)
 * Strictly adhering to legacy CountsCard.js loadComponentData logic.
 */
export function calculateBreachMetrics(projectsList = [], changeRequestsList = []) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayDivisionVal = 24 * 60 * 60 * 1000;

  // -------------------------------------------------------------------------
  // CARD 11: PROJECT BREACHES (7 METRICS)
  // -------------------------------------------------------------------------
  const unClosedForDays = 60;
  const testingForDays = 15;
  const BRDSSDForDays = 14;
  const unCommentedForDays = 5;

  // 1. Unclosed Projects Started Before 60 Days
  const unClosedResult = projectsList.filter((obj) => {
    if (!obj.Start_Date) return false;
    const date = new Date(obj.Start_Date);
    if (isNaN(date.getTime())) return false;
    const diffTime = Math.abs(today - date);
    const diffDays = Math.ceil(diffTime / dayDivisionVal);
    const statusId = obj.StatusId || 0;
    const status = obj.Status || '';
    return diffDays > unClosedForDays && statusId !== 16 && statusId !== 17 && status !== 'Deferred';
  });

  // 2. Project in Testing for more than 15 Days
  const testingResult = projectsList.filter((obj) => {
    if (!obj.SIT_Received_date) return false;
    const date = new Date(obj.SIT_Received_date);
    if (isNaN(date.getTime())) return false;
    const diffTime = Math.abs(today - date);
    const diffDays = Math.ceil(diffTime / dayDivisionVal);
    const statusId = obj.StatusId || 0;
    return diffDays > testingForDays && statusId >= 8 && statusId <= 12;
  });

  // 3. Project in BRD/SSD Stage for more than 14 Days
  const BRDSSDResult = projectsList.filter((obj) => {
    if (!obj.Start_Date) return false;
    const date = new Date(obj.Start_Date);
    if (isNaN(date.getTime())) return false;
    const diffTime = Math.abs(today - date);
    const diffDays = Math.ceil(diffTime / dayDivisionVal);
    const statusId = obj.StatusId || 0;
    return diffDays > BRDSSDForDays && (statusId === 2 || statusId === 3);
  });

  // 4. Any CR whose due date passed
  const CRDueDateResult = changeRequestsList.filter((obj) => {
    if (!obj.End_Date) return false;
    const CRdueDate = new Date(obj.End_Date);
    if (isNaN(CRdueDate.getTime())) return false;
    const status = obj.Status || '';
    return CRdueDate < today && (status === 'Open' || status === 'Development In Progress');
  });

  // 5. CR in progress stage, but WO moved to Testing
  const CRProgessResult = [];
  const CRProgess = changeRequestsList.filter((obj) => {
    const status = obj.Status || '';
    return status === 'Open' || status === 'Development In Progress';
  });
  CRProgess.forEach((x) => {
    const xWoId = parseInt(x.Wo_Id, 10);
    const matchedWO = projectsList.find((obj) => parseInt(obj.Wo_Id, 10) === xWoId);
    if (matchedWO && (matchedWO.StatusId || 0) >= 7) {
      CRProgessResult.push(x);
    }
  });

  // 6. CR in Open stage, but WO moved to Development
  const CROpenResult = [];
  const CROPen = changeRequestsList.filter((obj) => (obj.Status || '') === 'Open');
  CROPen.forEach((x) => {
    const xWoId = parseInt(x.Wo_Id, 10);
    const matchedWO = projectsList.find((obj) => parseInt(obj.Wo_Id, 10) === xWoId);
    if (matchedWO && (matchedWO.StatusId || 0) >= 5) {
      CROpenResult.push(x);
    }
  });

  // 7. Projects with no comments for more than 5 days
  const unCommentedProjectsResult = projectsList
    .map((obj) => {
      const commentInfo = extractLatestCommentWithDate(obj.Last_Comment, unCommentedForDays);
      return {
        ...obj,
        _tempCommentInfo: commentInfo,
      };
    })
    .filter((obj) => {
      return (
        obj._tempCommentInfo !== null &&
        obj.Last_Comment &&
        obj.Last_Comment !== '' &&
        obj.Status !== 'Closed'
      );
    })
    .map((obj) => {
      const { _tempCommentInfo, ...cleanObj } = obj;
      return {
        ...cleanObj,
        Last_Comment: _tempCommentInfo ? _tempCommentInfo.latestComment : cleanObj.Last_Comment,
      };
    });

  // -------------------------------------------------------------------------
  // CARD 12: PROJECT DUE DATES (2 METRICS)
  // -------------------------------------------------------------------------
  const next45D = new Date(today.getTime() + 45 * dayDivisionVal);

  const emptyDev45DaysResult = projectsList.filter((obj) => {
    if (!obj.Due_Date) return false;
    const date = new Date(obj.Due_Date);
    if (isNaN(date.getTime())) return false;
    const plannedDev = obj.Planned_DEV_completion_Date;
    const isPlannedDevEmpty = !plannedDev || plannedDev === '' || String(plannedDev).length === 1;
    return isPlannedDevEmpty && date >= today && date <= next45D;
  });

  const Dev15DaysResult = projectsList.filter((obj) => {
    if (!obj.Due_Date) return false;
    const dueDate = new Date(obj.Due_Date);
    if (isNaN(dueDate.getTime())) return false;
    const plannedDev = obj.Planned_DEV_completion_Date;
    const plDevDate = (!plannedDev || plannedDev === '') ? 0 : new Date(plannedDev);
    if (plDevDate === 0 || isNaN(plDevDate.getTime())) return false;
    const diffTime = Math.abs(dueDate - plDevDate);
    const diffDays = Math.ceil(diffTime / dayDivisionVal);
    return diffDays < 15;
  });

  // -------------------------------------------------------------------------
  // CARD 13: CR EXCEPTIONS (4 METRICS)
  // -------------------------------------------------------------------------
  const CRDueDatesResult = changeRequestsList.filter((obj) => {
    const objWoId = parseInt(obj.Wo_Id, 10);
    const projectDueDateObj = projectsList.find((pr) => parseInt(pr.Wo_Id, 10) === objWoId);
    if (!projectDueDateObj || !obj.End_Date || !projectDueDateObj.Due_Date) return false;
    const crEndDate = new Date(obj.End_Date);
    const woDueDate = new Date(projectDueDateObj.Due_Date);
    return !isNaN(crEndDate.getTime()) && !isNaN(woDueDate.getTime()) && crEndDate > woDueDate;
  });

  const noManDaysResult = changeRequestsList.filter((obj) => {
    const effort = obj.Effort_in_MDs;
    return effort === undefined || effort === null || effort === '' || parseInt(effort, 10) === 0 || effort === '0';
  });

  const noStartDateResult = changeRequestsList.filter((obj) => {
    const start = obj.Start_Date;
    return !start || start === '' || String(start).length === 1;
  });

  const noEndDateResult = changeRequestsList.filter((obj) => {
    const end = obj.End_Date;
    return !end || end === '' || String(end).length === 1;
  });

  const breaches = [
    { id: 'b1', label: 'Unclosed Projects Started Before 60 Days', count: unClosedResult.length, records: unClosedResult, isCR: false },
    { id: 'b2', label: 'Project in Testing for more than 15 Days', count: testingResult.length, records: testingResult, isCR: false },
    { id: 'b3', label: 'Project in BRD/SSD Stage for more than 14 Days', count: BRDSSDResult.length, records: BRDSSDResult, isCR: false },
    { id: 'b4', label: 'Any CR whose due date passed', count: CRDueDateResult.length, records: CRDueDateResult, isCR: true },
    { id: 'b5', label: 'CR in progress stage, but WO moved to Testing', count: CRProgessResult.length, records: CRProgessResult, isCR: true },
    { id: 'b6', label: 'CR in Open stage, but WO moved to Development', count: CROpenResult.length, records: CROpenResult, isCR: true },
    { id: 'b7', label: 'Projects with no comments for more than 5 days', count: unCommentedProjectsResult.length, records: unCommentedProjectsResult, isCR: false },
  ];

  const dueDates = [
    { id: 'dd1', label: 'Empty Planned Development Completion in Next 45 Days', count: emptyDev45DaysResult.length, records: emptyDev45DaysResult, isCR: false },
    { id: 'dd2', label: 'Due Date - Dev Completion < 2 Weeks', count: Dev15DaysResult.length, records: Dev15DaysResult, isCR: false },
  ];

  const crExceptions = [
    { id: 'cr1', label: 'CR Due Date > WO Due Date', count: CRDueDatesResult.length, records: CRDueDatesResult, isCR: true },
    { id: 'cr2', label: 'No Man Days in CR', count: noManDaysResult.length, records: noManDaysResult, isCR: true },
    { id: 'cr3', label: 'No Start in CR', count: noStartDateResult.length, records: noStartDateResult, isCR: true },
    { id: 'cr4', label: 'No Due Date in CR', count: noEndDateResult.length, records: noEndDateResult, isCR: true },
  ];

  return { breaches, dueDates, crExceptions };
}

/**
 * Filter projects for drill-down modal overlay
 */
export function getDrilldownProjects(projectsList = [], changeRequestsList = [], stageInfo = null) {
  if (!stageInfo) return { records: [], isCR: false };

  const { key, label, type, records: prefilteredRecords, isCR } = stageInfo;

  // If prefiltered records exist on stageInfo object, return them directly
  if (prefilteredRecords && Array.isArray(prefilteredRecords)) {
    return { records: prefilteredRecords, isCR: Boolean(isCR) };
  }

  const q = (label || '').trim().toLowerCase();

  // If member drilldown is for Developer or Additional Developer, query Change Requests collection
  if (type === 'member' && (key === 'developer' || key === 'additionalDev')) {
    const matchingCRs = changeRequestsList.filter((cr) => {
      const raw = key === 'developer'
        ? (cr.Assigned_Developer || cr.developer || 'unassigned')
        : (cr.Additional_Developers || 'unassigned');
      
      const cleaned = (raw || '').toString().toLowerCase();
      if (q === 'unassigned') {
        return !cleaned || cleaned === 'unassigned' || cleaned === 'null' || cleaned === 'undefined' || cleaned === '—';
      }
      return cleaned.includes(q);
    });

    return { records: matchingCRs, isCR: true };
  }

  const matchingProjects = projectsList.filter((p) => {
    if (type === 'member') {
      if (key === 'itdl') return (p.IT_Delivery_Lead || 'unassigned').trim().toLowerCase().includes(q);
      if (key === 'po') return (p.Product_Owner || 'unassigned').trim().toLowerCase().includes(q);
      if (key === 'backupItdl') return (p.Backup_IT_Delivery_Lead || 'unassigned').trim().toLowerCase().includes(q);
      if (key === 'sitLead') return (p.SIT_Lead || 'unassigned').trim().toLowerCase().includes(q);
      if (key === 'uatLead') return (p.UAT_Lead || 'unassigned').trim().toLowerCase().includes(q);

      return (
        (p.IT_Delivery_Lead && p.IT_Delivery_Lead.toLowerCase().trim().includes(q)) ||
        (p.Product_Owner && p.Product_Owner.toLowerCase().trim().includes(q)) ||
        (p.Backup_IT_Delivery_Lead && p.Backup_IT_Delivery_Lead.toLowerCase().trim().includes(q)) ||
        (p.PMO_Project_Manager && p.PMO_Project_Manager.toLowerCase().trim().includes(q)) ||
        (p.Owned_By && p.Owned_By.toLowerCase().trim().includes(q))
      );
    }

    if (key === 'testing-blocked') return (p.Status || '').toLowerCase().includes('testing blocked') || (p.Status || '').toLowerCase().includes('blocked');
    if (key === 'deferred') return (p.Status || '').toLowerCase().includes('deferred');

    return (p.Status || '').toLowerCase().includes(q) || (p.StatusGroup || 0).toString() === key;
  });

  return { records: matchingProjects, isCR: false };
}

/**
 * Multi-criteria project table search filtering logic (onSearchProject)
 */
export function filterProjectGridData(projectsList = [], filters = {}) {
  const { selectedStatusSearch, IPM_number, ITDLSearch, ProductOwnerSearch, startDateSearch, endDateSearch } = filters;

  const formattedStartDate = startDateSearch ? parseDate(startDateSearch) : null;
  const formattedEndDate = endDateSearch ? parseDate(endDateSearch) : null;

  return projectsList.filter((x) => {
    // 1. Status Filter
    if (selectedStatusSearch && selectedStatusSearch !== 'All' && selectedStatusSearch.name !== 'All') {
      const targetName = typeof selectedStatusSearch === 'string' ? selectedStatusSearch : selectedStatusSearch.name;
      if (x.Status !== targetName) return false;
    }

    // 2. Project Code Search
    if (IPM_number && typeof IPM_number === 'string' && IPM_number.trim()) {
      if (!x.Ipm_Number || !x.Ipm_Number.toLowerCase().includes(IPM_number.trim().toLowerCase())) return false;
    }

    // 3. ITDL Search
    if (ITDLSearch && typeof ITDLSearch === 'string' && ITDLSearch.trim()) {
      if (!x.IT_Delivery_Lead || !x.IT_Delivery_Lead.toLowerCase().includes(ITDLSearch.trim().toLowerCase())) return false;
    }

    // 4. Product Owner Search
    if (ProductOwnerSearch && typeof ProductOwnerSearch === 'string' && ProductOwnerSearch.trim()) {
      if (!x.Product_Owner || !x.Product_Owner.toLowerCase().includes(ProductOwnerSearch.trim().toLowerCase())) return false;
    }

    // 5. Start Date Search
    if (formattedStartDate) {
      const prjStart = parseDate(x.Start_Date);
      if (!prjStart || prjStart.getTime() < formattedStartDate.getTime()) return false;
    }

    // 6. End Date Search
    if (formattedEndDate) {
      const prjEnd = parseDate(x.Due_Date);
      if (!prjEnd || prjEnd.getTime() > formattedEndDate.getTime()) return false;
    }

    return true;
  });
}

/**
 * Calculates Completed Projects Trends (Monthly, Quarterly, Half-Yearly, Annual)
 */
export function calculateCompletedProjectsTrends(projectsList = [], timeframe = 'Monthly') {
  const currentYear = new Date().getFullYear();

  const completedProjects = projectsList.filter((p) => {
    const stage = (p.Status || '').toLowerCase();
    return stage === 'completed';
  });

  if (timeframe === 'Monthly') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts = new Array(12).fill(0);

    completedProjects.forEach((p) => {
      const d = parseDate(p.Due_Date);
      if (d) {
        const m = d.getMonth();
        counts[m]++;
      }
    });

    return { labels: months, counts };
  }

  if (timeframe === 'Quarterly') {
    const quarters = ['Jan - Mar', 'Apr - Jun', 'Jul - Sep', 'Oct - Dec'];
    const counts = [0, 0, 0, 0];

    completedProjects.forEach((p) => {
      const d = parseDate(p.Due_Date);
      if (d) {
        const m = d.getMonth();
        if (m >= 0 && m <= 2) counts[0]++;
        else if (m >= 3 && m <= 5) counts[1]++;
        else if (m >= 6 && m <= 8) counts[2]++;
        else if (m >= 9 && m <= 11) counts[3]++;
      }
    });

    return { labels: quarters, counts };
  }

  if (timeframe === 'HalfYearly') {
    const halfYears = ['Jan - Jun', 'Jul - Dec'];
    const counts = [0, 0];

    completedProjects.forEach((p) => {
      const d = parseDate(p.Due_Date);
      if (d) {
        const m = d.getMonth();
        if (m >= 0 && m <= 5) counts[0]++;
        else counts[1]++;
      }
    });

    return { labels: halfYears, counts };
  }

  if (timeframe === 'Annual') {
    const years = [String(currentYear - 2), String(currentYear - 1), String(currentYear)];
    const counts = [0, 0, 0];

    completedProjects.forEach((p) => {
      const d = parseDate(p.Due_Date);
      if (d) {
        const yr = d.getFullYear();
        if (yr === currentYear - 2) counts[0]++;
        else if (yr === currentYear - 1) counts[1]++;
        else if (yr === currentYear) counts[2]++;
      }
    });

    return { labels: years, counts };
  }

  return { labels: [], counts: [] };
}
