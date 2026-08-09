import { X } from 'lucide-react';
import React, { useState, useEffect } from "react";
import { colors } from "../../styles/tokens";
import { StatCard, Pill, ProgressBar, AlertRow, Avatar } from "../../components/ui";
import ApprovalRow from "../../components/dashboard/ApprovalRow";
import { RequestsTrendChart, LeaveDistributionDonut, DepartmentBarChart } from "../../components/dashboard/charts";
import "./LmsDashboard.css";

const API_BASE = "/api/dashboard";

export default function LmsDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  // Summary KPI State
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Department Stats State
  const [deptStats, setDeptStats] = useState({ results: [], count: 0, current_page: 1, total_pages: 1 });
  const [deptPage, setDeptPage] = useState(1);
  const [deptSearch, setDeptSearch] = useState("");

  // Leave Utilization State
  const [utilization, setUtilization] = useState({ results: [], count: 0 });
  const [utilYear, setUtilYear] = useState(new Date().getFullYear());

  // Employee Balances State
  const [balances, setBalances] = useState({ results: [], count: 0, current_page: 1, total_pages: 1 });
  const [balPage, setBalPage] = useState(1);
  const [balSearch, setBalSearch] = useState("");

  // On-Leave List State
  const [onLeave, setOnLeave] = useState({ results: [], count: 0, current_page: 1, total_pages: 1 });
  const [onLeavePage, setOnLeavePage] = useState(1);

  // Pending Approvals State
  const [pending, setPending] = useState({ results: [], count: 0, current_page: 1, total_pages: 1 });
  const [pendingPage, setPendingPage] = useState(1);

  // EOD Status State
  const [eodStatus, setEodStatus] = useState({ results: [], count: 0, current_page: 1, total_pages: 1 });
  const [eodPage, setEodPage] = useState(1);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState({ results: [], count: 0, current_page: 1, total_pages: 1 });
  const [auditPage, setAuditPage] = useState(1);

  // Leave Requests Trend State
  const [trendData, setTrendData] = useState({ results: [], sla_threshold: 10 });
  const [trendLoading, setTrendLoading] = useState(false);

  // Fetch summary & trend on load
  useEffect(() => {
    fetchSummary();
    fetchTrend();
  }, []);

  // Tab trigger fetches
  useEffect(() => {
    if (activeTab === "overview") {
      fetchSummary();
      fetchTrend();
      fetchDeptStats(1);
    } else if (activeTab === "departments") {
      fetchDeptStats(deptPage);
    } else if (activeTab === "utilization") {
      fetchUtilization(utilYear);
    } else if (activeTab === "balances") {
      fetchBalances(balPage, balSearch);
    } else if (activeTab === "onleave") {
      fetchOnLeave(onLeavePage);
    } else if (activeTab === "pending") {
      fetchPending(pendingPage);
    } else if (activeTab === "eod") {
      fetchEodStatus(eodPage);
    } else if (activeTab === "audit") {
      fetchAuditLogs(auditPage);
    }
  }, [activeTab, deptPage, utilYear, balPage, onLeavePage, pendingPage, eodPage, auditPage]);

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const res = await fetch(`${API_BASE}/summary/`);
      if (res.ok) {
        const data = await res.json();
        setSummary(data);
      }
    } catch (err) {
      console.error("Failed to fetch dashboard summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const fetchTrend = async () => {
    try {
      setTrendLoading(true);
      const res = await fetch(`${API_BASE}/leave-requests-trend/?days=14`);
      if (res.ok) {
        const data = await res.json();
        setTrendData(data);
      }
    } catch (err) {
      console.error("Failed to fetch request trend data:", err);
    } finally {
      setTrendLoading(false);
    }
  };

  const fetchDeptStats = async (page = 1) => {
    try {
      const url = `${API_BASE}/department-stats/?page=${page}&search=${encodeURIComponent(deptSearch)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setDeptStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch department stats:", err);
    }
  };

  const fetchUtilization = async (year) => {
    try {
      const res = await fetch(`${API_BASE}/leave-utilization/?year=${year}`);
      if (res.ok) {
        const data = await res.json();
        setUtilization(data);
      }
    } catch (err) {
      console.error("Failed to fetch leave utilization:", err);
    }
  };

  const fetchBalances = async (page = 1, search = "") => {
    try {
      const res = await fetch(`${API_BASE}/employee-balances/?page=${page}&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setBalances(data);
      }
    } catch (err) {
      console.error("Failed to fetch employee balances:", err);
    }
  };

  const fetchOnLeave = async (page = 1) => {
    try {
      const res = await fetch(`${API_BASE}/on-leave/?page=${page}`);
      if (res.ok) {
        const data = await res.json();
        setOnLeave(data);
      }
    } catch (err) {
      console.error("Failed to fetch on-leave list:", err);
    }
  };

  const fetchPending = async (page = 1) => {
    try {
      const res = await fetch(`${API_BASE}/pending-approvals/?page=${page}`);
      if (res.ok) {
        const data = await res.json();
        setPending(data);
      }
    } catch (err) {
      console.error("Failed to fetch pending approvals:", err);
    }
  };

  const fetchEodStatus = async (page = 1) => {
    try {
      const res = await fetch(`${API_BASE}/eod-status/?page=${page}`);
      if (res.ok) {
        const data = await res.json();
        setEodStatus(data);
      }
    } catch (err) {
      console.error("Failed to fetch EOD status:", err);
    }
  };

  const fetchAuditLogs = async (page = 1) => {
    try {
      const res = await fetch(`${API_BASE}/audit-activity/?page=${page}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error("Failed to fetch audit logs:", err);
    }
  };

  const handleApprovalResolved = (rowId) => {
    setPending((prev) => ({
      ...prev,
      results: (prev.results || []).filter((item) => item.id !== rowId),
      count: Math.max(0, (prev.count || 1) - 1),
    }));
    fetchSummary();
  };

  // API values directly from backend summary endpoint
  const totalActive = summary?.active_employees || 0;
  const presentCount = summary?.present_count || 0;
  const wfhCount = summary?.wfh_count || 0;
  const onLeaveCount = summary?.employees_on_leave_today || 0;

  const presentPercent = totalActive > 0 ? Math.round((presentCount / totalActive) * 100) : 0;
  const wfhPercent = totalActive > 0 ? Math.round((wfhCount / totalActive) * 100) : 0;
  const onLeavePercent = totalActive > 0 ? Math.round((onLeaveCount / totalActive) * 100) : 0;

  // Department progression colors cycle
  const deptProgressVariants = ["blue", "green", "purple"];

  return (
    <div className="lms-dashboard-container">
      {/* Header Title Banner */}
      <div className="lms-dashboard-header">
        <div>
          <h2>Enterprise Leave Management Dashboard</h2>
          <p className="lms-dashboard-subtitle">
            Real-time Workforce Analytics, Leave Balances, and Operational Monitoring
          </p>
        </div>
        <div className="lms-header-actions">
          <button className="lms-btn lms-btn-primary" onClick={fetchSummary}>
            🔄 Refresh Analytics
          </button>
        </div>
      </div>

      {/* Refactored Design System KPI Row */}
      <div className="lms-kpi-grid">
        <StatCard
          label="Active Workforce"
          value={summaryLoading ? "..." : `${summary?.active_employees || 0} / ${summary?.total_employees || 0}`}
          variant="blue"
          caption="Total Registered Workforce"
        />
        <StatCard
          label="Present Today"
          value={summaryLoading ? "..." : presentCount}
          variant="green"
          trend={{ direction: "up", value: `${presentPercent}% Attendance` }}
          caption="Estimated — based on leave/WFH records, not attendance tracking"
        />
        <StatCard
          label="On Leave Today"
          value={summaryLoading ? "..." : onLeaveCount}
          variant="amber"
          caption="Currently Out of Office"
        />
        <StatCard
          label="Pending Approvals"
          value={summaryLoading ? "..." : summary?.pending_approvals_count || 0}
          variant="red"
          caption={`${summary?.stale_pending_count || 0} SLA Breaches (>3 Days)`}
        />
      </div>

      {/* Attendance Status Section */}
      <div className="lms-panel-section" style={{ marginBottom: "24px" }}>
        <h3 style={{ marginBottom: "16px" }}>Attendance Status</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <ProgressBar
            label="Present Personnel"
            percent={presentPercent}
            count={`${presentCount} staff present on-site / active`}
            variant="green"
          />
          <ProgressBar
            label="Working Remotely (WFH)"
            percent={wfhPercent}
            count={`${wfhCount} staff working remotely`}
            variant="blue"
          />
          <ProgressBar
            label="On Leave / Out of Office"
            percent={onLeavePercent}
            count={`${onLeaveCount} staff currently on leave`}
            variant="amber"
          />
        </div>
      </div>

      {/* 14-Day Leave Request Volume & SLA Trend Chart */}
      <div className="lms-panel-section" style={{ marginBottom: "24px" }}>
        <h3 style={{ marginBottom: "16px" }}>14-Day Leave Request Volume & SLA Trend</h3>
        <RequestsTrendChart
          data={trendData.results}
          slaThreshold={trendData.sla_threshold}
        />
      </div>

      {/* Analytics Tabs Navigation */}
      <div className="lms-nav-tabs">
        <button
          className={`lms-tab-btn ${activeTab === "overview" ? "active" : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          📈 Executive Overview
        </button>
        <button
          className={`lms-tab-btn ${activeTab === "departments" ? "active" : ""}`}
          onClick={() => setActiveTab("departments")}
        >
          Department Analytics
        </button>
        <button
          className={`lms-tab-btn ${activeTab === "utilization" ? "active" : ""}`}
          onClick={() => setActiveTab("utilization")}
        >
          Team leave Utilization
        </button>
        <button
          className={`lms-tab-btn ${activeTab === "balances" ? "active" : ""}`}
          onClick={() => setActiveTab("balances")}
        >
          Employee Balances
        </button>
        <button
          className={`lms-tab-btn ${activeTab === "onleave" ? "active" : ""}`}
          onClick={() => setActiveTab("onleave")}
        >
          On-Leave Calendar
        </button>
        <button
          className={`lms-tab-btn ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          Pending Worklist
        </button>
        <button
          className={`lms-tab-btn ${activeTab === "eod" ? "active" : ""}`}
          onClick={() => setActiveTab("eod")}
        >
          EOD Operations
        </button>
        <button
          className={`lms-tab-btn ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          Audit Logs
        </button>
      </div>

      {/* Tab Content Panels */}
      <div className="lms-tab-panel">
        {/* OVERVIEW TAB (Department Breakdown) */}
        {activeTab === "overview" && (
          <div className="lms-panel-section">
            <h3 style={{ marginBottom: "16px" }}>Department Workforce & Leave Days Used</h3>
            <div style={{ marginBottom: "24px" }}>
              <DepartmentBarChart
                data={(deptStats.results || []).map((d) => ({
                  department: d.department_name,
                  count: d.total_leave_days_used || 0,
                }))}
              />
            </div>

            <h3>Department Workforce Summary</h3>
            <div className="lms-table-responsive">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Active / Total Staff</th>
                    <th>Leave Requests</th>
                    <th>Total Days Used</th>
                    <th>Currently On Leave</th>
                  </tr>
                </thead>
                <tbody>
                  {(deptStats.results || []).map((d) => (
                    <tr key={d.department_id}>
                      <td>
                        <strong>{d.department_name}</strong> ({d.department_code})
                      </td>
                      <td>
                        {d.active_employees} / {d.total_employees}
                      </td>
                      <td>{d.total_leave_requests}</td>
                      <td>{d.total_leave_days_used} days</td>
                      <td>
                        <Pill variant={d.currently_on_leave_count > 0 ? "amber" : "green"}>
                          {d.currently_on_leave_count} On Leave
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* DEPARTMENTS TAB */}
        {activeTab === "departments" && (
          <div className="lms-panel-section">
            <div className="lms-filter-bar">
              <input
                type="text"
                placeholder="Search department name or code..."
                value={deptSearch}
                onChange={(e) => setDeptSearch(e.target.value)}
                className="lms-input"
               style={{ paddingRight: '32px' }} />
      {deptSearch && (
        <button type="button" className="search-clear-btn" onClick={() => setDeptSearch('')}>
          <X size={14} />
        </button>
      )}
              <button
                className="lms-btn lms-btn-secondary"
                onClick={() => fetchDeptStats(1)}
              >
                Search
              </button>
            </div>

            <div className="lms-table-responsive">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Code</th>
                    <th>Department Name</th>
                    <th>Total Staff</th>
                    <th>Active Staff</th>
                    <th>Requests Count</th>
                    <th>Days Used</th>
                    <th>Currently On Leave</th>
                  </tr>
                </thead>
                <tbody>
                  {(deptStats.results || []).map((d) => (
                    <tr key={d.department_id}>
                      <td>{d.department_id}</td>
                      <td><code>{d.department_code}</code></td>
                      <td>{d.department_name}</td>
                      <td>{d.total_employees}</td>
                      <td>{d.active_employees}</td>
                      <td>{d.total_leave_requests}</td>
                      <td>{d.total_leave_days_used}</td>
                      <td>
                        <Pill variant={d.currently_on_leave_count > 0 ? "amber" : "neutral"}>
                          {d.currently_on_leave_count}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lms-pagination">
              <span>
                Page {deptStats.current_page || 1} of {deptStats.total_pages || 1} ({deptStats.count || 0} departments)
              </span>
              <div>
                <button
                  disabled={!deptStats.previous}
                  onClick={() => setDeptPage((prev) => Math.max(1, prev - 1))}
                  className="lms-btn lms-btn-sm"
                >
                  Previous
                </button>
                <button
                  disabled={!deptStats.next}
                  onClick={() => setDeptPage((prev) => prev + 1)}
                  className="lms-btn lms-btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* LEAVE UTILIZATION TAB */}
        {activeTab === "utilization" && (
          <div className="lms-panel-section">
            <div className="lms-filter-bar">
              <label>Year: </label>
              <select
                value={utilYear}
                onChange={(e) => setUtilYear(Number(e.target.value))}
                className="lms-select"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
              </select>
            </div>

            {/* Donut Chart Distribution */}
            <div style={{ marginBottom: "24px", padding: "16px", background: colors.page, borderRadius: "10px" }}>
              <h4 style={{ margin: "0 0 16px 0", textAlign: "center", color: colors.textPrimary }}>
                Leave Application Distribution
              </h4>
              <LeaveDistributionDonut
                data={(utilization.results || []).map((u, idx) => {
                  const donutColors = [colors.blue.icon, colors.amber.icon, colors.purple.icon, colors.green.icon];
                  return {
                    name: u.leave_type_name || u.leave_type_code,
                    value: u.total_applications || 0,
                    color: donutColors[idx % donutColors.length],
                  };
                })}
              />
            </div>

            <div className="lms-table-responsive">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Leave Code</th>
                    <th>Leave Name</th>
                    <th>Total Applications</th>
                    <th>Approved</th>
                    <th>Pending</th>
                    <th>Rejected</th>
                    <th>Total Days Used</th>
                    <th>Approval Rate</th>
                    <th>Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {(utilization.results || []).map((u) => (
                    <tr key={u.leave_type_code}>
                      <td><code>{u.leave_type_code}</code></td>
                      <td>{u.leave_type_name}</td>
                      <td>{u.total_applications}</td>
                      <td><Pill variant="green">{u.approved_applications}</Pill></td>
                      <td><Pill variant="amber">{u.pending_applications}</Pill></td>
                      <td><Pill variant="red">{u.rejected_applications}</Pill></td>
                      <td>{u.total_days_used} days</td>
                      <td>
                        <ProgressBar percent={Math.round(u.approval_rate || 0)} variant="blue" />
                      </td>
                      <td>{u.avg_leave_duration_days} days</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* EMPLOYEE BALANCES TAB */}
        {activeTab === "balances" && (
          <div className="lms-panel-section">
            <div className="lms-filter-bar">
              <input
                type="text"
                placeholder="Search employee name or ID..."
                value={balSearch}
                onChange={(e) => setBalSearch(e.target.value)}
                className="lms-input"
               style={{ paddingRight: '32px' }} />
      {balSearch && (
        <button type="button" className="search-clear-btn" onClick={() => setBalSearch('')}>
          <X size={14} />
        </button>
      )}
              <button
                className="lms-btn lms-btn-secondary"
                onClick={() => fetchBalances(1, balSearch)}
              >
                Filter Balances
              </button>
            </div>

            <div className="lms-table-responsive">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Leave Code</th>
                    <th>Year</th>
                    <th>Entitled</th>
                    <th>Used</th>
                    <th>Pending</th>
                    <th>Available Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {(balances.results || []).map((b, idx) => (
                    <tr key={`${b.emp_id}-${b.leave_type_code}-${idx}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar name={b.emp_name} size={28} />
                          <div>
                            <strong>{b.emp_name}</strong>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>ID: {b.emp_id}</div>
                          </div>
                        </div>
                      </td>
                      <td>{b.department_name || "-"}</td>
                      <td><code>{b.leave_type_code}</code></td>
                      <td>{b.year}</td>
                      <td>{b.entitled_days}</td>
                      <td>{b.used_days}</td>
                      <td>{b.pending_days}</td>
                      <td>
                        <Pill variant={b.available_balance < 0 ? "red" : "green"}>
                          {b.available_balance} Days
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lms-pagination">
              <span>
                Page {balances.current_page || 1} of {balances.total_pages || 1} ({balances.count || 0} records)
              </span>
              <div>
                <button
                  disabled={!balances.previous}
                  onClick={() => setBalPage((prev) => Math.max(1, prev - 1))}
                  className="lms-btn lms-btn-sm"
                >
                  Previous
                </button>
                <button
                  disabled={!balances.next}
                  onClick={() => setBalPage((prev) => prev + 1)}
                  className="lms-btn lms-btn-sm"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PENDING WORKLIST TAB */}
        {activeTab === "pending" && (
          <div className="lms-panel-section">
            <h3>Pending Approvals & SLA Worklist</h3>

            {/* SLA Alert banner */}
            {(pending.results || []).some((p) => p.sla_breached) && (
              <div style={{ marginBottom: '16px' }}>
                <AlertRow
                  variant="red"
                  message="⚠️ Attention Required: There are pending approval requests exceeding the 3-day SLA policy threshold."
                />
              </div>
            )}

            {!pending.results || pending.results.length === 0 ? (
              <div className="lms-empty-state" style={{ textAlign: "center", padding: "40px 20px" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "8px" }}>✨</div>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "1.1rem", color: "#16211D" }}>
                  All pending approvals have been processed!
                </h4>
                <p style={{ margin: 0, color: "#5B6B65", fontSize: "0.9rem" }}>
                  No pending items require your action right now.
                </p>
              </div>
            ) : (
              <>
                <div className="lms-table-responsive">
                  <table className="lms-table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>ID</th>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Leave Type</th>
                        <th>Dates</th>
                        <th>Business Days</th>
                        <th>Age</th>
                        <th>SLA Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.results.map((p) => (
                        <ApprovalRow
                          key={`${p.row_type}-${p.id}`}
                          row={p}
                          onResolved={handleApprovalResolved}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="lms-pagination">
                  <span>
                    Page {pending.current_page || 1} of {pending.total_pages || 1} ({pending.count || 0} pending)
                  </span>
                  <div>
                    <button
                      disabled={!pending.previous}
                      onClick={() => setPendingPage((prev) => Math.max(1, prev - 1))}
                      className="lms-btn lms-btn-sm"
                    >
                      Previous
                    </button>
                    <button
                      disabled={!pending.next}
                      onClick={() => setPendingPage((prev) => prev + 1)}
                      className="lms-btn lms-btn-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* EOD OPERATIONS TAB */}
        {activeTab === "eod" && (
          <div className="lms-panel-section">
            <h3>EOD Batch Jobs & Environment Configurations</h3>
            <div className="lms-table-responsive">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Env ID</th>
                    <th>Environment</th>
                    <th>EOD Path</th>
                    <th>Server IP</th>
                    <th>Server User</th>
                    <th>Status File</th>
                    <th>Active</th>
                  </tr>
                </thead>
                <tbody>
                  {(eodStatus.results || []).map((e) => (
                    <tr key={e.id}>
                      <td>#{e.id}</td>
                      <td><strong>{e.environment}</strong></td>
                      <td><code>{e.eod_path || "-"}</code></td>
                      <td>{e.server_ip || "-"}</td>
                      <td>{e.server_username || "-"}</td>
                      <td>{e.status_file_name || "-"}</td>
                      <td>
                        <Pill variant={e.is_active_display === "Yes" ? "green" : "neutral"}>
                          {e.is_active_display}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AUDIT LOGS TAB */}
        {activeTab === "audit" && (
          <div className="lms-panel-section">
            <h3>Compliance & Audit Trail Feed</h3>
            <div className="lms-table-responsive">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Audit ID</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Emp ID</th>
                    <th>Leave ID</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {(auditLogs.results || []).map((a) => (
                    <tr key={a.id}>
                      <td>#{a.id}</td>
                      <td>{new Date(a.timestamp).toLocaleString()}</td>
                      <td><Pill variant="blue">{a.action}</Pill></td>
                      <td>{a.actor}</td>
                      <td>{a.emp_id || "-"}</td>
                      <td>{a.leave_id ? `#${a.leave_id}` : "-"}</td>
                      <td>{a.ip_address || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
