import { useState, useMemo } from 'react';
import {
  Search,
  Download,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  ChevronRight,
  ArrowUpDown,
  Users,
  LayoutList,
  BarChart2,
} from 'lucide-react';
import { Select } from '@components/forms/Select/Select';
import { DEPARTMENT_LEAVE_SUMMARY as mockDepartmentData } from '@mocks/data/leaveSummary';

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
  { key: 'paternityDays', label: 'Paternity', shortLabel: 'Paternity', color: '#059669' },
];
const AVATAR_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#059669',
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
  return c.leaveQuota > 0
    ? Math.round(((c.annualLeaveUsed + c.sickLeaveUsed) / c.leaveQuota) * 100)
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
function TeamLeaveSummary() {
  const [summaryView, setSummaryView] = useState('department');
  const [summaryDepartment, setSummaryDepartment] = useState('all');
  const [summaryTimePeriod, setSummaryTimePeriod] = useState('this-month');
  const [summaryLeaveType, setSummaryLeaveType] = useState('all');
  const [summarySearchQuery, setSummarySearchQuery] = useState('');
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState(/* @__PURE__ */ new Set());
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [expandedAnalyticsDepts, setExpandedAnalyticsDepts] = useState(
    new Set(mockDepartmentData.map((d) => d.id)),
  );
  const [analyticsSort, setAnalyticsSort] = useState('utilization-high');
  const toggleDept = (id) => {
    const next = new Set(expandedDepts);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedDepts(next);
  };
  const toggleAnalyticsDept = (id) => {
    const next = new Set(expandedAnalyticsDepts);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedAnalyticsDepts(next);
  };
  const handleSort = (field) => {
    if (sortField === field) setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  const filteredDepartments = useMemo(() => {
    let depts =
      summaryDepartment === 'all'
        ? mockDepartmentData
        : mockDepartmentData.filter((d) => d.id === summaryDepartment);
    if (summarySearchQuery.trim()) {
      const q = summarySearchQuery.toLowerCase();
      depts = depts
        .map((d) => ({
          ...d,
          consultants: d.consultants.filter((c) => c.name.toLowerCase().includes(q)),
        }))
        .filter((d) => d.consultants.length > 0);
    }
    return depts;
  }, [summaryDepartment, summarySearchQuery]);
  const getSortedConsultants = (consultants) =>
    [...consultants].sort((a, b) => {
      const aVal =
        sortField === 'name'
          ? a.name.toLowerCase()
          : sortField === 'totalLeaveDays'
            ? calcTotal(a)
            : calcRemaining(a);
      const bVal =
        sortField === 'name'
          ? b.name.toLowerCase()
          : sortField === 'totalLeaveDays'
            ? calcTotal(b)
            : calcRemaining(b);
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  const getSortedEmployees = (consultants) => {
    const filtered = summaryLeaveType === 'all' ? consultants : consultants;
    return [...filtered].sort((a, b) => {
      if (analyticsSort === 'name') return a.name.localeCompare(b.name);
      if (analyticsSort === 'utilization-high') return calcUtilization(b) - calcUtilization(a);
      return calcUtilization(a) - calcUtilization(b);
    });
  };
  const globalMaxDays = useMemo(() => {
    const all = filteredDepartments.flatMap((d) => d.consultants);
    return Math.max(...all.map((c) => calcTotal(c)), 1);
  }, [filteredDepartments]);
  const sortedAnalyticsDepts = useMemo(() => {
    const depts = filteredDepartments.map((dept) => ({
      dept,
      stats: getDeptStats(dept),
    }));
    return depts.sort((a, b) => {
      if (analyticsSort === 'name') return a.dept.name.localeCompare(b.dept.name);
      if (analyticsSort === 'utilization-high')
        return b.stats.utilizationPct - a.stats.utilizationPct;
      return a.stats.utilizationPct - b.stats.utilizationPct;
    });
  }, [filteredDepartments, analyticsSort]);
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
  return (
    <div className="team-summary-container">
      {/* ── Shared Filter Bar ── */}
      <div className="team-summary-filter-bar">
        <div className="team-summary-filters-left">
          <div className="team-summary-filter-group">
            <span className="team-summary-filter-label">Department</span>
            <Select
              value={summaryDepartment}
              onChange={setSummaryDepartment}
              options={[
                { value: 'all', label: 'All Departments' },
                ...mockDepartmentData.map((d) => ({ value: d.id, label: d.name })),
              ]}
              width="department"
            />
          </div>

          <div className="team-summary-filter-group">
            <span className="team-summary-filter-label">Time Period</span>
            <Select
              value={summaryTimePeriod}
              onChange={setSummaryTimePeriod}
              options={[
                { value: 'this-month', label: 'This Month' },
                { value: 'this-quarter', label: 'This Quarter' },
                { value: 'this-year', label: 'This Year' },
                { value: 'custom', label: 'Custom' },
              ]}
              width="dateRange"
            />
          </div>

          <div className="team-summary-filter-group">
            <span className="team-summary-filter-label">Leave Type</span>
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

          <div className="team-summary-filter-group team-summary-search-group">
            <span className="team-summary-filter-label">Search Employee</span>
            <div className="team-summary-search-wrapper">
              <Search className="team-summary-search-icon" size={13} />
              <input
                type="text"
                placeholder="Search by name..."
                className="team-summary-search-input"
                value={summarySearchQuery}
                onChange={(e) => setSummarySearchQuery(e.target.value)}
              />
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
              <span>Dept View</span>
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

          <div className="team-summary-export-wrapper">
            <button
              className="team-summary-export-btn"
              onClick={() => setShowExportDropdown((v) => !v)}
            >
              <Download size={13} />
              <span>Export</span>
              <ChevronDown size={11} />
            </button>
            {showExportDropdown && (
              <div className="team-summary-export-dropdown">
                <button
                  className="team-summary-export-option"
                  onClick={() => setShowExportDropdown(false)}
                >
                  <FileSpreadsheet size={13} />
                  <span>Export as Excel</span>
                </button>
                <button
                  className="team-summary-export-option"
                  onClick={() => setShowExportDropdown(false)}
                >
                  <FileText size={13} />
                  <span>Export as PDF</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
        DEPARTMENT VIEW
    ═══════════════════════════════════════════════════════════ */}
      {summaryView === 'department' && (
        <div className="team-summary-departments">
          {filteredDepartments.map((department) => {
            const isExpanded = expandedDepts.has(department.id);
            const stats = getDeptStats(department);
            const sorted = getSortedConsultants(department.consultants);
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
                    <div className="team-summary-dept-stat">
                      <span className="team-summary-dept-stat-val">{stats.totalLeaveDays}</span>
                      <span className="team-summary-dept-stat-sub">days used</span>
                    </div>
                    <div className="team-summary-dept-meta-sep" />
                    <div className="team-summary-dept-stat">
                      <span className="team-summary-dept-stat-val">{stats.avgLeaveDays}</span>
                      <span className="team-summary-dept-stat-sub">avg/person</span>
                    </div>
                    <div className="team-summary-dept-meta-sep" />
                    <div className="team-summary-dept-utilization">
                      <div className="team-summary-dept-util-bar">
                        <div
                          className="team-summary-dept-util-fill"
                          style={{ width: `${stats.utilizationPct}%` }}
                          data-high={stats.utilizationPct >= 80 ? 'true' : 'false'}
                        />
                      </div>
                      <span className="team-summary-dept-util-pct">{stats.utilizationPct}%</span>
                      <span className="team-summary-dept-stat-sub">utilization</span>
                    </div>
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
                              onClick={() => handleSort('name')}
                            >
                              <span>Employee</span>
                              <ArrowUpDown size={10} className="team-summary-sort-icon" />
                            </th>
                            <th className="team-summary-table-header team-summary-table-header-numeric">
                              Quota
                            </th>
                            <th className="team-summary-table-header team-summary-table-header-numeric">
                              Annual
                            </th>
                            <th className="team-summary-table-header team-summary-table-header-numeric">
                              Sick
                            </th>
                            <th className="team-summary-table-header team-summary-table-header-numeric">
                              Comp-Off
                            </th>
                            <th className="team-summary-table-header team-summary-table-header-numeric">
                              WFH
                            </th>
                            <th className="team-summary-table-header team-summary-table-header-numeric">
                              Offshore
                            </th>
                            <th className="team-summary-table-header team-summary-table-header-numeric">
                              Weekend
                            </th>
                            <th className="team-summary-table-header team-summary-table-header-numeric">
                              Visa
                            </th>
                            <th className="team-summary-table-header team-summary-table-header-numeric">
                              Paternity
                            </th>
                            <th
                              className="team-summary-table-header team-summary-table-header-numeric team-summary-table-header-sortable"
                              onClick={() => handleSort('totalLeaveDays')}
                            >
                              <span>Total</span>
                              <ArrowUpDown size={10} className="team-summary-sort-icon" />
                            </th>
                            <th
                              className="team-summary-table-header team-summary-table-header-numeric team-summary-table-header-sortable"
                              onClick={() => handleSort('remaining')}
                            >
                              <span>Balance</span>
                              <ArrowUpDown size={10} className="team-summary-sort-icon" />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="team-summary-table-tbody">
                          {sorted.map((c) => {
                            const total = calcTotal(c);
                            const remaining = calcRemaining(c);
                            return (
                              <tr key={c.id} className="team-summary-table-row">
                                <td className="team-summary-table-cell team-summary-table-cell-name">
                                  {c.name}
                                </td>
                                <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                  {c.leaveQuota}
                                </td>
                                <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                  {c.annualLeaveUsed}
                                </td>
                                <td
                                  className="team-summary-table-cell team-summary-table-cell-numeric"
                                  data-highlight={c.sickLeaveUsed > 2 ? 'true' : 'false'}
                                >
                                  {c.sickLeaveUsed}
                                </td>
                                <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                  {c.compOffDays}
                                </td>
                                <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                  {c.wfhDays}
                                </td>
                                <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                  {c.offshoreWorkDays}
                                </td>
                                <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                  {c.weekendWorkDays}
                                </td>
                                <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                  {c.visaDays}
                                </td>
                                <td className="team-summary-table-cell team-summary-table-cell-numeric">
                                  {c.paternityDays}
                                </td>
                                <td className="team-summary-table-cell team-summary-table-cell-numeric team-summary-cell-total">
                                  {total}
                                </td>
                                <td
                                  className="team-summary-table-cell team-summary-table-cell-numeric"
                                  data-critical={remaining <= 3 ? 'true' : 'false'}
                                >
                                  {remaining}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
            {sortedAnalyticsDepts.map(({ dept, stats }) => {
              const isExpanded = expandedAnalyticsDepts.has(dept.id);
              const employees = getSortedEmployees(dept.consultants);
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
                      <div className="tsa-dept-kpi">
                        <span className="tsa-dept-kpi-val">{stats.totalLeaveDays}</span>
                        <span className="tsa-dept-kpi-sub">days total</span>
                      </div>
                      <div className="tsa-dept-kpi-sep" />
                      <div className="tsa-dept-kpi">
                        <span className="tsa-dept-kpi-val">{stats.avgLeaveDays}</span>
                        <span className="tsa-dept-kpi-sub">avg/person</span>
                      </div>
                      <div className="tsa-dept-kpi-sep" />
                      <div className="tsa-dept-util">
                        <div className="tsa-dept-util-track">
                          <div
                            className="tsa-dept-util-fill"
                            style={{ width: `${stats.utilizationPct}%` }}
                            data-high={stats.utilizationPct >= 80 ? 'true' : 'false'}
                          />
                        </div>
                        <span
                          className="tsa-dept-util-pct"
                          data-high={stats.utilizationPct >= 80 ? 'true' : 'false'}
                        >
                          {stats.utilizationPct}%
                        </span>
                        <span className="tsa-dept-kpi-sub">utilized</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded: dept summary + employee bars */}
                  {isExpanded && (
                    <div className="tsa-dept-body">
                      {/* Department Summary Strip */}
                      <div className="tsa-dept-summary">
                        <div className="tsa-summary-stat">
                          <span className="tsa-summary-stat-val">{stats.count}</span>
                          <span className="tsa-summary-stat-label">Total Employees</span>
                        </div>
                        <div className="tsa-summary-sep" />
                        <div className="tsa-summary-stat">
                          <span className="tsa-summary-stat-val">{stats.totalLeaveDays}</span>
                          <span className="tsa-summary-stat-label">Days Utilized</span>
                        </div>
                        <div className="tsa-summary-sep" />
                        <div className="tsa-summary-stat">
                          <span className="tsa-summary-stat-val">{stats.avgLeaveDays}</span>
                          <span className="tsa-summary-stat-label">Avg Days / Person</span>
                        </div>
                        <div className="tsa-summary-sep" />
                        <div className="tsa-summary-stat">
                          <span
                            className="tsa-summary-stat-val"
                            data-high={stats.utilizationPct >= 80 ? 'true' : 'false'}
                          >
                            {stats.utilizationPct}%
                          </span>
                          <span className="tsa-summary-stat-label">Leave Utilization</span>
                        </div>
                      </div>

                      {/* Employee Bar Rows */}
                      <div className="tsa-emp-list">
                        {employees.map((emp) => {
                          const total = calcTotal(emp);
                          const utilPct = calcUtilization(emp);
                          const barWidthPct = (total / globalMaxDays) * 100;
                          const avatarColor = getAvatarColor(emp.name);
                          const initials = getInitials(emp.name);
                          return (
                            <div key={emp.id} className="tsa-emp-row">
                              {/* Employee info */}
                              <div className="tsa-emp-info">
                                <div
                                  className="tsa-avatar"
                                  style={{ backgroundColor: avatarColor }}
                                >
                                  {initials}
                                </div>
                                <div className="tsa-emp-text">
                                  <span className="tsa-emp-name">{emp.name}</span>
                                  <span className="tsa-emp-meta">
                                    {emp.employeeId}
                                    <span className="tsa-emp-meta-dot">·</span>
                                    {emp.designation}
                                  </span>
                                </div>
                              </div>

                              {/* Stacked bar */}
                              <div className="tsa-bar-wrap">
                                <div className="tsa-bar-track">
                                  <div className="tsa-bar" style={{ width: `${barWidthPct}%` }}>
                                    {visibleCategories.map((cat) => {
                                      const val = emp[cat.key];
                                      const segPct = total > 0 ? (val / total) * 100 : 0;
                                      if (segPct === 0) return null;
                                      return (
                                        <div
                                          key={cat.key}
                                          className="tsa-segment"
                                          style={{
                                            width: `${segPct}%`,
                                            backgroundColor: cat.color,
                                          }}
                                          title={`${cat.label}: ${val} days`}
                                        />
                                      );
                                    })}
                                  </div>
                                  {/* Quota marker */}
                                  {emp.leaveQuota > 0 && (
                                    <div
                                      className="tsa-quota-marker"
                                      style={{ left: `${(emp.leaveQuota / globalMaxDays) * 100}%` }}
                                      title={`Quota: ${emp.leaveQuota} days`}
                                    />
                                  )}
                                </div>
                              </div>

                              {/* Stats */}
                              <div className="tsa-emp-stats">
                                <span className="tsa-emp-total">{total} days</span>
                                <span
                                  className="tsa-emp-util"
                                  data-high={utilPct >= 80 ? 'true' : 'false'}
                                  data-low={utilPct < 40 ? 'true' : 'false'}
                                >
                                  {utilPct}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
export { TeamLeaveSummary };
export default TeamLeaveSummary;
