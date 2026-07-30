import React, { useState, useEffect } from 'react';
import { colors } from '../../styles/tokens';
import { Pill, ProgressBar } from '../../components/ui';
import {
  RequestsTrendChart,
  LeaveDistributionDonut,
} from '../../components/dashboard/charts';
import { useAuth } from '../../hooks/useAuth';
import './UnifiedDashboardPage.css';

const API_BASE = '/api';

const DEFAULT_TREND_DATA = [
  { day: 'Mon', count: 60, failed: 1 },
  { day: 'Tue', count: 85, failed: 2 },
  { day: 'Wed', count: 50, failed: 1 },
  { day: 'Thu', count: 70, failed: 1 },
  { day: 'Fri', count: 90, failed: 1 },
  { day: 'Sat', count: 30, failed: 0 },
  { day: 'Sun', count: 65, failed: 1 },
];

const DEFAULT_MUREX_HEALTH = {
  healthy: 18, warning: 4, critical: 2, total: 24,
  topFailing: 'FX_RECON_03', failCount: 7, avgRuntime: '1h 46m', outliers: 3,
};

const DEFAULT_ENV_STATUS = [
  { env: 'PROD', rtbs: 'connected',    components: { healthy: 12, warning: 1, critical: 0 }, lastEOD: '05:30 AM' },
  { env: 'UAT',  rtbs: 'connected',    components: { healthy: 10, warning: 2, critical: 0 }, lastEOD: '06:15 AM' },
  { env: 'SIT',  rtbs: 'disconnected', components: { healthy: 8,  warning: 3, critical: 1 }, lastEOD: '07:00 AM' },
  { env: 'DEV',  rtbs: 'connected',    components: { healthy: 9,  warning: 0, critical: 0 }, lastEOD: 'N/A'      },
];

const DEFAULT_RECON_SUMMARY = {
  matchRate: 42.9, matched: 1284, mismatched: 198, missing: 72, duplicates: 14,
  lastRun: '05 Feb · 09:30 AM', status: 'Issues Found',
};

const DEFAULT_HEADCOUNT = [
  { team: 'Backend',  active: 18, total: 20 },
  { team: 'Data',     active: 12, total: 13 },
  { team: 'DevOps',   active: 8,  total: 8  },
  { team: 'Frontend', active: 15, total: 17 },
  { team: 'UI/UX',    active: 7,  total: 7  },
];

const DEFAULT_PIPELINE = [
  { stage: 'Inception',  count: 9,  color: '#94A3B8' },
  { stage: 'Planning',   count: 25, color: '#60A5FA' },
  { stage: 'Building',   count: 25, color: '#34D399' },
  { stage: 'Testing',    count: 29, color: '#FBBF24' },
  { stage: 'Release',    count: 2,  color: '#F97316' },
  { stage: 'Deployed',   count: 5,  color: '#10B981' },
  { stage: 'Completed',  count: 5,  color: '#1B4D3E' },
];

const DEFAULT_PENDING_APPROVALS = [
  { id: 1, name: 'Sofia Martinez',  initials: 'SM', type: 'Annual Leave', dates: '10-12 Feb', color: '#1B4D3E' },
  { id: 2, name: 'Ahmed Al-Rashid', initials: 'AA', type: 'Sick Leave',   dates: '11 Feb',    color: '#143A2F' },
  { id: 3, name: 'Priya Sharma',    initials: 'PS', type: 'WFH',          dates: '12-14 Feb', color: '#7C3AED' },
];

const DEFAULT_LEAVE_BALANCE = {
  al:      { available: 14, used: 6,  total: 24 },
  sl:      { available: 12, used: 2,  total: 14 },
  compOff: { available: 2,  used: 3,  total: 5  },
  wfh:     { available: 8,  used: 4,  total: 12 },
};

export default function UnifiedDashboardPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [summary, setSummary]         = useState(null);
  const [trendData, setTrendData]     = useState({ results: DEFAULT_TREND_DATA });
  const [eodRecords, setEodRecords]   = useState([]);
  const [teamHeadcount, setTeamHeadcount]       = useState(DEFAULT_HEADCOUNT);
  const [leaveBalance, setLeaveBalance]         = useState(DEFAULT_LEAVE_BALANCE);
  const [pendingApprovals, setPendingApprovals] = useState(DEFAULT_PENDING_APPROVALS);

  const reconSummary = DEFAULT_RECON_SUMMARY;
  const envStatus    = DEFAULT_ENV_STATUS;
  const murexHealth  = DEFAULT_MUREX_HEALTH;
  const pipeline     = DEFAULT_PIPELINE;

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const empId = user?.employee_id || user?.id || 1;
      const [summaryRes, trendRes, eodRes, headcountRes, balanceRes, pendingRes] =
        await Promise.allSettled([
          fetch(`${API_BASE}/dashboard/summary/`),
          fetch(`${API_BASE}/dashboard/leave-requests-trend/?days=7`),
          fetch(`${API_BASE}/eod-jobs/records/`),
          fetch(`${API_BASE}/employees/team-headcount/`),
          fetch(`${API_BASE}/leaves/me/${empId}/balance/`),
          fetch(`${API_BASE}/leaves/manager/${empId}/pending/`),
        ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value.ok)
        setSummary(await summaryRes.value.json());
      if (trendRes.status === 'fulfilled' && trendRes.value.ok) {
        const j = await trendRes.value.json();
        if (j.results?.length > 0) setTrendData(j);
      }
      if (eodRes.status === 'fulfilled' && eodRes.value.ok) {
        const r = await eodRes.value.json();
        if (Array.isArray(r) && r.length > 0) setEodRecords(r);
      }
      if (headcountRes.status === 'fulfilled' && headcountRes.value.ok) {
        const d = await headcountRes.value.json();
        if (Array.isArray(d) && d.length > 0) setTeamHeadcount(d);
      }
      if (balanceRes.status === 'fulfilled' && balanceRes.value.ok) {
        const d = await balanceRes.value.json();
        if (d) setLeaveBalance(d);
      }
      if (pendingRes.status === 'fulfilled' && pendingRes.value.ok) {
        const d = await pendingRes.value.json();
        if (Array.isArray(d) && d.length > 0) {
          setPendingApprovals(d.slice(0, 5).map(r => ({
            id: r.id,
            name: r.employee_name || r.employee?.full_name || 'Unknown',
            initials: (r.employee_name || 'UN').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
            type: r.leave_type_name || r.leave_type || 'Leave',
            dates: r.from_date || r.start_date || '',
            color: '#1B4D3E',
          })));
        }
      }
    } catch (e) { console.error('Dashboard fetch error:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchDashboardData(); }, [user]);

  const totalConsultants = summary?.total_employees || 132;
  const presentCount     = summary?.present_count || 94;
  const onLeaveCount     = summary?.employees_on_leave_today || 26;
  const wfhCount         = summary?.wfh_count || 12;
  const inactiveCount    = 10;
  const totalActive      = totalConsultants - inactiveCount;
  const presentPct       = totalActive ? Math.round((presentCount / totalActive) * 100) : 77;
  const wfhPct           = totalActive ? Math.round((wfhCount / totalActive) * 100) : 10;
  const onLeavePct       = totalActive ? Math.round((onLeaveCount / totalActive) * 100) : 21;
  const eodCompleted     = Array.isArray(eodRecords) && eodRecords.length > 0
    ? eodRecords.filter(r => r.is_active === 'Yes' || r.is_active === 1).length : 19;
  const eodTotal         = Array.isArray(eodRecords) && eodRecords.length > 0 ? eodRecords.length : 21;
  const eodRunning       = eodTotal - eodCompleted;
  const totalPipeline    = pipeline.reduce((s, p) => s + p.count, 0);
  const maxPipeline      = Math.max(...pipeline.map(p => p.count));
  const reconColor       = reconSummary.matchRate >= 80 ? 'var(--ud-accent-green)'
    : reconSummary.matchRate >= 60 ? 'var(--ud-accent-amber)' : 'var(--ud-accent-red)';

  return (
    <div className="ud-dashboard">

      {/* KPI Strip */}
      <div className="ud-kpi-strip">
        {[
          { val: totalConsultants, label: 'Total Consultants', sub: 'Updated 5 mins ago', icon: '👥' },
          { val: presentCount,     label: 'Present Today',     sub: 'Updated 5 mins ago', icon: '🏢', trend: '↗' },
          { val: onLeaveCount,     label: 'On Leave',          sub: 'Updated 5 mins ago', icon: '🕒' },
          { val: wfhCount,         label: 'Work From Home',    sub: 'Updated 5 mins ago', icon: '🏠' },
          { val: inactiveCount,    label: 'Inactive',          sub: 'Updated 5 mins ago', icon: '👤' },
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

      {/* Environment Status Strip */}
      <div className="ud-env-strip">
        {envStatus.map(env => (
          <div key={env.env} className="ud-env-card">
            <div className="ud-env-header">
              <span className="ud-env-name">{env.env}</span>
              <span className={`ud-env-rtbs ${env.rtbs === 'connected' ? 'ud-rtbs-ok' : 'ud-rtbs-down'}`}>
                ● RTBS
              </span>
            </div>
            <div className="ud-env-stats">
              <span style={{ color: 'var(--ud-accent-green)', fontWeight: 700, fontSize: '0.72rem' }}>{env.components.healthy}✓</span>
              {env.components.warning > 0 && <span style={{ color: 'var(--ud-accent-amber)', fontWeight: 700, fontSize: '0.72rem', marginLeft: 4 }}>{env.components.warning}⚠</span>}
              {env.components.critical > 0 && <span style={{ color: 'var(--ud-accent-red)', fontWeight: 700, fontSize: '0.72rem', marginLeft: 4 }}>{env.components.critical}✕</span>}
            </div>
            <div className="ud-env-last-eod">EOD: {env.lastEOD}</div>
          </div>
        ))}
      </div>

      {/* Master Layout */}
      <div className="ud-master-layout">
        <div className="ud-main-content">

          {/* Row 1: System Health + Murex + Runtime Trend */}
          <div className="ud-card">
            <div className="ud-health-grid">
              <div className="ud-health-col">
                <h3 className="ud-card-title" style={{ marginBottom: '12px' }}>SYSTEM HEALTH</h3>

                <div className="ud-health-metric-box">
                  <div className="ud-health-label"><span className="ud-health-dot-orange" /><span>Murex Jobs Today</span></div>
                  <div className="ud-health-val-row">
                    <span className="ud-health-val-large">48</span>
                    <span className="ud-health-val-sub" style={{ color: 'var(--ud-accent-red)' }}>3 FAILED</span>
                  </div>
                </div>

                <div className="ud-health-metric-box">
                  <div className="ud-health-label"><span className="ud-health-dot-green" /><span>EOD Status</span></div>
                  <div className="ud-health-val-row">
                    <span className="ud-health-val-large">{eodCompleted}/{eodTotal}</span>
                    <span className="ud-health-val-sub" style={{ color: 'var(--ud-accent-blue)' }}>{eodRunning} RUNNING</span>
                  </div>
                </div>

                <div className="ud-health-metric-box">
                  <div className="ud-health-label"><span>Murex Script Health</span></div>
                  <div className="ud-murex-health-pills">
                    <span className="ud-mh-pill ud-mh-green">{murexHealth.healthy} OK</span>
                    <span className="ud-mh-pill ud-mh-amber">{murexHealth.warning} ⚠</span>
                    <span className="ud-mh-pill ud-mh-red">{murexHealth.critical} ✕</span>
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--ud-accent-red)', marginTop: 3 }}>
                    Top failing: {murexHealth.topFailing}
                  </div>
                </div>

                <div className="ud-health-metric-box">
                  <div className="ud-health-label"><span>Avg Runtime (24h)</span></div>
                  <div className="ud-health-val-row"><span className="ud-health-val-large">{murexHealth.avgRuntime}</span></div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--ud-accent-amber)', fontWeight: 600 }}>
                    +8% vs yesterday · {murexHealth.outliers} outliers
                  </div>
                </div>
              </div>

              <div>
                <div className="ud-card-header">
                  <h3 className="ud-card-title">RUNTIME TREND — LAST 7 DAYS</h3>
                  <Pill variant="red">SLA: 120m</Pill>
                </div>
                <RequestsTrendChart data={trendData.results || DEFAULT_TREND_DATA} slaThreshold={120} />
                <div className="ud-runtime-pills-footer">
                  <div className="ud-pill-amber">⚠️ Longest: SETTLEMENT_BATCH_07 – 2h 12m</div>
                  <div className="ud-pill-red">🛑 Most Failed: FX_RECON_03</div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Leave Distribution + Upcoming Leaves + Attendance */}
          <div className="ud-grid-3">
            <div className="ud-card">
              <div className="ud-card-header"><h3 className="ud-card-title">LEAVE DISTRIBUTION</h3></div>
              <LeaveDistributionDonut data={[
                { name: 'Planned Leave', value: 12, color: colors.blue.icon },
                { name: 'Sick Leave',    value: 9,  color: colors.amber.icon },
                { name: 'Comp Off',      value: 5,  color: colors.purple.icon },
              ]} />
            </div>

            <div className="ud-card">
              <div className="ud-card-header"><h3 className="ud-card-title">UPCOMING LEAVES (7 DAYS)</h3></div>
              <div className="ud-upcoming-list">
                {[
                  { i: 'SM', name: 'Sofia Martinez',  date: '06 Feb',    v: 'blue',   l: 'Planned' },
                  { i: 'AA', name: 'Ahmed Al-Rashid', date: '07 Feb',    v: 'amber',  l: 'Sick',   bg: 'var(--ud-brand-hover)' },
                  { i: 'DW', name: 'Daniel Wong',     date: '09-11 Feb', v: 'blue',   l: 'Planned' },
                  { i: 'PS', name: 'Priya Sharma',    date: '10 Feb',    v: 'purple', l: 'Comp Off', bg: 'var(--ud-accent-purple)' },
                ].map(u => (
                  <div key={u.i} className="ud-upcoming-item">
                    <div className="ud-upcoming-user">
                      <div className="ud-avatar-circle" style={u.bg ? { background: u.bg } : {}}>{u.i}</div>
                      <div>
                        <div className="ud-user-name">{u.name}</div>
                        <div className="ud-user-date">{u.date}</div>
                      </div>
                    </div>
                    <Pill variant={u.v}>{u.l}</Pill>
                  </div>
                ))}
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

          {/* Row 3: Reconciliation + Headcount + Leave Balance */}
          <div className="ud-grid-3">

            {/* Reconciliation */}
            <div className="ud-card">
              <div className="ud-card-header">
                <h3 className="ud-card-title">🔄 RECONCILIATION</h3>
                <span className="ud-recon-status-badge" style={{
                  background: reconSummary.matchRate >= 80 ? 'var(--ud-accent-green-light)' : 'var(--ud-accent-red-light)',
                  color: reconSummary.matchRate >= 80 ? '#065F46' : '#991B1B',
                }}>{reconSummary.status}</span>
              </div>
              <div className="ud-recon-rate-row">
                <span className="ud-recon-rate-val" style={{ color: reconColor }}>{reconSummary.matchRate}%</span>
                <span className="ud-recon-rate-label">Match Rate</span>
              </div>
              <div className="ud-recon-stat-grid">
                <div className="ud-recon-stat">
                  <span className="ud-recon-stat-val" style={{ color: 'var(--ud-accent-green)' }}>{reconSummary.matched.toLocaleString()}</span>
                  <span className="ud-recon-stat-lbl">Matched</span>
                </div>
                <div className="ud-recon-stat">
                  <span className="ud-recon-stat-val" style={{ color: 'var(--ud-accent-red)' }}>{reconSummary.mismatched}</span>
                  <span className="ud-recon-stat-lbl">Mismatch</span>
                </div>
                <div className="ud-recon-stat">
                  <span className="ud-recon-stat-val" style={{ color: 'var(--ud-accent-amber)' }}>{reconSummary.missing}</span>
                  <span className="ud-recon-stat-lbl">Missing</span>
                </div>
                <div className="ud-recon-stat">
                  <span className="ud-recon-stat-val" style={{ color: 'var(--ud-accent-purple)' }}>{reconSummary.duplicates}</span>
                  <span className="ud-recon-stat-lbl">Duplicates</span>
                </div>
              </div>
              <div className="ud-recon-last-run">Last run: {reconSummary.lastRun}</div>
            </div>

            {/* Headcount by Team */}
            <div className="ud-card">
              <div className="ud-card-header">
                <h3 className="ud-card-title">👥 HEADCOUNT BY TEAM</h3>
                <Pill variant="neutral">{teamHeadcount.reduce((s, t) => s + t.active, 0)} Active</Pill>
              </div>
              <div className="ud-headcount-list">
                {teamHeadcount.map(t => {
                  const tot = t.total || t.active;
                  const pct = Math.round((t.active / tot) * 100);
                  return (
                    <div key={t.team} className="ud-headcount-row">
                      <div className="ud-headcount-meta">
                        <span className="ud-headcount-team">{t.team}</span>
                        <span className="ud-headcount-count">{t.active}/{tot}</span>
                      </div>
                      <div className="ud-headcount-bar-bg">
                        <div className="ud-headcount-bar-fill" style={{
                          width: `${pct}%`,
                          background: pct === 100 ? 'var(--ud-accent-green)' : 'var(--ud-brand)',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* My Leave Balance */}
            <div className="ud-card">
              <div className="ud-card-header"><h3 className="ud-card-title">🏖️ MY LEAVE BALANCE</h3></div>
              <div className="ud-balance-grid">
                {[
                  { key: 'al',      label: 'Annual Leave', color: 'var(--ud-brand)',        bal: leaveBalance.al      },
                  { key: 'sl',      label: 'Sick Leave',   color: 'var(--ud-accent-amber)',  bal: leaveBalance.sl      },
                  { key: 'compOff', label: 'Comp Off',     color: 'var(--ud-accent-purple)', bal: leaveBalance.compOff },
                  { key: 'wfh',     label: 'WFH',          color: 'var(--ud-accent-blue)',   bal: leaveBalance.wfh     },
                ].map(item => (
                  <div key={item.key} className="ud-balance-card">
                    <span className="ud-balance-val" style={{ color: item.color }}>{item.bal.available}</span>
                    <span className="ud-balance-type">{item.label}</span>
                    <span className="ud-balance-sub">of {item.bal.total} days</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 4: Project Pipeline + EOD Batch Jobs */}
          <div className="ud-grid-2">

            <div className="ud-card">
              <div className="ud-card-header">
                <h3 className="ud-card-title">🚀 PROJECT PIPELINE</h3>
                <Pill variant="neutral">{totalPipeline} Projects</Pill>
              </div>
              <div className="ud-pipeline-stages">
                {pipeline.map(p => (
                  <div key={p.stage} className="ud-pipeline-stage">
                    <span className="ud-pipeline-count">{p.count}</span>
                    <div className="ud-pipeline-bar-wrap">
                      <div className="ud-pipeline-bar" style={{
                        height: `${Math.round((p.count / maxPipeline) * 52) + 6}px`,
                        background: p.color,
                      }} />
                    </div>
                    <span className="ud-pipeline-label">{p.stage}</span>
                  </div>
                ))}
              </div>
              <div className="ud-pipeline-sla-row">
                <span className="ud-pipeline-sla-badge ud-sla-red">🔴 92 Unclosed &gt;60d</span>
                <span className="ud-pipeline-sla-badge ud-sla-amber">⚠️ 40 No Man Days</span>
              </div>
            </div>

            <div className="ud-card">
              <div className="ud-card-header">
                <h3 className="ud-card-title">⚙️ ACTIVE EOD BATCH JOBS</h3>
                <Pill variant="green">{eodCompleted}/{eodTotal} Active</Pill>
              </div>
              <div className="ud-table-wrap">
                <table className="ud-table">
                  <thead>
                    <tr><th>Env</th><th>Server IP</th><th>Port</th><th>Status File</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {Array.isArray(eodRecords) && eodRecords.length > 0 ? (
                      eodRecords.slice(0, 5).map(rec => (
                        <tr key={rec.id}>
                          <td><strong>{rec.environment}</strong></td>
                          <td><code>{rec.server_ip || '—'}</code></td>
                          <td>{rec.port_no || 22}</td>
                          <td>{rec.status_file_name || 'N/A'}</td>
                          <td><Pill variant={rec.is_active === 'Yes' || rec.is_active === 1 ? 'green' : 'neutral'}>
                            {rec.is_active === 'Yes' || rec.is_active === 1 ? 'Active' : 'Inactive'}
                          </Pill></td>
                        </tr>
                      ))
                    ) : (
                      <>
                        <tr><td><strong>PRODUCTION</strong></td><td><code>192.168.1.100</code></td><td>22</td><td>prod_status.log</td><td><Pill variant="green">Active</Pill></td></tr>
                        <tr><td><strong>UAT</strong></td><td><code>192.168.1.102</code></td><td>22</td><td>uat_status.log</td><td><Pill variant="green">Active</Pill></td></tr>
                        <tr><td><strong>SIT</strong></td><td><code>192.168.1.105</code></td><td>22</td><td>sit_status.log</td><td><Pill variant="amber">Running</Pill></td></tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Row 5: Capacity Utilization */}
          <div className="ud-card">
            <div className="ud-card-header"><h3 className="ud-card-title">CAPACITY UTILIZATION BY TEAM</h3></div>
            <div className="ud-capacity-list">
              {[
                { team: 'Backend',         pct: 92, cls: 'ud-cap-critical', color: 'var(--ud-accent-red)'   },
                { team: 'Data Innovators', pct: 78, cls: 'ud-cap-healthy',  color: 'var(--ud-accent-green)' },
                { team: 'DevOps',          pct: 83, cls: 'ud-cap-warning',  color: 'var(--ud-accent-amber)' },
                { team: 'Frontend',        pct: 69, cls: 'ud-cap-healthy',  color: 'var(--ud-accent-green)' },
                { team: 'UI/UX',           pct: 81, cls: 'ud-cap-warning',  color: 'var(--ud-accent-amber)' },
              ].map(t => (
                <div key={t.team} className="ud-capacity-item">
                  <div className="ud-capacity-meta">
                    <span>{t.team}</span><span style={{ color: t.color }}>{t.pct}%</span>
                  </div>
                  <div className="ud-cap-bar-bg">
                    <div className={`ud-cap-bar-fill ${t.cls}`} style={{ width: `${t.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="ud-capacity-legend">
              <span><span className="ud-legend-dot" style={{ background: 'var(--ud-accent-green)' }} /> &lt;80% Healthy</span>
              <span><span className="ud-legend-dot" style={{ background: 'var(--ud-accent-amber)' }} /> 80-90% Warning</span>
              <span><span className="ud-legend-dot" style={{ background: 'var(--ud-accent-red)'   }} /> 90%+ Critical</span>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="ud-sidebar">

          {/* Alerts & Actions */}
          <div className="ud-card">
            <div className="ud-card-header">
              <h3 className="ud-card-title">🔔 ALERTS &amp; ACTIONS</h3>
              <span className="ud-badge-count">4</span>
            </div>
            <div className="ud-alert-stack">
              <div className="ud-alert-item ud-alert-red"><span>🛑</span><div><strong>Backend team over capacity</strong></div></div>
              <div className="ud-alert-item ud-alert-red"><span>⚠️</span><div><strong>2 scripts breached SLA</strong></div></div>
              <div className="ud-alert-item ud-alert-amber"><span>⚡</span><div><strong>3 consultants missing attendance</strong></div></div>
              <div className="ud-alert-item ud-alert-blue"><span>📋</span><div><strong>1 leave request pending</strong></div></div>
            </div>
            <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--ud-border)' }}>
              <div className="ud-sidebar-stats">
                <div className="ud-stat-row"><span>Match Rate</span><span style={{ color: reconColor, fontWeight: 700 }}>{reconSummary.matchRate}%</span></div>
                <div className="ud-stat-row"><span>Pending Review</span><span style={{ fontWeight: 700 }}>{pendingApprovals.length} items</span></div>
                <div className="ud-stat-row"><span>System Uptime</span><span style={{ color: 'var(--ud-accent-green)', fontWeight: 700 }}>99.8%</span></div>
              </div>
            </div>
          </div>

          {/* Pending Leave Approvals */}
          <div className="ud-card">
            <div className="ud-card-header">
              <h3 className="ud-card-title">📋 PENDING APPROVALS</h3>
              <span className="ud-badge-count" style={{ background: 'var(--ud-accent-amber)' }}>
                {pendingApprovals.length}
              </span>
            </div>
            <div className="ud-approval-list">
              {pendingApprovals.map(a => (
                <div key={a.id} className="ud-approval-item">
                  <div className="ud-approval-info">
                    <div className="ud-avatar-circle" style={{ background: a.color, flexShrink: 0 }}>{a.initials}</div>
                    <div className="ud-approval-details">
                      <span className="ud-approval-name">{a.name}</span>
                      <span className="ud-approval-meta">{a.type} · {a.dates}</span>
                    </div>
                  </div>
                  <div className="ud-approval-actions">
                    <button className="ud-btn-approve" title="Approve">✓</button>
                    <button className="ud-btn-reject"  title="Reject">✕</button>
                  </div>
                </div>
              ))}
              {pendingApprovals.length === 0 && (
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
