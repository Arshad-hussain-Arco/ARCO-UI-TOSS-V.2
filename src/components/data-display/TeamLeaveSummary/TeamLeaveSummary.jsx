import React, { useState, useMemo, useEffect, Fragment } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  ArrowUpDown,
  Users,
  LayoutList,
  BarChart2,
  X
} from 'lucide-react';
import { Select } from '@components/forms/Select/Select';
import { ExportButton } from '@components/ui/ExportButton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '@api/httpClient';
import endpoints from '@api/endpoints';
import { useAuth } from '@hooks/useAuth';
import { Loader } from '@components/feedback/Loader/Loader';

import './TeamLeaveSummary.css';
import { activatable } from '@utils/interactive';
const LEAVE_CATEGORIES = [
  {
    key: 'annualLeaveUsed',
    label: 'Annual Leave',
    shortLabel: 'Annual',
    color: 'var(--c-primary)',
  },
  { key: 'sickLeaveUsed', label: 'Sick Leave', shortLabel: 'Sick', color: 'var(--c-danger)' },
  { key: 'compOffDays', label: 'Comp-Off', shortLabel: 'Comp-Off', color: '#d97706' },
  { key: 'wfhDays', label: 'WFH', shortLabel: 'WFH', color: '#6366f1' },
  { key: 'offshoreWorkDays', label: 'Offshore Work', shortLabel: 'Offshore', color: '#0891b2' },
  { key: 'weekendWorkDays', label: 'Weekend Work', shortLabel: 'Weekend', color: '#7c3aed' },
  { key: 'visaDays', label: 'Visa Purpose', shortLabel: 'Visa', color: '#be185d' },
  { key: 'paternityDays', label: 'Paternity', shortLabel: 'Paternity', color: 'var(--c-success)' },
];
const AVATAR_COLORS = [
  '#4f46e5',
  '#0891b2',
  'var(--c-success)',
  '#d97706',
  '#be185d',
  '#7c3aed',
  '#0f766e',
  '#b45309',
];
function calcTotal(c) {
  return (
    c.annualLeaveUsed +
    c.sickLeaveUsed +
    c.compOffDays +
    c.wfhDays +
    c.offshoreWorkDays +
    c.weekendWorkDays +
    c.visaDays +
    c.paternityDays
  );
}
function calcRemaining(c) {
  return c.leaveQuota - c.annualLeaveUsed - c.sickLeaveUsed;
}
function calcUtilization(c) {
  if (!c.leaveTypes || c.leaveTypes.length === 0) return 0;

  const totalQuota = c.leaveTypes
    .filter(leave => !leave.is_unlimited)
    .reduce((sum, leave) => sum + (Number(leave.entitled) || 0), 0);

  const totalBooked = c.leaveTypes
    .filter(leave => !leave.is_unlimited)
    .reduce((sum, leave) => sum + (Number(leave.booked) || 0), 0);

  return totalQuota > 0
    ? Number(((totalBooked / totalQuota) * 100).toFixed(2))
    : 0;
}
function getDeptStats(dept) {
  const count = dept.consultants.length;
  const totalLeaveDays = dept.consultants.reduce((s, c) => s + calcTotal(c), 0);
  const avgLeaveDays = count > 0 ? Math.round((totalLeaveDays / count) * 10) / 10 : 0;
  const quota = dept.consultants.reduce((s, c) => s + c.leaveQuota, 0);
  const used = dept.consultants.reduce((s, c) => s + c.annualLeaveUsed + c.sickLeaveUsed, 0);
  const utilizationPct = quota > 0 ? Math.round((used / quota) * 100) : 0;
  return { count, totalLeaveDays, avgLeaveDays, utilizationPct };
}
function getAvatarColor(name) {
  const sum = name.split('').reduce((s, ch) => s + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}
function getInitials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
function calculateConsultantTotals(c, summaryLeaveType) {
  let targetTypes = [];
  if (summaryLeaveType === 'annual') targetTypes = ['AL'];
  else if (summaryLeaveType === 'sick') targetTypes = ['SL'];
  else if (summaryLeaveType === 'compoff') targetTypes = ['CompOff', 'CCompOff'];
  else if (summaryLeaveType === 'wfh') targetTypes = ['WFH'];
  else if (summaryLeaveType === 'offshore') targetTypes = ['OW'];
  else if (summaryLeaveType === 'weekend') targetTypes = ['WW', 'CWW'];
  else if (summaryLeaveType === 'paternity') targetTypes = ['PL', 'ML'];

  let totalQuota = 0, totalBooked = 0, totalPending = 0, totalRemaining = 0;

  if (summaryLeaveType === 'all') {
    totalQuota = c.leaveTypes?.reduce((sum, lt) => sum + (lt.entitled || 0), 0) || c.leaveQuota || 0;
    totalBooked = c.leaveTypes?.reduce((sum, lt) => sum + (lt.booked || 0), 0) || calcTotal(c) || 0;
    totalPending = c.leaveTypes?.reduce((sum, lt) => sum + (lt.pending || 0), 0) || 0;
    totalRemaining = c.leaveTypes?.reduce((sum, lt) => sum + (lt.remaining || 0), 0) || calcRemaining(c) || 0;
  } else {
    if (c.leaveTypes && c.leaveTypes.length > 0) {
      const lts = c.leaveTypes.filter(lt => targetTypes.includes(lt.leave_type_code));
      totalQuota = lts.reduce((sum, lt) => sum + (lt.entitled || 0), 0);
      totalBooked = lts.reduce((sum, lt) => sum + (lt.booked || 0), 0);
      totalPending = lts.reduce((sum, lt) => sum + (lt.pending || 0), 0);
      totalRemaining = lts.reduce((sum, lt) => sum + (lt.remaining || 0), 0);
    } else {
      targetTypes.forEach(tt => {
        totalQuota += c.balances?.[tt]?.entitled || 0;
        totalBooked += c.balances?.[tt]?.used || 0;
        totalRemaining += c.balances?.[tt]?.available || 0;
      });
    }
  }
  return { totalQuota, totalBooked, totalPending, totalRemaining };
}
function TeamLeaveSummary({ getPhoto }) {
  const { user } = useAuth();
  const [departmentData, setDepartmentData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [summaryView, setSummaryView] = useState('department');
  const [summaryDepartment, setSummaryDepartment] = useState('all');
  const [summaryTimePeriod, setSummaryTimePeriod] = useState('');
  const [summaryLeaveType, setSummaryLeaveType] = useState('all');
  const [teamSortState, setTeamSortState] = useState({});
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [expandedDepts, setExpandedDepts] = useState(/* @__PURE__ */ new Set());
  const [expandedEmployees, setExpandedEmployees] = useState(new Set());
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [expandedAnalyticsDepts, setExpandedAnalyticsDepts] = useState(new Set());
  const [teamSearchQueries, setTeamSearchQueries] = useState({});

  useEffect(() => {
    const fetchSummary = async () => {
      if (!user?.emp_id) return;
      try {
        if (departmentData.length === 0) setLoading(true);
        const res = await api.get(endpoints.manager.teamLeaveQuota(user.emp_id), {
          params: summaryTimePeriod ? { month: summaryTimePeriod } : {}
        });
        const payload = res.data?.data || res.data;
        const rawData = Array.isArray(payload) ? payload : (payload?.results || []);

        // Group employees by team
        const deptMap = {};

        rawData.forEach(emp => {
          const tId = emp.team_id || 'unknown';
          if (!deptMap[tId]) {
            deptMap[tId] = {
              id: tId,
              name: emp.team_name || 'Other',
              consultants: []
            };
          }

          const b = {};
          if (Array.isArray(emp.leave_types)) {
            emp.leave_types.forEach(lt => {
              b[lt.leave_type_code] = {
                entitled: lt.entitled || 0,
                used: lt.booked || 0,
                available: lt.remaining || 0,
              };
            });
          } else if (emp.balances) {
            Object.assign(b, emp.balances);
          }

          deptMap[tId].consultants.push({
            id: emp.emp_id,
            name: emp.emp_name || 'Unknown Employee',
            designation: emp.designation,
            photo: emp.photo || emp.avatar || null,
            balances: b, // keep balances for backwards compatibility if needed
            leaveTypes: Array.isArray(emp.leave_types) ? emp.leave_types : [],
            leaveQuota: emp.summary?.total_entitled || (b.AL?.entitled || 0) + (b.SL?.entitled || 0),
            annualLeaveUsed: b.AL?.used || 0,
            sickLeaveUsed: b.SL?.used || 0,
            compOffDays: (b.CompOff?.used || 0) + (b.CCompOff?.used || 0),
            wfhDays: b.WFH?.used || 0,
            offshoreWorkDays: 0,
            weekendWorkDays: (b.WW?.used || 0) + (b.CWW?.used || 0),
            visaDays: 0,
            paternityDays: b.ML?.used || 0,
          });
        });

        setDepartmentData(Object.values(deptMap));
      } catch (err) {
        console.error('Error fetching team leave summary:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [user?.emp_id, summaryTimePeriod]);

  const mergedDepartmentData = useMemo(() => {
    if (!getPhoto) return departmentData;
    return departmentData.map(dept => ({
      ...dept,
      consultants: dept.consultants.map(emp => ({
        ...emp,
        photo: getPhoto(emp.emp_id || emp.id) || emp.photo
      }))
    }));
  }, [departmentData, getPhoto]);

  const handleTeamSearchChange = (deptId, value) => {
    setTeamSearchQueries((prev) => ({
      ...prev,
      [deptId]: value,
    }));
  };

  const handleAnalyticsUtilizationSort = (deptId) => {
    setTeamSortState((prev) => {
      const current = prev[deptId] || { field: null, direction: null };
      let nextDirection;
      if (current.field !== 'utilization' || !current.direction) {
        nextDirection = 'desc';
      } else if (current.direction === 'desc') {
        nextDirection = 'asc';
      } else {
        nextDirection = 'desc';
      }
      return {
        ...prev,
        [deptId]: {
          field: 'utilization',
          direction: nextDirection,
        },
      };
    });
  };

  useEffect(() => {
    if (departmentData.length > 0) {
      if (expandedAnalyticsDepts.size === 0) {
        setExpandedAnalyticsDepts(new Set(departmentData.map((d) => d.id)));
      }
      if (expandedDepts.size === 0) {
        setExpandedDepts(new Set(departmentData.map((d) => d.id)));
      }
    }
  }, [departmentData]);
  const [analyticsSort, setAnalyticsSort] = useState('utilization-high');
  const toggleDept = (id) => {
    const next = new Set(expandedDepts);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedDepts(next);
  };
  const toggleEmployee = (id) => {
    const next = new Set(expandedEmployees);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedEmployees(next);
  };
  const toggleAnalyticsDept = (id) => {
    const next = new Set(expandedAnalyticsDepts);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedAnalyticsDepts(next);
  };
  const handleSort = (deptId, field) => {
    setTeamSortState(prev => {
      const current = prev[deptId] || { field: 'name', direction: 'asc' };
      if (current.field === field) {
        return { ...prev, [deptId]: { field, direction: current.direction === 'asc' ? 'desc' : 'asc' } };
      } else {
        return { ...prev, [deptId]: { field, direction: 'asc' } };
      }
    });
  };
  const filteredDepartments = useMemo(() => {
    let depts = mergedDepartmentData;

    if (summaryDepartment !== 'all') {
      depts = depts.filter((d) => String(d.id) === String(summaryDepartment));
    }

    if (summaryTimePeriod) {
      depts = depts.map(dept => {
        const activeConsultants = (dept.consultants || []).filter(c => calcTotal(c) > 0);
        return { ...dept, consultants: activeConsultants };
      }).filter(dept => dept.consultants.length > 0);
    }
    
    const q = globalSearchQuery?.trim().toLowerCase();
    if (q) {
      depts = depts.map(dept => {
        const matched = (dept.consultants || []).filter(c => 
          c.name.toLowerCase().includes(q) ||
          (c.designation && c.designation.toLowerCase().includes(q))
        );
        return { ...dept, consultants: matched };
      }).filter(dept => dept.consultants.length > 0);
    }

    return depts;
  }, [summaryDepartment, mergedDepartmentData, summaryTimePeriod, globalSearchQuery]);

  useEffect(() => {
    if (globalSearchQuery?.trim() !== '') {
      const allFilteredDeptIds = filteredDepartments.map(d => d.id);
      setExpandedDepts(new Set(allFilteredDeptIds));
      setExpandedAnalyticsDepts(new Set(allFilteredDeptIds));
    }
  }, [globalSearchQuery, filteredDepartments]);
  const getSortedConsultants = (deptId, consultants) => {
    let filtered = consultants;
    const q = globalSearchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.designation && c.designation.toLowerCase().includes(q))
      );
    }
    const sortConfig = teamSortState[deptId] || { field: 'name', direction: 'asc' };
    const { field: sField, direction: sDir } = sortConfig;
    
    return [...filtered].sort((a, b) => {
      let aVal, bVal;
      
      switch (sField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'totalQuota':
          aVal = calculateConsultantTotals(a, summaryLeaveType).totalQuota;
          bVal = calculateConsultantTotals(b, summaryLeaveType).totalQuota;
          break;
        case 'totalBooked':
          aVal = calculateConsultantTotals(a, summaryLeaveType).totalBooked;
          bVal = calculateConsultantTotals(b, summaryLeaveType).totalBooked;
          break;
        case 'totalPending':
          aVal = calculateConsultantTotals(a, summaryLeaveType).totalPending;
          bVal = calculateConsultantTotals(b, summaryLeaveType).totalPending;
          break;
        case 'remaining':
          aVal = calculateConsultantTotals(a, summaryLeaveType).totalRemaining;
          bVal = calculateConsultantTotals(b, summaryLeaveType).totalRemaining;
          break;
        default:
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
      }
      
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sDir === 'asc' ? cmp : -cmp;
    });
  };
  const visibleCategories = useMemo(() => {
    if (summaryLeaveType === 'all') return LEAVE_CATEGORIES;
    const map = {
      annual: 'annualLeaveUsed',
      sick: 'sickLeaveUsed',
      compoff: 'compOffDays',
      wfh: 'wfhDays',
      offshore: 'offshoreWorkDays',
      weekend: 'weekendWorkDays',
      visa: 'visaDays',
      paternity: 'paternityDays',
    };
    const key = map[summaryLeaveType];
    return key ? LEAVE_CATEGORIES.filter((c) => c.key === key) : LEAVE_CATEGORIES;
  }, [summaryLeaveType]);
  const getSortedEmployees = (deptId, consultants) => {
    let filtered = consultants;
    if (summaryLeaveType !== 'all') {
      filtered = consultants.filter(c => visibleCategories.some(cat => c[cat.key] > 0));
    }
    const q = globalSearchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.designation && c.designation.toLowerCase().includes(q))
      );
    }
    const sortInfo = teamSortState[deptId];
    if (sortInfo && sortInfo.field === 'utilization' && sortInfo.direction) {
      return [...filtered].sort((a, b) => {
        const utilA = calcUtilization(a);
        const utilB = calcUtilization(b);
        return sortInfo.direction === 'desc' ? utilB - utilA : utilA - utilB;
      });
    }
    return [...filtered];
  };
  const globalMaxDays = useMemo(() => {
    const all = filteredDepartments.flatMap((d) => d.consultants);
    return Math.max(...all.map((c) => calcTotal(c)), 1);
  }, [filteredDepartments]);
  const sortedAnalyticsDepts = useMemo(() => {
    let depts = filteredDepartments;
    if (summaryLeaveType !== 'all') {
      depts = depts.filter(dept => {
        return dept.consultants.some(c => visibleCategories.some(cat => c[cat.key] > 0));
      });
    }

    const mapped = depts.map((dept) => ({
      dept,
      stats: getDeptStats(dept),
    }));
    return mapped.sort((a, b) => {
      if (analyticsSort === 'name') return a.dept.name.localeCompare(b.dept.name);
      if (analyticsSort === 'utilization-high')
        return b.stats.utilizationPct - a.stats.utilizationPct;
      return a.stats.utilizationPct - b.stats.utilizationPct;
    });
  }, [filteredDepartments, analyticsSort, summaryLeaveType, visibleCategories]);

  const handleExportCSV = () => {
    const headers = ['"Department"', '"Employee Name"', ...visibleCategories.map(c => `"${c.label}"`)];
    const rows = [];
    sortedAnalyticsDepts.forEach(({ dept }) => {
      const sortedEmployees = getSortedEmployees(dept.id, dept.consultants || []);
      sortedEmployees.forEach(emp => {
        rows.push([
          `"${(dept.name || '').replace(/"/g, '""')}"`,
          `"${(emp.name || '').replace(/"/g, '""')}"`,
          ...visibleCategories.map(c => emp[c.key] || 0)
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'team_leave_summary.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF('landscape');
    const headers = ['Department', 'Employee Name', ...visibleCategories.map(c => c.label)];
    const rows = [];
    sortedAnalyticsDepts.forEach(({ dept }) => {
      const sortedEmployees = getSortedEmployees(dept.id, dept.consultants || []);
      sortedEmployees.forEach(emp => {
        rows.push([
          dept.name || '',
          emp.name || '',
          ...visibleCategories.map(c => emp[c.key] || 0)
        ]);
      });
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [29, 78, 216] }
    });
    doc.save('team_leave_summary.pdf');
  };

  return (
    <div className="team-summary-container">
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
          <Loader size="md" message="Loading team leave summary..." />
        </div>
      )}
      {!loading && (
        <>
          {/* ── Shared Filter Bar ── */}
          <div className="team-summary-filter-bar">
            <div className="team-summary-filters-left">
              <div className="team-summary-filter-group">
                <Select
                  value={summaryDepartment}
                  onChange={setSummaryDepartment}
                  options={[
                    { value: 'all', label: 'All Departments' },
                    ...departmentData.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                  width="department"
                />
              </div>

              <div className="team-summary-filter-group">
                <Select
                  value={summaryTimePeriod}
                  onChange={setSummaryTimePeriod}
                  placeholder="Select Month"
                  options={[
                    { value: '', label: 'Select Month', disabled: true },
                    { value: 'january', label: 'January' },
                    { value: 'february', label: 'February' },
                    { value: 'march', label: 'March' },
                    { value: 'april', label: 'April' },
                    { value: 'may', label: 'May' },
                    { value: 'june', label: 'June' },
                    { value: 'july', label: 'July' },
                    { value: 'august', label: 'August' },
                    { value: 'september', label: 'September' },
                    { value: 'october', label: 'October' },
                    { value: 'november', label: 'November' },
                    { value: 'december', label: 'December' }
                  ]}
                  width="dateRange"
                />
              </div>

              <div className="team-summary-filter-group">
                <Select
                  value={summaryLeaveType}
                  onChange={setSummaryLeaveType}
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'annual', label: 'Annual Leave' },
                    { value: 'sick', label: 'Sick Leave' },
                    { value: 'compoff', label: 'Comp-Off' },
                    { value: 'wfh', label: 'WFH' },
                    { value: 'offshore', label: 'Offshore Work' },
                    { value: 'weekend', label: 'Weekend Work' },
                    { value: 'visa', label: 'Visa Purpose' },
                    { value: 'paternity', label: 'Paternity' },
                  ]}
                  width="leaveType"
                />
              </div>

              <div className="team-summary-filter-group" style={{ display: 'flex', alignItems: 'center' }}>
                <div className="team-summary-search-wrapper" style={{ minWidth: '220px' }}>
                  <Search className="team-summary-search-icon" size={13} />
                  <input
                    type="text"
                    placeholder="Search employee across all..."
                    className="team-summary-search-input"
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    style={{ paddingRight: '32px' }} 
                  />
                  {globalSearchQuery && (
                    <button type="button" className="search-clear-btn" onClick={() => setGlobalSearchQuery('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="team-summary-filters-right">
              <div className="team-summary-view-switcher">
                <button
                  className="team-summary-view-btn"
                  data-active={summaryView === 'department'}
                  onClick={() => setSummaryView('department')}
                >
                  <LayoutList size={13} />
                  <span>Table View</span>
                </button>
                <button
                  className="team-summary-view-btn"
                  data-active={summaryView === 'analytics'}
                  onClick={() => setSummaryView('analytics')}
                >
                  <BarChart2 size={13} />
                  <span>Analytics</span>
                </button>
              </div>

              <ExportButton
                excel
                pdf
                onExcelExport={handleExportCSV}
                onPdfExport={handleExportPDF}
              />
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════
        DEPARTMENT VIEW
    ═══════════════════════════════════════════════════════════ */}
          {summaryView === 'department' && (
            <div className="team-summary-departments">
              {filteredDepartments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '20px', fontSize: '13px' }}>
                  No team leave data available for the selected filters.
                </div>
              ) : (
                filteredDepartments.map((department) => {
                  const isExpanded = expandedDepts.has(department.id);
                  const stats = getDeptStats(department);
                  const sorted = getSortedConsultants(department.id, department.consultants);
                  return (
                    <div key={department.id} className="team-summary-department-section">
                      <div
                        className="team-summary-department-header"
                        {...activatable(() => toggleDept(department.id), {
                          isExpanded: expandedDepts.has(department.id),
                        })}
                      >
                        <div className="team-summary-department-header-left">
                          <ChevronRight
                            size={15}
                            className="team-summary-department-chevron"
                            data-expanded={isExpanded}
                          />
                          <span className="team-summary-department-name">{department.name}</span>
                        </div>
                        <div className="team-summary-department-meta">
                          <div className="team-summary-dept-stat">
                            <Users size={11} />
                            <span className="team-summary-dept-stat-val">{stats.count}</span>
                            <span className="team-summary-dept-stat-sub">consultants</span>
                          </div>



                          <div className="team-summary-dept-meta-sep" />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="team-summary-table-wrapper">
                          <div className="team-summary-table-container">
                            <table className="team-summary-table">
                              <thead className="team-summary-table-thead">
                                <tr>
                                  <th
                                    className="team-summary-table-header team-summary-table-header-sortable"
                                    onClick={() => handleSort(department.id, 'name')}
                                  >
                                    <span>
                                      Employee
                                      <ArrowUpDown size={10} className="team-summary-sort-icon" />
                                    </span>
                                  </th>
                                  <th className="team-summary-table-header team-summary-table-header-numeric team-summary-table-header-sortable" onClick={() => handleSort(department.id, 'totalQuota')}>
                                    <span>
                                      Total Quota
                                      <ArrowUpDown size={10} className="team-summary-sort-icon" />
                                    </span>
                                  </th>
                                  <th className="team-summary-table-header team-summary-table-header-numeric team-summary-table-header-sortable" onClick={() => handleSort(department.id, 'totalBooked')}>
                                    <span>
                                      Total Booked
                                      <ArrowUpDown size={10} className="team-summary-sort-icon" />
                                    </span>
                                  </th>
                                  <th className="team-summary-table-header team-summary-table-header-numeric team-summary-table-header-sortable" onClick={() => handleSort(department.id, 'totalPending')}>
                                    <span>
                                      Total Pending
                                      <ArrowUpDown size={10} className="team-summary-sort-icon" />
                                    </span>
                                  </th>
                                  <th
                                    className="team-summary-table-header team-summary-table-header-numeric team-summary-table-header-sortable"
                                    onClick={() => handleSort(department.id, 'remaining')}
                                  >
                                    <span>
                                      Total Remaining
                                      <ArrowUpDown size={10} className="team-summary-sort-icon" />
                                    </span>
                                  </th>
                                  <th className="team-summary-table-header" style={{ width: '40px', textAlign: 'center' }}></th>
                                </tr>
                              </thead>
                              <tbody className="team-summary-table-tbody">
                                {sorted.map((c) => {
                                  const isEmpExpanded = expandedEmployees.has(c.id);

                                  const { totalQuota, totalBooked, totalPending, totalRemaining } = calculateConsultantTotals(c, summaryLeaveType);

                                  const LEAVE_TYPE_LABELS = {
                                    AL: "Annual Leave",
                                    SL: "Sick Leave",
                                    ML: "Maternity Leave",
                                    PL: "Paternity Leave",
                                    CompOff: "Compensatory Off",
                                    WW: "Weekend Work",
                                    AdvL: "Advance Leave",
                                    CWW: "Claim Weekend Work",
                                    CCompOff: "Claim Compensatory Off",
                                    WFH: "Work From Home"
                                  };

                                  let targetTypes = [];
                                  if (summaryLeaveType === 'annual') targetTypes = ['AL'];
                                  else if (summaryLeaveType === 'sick') targetTypes = ['SL'];
                                  else if (summaryLeaveType === 'compoff') targetTypes = ['CompOff', 'CCompOff'];
                                  else if (summaryLeaveType === 'wfh') targetTypes = ['WFH'];
                                  else if (summaryLeaveType === 'offshore') targetTypes = ['OW'];
                                  else if (summaryLeaveType === 'weekend') targetTypes = ['WW', 'CWW'];
                                  else if (summaryLeaveType === 'paternity') targetTypes = ['PL', 'ML'];

                                  const relevantLeaves = c.leaveTypes || [];

                                  return (
                                    <Fragment key={c.id}>
                                      <tr className="team-summary-table-row" onClick={() => toggleEmployee(c.id)} style={{ cursor: 'pointer' }}>
                                        <td className="team-summary-table-cell team-summary-table-cell-name">
                                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 500 }}>{c.name}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.designation}</span>
                                          </div>
                                        </td>
                                        <td className="team-summary-table-cell team-summary-table-cell-numeric">{totalQuota}</td>
                                        <td className="team-summary-table-cell team-summary-table-cell-numeric">{totalBooked}</td>
                                        <td className="team-summary-table-cell team-summary-table-cell-numeric">{totalPending}</td>
                                        <td className="team-summary-table-cell team-summary-table-cell-numeric team-summary-cell-total" data-critical={totalRemaining <= 3 ? 'true' : 'false'}>{totalRemaining}</td>
                                        <td className="team-summary-table-cell" style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                          <ChevronDown size={16} style={{ transform: isEmpExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }} />
                                        </td>
                                      </tr>
                                      {isEmpExpanded && (
                                        <tr className="team-summary-sub-row">
                                          <td colSpan={6} style={{ padding: 0 }}>
                                            <div className="team-summary-sub-table-wrapper">
                                              <table className="team-summary-sub-table">
                                                <thead>
                                                  <tr>
                                                    <th>Leave Type</th>
                                                    <th className="num">Entitled</th>
                                                    <th className="num">Carryover</th>
                                                    <th className="num">Advance Prev Yr</th>
                                                    <th className="num">Upcoming</th>
                                                    <th className="num">Booked</th>
                                                    <th className="num">Pending</th>
                                                    <th className="num">Approved</th>
                                                    <th className="num">Rejected</th>
                                                    <th className="num">Completed</th>
                                                    <th className="num">Remaining</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {relevantLeaves.length > 0 ? (
                                                    relevantLeaves.map((lt, idx) => {
                                                      const typeMatches = targetTypes.includes(lt.leave_type_code);
                                                      return (
                                                        <tr key={idx} style={{ backgroundColor: (summaryLeaveType !== 'all' && typeMatches) ? 'rgba(16, 185, 129, 0.15)' : 'transparent' }}>
                                                          <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{LEAVE_TYPE_LABELS[lt.leave_type_code] || lt.leave_type_name || lt.leave_type_code}</td>
                                                          <td className="num">{lt.entitled || 0}</td>
                                                          <td className="num">{lt.carryover || 0}</td>
                                                          <td className="num">{lt.advance_taken_prev_yr || 0}</td>
                                                          <td className="num">{lt.upcoming || 0}</td>
                                                          <td className="num">{lt.booked || 0}</td>
                                                          <td className="num">{lt.pending || 0}</td>
                                                          <td className="num">{lt.approved || 0}</td>
                                                          <td className="num">{lt.rejected || 0}</td>
                                                          <td className="num">{lt.completed || 0}</td>
                                                          <td className="num" style={{ fontWeight: 600, color: 'var(--c-primary)' }}>{lt.remaining || 0}</td>
                                                        </tr>
                                                      );
                                                    })
                                                  ) : (
                                                    <tr>
                                                      <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '16px' }}>No active leave allocations found.</td>
                                                    </tr>
                                                  )}
                                                </tbody>
                                              </table>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
        ANALYTICS VIEW
    ═══════════════════════════════════════════════════════════ */}
          {summaryView === 'analytics' && (
            <div className="tsa-container">
              {/* ── Analytics Controls Bar ── */}
              <div className="tsa-controls">
                {/* Legend */}
                <div className="tsa-legend">
                  {visibleCategories.map((cat) => (
                    <div key={cat.key} className="tsa-legend-item">
                      <span className="tsa-legend-swatch" style={{ backgroundColor: cat.color }} />
                      <span className="tsa-legend-label">{cat.shortLabel}</span>
                    </div>
                  ))}
                </div>

                {/* Sort control */}
                <div className="tsa-sort-wrap">
                  <span className="team-summary-filter-label">Sort By</span>
                  <Select
                    value={analyticsSort}
                    onChange={(v) => setAnalyticsSort(v)}
                    options={[
                      { value: 'utilization-high', label: 'Highest Utilized' },
                      { value: 'utilization-low', label: 'Lowest Utilized' },
                      { value: 'name', label: 'Employee Name' },
                    ]}
                    width="sort"
                  />
                </div>
              </div>

              {/* ── Department Accordion List ── */}
              <div className="tsa-dept-list">
                {sortedAnalyticsDepts.length === 0 ? (
                  <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px', backgroundColor: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-color)', marginTop: '20px' }}>
                    No team leave data available for the selected filters.
                  </div>
                ) : (
                  sortedAnalyticsDepts.map(({ dept, stats }) => {
                    const isExpanded = expandedAnalyticsDepts.has(dept.id);
                    const employees = getSortedEmployees(dept.id, dept.consultants);
                    const teamSort = teamSortState[dept.id] || { field: null, direction: null };
                    const isSorted = teamSort.field === 'utilization' && Boolean(teamSort.direction);
                    const isAsc = teamSort.direction === 'asc';
                    return (
                      <div key={dept.id} className="tsa-dept-section">
                        {/* Accordion Header */}
                        <div
                          className="tsa-dept-header"
                          {...activatable(() => toggleAnalyticsDept(dept.id))}
                        >
                          <div className="tsa-dept-header-left">
                            <ChevronRight
                              size={15}
                              className="tsa-dept-chevron"
                              data-expanded={isExpanded}
                            />
                            <span className="tsa-dept-name">{dept.name}</span>
                            <span className="tsa-dept-count">{stats.count} employees</span>
                          </div>
                          <div className="tsa-dept-header-right">


                            <div className="tsa-dept-kpi-sep" />


                          </div>
                        </div>

                        {/* Expanded: employee table */}
                        {isExpanded && (
                          <div className="team-summary-table-wrapper" style={{ padding: '12px 14px' }}>
                            <div className="team-summary-table-container">
                              <table className="team-summary-table">
                                <thead className="team-summary-table-thead">
                                  <tr>
                                    <th className="team-summary-table-header">Employee</th>
                                    <th className="team-summary-table-header team-summary-table-header-numeric">Leave Taken</th>
                                    <th className="team-summary-table-header team-summary-table-header-numeric">Leave Balance</th>
                                    <th
                                      className="team-summary-table-header team-summary-table-header-numeric team-summary-table-header-sortable"
                                      onClick={() => handleAnalyticsUtilizationSort(dept.id)}
                                    >
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                        Utilization
                                        <ArrowUpDown
                                          size={10}
                                          className="team-summary-sort-icon"
                                          style={{
                                            opacity: isSorted ? 1 : 0.35,
                                            color: isSorted ? 'var(--c-primary)' : 'inherit',
                                            transform: isAsc ? 'rotate(180deg)' : 'none',
                                            transition: 'transform 0.2s ease, opacity 0.2s ease'
                                          }}
                                        />
                                      </span>
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="team-summary-table-tbody">
                                  {employees.length === 0 ? (
                                    <tr>
                                      <td colSpan={4} style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '14px' }}>
                                        {teamSearchQueries[dept.id]?.trim()
                                          ? "No employees match your search."
                                          : (summaryLeaveType !== 'all'
                                            ? "No employees have utilized this specific leave type."
                                            : "No employees found in this department.")}
                                      </td>
                                    </tr>
                                  ) : (
                                    employees.map((emp) => {
                                      const total = calcTotal(emp);
                                      const utilPct = calcUtilization(emp);
                                      const avatarColor = getAvatarColor(emp.name);
                                      const initials = getInitials(emp.name);

                                      // Status: Low (0%-44%) -> low, Moderate (45%-70%) -> moderate, High (71%+) -> high
                                      let statusClass = 'low';
                                      if (utilPct >= 71) statusClass = 'high';
                                      else if (utilPct >= 45) statusClass = 'moderate';

                                      // Find leave type booked and remaining days
                                      let leaveTaken = total;
                                      let leaveBalance = calcRemaining(emp);

                                      if (summaryLeaveType !== 'all') {
                                        let targetTypes = [];
                                        if (summaryLeaveType === 'annual') targetTypes = ['AL'];
                                        else if (summaryLeaveType === 'sick') targetTypes = ['SL'];
                                        else if (summaryLeaveType === 'compoff') targetTypes = ['CompOff', 'CCompOff'];
                                        else if (summaryLeaveType === 'wfh') targetTypes = ['WFH'];
                                        else if (summaryLeaveType === 'offshore') targetTypes = ['OW'];
                                        else if (summaryLeaveType === 'weekend') targetTypes = ['WW', 'CWW'];
                                        else if (summaryLeaveType === 'paternity') targetTypes = ['PL', 'ML'];

                                        if (emp.leaveTypes && emp.leaveTypes.length > 0) {
                                          const lts = emp.leaveTypes.filter(lt => targetTypes.includes(lt.leave_type_code));
                                          leaveTaken = lts.reduce((sum, lt) => sum + (lt.booked || 0), 0);
                                          leaveBalance = lts.reduce((sum, lt) => sum + (lt.remaining || 0), 0);
                                        } else {
                                          leaveTaken = 0;
                                          leaveBalance = 0;
                                          targetTypes.forEach(tt => {
                                            leaveTaken += emp.balances?.[tt]?.used || 0;
                                            leaveBalance += emp.balances?.[tt]?.available || 0;
                                          });
                                        }
                                      }

                                      return (
                                        <tr key={emp.id} className="team-summary-table-row">
                                          <td className="team-summary-table-cell team-summary-table-cell-name">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                              <div
                                                className="tsa-avatar"
                                                style={{ backgroundColor: emp.photo ? 'transparent' : avatarColor }}
                                              >
                                                {emp.photo ? (
                                                  <img
                                                    src={emp.photo.startsWith('data:') ? emp.photo : `data:image/jpeg;base64,${emp.photo}`}
                                                    alt={emp.name}
                                                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                                                  />
                                                ) : (
                                                  initials
                                                )}
                                              </div>
                                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)' }}>{emp.name}</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{emp.designation}</span>
                                              </div>
                                            </div>
                                          </td>
                                          <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                            {leaveTaken !== null && leaveTaken !== undefined ? `${leaveTaken} day${leaveTaken !== 1 ? 's' : ''}` : '—'}
                                          </td>
                                          <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                            {leaveBalance !== null && leaveBalance !== undefined ? `${leaveBalance} day${leaveBalance !== 1 ? 's' : ''}` : '—'}
                                          </td>
                                          <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                            <span className="tsa-util-badge" data-status={statusClass}>
                                              {utilPct}%
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  }))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export { TeamLeaveSummary };
export default TeamLeaveSummary;
