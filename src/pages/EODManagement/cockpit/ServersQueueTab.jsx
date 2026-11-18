import { useState, useMemo } from 'react';
import {
  Server,
  Activity,
  Layers,
  Cpu,
  Clock,
  RefreshCw,
  Search,
  ArrowRight,
  Globe,
} from 'lucide-react';
import { usePolling } from '../scheduler/useResource';
import { eodSchedulerService as svc } from '@services/eodSchedulerService';

export function ServersQueueTab({
  env = null,
  onNavigateEnv = null,
}) {
  const [telemetry, setTelemetry] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [serverSearch, setServerSearch] = useState('');
  const [queueFilter, setQueueFilter] = useState('ALL'); // 'ALL' | 'RUNNING' | 'SLOT_WAIT' | 'DEP_WAIT'
  const [queueSearch, setQueueSearch] = useState('');

  const fetchTelemetry = async () => {
    try {
      let data = null;
      if (typeof svc.getGlobalTelemetry === 'function') {
        data = await svc.getGlobalTelemetry();
      } else if (env) {
        data = await svc.getLiveTelemetry(env);
      }
      if (data) {
        setTelemetry(data);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      if (env) {
        try {
          const fallback = await svc.getLiveTelemetry(env);
          if (fallback) {
            setTelemetry(fallback);
            setLastRefreshed(new Date());
          }
        } catch {
          // ignore
        }
      }
      console.warn('Live telemetry poll notice:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Poll global telemetry every 3 seconds
  usePolling(fetchTelemetry, 3000);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchTelemetry();
  };

  const rawServers = useMemo(() => telemetry?.servers || [], [telemetry?.servers]);
  const queues = useMemo(
    () =>
      telemetry?.queues || {
        xml_runs: { running: 0, queued: 0, paused: 0 },
        workflows: { running: 0, queued: 0, by_environment: {} },
        jobs: { running: 0, queued_capacity: 0, waiting_dependencies: 0 },
        active_jobs_list: [],
        queued_jobs_list: [],
      },
    [telemetry?.queues],
  );

  // Standardize server objects (ensuring IP as primary identity, environments list, workflow counts)
  const normalizedServers = useMemo(() => {
    return rawServers.map((s) => {
      const ip = s.ip || s.host || '127.0.0.1';
      const port = s.port || 22;
      const displayIp = s.display_ip || (port !== 22 ? `${ip}:${port}` : ip);
      const hostId = s.host_id || null;
      const inUse = s.in_use || 0;
      const maxConcurrent = s.max_concurrent || 10;
      const loadPercent =
        s.load_percent != null
          ? s.load_percent
          : maxConcurrent > 0
          ? Math.round((inUse / maxConcurrent) * 100)
          : 0;
      const isBusy = s.is_busy ?? inUse >= maxConcurrent;

      // Associated environments list
      let envs = s.environments || [];
      if (!Array.isArray(envs) && envs) {
        envs = Object.values(envs);
      }
      if (!envs.length) {
        // Fallback for single-environment legacy payload
        const singleEnv = telemetry?.environment || env || 'DEFAULT';
        const runningWfs = s.running_workflows || [];
        envs = [
          {
            code: singleEnv,
            name: singleEnv,
            target_name: s.name || 'Arco Server',
            username: s.username || 'arco',
            enabled: true,
            running_workflows: runningWfs,
            running_workflows_count: runningWfs.length,
            queued_workflows: [],
            queued_workflows_count: 0,
            running_jobs_count: inUse,
            queued_jobs_count: s.queued_count || 0,
            status:
              runningWfs.length > 0 || inUse > 0
                ? 'RUNNING'
                : s.queued_count > 0
                ? 'QUEUED'
                : 'IDLE',
            active_jobs: s.active_jobs || [],
            queued_jobs: s.queued_jobs || [],
          },
        ];
      }

      return {
        ...s,
        ip,
        port,
        display_ip: displayIp,
        host_id: hostId,
        in_use: inUse,
        max_concurrent: maxConcurrent,
        load_percent: loadPercent,
        is_busy: isBusy,
        environments: envs,
        active_jobs: s.active_jobs || [],
        queued_jobs: s.queued_jobs || [],
      };
    });
  }, [rawServers, telemetry?.environment, env]);

  // Distinct environments across all servers for filter dropdown
  const allEnvironmentCodes = useMemo(() => {
    const set = new Set();
    for (const s of normalizedServers) {
      for (const e of s.environments || []) {
        if (e.code) set.add(e.code);
      }
    }
    if (env) set.add(env);
    return Array.from(set).sort();
  }, [normalizedServers, env]);

  // Aggregate KPI metrics
  const totalServersCount = normalizedServers.length;
  const activeServersCount = normalizedServers.filter((s) => s.in_use > 0).length;
  const totalSlotsLimit = normalizedServers.reduce((acc, s) => acc + (s.max_concurrent || 0), 0);
  const totalSlotsInUse = normalizedServers.reduce((acc, s) => acc + (s.in_use || 0), 0);
  const aggregateLoadPct =
    totalSlotsLimit > 0 ? Math.min(100, Math.round((totalSlotsInUse / totalSlotsLimit) * 100)) : 0;

  // Operational Engine and Worker Status
  const isEngineServing = Boolean(
    telemetry?.engine_status?.serving ?? (telemetry?.environment ? true : false),
  );
  const rawEngineMsg = telemetry?.engine_status?.message;
  const engineMessage =
    rawEngineMsg && !rawEngineMsg.toLowerCase().includes('engine is serving')
      ? rawEngineMsg
      : (isEngineServing ? 'Active' : 'Inactive');
  const workerCount =
    telemetry?.worker_status?.active_count || (isEngineServing ? 1 : 0);

  // Filter servers by search query (no environment dropdown restriction)
  const filteredServers = useMemo(() => {
    return normalizedServers.filter((s) => {
      if (!serverSearch.trim()) return true;
      const q = serverSearch.toLowerCase();
      const matchIp =
        (s.ip || '').toLowerCase().includes(q) || (s.display_ip || '').toLowerCase().includes(q);
      const matchEnv = (s.environments || []).some(
        (e) =>
          (e.code || '').toLowerCase().includes(q) ||
          (e.name || '').toLowerCase().includes(q) ||
          (e.target_name || '').toLowerCase().includes(q) ||
          (e.running_workflows || []).some((w) => w.toLowerCase().includes(q)),
      );
      return matchIp || matchEnv;
    });
  }, [normalizedServers, serverSearch]);

  // Build unified global queue ledger items
  const allQueueItems = useMemo(() => {
    const list = [];
    const seen = new Set();

    for (const j of queues.active_jobs_list || []) {
      const key = `${j.run_id || ''}:${j.job || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ ...j, kind: 'RUNNING' });
      }
    }
    for (const j of queues.queued_jobs_list || []) {
      const key = `${j.run_id || ''}:${j.job || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ ...j, kind: j.is_slot_wait ? 'SLOT_WAIT' : 'DEP_WAIT' });
      }
    }
    for (const s of normalizedServers) {
      for (const qj of s.queued_jobs || []) {
        const key = `${qj.run_id || ''}:${qj.job || ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ ...qj, kind: qj.is_slot_wait ? 'SLOT_WAIT' : 'DEP_WAIT', target_ip: s.ip });
        }
      }
    }
    return list;
  }, [queues, normalizedServers]);

  // Filter queue ledger items
  const filteredQueueItems = useMemo(() => {
    return allQueueItems.filter((item) => {
      if (queueFilter === 'RUNNING' && item.kind !== 'RUNNING') return false;
      if (queueFilter === 'SLOT_WAIT' && item.kind !== 'SLOT_WAIT') return false;
      if (queueFilter === 'DEP_WAIT' && item.kind !== 'DEP_WAIT') return false;
      if (queueSearch.trim()) {
        const q = queueSearch.toLowerCase();
        return (
          (item.job || '').toLowerCase().includes(q) ||
          (item.target || '').toLowerCase().includes(q) ||
          (item.target_ip || '').toLowerCase().includes(q) ||
          (item.folder || '').toLowerCase().includes(q) ||
          (item.partition || '').toLowerCase().includes(q) ||
          (item.run_id || '').toLowerCase().includes(q) ||
          (item.reason || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allQueueItems, queueFilter, queueSearch]);

  return (
    <div className="cr-servers-queue-page">
      {/* ── Global Top Header ── */}
      <div className="cr-sq-header">
        <div className="cr-sq-header-left">
          <div className="cr-sq-title-row">
            <Globe size={18} className="cr-sq-title-icon" />
            <h2 className="cr-sq-title">Global Infrastructure & Multi-Tier Queue</h2>
            <span className="cr-sq-env-badge">GLOBAL CLUSTER</span>
            <span className="cr-live-pulse-dot" title="Live connection active" />
          </div>
          <p className="cr-sq-subtitle">
            System-wide server capacity by IP, environment workload distribution, and cluster execution queue.
          </p>
        </div>

        <div className="cr-sq-header-right">
          <span className="cr-sq-refreshed-time">
            {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : 'Connecting...'}
          </span>
          <button
            type="button"
            className="cr-btn-sq-refresh"
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="Refresh global telemetry"
          >
            <RefreshCw size={13} className={refreshing ? 'is-spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Engine & Worker Operational Status Banner ── */}
      <div className="cr-sq-engine-worker-banner">
        {/* Engine Status */}
        <div className="cr-sq-ew-card">
          <div className="cr-sq-ew-icon-wrap is-engine">
            <Cpu size={16} />
          </div>
          <div className="cr-sq-ew-content">
            <div className="cr-sq-ew-title-row">
              <span className="cr-sq-ew-title">Engine Status</span>
              <span
                className={`cr-sq-ew-badge ${
                  isEngineServing ? 'is-active' : 'is-inactive'
                }`}
              >
                <span className="cr-sq-ew-pulse" />
                {engineMessage}
              </span>
            </div>
            <div className="cr-sq-ew-subtext">
              {isEngineServing
                ? 'Scheduler background engine is connected and polling leases'
                : 'Engine stopped. Start one via: python manage.py run_eod_engine'}
            </div>
          </div>
        </div>

        {/* Worker Status */}
        <div className="cr-sq-ew-card">
          <div className="cr-sq-ew-icon-wrap is-worker">
            <Activity size={16} />
          </div>
          <div className="cr-sq-ew-content">
            <div className="cr-sq-ew-title-row">
              <span className="cr-sq-ew-title">Worker Status</span>
              <span
                className={`cr-sq-ew-badge ${
                  isEngineServing ? 'is-active' : 'is-idle'
                }`}
              >
                <span className="cr-sq-ew-pulse" />
                {isEngineServing ? 'Worker Online' : 'Worker Idle'}
              </span>
            </div>
            <div className="cr-sq-ew-subtext">
              {isEngineServing
                ? `${
                    workerCount > 0 ? `${workerCount} active worker(s)` : 'Direct SSH Worker'
                  } processing job execution dispatches`
                : 'Zero active background workers claiming queue tasks'}
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Metrics Cards Row ── */}
      <div className="cr-sq-metrics-grid">
        {/* Card 1: Target Servers Capacity */}
        <div className="cr-sq-card">
          <div className="cr-sq-card-label">
            <Server size={14} />
            <span>TARGET SERVERS (BY IP)</span>
          </div>
          <div className="cr-sq-card-value-row">
            <span className="cr-sq-card-value">
              {activeServersCount} / {totalServersCount}
            </span>
            <span className="cr-sq-card-subval">Active Machines</span>
          </div>
          <div className="cr-sq-card-progress-wrap">
            <div className="cr-sq-progress-bar">
              <div
                className={`cr-sq-progress-fill ${
                  aggregateLoadPct >= 90
                    ? 'is-danger'
                    : aggregateLoadPct >= 70
                    ? 'is-warning'
                    : ''
                }`}
                style={{ width: `${aggregateLoadPct}%` }}
              />
            </div>
            <span className="cr-sq-progress-text">
              {totalSlotsInUse} / {totalSlotsLimit || '∞'} slots in use ({aggregateLoadPct}%)
            </span>
          </div>
        </div>

        {/* Card 2: Active Workflows Across Environments */}
        <div className="cr-sq-card">
          <div className="cr-sq-card-label">
            <Cpu size={14} />
            <span>ACTIVE WORKFLOWS</span>
          </div>
          <div className="cr-sq-card-value-row">
            <span className="cr-sq-card-value">{queues.workflows.running}</span>
            <span className="cr-sq-card-subval">
              {queues.xml_runs.running} Batch Run{queues.xml_runs.running === 1 ? '' : 's'}
            </span>
          </div>
          <div className="cr-sq-card-footer-info">
            Across {allEnvironmentCodes.length} Environment{allEnvironmentCodes.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Card 3: Running Jobs */}
        <div className="cr-sq-card">
          <div className="cr-sq-card-label">
            <Activity size={14} />
            <span>RUNNING JOBS</span>
          </div>
          <div className="cr-sq-card-value-row">
            <span className="cr-sq-card-value st-running">{queues.jobs.running}</span>
            <span className="cr-sq-card-subval">Executing via SSH</span>
          </div>
          <div className="cr-sq-card-footer-info">
            Across {activeServersCount} active machine{activeServersCount === 1 ? '' : 's'}
          </div>
        </div>

        {/* Card 4: Capacity Queued (Slot Waiting) */}
        <div className={`cr-sq-card ${queues.jobs.queued_capacity > 0 ? 'is-alert-card' : ''}`}>
          <div className="cr-sq-card-label">
            <Clock size={14} />
            <span>CAPACITY QUEUED</span>
          </div>
          <div className="cr-sq-card-value-row">
            <span
              className={`cr-sq-card-value ${
                queues.jobs.queued_capacity > 0 ? 'st-warning' : ''
              }`}
            >
              {queues.jobs.queued_capacity}
            </span>
            <span className="cr-sq-card-subval">Waiting for Free Slot</span>
          </div>
          <div className="cr-sq-card-footer-info">
            {queues.jobs.queued_capacity > 0
              ? 'Blocked by server max concurrency'
              : 'Zero server slot bottlenecks'}
          </div>
        </div>

        {/* Card 5: Dependency Waiting */}
        <div className="cr-sq-card">
          <div className="cr-sq-card-label">
            <Layers size={14} />
            <span>DEPENDENCY WAITING</span>
          </div>
          <div className="cr-sq-card-value-row">
            <span className="cr-sq-card-value">{queues.jobs.waiting_dependencies}</span>
            <span className="cr-sq-card-subval">DAG Prerequisites</span>
          </div>
          <div className="cr-sq-card-footer-info">In-progress prerequisite tasks</div>
        </div>
      </div>

      {/* ── Main Section: Servers by IP with Associated Environments ── */}
      <div className="cr-sq-section">
        <div className="cr-sq-section-head">
          <div className="cr-sq-section-title-wrap">
            <Server size={16} />
            <h3 className="cr-sq-section-title">Servers & Workload Distribution (by IP)</h3>
            <span className="cr-sq-section-count">{normalizedServers.length} Servers</span>
          </div>

          {/* Server Search input */}
          <div className="cr-sq-search-wrap">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search server IP, host, workflow..."
              value={serverSearch}
              onChange={(e) => setServerSearch(e.target.value)}
              className="cr-sq-search-input"
            />
          </div>
        </div>

        <div className="cr-sq-servers-grid">
          {filteredServers.length === 0 ? (
            <div className="cr-sq-empty">
              No target servers matching &ldquo;{serverSearch}&rdquo;.
            </div>
          ) : (
            filteredServers.map((srv) => {
              const max = srv.max_concurrent;
              const used = srv.in_use || 0;
              const pct = srv.load_percent || 0;
              const isFull = srv.is_busy;
              const isBusy = pct >= 70 && !isFull;
              const envs = srv.environments || [];
              const activeJobs = srv.active_jobs || [];
              const queuedJobs = srv.queued_jobs || [];

              // Collect target alias names for secondary display
              const aliases = Array.from(
                new Set(envs.map((e) => e.target_name).filter(Boolean)),
              ).join(', ');

              return (
                <div
                  key={srv.display_ip}
                  className={`cr-sq-server-card ${
                    isFull ? 'is-full' : isBusy ? 'is-busy' : used > 0 ? 'is-active' : ''
                  }`}
                >
                  {/* Server Header: IP Address Prominently Shown */}
                  <div className="cr-sq-sc-head">
                    <div className="cr-sq-sc-ip-row">
                      <div className="cr-sq-sc-ip">
                        <Server size={16} />
                        <span>{srv.display_ip}</span>
                      </div>
                      <span
                        className={`cr-sq-status-pill ${
                          isFull
                            ? 'pill-full'
                            : isBusy
                            ? 'pill-busy'
                            : used > 0
                            ? 'pill-active'
                            : 'pill-idle'
                        }`}
                      >
                        {isFull ? 'AT CAPACITY' : isBusy ? 'BUSY' : used > 0 ? 'ACTIVE' : 'IDLE'}
                      </span>
                    </div>
                    {aliases && (
                      <div className="cr-sq-sc-alias">
                        Target Alias: <strong>{aliases}</strong> (Port {srv.port})
                      </div>
                    )}
                  </div>

                  {/* Slot Concurrency Meter */}
                  <div className="cr-sq-sc-meter">
                    <div className="cr-sq-meter-labels">
                      <span className="cr-sq-meter-label">Concurrency Slot Usage:</span>
                      <span className="cr-sq-meter-val">
                        <strong>{used}</strong> / {max !== null ? max : '∞'} slots ({pct}%)
                      </span>
                    </div>
                    <div className="cr-sq-meter-track">
                      <div
                        className={`cr-sq-meter-fill ${
                          isFull ? 'fill-full' : isBusy ? 'fill-busy' : 'fill-normal'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* ── Associated Environments Breakdown ── */}
                  <div className="cr-sq-envs-section">
                    <div className="cr-sq-envs-section-head">
                      <span>Associated Environments ({envs.length})</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--cr-text-muted)' }}>
                        Status & Workflows
                      </span>
                    </div>

                    <div className="cr-sq-envs-list">
                      {envs.length === 0 ? (
                        <div className="cr-sq-muted-text">No environments mapped to this server.</div>
                      ) : (
                        envs.map((envItem) => {
                          const isEnvRunning = envItem.status === 'RUNNING';
                          const isEnvQueued = envItem.status === 'QUEUED';
                          const wfCount = envItem.running_workflows_count || 0;
                          const wfNames = envItem.running_workflows || [];

                          return (
                            <div
                              key={envItem.code}
                              className={`cr-sq-env-card ${
                                isEnvRunning
                                  ? 'is-running'
                                  : isEnvQueued
                                  ? 'is-queued'
                                  : 'is-idle'
                              }`}
                            >
                              <div className="cr-sq-env-card-top">
                                <div className="cr-sq-env-title-group">
                                  <span className="cr-sq-env-code-badge">{envItem.code}</span>
                                  <span className="cr-sq-env-name-text">
                                    {envItem.name && envItem.name !== envItem.code
                                      ? envItem.name
                                      : ''}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span
                                    className={`cr-sq-env-status-badge ${
                                      isEnvRunning
                                        ? 'status-running'
                                        : isEnvQueued
                                        ? 'status-queued'
                                        : 'status-idle'
                                    }`}
                                  >
                                    {isEnvRunning ? 'Running' : isEnvQueued ? 'Queued' : 'Idle'}
                                  </span>

                                  {onNavigateEnv && (
                                    <button
                                      type="button"
                                      className="cr-btn-sq-open-cockpit"
                                      onClick={() => onNavigateEnv(envItem.code)}
                                      title={`Switch to ${envItem.code} in Control Run Cockpit`}
                                    >
                                      Cockpit <ArrowRight size={10} />
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="cr-sq-env-stats-row">
                                <span
                                  className={`cr-sq-env-wf-count ${
                                    wfCount > 0 ? 'is-running' : ''
                                  }`}
                                >
                                  {wfCount > 0
                                    ? `${wfCount} Workflow${wfCount === 1 ? '' : 's'} Running`
                                    : '0 Workflows Running'}
                                </span>
                                <span>
                                  {envItem.running_jobs_count || 0} active job{envItem.running_jobs_count === 1 ? '' : 's'} · {envItem.queued_jobs_count || 0} queued
                                </span>
                              </div>

                              {wfNames.length > 0 && (
                                <div className="cr-sq-env-wf-names">
                                  {wfNames.map((wName) => (
                                    <span key={wName} className="cr-sq-env-wf-chip active-wf">
                                      <Cpu size={10} /> {wName}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Active Executing Jobs on this Server */}
                  <div className="cr-sq-jobs-block">
                    <div className="cr-sq-block-title">
                      <span>Currently Executing Jobs ({activeJobs.length})</span>
                    </div>
                    {activeJobs.length === 0 ? (
                      <div className="cr-sq-empty-jobs">No jobs actively running on this host.</div>
                    ) : (
                      <div className="cr-sq-jobs-table-wrap">
                        <table className="cr-sq-table">
                          <thead>
                            <tr>
                              <th>Env</th>
                              <th>Job Name</th>
                              <th>Workflow</th>
                              <th>Duration</th>
                              <th>Run ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeJobs.map((j) => (
                              <tr key={`${j.run_id}-${j.job}`}>
                                <td>
                                  <span className="cr-sq-folder-badge">{j.partition || '—'}</span>
                                </td>
                                <td className="mono font-semibold">
                                  <span className="cr-sq-job-link">{j.job}</span>
                                </td>
                                <td>
                                  <span className="cr-sq-folder-badge">{j.folder}</span>
                                </td>
                                <td>
                                  {j.elapsed_seconds != null ? `${j.elapsed_seconds}s` : '—'}
                                </td>
                                <td className="mono text-muted text-xs">#{j.run_id}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Queued Jobs for this Server */}
                  {queuedJobs.length > 0 && (
                    <div className="cr-sq-queued-block">
                      <div className="cr-sq-block-title warning">
                        <Clock size={12} />
                        <span>Queued for this Server ({queuedJobs.length})</span>
                      </div>
                      <div className="cr-sq-queued-list">
                        {queuedJobs.slice(0, 5).map((qj) => (
                          <div key={`${qj.run_id}-${qj.job}`} className="cr-sq-queued-item">
                            <div className="cr-sq-qi-top">
                              <span className="cr-sq-qi-job mono">
                                {qj.partition ? `[${qj.partition}] ` : ''}
                                {qj.job}
                              </span>
                              <span
                                className={`cr-sq-qi-tag ${
                                  qj.is_slot_wait ? 'tag-slot' : 'tag-dep'
                                }`}
                              >
                                {qj.is_slot_wait ? 'Slot Wait' : 'Prereq Wait'}
                              </span>
                            </div>
                            {qj.reason && <div className="cr-sq-qi-reason">{qj.reason}</div>}
                          </div>
                        ))}
                        {queuedJobs.length > 5 && (
                          <div className="cr-sq-more-text">
                            + {queuedJobs.length - 5} more queued jobs
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Global Cluster Execution Queue Ledger ── */}
      <div className="cr-sq-section">
        <div className="cr-sq-section-head">
          <div className="cr-sq-section-title-wrap">
            <Activity size={16} />
            <h3 className="cr-sq-section-title">Global Execution Queue Ledger</h3>
            <span className="cr-sq-section-count">{filteredQueueItems.length} tasks</span>
          </div>

          <div className="cr-sq-queue-controls">
            {/* Filter buttons */}
            <div className="cr-sq-filter-pills">
              <button
                type="button"
                className={`cr-sq-pill ${queueFilter === 'ALL' ? 'is-active' : ''}`}
                onClick={() => setQueueFilter('ALL')}
              >
                All ({allQueueItems.length})
              </button>
              <button
                type="button"
                className={`cr-sq-pill ${queueFilter === 'RUNNING' ? 'is-active' : ''}`}
                onClick={() => setQueueFilter('RUNNING')}
              >
                Running ({queues.jobs.running})
              </button>
              <button
                type="button"
                className={`cr-sq-pill ${queueFilter === 'SLOT_WAIT' ? 'is-active' : ''}`}
                onClick={() => setQueueFilter('SLOT_WAIT')}
              >
                Slot Waiting ({queues.jobs.queued_capacity})
              </button>
              <button
                type="button"
                className={`cr-sq-pill ${queueFilter === 'DEP_WAIT' ? 'is-active' : ''}`}
                onClick={() => setQueueFilter('DEP_WAIT')}
              >
                Prereq Waiting ({queues.jobs.waiting_dependencies})
              </button>
            </div>

            {/* Search */}
            <div className="cr-sq-search-wrap">
              <Search size={13} />
              <input
                type="text"
                placeholder="Search job, env, target, reason..."
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                className="cr-sq-search-input"
              />
            </div>
          </div>
        </div>

        {/* Queue Ledger Table */}
        <div className="cr-sq-ledger-wrap">
          {filteredQueueItems.length === 0 ? (
            <div className="cr-sq-empty">No jobs currently in this queue state.</div>
          ) : (
            <table className="cr-sq-table cr-sq-ledger-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Environment</th>
                  <th>Job Name</th>
                  <th>Workflow</th>
                  <th>Server IP / Target</th>
                  <th>Run ID</th>
                  <th>Queue / Execution Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredQueueItems.map((item) => {
                  const isRunning = item.kind === 'RUNNING';
                  const isSlotWait = item.kind === 'SLOT_WAIT';

                  return (
                    <tr key={`${item.run_id}-${item.job}`}>
                      <td>
                        <span
                          className={`cr-sq-kind-badge ${
                            isRunning ? 'badge-running' : isSlotWait ? 'badge-slot' : 'badge-dep'
                          }`}
                        >
                          {isRunning ? 'Running' : isSlotWait ? 'Slot Queued' : 'Waiting Prereq'}
                        </span>
                      </td>
                      <td>
                        <span className="cr-sq-folder-badge">
                          {item.partition || item.environment || '—'}
                        </span>
                      </td>
                      <td className="mono font-semibold">{item.job}</td>
                      <td>
                        <span className="cr-sq-folder-badge">{item.folder || '—'}</span>
                      </td>
                      <td>
                        <span className="cr-sq-target-pill mono">
                          {item.target_ip || item.target || 'UNASSIGNED'}
                        </span>
                      </td>
                      <td className="mono text-muted text-xs">#{item.run_id}</td>
                      <td className="cr-sq-reason-cell">
                        {item.reason ||
                          (isRunning
                            ? 'Executing command via SSH'
                            : 'Prerequisites pending')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServersQueueTab;
