import React, { useState } from 'react';
import {
  Server,
  Activity,
  Layers,
  Cpu,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';
import { usePolling } from '../scheduler/useResource';
import { eodSchedulerService as svc } from '@services/eodSchedulerService';

export function ServersQueueTab({ env, scope = null, onSelectScope, onSelectJob }) {
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [serverSearch, setServerSearch] = useState('');
  const [queueFilter, setQueueFilter] = useState('ALL'); // 'ALL' | 'RUNNING' | 'SLOT_WAIT' | 'DEP_WAIT'
  const [queueSearch, setQueueSearch] = useState('');

  const fetchTelemetry = async () => {
    if (!env) return;
    try {
      const data = await svc.getLiveTelemetry(env);
      setTelemetry(data);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn('Failed to fetch live telemetry:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Poll live telemetry every 3 seconds
  usePolling(fetchTelemetry, 3000);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchTelemetry();
  };

  const servers = telemetry?.servers || [];
  const queues = telemetry?.queues || {
    xml_runs: { running: 0, queued: 0, paused: 0 },
    workflows: { running: 0, queued: 0 },
    jobs: { running: 0, queued_capacity: 0, waiting_dependencies: 0 },
    active_jobs_list: [],
    queued_jobs_list: [],
  };

  const activeServers = servers.filter((s) => s.in_use > 0);
  const totalSlotsLimit = servers.reduce((acc, s) => acc + (s.max_concurrent || 0), 0);
  const totalSlotsInUse = servers.reduce((acc, s) => acc + (s.in_use || 0), 0);
  const aggregateLoadPct =
    totalSlotsLimit > 0 ? Math.min(100, Math.round((totalSlotsInUse / totalSlotsLimit) * 100)) : 0;

  // Filter queues
  const allQueueItems = [
    ...(queues.active_jobs_list || []).map((j) => ({ ...j, kind: 'RUNNING' })),
    ...(queues.queued_jobs_list || []).map((j) => ({
      ...j,
      kind: j.is_slot_wait ? 'SLOT_WAIT' : 'DEP_WAIT',
    })),
  ];

  // Scoped queue items
  const scopedQueueItems = allQueueItems.filter((item) => {
    if (scope?.type === 'workflow' && scope.folder) {
      const normF = scope.folder.trim().toUpperCase();
      const itemF = String(item.folder || '').trim().toUpperCase();
      const itemRid = String(item.run_id || '').toUpperCase();
      return itemF === normF || itemRid.startsWith(`${normF}-`) || itemRid.includes(normF);
    }
    if (scope?.type === 'job' && scope.job) {
      const normJ = scope.job.trim().toUpperCase();
      return String(item.job || '').trim().toUpperCase() === normJ;
    }
    return true;
  });

  // Dedicated single-job telemetry lookup
  const jobFocusItem = scope?.type === 'job' && scope.job
    ? allQueueItems.find((j) => String(j.job || '').trim().toUpperCase() === scope.job.trim().toUpperCase())
    : null;

  // Filter servers with search and scope relevance
  const filteredServers = servers.filter((s) => {
    if (!serverSearch.trim()) return true;
    const q = serverSearch.toLowerCase();
    return (
      (s.name || '').toLowerCase().includes(q) ||
      (s.host || '').toLowerCase().includes(q) ||
      (s.running_workflows || []).some((w) => w.toLowerCase().includes(q))
    );
  });

  const filteredQueueItems = scopedQueueItems.filter((item) => {
    if (queueFilter === 'RUNNING' && item.kind !== 'RUNNING') return false;
    if (queueFilter === 'SLOT_WAIT' && item.kind !== 'SLOT_WAIT') return false;
    if (queueFilter === 'DEP_WAIT' && item.kind !== 'DEP_WAIT') return false;
    if (queueSearch.trim()) {
      const q = queueSearch.toLowerCase();
      return (
        (item.job || '').toLowerCase().includes(q) ||
        (item.target || '').toLowerCase().includes(q) ||
        (item.run_id || '').toLowerCase().includes(q) ||
        (item.reason || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="cr-servers-queue-page">
      {/* ── Subtab Top Header ── */}
      <div className="cr-sq-header">
        <div className="cr-sq-header-left">
          <div className="cr-sq-title-row">
            <Server size={18} className="cr-sq-title-icon" />
            <h2 className="cr-sq-title">Infrastructure & Execution Queue</h2>
            <span className="cr-sq-env-badge">{String(env).toUpperCase()}</span>
            <span className="cr-live-pulse-dot" title="Live connection active" />
          </div>
          <p className="cr-sq-subtitle">
            Real-time server capacity, running vs queued jobs per host, and cluster-wide bottleneck analysis.
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
            title="Refresh telemetry"
          >
            <RefreshCw size={13} className={refreshing ? 'is-spinning' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* ── Active Scope Indicator & Controls ── */}
      {scope?.type && scope.type !== 'xml' && (
        <div className="cr-sq-scope-banner">
          <div className="cr-sq-scope-banner-text">
            {scope.type === 'workflow' ? <Cpu size={14} /> : <Activity size={14} />}
            <span>
              Telemetry Scope:{' '}
              <strong>
                {scope.type === 'workflow'
                  ? `Workflow (Folder) — ${scope.folder || 'ALL'}`
                  : `Job — ${scope.job}`}
              </strong>
            </span>
          </div>
          <button
            type="button"
            className="cr-btn sm outline"
            onClick={() => onSelectScope?.({ type: 'xml', folder: null, job: null })}
            title="Switch back to Whole XML scope"
          >
            Reset to Whole XML
          </button>
        </div>
      )}

      {/* ── Single Job Execution Status Banner ── */}
      {scope?.type === 'job' && scope.job && (
        <div className="cr-sq-job-focus-card">
          <div className="cr-sq-jfc-header">
            <div className="cr-sq-jfc-title">
              <Activity size={15} />
              <span>Job Runtime & Queue Status: {scope.job}</span>
            </div>
            <span
              className={`cr-sq-jfc-status ${
                jobFocusItem?.kind === 'RUNNING'
                  ? 'is-running'
                  : jobFocusItem?.kind === 'SLOT_WAIT'
                  ? 'is-queued'
                  : 'is-waiting'
              }`}
            >
              {jobFocusItem?.kind === 'RUNNING'
                ? 'Running on Host'
                : jobFocusItem?.kind === 'SLOT_WAIT'
                ? 'Queued for Server Slot'
                : jobFocusItem?.kind === 'DEP_WAIT'
                ? 'Waiting for Prerequisites'
                : 'Not in Active Queue / Idle'}
            </span>
          </div>
          <div className="cr-sq-jfc-body">
            {jobFocusItem?.kind === 'RUNNING'
              ? `Currently executing on target server ${jobFocusItem.target || 'host'} (Run #${jobFocusItem.run_id}). Elapsed time: ${jobFocusItem.elapsed_seconds != null ? `${jobFocusItem.elapsed_seconds}s` : 'active'}.`
              : jobFocusItem?.kind === 'SLOT_WAIT'
              ? `Job is ready to execute but waiting for an available concurrency slot on target server ${jobFocusItem.target || 'host'}. Reason: ${jobFocusItem.reason || 'Server at maximum concurrency capacity'}.`
              : jobFocusItem?.kind === 'DEP_WAIT'
              ? `Job is waiting for predecessor jobs in workflow DAG to complete. Reason: ${jobFocusItem.reason || 'Prerequisite conditions not met'}.`
              : `Job ${scope.job} is currently idle and not queued in any active batch run.`}
          </div>
        </div>
      )}

      {/* ── KPI Metrics Cards Row ── */}
      <div className="cr-sq-metrics-grid">
        {/* Card 1: Target Servers Capacity */}
        <div className="cr-sq-card">
          <div className="cr-sq-card-label">
            <Server size={14} />
            <span>TARGET SERVERS</span>
          </div>
          <div className="cr-sq-card-value-row">
            <span className="cr-sq-card-value">
              {activeServers.length} / {servers.length}
            </span>
            <span className="cr-sq-card-subval">Active</span>
          </div>
          <div className="cr-sq-card-progress-wrap">
            <div className="cr-sq-progress-bar">
              <div
                className={`cr-sq-progress-fill ${aggregateLoadPct >= 90 ? 'is-danger' : aggregateLoadPct >= 70 ? 'is-warning' : ''}`}
                style={{ width: `${aggregateLoadPct}%` }}
              />
            </div>
            <span className="cr-sq-progress-text">
              {totalSlotsInUse} / {totalSlotsLimit || '∞'} slots ({aggregateLoadPct}%)
            </span>
          </div>
        </div>

        {/* Card 2: Running Jobs */}
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
            Across {activeServers.length} target machine{activeServers.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Card 3: Capacity Queued (Slot Waiting) */}
        <div className={`cr-sq-card ${queues.jobs.queued_capacity > 0 ? 'is-alert-card' : ''}`}>
          <div className="cr-sq-card-label">
            <Clock size={14} />
            <span>CAPACITY QUEUED</span>
          </div>
          <div className="cr-sq-card-value-row">
            <span
              className={`cr-sq-card-value ${queues.jobs.queued_capacity > 0 ? 'st-warning' : ''}`}
            >
              {queues.jobs.queued_capacity}
            </span>
            <span className="cr-sq-card-subval">Waiting for Slot</span>
          </div>
          <div className="cr-sq-card-footer-info">
            {queues.jobs.queued_capacity > 0
              ? 'Blocked by host max_concurrent'
              : 'Zero server slot bottlenecks'}
          </div>
        </div>

        {/* Card 4: Dependency Waiting */}
        <div className="cr-sq-card">
          <div className="cr-sq-card-label">
            <Layers size={14} />
            <span>DEPENDENCY WAITING</span>
          </div>
          <div className="cr-sq-card-value-row">
            <span className="cr-sq-card-value">{queues.jobs.waiting_dependencies}</span>
            <span className="cr-sq-card-subval">Waiting Predecessors</span>
          </div>
          <div className="cr-sq-card-footer-info">
            DAG prerequisites in progress
          </div>
        </div>

        {/* Card 5: Active Workflows & Batches */}
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
            {queues.workflows.queued > 0 ? `${queues.workflows.queued} queued folders` : 'All folders dispatched'}
          </div>
        </div>
      </div>

      {/* ── Main Section: Server-by-Server Capacity & Active Jobs ── */}
      <div className="cr-sq-section">
        <div className="cr-sq-section-head">
          <div className="cr-sq-section-title-wrap">
            <Server size={16} />
            <h3 className="cr-sq-section-title">Target Servers & Workload Distribution</h3>
            <span className="cr-sq-section-count">{servers.length} configured</span>
          </div>
          <div className="cr-sq-search-wrap">
            <Search size={13} />
            <input
              type="text"
              placeholder="Search server, host, workflow..."
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
              const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
              const isFull = srv.is_busy;
              const isBusy = pct >= 70 && !isFull;
              const runningWfs = srv.running_workflows || [];
              const activeJobs = srv.active_jobs || [];
              const queuedJobs = srv.queued_jobs || [];

              const isScopeRelevant =
                scope?.type === 'workflow' && scope.folder
                  ? runningWfs.some((w) => w.toUpperCase() === scope.folder.toUpperCase()) ||
                    activeJobs.some((j) => (j.folder || '').toUpperCase() === scope.folder.toUpperCase()) ||
                    queuedJobs.some((j) => (j.folder || '').toUpperCase() === scope.folder.toUpperCase())
                  : scope?.type === 'job' && scope.job
                  ? activeJobs.some((j) => (j.job || '').toUpperCase() === scope.job.toUpperCase()) ||
                    queuedJobs.some((j) => (j.job || '').toUpperCase() === scope.job.toUpperCase()) ||
                    srv.name === jobFocusItem?.target ||
                    srv.host === jobFocusItem?.target
                  : false;

              return (
                <div
                  key={srv.id || srv.name}
                  className={`cr-sq-server-card ${isScopeRelevant ? 'is-highlighted-scope' : ''} ${isFull ? 'is-full' : isBusy ? 'is-busy' : used > 0 ? 'is-active' : ''}`}
                >
                  {/* Server Head */}
                  <div className="cr-sq-sc-head">
                    <div className="cr-sq-sc-name-row">
                      <span className="cr-sq-sc-name">{srv.name}</span>
                      {isScopeRelevant && (
                        <span
                          className="cr-sq-status-pill"
                          style={{
                            background: 'var(--cr-accent-tint, #e6f4ed)',
                            color: 'var(--c-primary, #005a36)',
                            borderColor: 'var(--c-primary, #005a36)',
                            fontWeight: 700,
                          }}
                        >
                          MATCHES SCOPE
                        </span>
                      )}
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
                    <div className="cr-sq-sc-addr">
                      {srv.host}:{srv.port || 22}
                    </div>
                  </div>

                  {/* Slot Meter */}
                  <div className="cr-sq-sc-meter">
                    <div className="cr-sq-meter-labels">
                      <span className="cr-sq-meter-label">Concurrency Slot Usage:</span>
                      <span className="cr-sq-meter-val">
                        <strong>{used}</strong> / {max !== null ? max : '∞'} slots ({pct}%)
                      </span>
                    </div>
                    <div className="cr-sq-meter-track">
                      <div
                        className={`cr-sq-meter-fill ${isFull ? 'fill-full' : isBusy ? 'fill-busy' : 'fill-normal'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Active Workflows on this Server */}
                  <div className="cr-sq-sc-wfs">
                    <span className="cr-sq-sublabel">
                      Workflows Running on this Server ({runningWfs.length}):
                    </span>
                    <div className="cr-sq-wfs-pills">
                      {runningWfs.length === 0 ? (
                        <span className="cr-sq-muted-text">None currently</span>
                      ) : (
                        runningWfs.map((wf) => (
                          <span
                            key={wf}
                            className="cr-sq-wf-tag"
                            onClick={() => onSelectScope?.({ type: 'workflow', folder: wf })}
                            title="Focus on this workflow"
                          >
                            <Cpu size={11} />
                            {wf}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Active Running Jobs List */}
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
                              <th>Job Name</th>
                              <th>Workflow</th>
                              <th>Duration</th>
                              <th>Run ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeJobs.map((j) => (
                              <tr key={`${j.run_id}-${j.job}`}>
                                <td className="mono font-semibold">
                                  <button
                                    type="button"
                                    className="cr-sq-job-link"
                                    onClick={() => {
                                      onSelectJob?.(j.job);
                                      onSelectScope?.({ type: 'job', job: j.job, folder: j.folder });
                                    }}
                                  >
                                    {j.job}
                                  </button>
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
                              <span className="cr-sq-qi-job mono">{qj.job}</span>
                              <span
                                className={`cr-sq-qi-tag ${qj.is_slot_wait ? 'tag-slot' : 'tag-dep'}`}
                              >
                                {qj.is_slot_wait ? 'Slot Wait' : 'Prereq Wait'}
                              </span>
                            </div>
                            {qj.reason && (
                              <div className="cr-sq-qi-reason">{qj.reason}</div>
                            )}
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
            <span className="cr-sq-section-count">{allQueueItems.length} total tasks</span>
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
                Dependency Waiting ({queues.jobs.waiting_dependencies})
              </button>
            </div>

            {/* Search */}
            <div className="cr-sq-search-wrap">
              <Search size={13} />
              <input
                type="text"
                placeholder="Search job, target, reason..."
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
            <div className="cr-sq-empty">
              No jobs currently in this queue state.
            </div>
          ) : (
            <table className="cr-sq-table cr-sq-ledger-table">
              <thead>
                <tr>
                  <th>State</th>
                  <th>Job Name</th>
                  <th>Target Server</th>
                  <th>Run ID</th>
                  <th>Queue / Execution Reason</th>
                  <th>Action</th>
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
                      <td className="mono font-semibold">{item.job}</td>
                      <td>
                        <span className="cr-sq-target-pill">{item.target || 'UNASSIGNED'}</span>
                      </td>
                      <td className="mono text-muted text-xs">#{item.run_id}</td>
                      <td className="cr-sq-reason-cell">
                        {item.reason || (isRunning ? 'Executing command via SSH' : 'Prerequisites pending')}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cr-btn-sq-inspect"
                          onClick={() => {
                            onSelectJob?.(item.job);
                            onSelectScope?.({ type: 'job', job: item.job });
                          }}
                          title="Inspect job in details drawer"
                        >
                          Inspect <ArrowRight size={11} />
                        </button>
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
