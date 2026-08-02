import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/tokens';
import { Pill, ProgressBar } from '../../components/ui';
import {
  RequestsTrendChart,
  LeaveDistributionDonut,
} from '../../components/dashboard/charts';
import httpClient from '@api/httpClient';
import { useAuth } from '../../hooks/useAuth';
import './UnifiedDashboardPage.css';

export default function UnifiedDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Real-time API States
  const [summary, setSummary]                 = useState(null);
  const [trendData, setTrendData]             = useState(null);
  const [utilization, setUtilization]         = useState(null);
  const [eodRecords, setEodRecords]           = useState([]);
  const [teamHeadcount, setTeamHeadcount]     = useState([]);
  const [leaveBalance, setLeaveBalance]       = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [announcements, setAnnouncements]     = useState({ banner: [], feed: [] });
  const [departmentStats, setDepartmentStats] = useState([]);

  const [employeesList, setEmployeesList]     = useState([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const empId = user?.employee_id || user?.emp_id || user?.id;

      const promises = [
        httpClient.get('/dashboard/summary/'),
        httpClient.get('/dashboard/leave-requests-trend/?days=7'),
        httpClient.get('/dashboard/leave-utilization/'),
        httpClient.get('/eod-jobs/eod-records/'),
        httpClient.get('/employees/teams/'),
        httpClient.get('/dashboard/department-stats/'),
        httpClient.get('/dashboard/announcements/'),
        httpClient.get('/employees/employees-list/'),
      ];

      if (empId) {
        promises.push(httpClient.get(`/leaves/me/${empId}/balance/`));
        promises.push(httpClient.get(`/dashboard/pending-approvals/?manager_id=${empId}`));
      }

      const results = await Promise.allSettled(promises);

      if (results[0]?.status === 'fulfilled') setSummary(results[0].value.data);
      if (results[1]?.status === 'fulfilled') setTrendData(results[1].value.data);
      if (results[2]?.status === 'fulfilled') setUtilization(results[2].value.data);
      if (results[3]?.status === 'fulfilled') {
        const data = results[3].value.data;
        setEodRecords(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[4]?.status === 'fulfilled') {
        const data = results[4].value.data;
        setTeamHeadcount(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[5]?.status === 'fulfilled') {
        const data = results[5].value.data;
        setDepartmentStats(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[6]?.status === 'fulfilled') setAnnouncements(results[6].value.data);
      if (results[7]?.status === 'fulfilled') {
        const data = results[7].value.data;
        setEmployeesList(Array.isArray(data) ? data : data?.results || []);
      }
      if (results[8]?.status === 'fulfilled') setLeaveBalance(results[8].value.data);
      if (results[9]?.status === 'fulfilled') {
        const data = results[9].value.data;
        setPendingApprovals(Array.isArray(data) ? data : data?.results || []);
      }
    } catch (e) {
      console.error('Realtime Dashboard API error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  // Derived Realtime Stats from backend API responses
  const totalEmployees            = summary?.total_employees ?? 0;
  const activeEmployees           = summary?.active_employees ?? 0;
  const presentCount              = summary?.present_count ?? 0;
  const onLeaveCount              = summary?.employees_on_leave_today ?? 0;
  const wfhCount                  = summary?.wfh_count ?? 0;
  const pendingCount              = summary?.pending_approvals_count ?? pendingApprovals.length;
  const stalePendingCount         = summary?.stale_pending_count ?? 0;
  const blackoutCount             = summary?.active_blackout_periods_count ?? 0;
  const inactiveCount             = totalEmployees - activeEmployees;

  const totalActive               = activeEmployees || (totalEmployees - inactiveCount);
  const presentPct                = totalActive ? Math.round((presentCount / totalActive) * 100) : 0;
  const wfhPct                    = totalActive ? Math.round((wfhCount / totalActive) * 100) : 0;
  const onLeavePct                = totalActive ? Math.round((onLeaveCount / totalActive) * 100) : 0;

  const eodActiveCount            = eodRecords.filter(r => r.is_active === 'Yes' || r.is_active === 1 || r.is_active === true).length;
  const eodTotal                  = eodRecords.length;
  const eodRunning                = Math.max(0, eodTotal - eodActiveCount);

  // Derive Leave Distribution Donut data from real API
  const donutData = Array.isArray(utilization?.results) && utilization.results.length > 0
    ? utilization.results.map((item, idx) => ({
        name: item.leave_type_name || item.leave_type_code,
        value: item.total_applications || item.total_days_used || 0,
        color: [colors.blue.icon, colors.amber.icon, colors.purple.icon, colors.green.icon][idx % 4],
      }))
    : [];

  return (
    <div className="ud-dashboard">

      {/* KPI Strip */}
      <div className="ud-kpi-strip">
        {[
          { val: totalEmployees,  label: 'Total Consultants', sub: 'Realtime Backend API', icon: '👥' },
          { val: presentCount,    label: 'Present Today',     sub: 'Realtime Backend API', icon: '🏢', trend: '↗' },
          { val: onLeaveCount,    label: 'On Leave',          sub: 'Realtime Backend API', icon: '🕒' },
          { val: wfhCount,        label: 'Work From Home',    sub: 'Realtime Backend API', icon: '🏠' },
          { val: inactiveCount,   label: 'Inactive',          sub: 'Realtime Backend API', icon: '👤' },
        ].map(k => (
          <div key={k.label} className="ud-kpi-card">
            <div className="ud-kpi-info">
              <div className="ud-kpi-val-row">
                <span className="ud-kpi-val">{k.val}</span>
                {k.trend && <span className="ud-kpi-trend">{k.trend}</span>}
              </div>
              <span className="ud-kpi-label">{k.label}</span>
              <span className="ud-kpi-sub">{k.sub}</span>
            </div>
            <div className="ud-kpi-icon-wrap">{k.icon}</div>
          </div>
        ))}
      </div>

      {/* Realtime Environment Status Strip */}
      {eodRecords.length > 0 && (
        <div className="ud-env-strip">
          {eodRecords.map(env => (
            <div key={env.id || env.environment} className="ud-env-card">
              <div className="ud-env-header">
                <span className="ud-env-name">{String(env.environment || 'ENV').toUpperCase()}</span>
                <span className={`ud-env-rtbs ${env.is_active === 'Yes' || env.is_active === 1 || env.is_active === true ? 'ud-rtbs-ok' : 'ud-rtbs-down'}`}>
                  ● {env.is_active === 'Yes' || env.is_active === 1 || env.is_active === true ? 'Active' : 'Offline'}
                </span>
              </div>
              <div className="ud-env-stats">
                <span style={{ color: 'var(--ud-brand)', fontWeight: 700, fontSize: '0.72rem' }}>
                  IP: {env.server_ip || '192.168.1.x'} Port: {env.port_no || 22}
                </span>
              </div>
              <div className="ud-env-last-eod">Log: {env.status_file_name || 'status.log'}</div>
            </div>
          ))}
        </div>
      )}

      {/* Master Layout */}
      <div className="ud-master-layout">
        <div className="ud-main-content">

          {/* Row 1: System Health + Realtime Request Trend */}
          <div className="ud-card">
            <div className="ud-health-grid">
              <div className="ud-health-col">
                <h3 className="ud-card-title" style={{ marginBottom: '12px' }}>REALTIME SYSTEM HEALTH</h3>

                <div className="ud-health-metric-box">
                  <div className="ud-health-label"><span className="ud-health-dot-green" /><span>EOD Jobs Active</span></div>
                  <div className="ud-health-val-row">
                    <span className="ud-health-val-large">{eodActiveCount}/{eodTotal}</span>
                    <span className="ud-health-val-sub" style={{ color: 'var(--ud-accent-blue)' }}>{eodRunning} RUNNING</span>
                  </div>
                </div>

                <div className="ud-health-metric-box">
                  <div className="ud-health-label"><span className="ud-health-dot-orange" /><span>Pending Approvals</span></div>
                  <div className="ud-health-val-row">
                    <span className="ud-health-val-large">{pendingCount}</span>
                    {stalePendingCount > 0 && (
                      <span className="ud-health-val-sub" style={{ color: 'var(--ud-accent-red)' }}>
                        {stalePendingCount} BREACHED SLA
                      </span>
                    )}
                  </div>
                </div>

                <div className="ud-health-metric-box">
                  <div className="ud-health-label"><span>Active Blackout Periods</span></div>
                  <div className="ud-health-val-row"><span className="ud-health-val-large">{blackoutCount}</span></div>
                </div>
              </div>

              <div>
                <div className="ud-card-header">
                  <h3 className="ud-card-title">REQUESTS TREND — LAST 7 DAYS</h3>
                  {trendData?.sla_threshold && <Pill variant="red">SLA: {trendData.sla_threshold}</Pill>}
                </div>
                {trendData?.results && trendData.results.length > 0 ? (
                  <RequestsTrendChart data={trendData.results} slaThreshold={trendData.sla_threshold || 10} />
                ) : (
                  <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--ud-text-secondary)', fontSize: '0.78rem' }}>
                    No request trend data returned from API
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Leave Distribution + Department Breakdown + Attendance */}
          <div className="ud-grid-3">
            <div className="ud-card">
              <div className="ud-card-header"><h3 className="ud-card-title">LEAVE UTILIZATION</h3></div>
              {donutData.length > 0 ? (
                <LeaveDistributionDonut data={donutData} />
              ) : (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ud-text-secondary)', fontSize: '0.78rem' }}>
                  No leave utilization data from API
                </div>
              )}
            </div>

            <div className="ud-card">
              <div className="ud-card-header"><h3 className="ud-card-title">DEPARTMENT HEADCOUNT</h3></div>
              <div className="ud-headcount-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {departmentStats.length > 0 ? (
                  departmentStats.map(d => (
                    <div key={d.department_id || d.department_code} className="ud-headcount-row">
                      <div className="ud-headcount-meta">
                        <span className="ud-headcount-team">{d.department_name} ({d.department_code})</span>
                        <span className="ud-headcount-count">{d.active_employees}/{d.total_employees}</span>
                      </div>
                      <div className="ud-headcount-bar-bg">
                        <div className="ud-headcount-bar-fill" style={{
                          width: `${d.total_employees ? Math.round((d.active_employees / d.total_employees) * 100) : 0}%`,
                          background: 'var(--ud-brand)',
                        }} />
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ud-text-secondary)', fontSize: '0.78rem' }}>
                    No department stats available
                  </div>
                )}
              </div>
            </div>

            <div className="ud-card">
              <div className="ud-card-header"><h3 className="ud-card-title">ATTENDANCE STATUS</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', height: '80%' }}>
                <ProgressBar label="Present"        percent={presentPct}  count={`${presentCount} consultants`}  variant="green" />
                <ProgressBar label="Work From Home" percent={wfhPct}      count={`${wfhCount} consultants`}      variant="blue"  />
                <ProgressBar label="On Leave"       percent={onLeavePct}  count={`${onLeaveCount} consultants`}  variant="amber" />
              </div>
            </div>
          </div>

          {/* Row 3: Team Headcount + My Leave Balance */}
          <div className="ud-grid-2">

            {/* Headcount by Team */}
            <div className="ud-card">
              <div className="ud-card-header">
                <h3 className="ud-card-title">👥 HEADCOUNT BY TEAM</h3>
                <Pill variant="neutral">{teamHeadcount.length} Teams</Pill>
              </div>
              <div className="ud-headcount-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {teamHeadcount.length > 0 ? (
                  teamHeadcount.map(t => {
                    const memberCount = employeesList.filter(e => e.team_name === t.name || e.team_id === t.id).length;
                    const pct = totalEmployees ? Math.round((memberCount / totalEmployees) * 100) : 0;
                    return (
                      <div key={t.id || t.name} className="ud-headcount-row">
                        <div className="ud-headcount-meta">
                          <span className="ud-headcount-team">{t.name || 'Team'}</span>
                          <span className="ud-headcount-count" style={{ color: 'var(--ud-brand)', fontWeight: 700 }}>
                            {memberCount} {memberCount === 1 ? 'member' : 'members'}
                          </span>
                        </div>
                        <div className="ud-headcount-bar-bg">
                          <div
                            className="ud-headcount-bar-fill"
                            style={{
                              width: `${Math.max(pct, memberCount > 0 ? 12 : 3)}%`,
                              background: memberCount > 0 ? 'var(--ud-accent-green)' : 'var(--ud-brand)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ud-text-secondary)', fontSize: '0.78rem' }}>
                    No team headcount data returned
                  </div>
                )}
              </div>
            </div>

            {/* My Leave Balance */}
            <div className="ud-card">
              <div className="ud-card-header"><h3 className="ud-card-title">🏖️ MY LEAVE BALANCE</h3></div>
              {leaveBalance ? (
                (() => {
                  const b = leaveBalance.balances || leaveBalance;
                  const items = [
                    { key: 'AL',      label: 'Annual Leave', color: 'var(--ud-brand)',        bal: b.AL || b.al },
                    { key: 'PL',      label: 'Planned Leave',color: 'var(--ud-accent-green)',  bal: b.PL || b.pl },
                    { key: 'SL',      label: 'Sick Leave',   color: 'var(--ud-accent-amber)',  bal: b.SL || b.sl },
                    { key: 'CompOff', label: 'Comp Off',     color: 'var(--ud-accent-purple)', bal: b.CompOff || b.compOff },
                  ];
                  return (
                    <div className="ud-balance-grid">
                      {items.map(item => (
                        <div key={item.key} className="ud-balance-card">
                          <span className="ud-balance-val" style={{ color: item.color }}>
                            {item.bal ? (item.bal.available ?? item.bal.available_balance ?? 0) : 0}
                          </span>
                          <span className="ud-balance-type">{item.label}</span>
                          <span className="ud-balance-sub">
                            of {item.bal ? (item.bal.entitled ?? item.bal.total ?? item.bal.entitled_days ?? 0) : 0} days
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--ud-text-secondary)', fontSize: '0.78rem' }}>
                  No leave balance returned for current user
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Active EOD Batch Jobs Table */}
          <div className="ud-card">
            <div className="ud-card-header">
              <h3 className="ud-card-title">⚙️ ACTIVE EOD BATCH JOBS</h3>
              <Pill variant="green">{eodActiveCount}/{eodTotal} Active</Pill>
            </div>
            <div className="ud-table-wrap">
              <table className="ud-table">
                <thead>
                  <tr><th>Env</th><th>Server IP</th><th>Port</th><th>Status File</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {eodRecords.length > 0 ? (
                    eodRecords.map(rec => (
                      <tr key={rec.id || rec.environment}>
                        <td><strong>{String(rec.environment || '').toUpperCase()}</strong></td>
                        <td><code>{rec.server_ip || '—'}</code></td>
                        <td>{rec.port_no || 22}</td>
                        <td>{rec.status_file_name || 'N/A'}</td>
                        <td>
                          <Pill variant={rec.is_active === 'Yes' || rec.is_active === 1 || rec.is_active === true ? 'green' : 'neutral'}>
                            {rec.is_active === 'Yes' || rec.is_active === 1 || rec.is_active === true ? 'Active' : 'Inactive'}
                          </Pill>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', color: 'var(--ud-text-secondary)', padding: '16px' }}>
                        No EOD batch jobs returned from API
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Sidebar */}
        <div className="ud-sidebar">

          {/* Realtime Alerts & Actions */}
          <div className="ud-card">
            <div className="ud-card-header">
              <h3 className="ud-card-title">🔔 ALERTS &amp; ACTIONS</h3>
              <span className="ud-badge-count">
                {(stalePendingCount > 0 ? 1 : 0) + (pendingCount > 0 ? 1 : 0) + (blackoutCount > 0 ? 1 : 0) + (eodRunning > 0 ? 1 : 0)}
              </span>
            </div>
            <div className="ud-alert-stack">
              {stalePendingCount > 0 && (
                <div className="ud-alert-item ud-alert-red">
                  <span>🛑</span><div><strong>{stalePendingCount} leave request(s) breached SLA (&gt;3 days)</strong></div>
                </div>
              )}
              {pendingCount > 0 && (
                <div className="ud-alert-item ud-alert-blue">
                  <span>📋</span><div><strong>{pendingCount} leave request(s) pending approval</strong></div>
                </div>
              )}
              {blackoutCount > 0 && (
                <div className="ud-alert-item ud-alert-amber">
                  <span>⚡</span><div><strong>{blackoutCount} active blackout period(s) in effect</strong></div>
                </div>
              )}
              {eodRunning > 0 && (
                <div className="ud-alert-item ud-alert-amber">
                  <span>⚙️</span><div><strong>{eodRunning} EOD job(s) currently running</strong></div>
                </div>
              )}
              {stalePendingCount === 0 && pendingCount === 0 && blackoutCount === 0 && eodRunning === 0 && (
                <div style={{ fontSize: '0.76rem', color: 'var(--ud-text-secondary)', padding: '8px 0' }}>
                  No active system alerts ✅
                </div>
              )}
            </div>
          </div>

          {/* Pending Leave Approvals Queue */}
          <div className="ud-card">
            <div className="ud-card-header">
              <h3 className="ud-card-title">📋 PENDING APPROVALS</h3>
              <span className="ud-badge-count" style={{ background: 'var(--ud-accent-amber)' }}>
                {pendingApprovals.length}
              </span>
            </div>
            <div className="ud-approval-list">
              {pendingApprovals.length > 0 ? (
                pendingApprovals.map(a => (
                  <div key={a.id || a.emp_id} className="ud-approval-item">
                    <div className="ud-approval-info">
                      <div className="ud-avatar-circle" style={{ background: 'var(--ud-brand)', flexShrink: 0 }}>
                        {(a.emp_name || a.employee_name || 'UN').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="ud-approval-details">
                        <span className="ud-approval-name">{a.emp_name || a.employee_name || 'Employee'}</span>
                        <span className="ud-approval-meta">{a.leave_type || 'Leave'} · {a.start_date || a.dates || 'Pending'}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.76rem', color: 'var(--ud-text-secondary)', textAlign: 'center', padding: '12px 0' }}>
                  No pending approvals 🎉
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
