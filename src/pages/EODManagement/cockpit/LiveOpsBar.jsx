import React, { useState } from 'react';
import {
  Server,
  Layers,
  Cpu,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Info,
} from 'lucide-react';
import { usePolling } from '../scheduler/useResource';
import { eodSchedulerService as svc } from '@services/eodSchedulerService';

export function LiveOpsBar({ env, onSelectScope }) {
  const [telemetry, setTelemetry] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedServer, setSelectedServer] = useState(null);

  // Poll live telemetry every 3.5s
  usePolling(async () => {
    if (!env) return;
    try {
      const data = await svc.getLiveTelemetry(env);
      setTelemetry(data);
      setIsLoading(false);
    } catch (_) {
      // keep previous state if transient error
    }
  }, 3500);

  const servers = telemetry?.servers || [];
  const queues = telemetry?.queues || {
    xml_runs: { running: 0, queued: 0, paused: 0 },
    workflows: { running: 0, queued: 0 },
    jobs: { running: 0, queued_capacity: 0, waiting_dependencies: 0 },
  };

  const activeServersCount = servers.filter((s) => s.in_use > 0).length;
  const totalServersCount = servers.length;

  return (
    <div className="cr-live-ops-bar">
      <div className="cr-live-ops-header">
        <div className="cr-live-ops-title-group">
          <span className="cr-live-pulse-dot" title="Live connection active" />
          <span className="cr-live-ops-title">LIVE INFRASTRUCTURE & QUEUE MONITOR</span>
          <span className="cr-live-env-badge">{String(env).toUpperCase()}</span>
        </div>

        {/* Quick Summary Badges */}
        <div className="cr-live-ops-summary-strip">
          {/* Target Servers Badge */}
          <div
            className={`cr-live-stat-pill ${activeServersCount > 0 ? 'is-active' : ''}`}
            onClick={() => setIsExpanded((v) => !v)}
            title="Click to expand server capacity telemetry"
          >
            <Server size={13} />
            <span>Target Servers:</span>
            <strong>
              {activeServersCount} / {totalServersCount} Active
            </strong>
          </div>

          {/* XML Runs Badge */}
          <div
            className={`cr-live-stat-pill ${queues.xml_runs.running > 0 ? 'is-running' : ''}`}
            title="Active & Queued Batch Runs"
          >
            <Layers size={13} />
            <span>Whole XML:</span>
            <strong>{queues.xml_runs.running} Running</strong>
            {queues.xml_runs.queued > 0 && (
              <span className="cr-pill-queued">({queues.xml_runs.queued} Queued)</span>
            )}
          </div>

          {/* Workflows Badge */}
          <div
            className={`cr-live-stat-pill ${queues.workflows.running > 0 ? 'is-running' : ''}`}
            title="Active & Queued Workflow Folders"
          >
            <Cpu size={13} />
            <span>Workflows:</span>
            <strong>{queues.workflows.running} Running</strong>
            {queues.workflows.queued > 0 && (
              <span className="cr-pill-queued">({queues.workflows.queued} Queued)</span>
            )}
          </div>

          {/* Jobs Queue Badge */}
          <div
            className={`cr-live-stat-pill ${queues.jobs.running > 0 ? 'is-running' : ''}`}
            title="Running, Capacity Queued, and Dependency Waiting Jobs"
          >
            <Activity size={13} />
            <span>Jobs:</span>
            <strong>{queues.jobs.running} Running</strong>
            {queues.jobs.queued_capacity > 0 && (
              <span className="cr-pill-queued" title="Waiting for available slot on target server">
                ({queues.jobs.queued_capacity} Slot Wait)
              </span>
            )}
            {queues.jobs.waiting_dependencies > 0 && (
              <span className="cr-pill-waiting" title="Waiting for upstream prerequisites">
                ({queues.jobs.waiting_dependencies} Waiting)
              </span>
            )}
          </div>

          {/* Expand / Collapse toggle */}
          <button
            type="button"
            className="cr-btn-ghost-icon"
            onClick={() => setIsExpanded((v) => !v)}
            title={isExpanded ? 'Collapse Telemetry Details' : 'Expand Telemetry Details'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Details Section */}
      {isExpanded && (
        <div className="cr-live-ops-expanded">
          <div className="cr-live-ops-grid">
            {/* 1. Target Servers Load Grid */}
            <div className="cr-live-section-card">
              <div className="cr-live-card-head">
                <Server size={14} />
                <span>Target Execution Servers ({servers.length})</span>
              </div>
              <div className="cr-live-servers-list">
                {servers.length === 0 ? (
                  <div className="cr-live-empty-text">No target servers configured for {env}.</div>
                ) : (
                  servers.map((srv) => {
                    const max = srv.max_concurrent;
                    const used = srv.in_use || 0;
                    const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
                    const isBusy = srv.is_busy;

                    return (
                      <div
                        key={srv.id}
                        className={`cr-live-server-item ${isBusy ? 'is-busy' : ''} ${used > 0 ? 'is-active' : ''}`}
                        onClick={() => setSelectedServer(srv)}
                        title="Click to view running jobs on this server"
                      >
                        <div className="cr-server-info-row">
                          <span className="cr-server-name">{srv.name}</span>
                          <span className="cr-server-addr">{srv.host}:{srv.port}</span>
                        </div>
                        <div className="cr-server-capacity-row">
                          <div className="cr-cap-bar-track">
                            <div
                              className={`cr-cap-bar-fill ${isBusy ? 'is-full' : ''}`}
                              style={{ width: max ? `${pct}%` : `${used > 0 ? 50 : 0}%` }}
                            />
                          </div>
                          <span className="cr-cap-text">
                            {used} / {max !== null ? max : '∞'} slots
                          </span>
                        </div>
                        {srv.active_jobs?.length > 0 && (
                          <div className="cr-server-active-pill">
                            {srv.active_jobs.length} active jobs
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 2. Live Queues Breakdown */}
            <div className="cr-live-section-card">
              <div className="cr-live-card-head">
                <Activity size={14} />
                <span>Real-Time Execution & Queue Breakdown</span>
              </div>
              <div className="cr-live-breakdown-content">
                <div className="cr-breakdown-row">
                  <span className="cr-breakdown-label">Whole XML Batch Runs:</span>
                  <div className="cr-breakdown-badges">
                    <span className="cr-state-badge running">
                      {queues.xml_runs.running} Running
                    </span>
                    <span className="cr-state-badge queued">
                      {queues.xml_runs.queued} Queued (Host Barrier)
                    </span>
                    {queues.xml_runs.paused > 0 && (
                      <span className="cr-state-badge paused">
                        {queues.xml_runs.paused} Paused
                      </span>
                    )}
                  </div>
                </div>

                <div className="cr-breakdown-row">
                  <span className="cr-breakdown-label">Active Workflows (Folders):</span>
                  <div className="cr-breakdown-badges">
                    <span className="cr-state-badge running">
                      {queues.workflows.running} Active
                    </span>
                    <span className="cr-state-badge queued">
                      {queues.workflows.queued} Queued (Overlap Policy)
                    </span>
                  </div>
                </div>

                <div className="cr-breakdown-row">
                  <span className="cr-breakdown-label">Individual Jobs:</span>
                  <div className="cr-breakdown-badges">
                    <span className="cr-state-badge running">
                      {queues.jobs.running} Executing via SSH
                    </span>
                    <span className="cr-state-badge queued" title="Dependencies met, waiting for machine capacity slot">
                      {queues.jobs.queued_capacity} Capacity Queued
                    </span>
                    <span className="cr-state-badge waiting" title="Waiting for predecessor jobs to finish">
                      {queues.jobs.waiting_dependencies} Dependency Waiting
                    </span>
                  </div>
                </div>

                {queues.workflows.running_folders?.length > 0 && (
                  <div className="cr-live-active-names">
                    <span className="cr-active-names-title">Running Workflows:</span>
                    <div className="cr-names-pills">
                      {queues.workflows.running_folders.map((f) => (
                        <button
                          key={f}
                          type="button"
                          className="cr-folder-pill-link"
                          onClick={() => onSelectScope && onSelectScope({ type: 'workflow', folder: f })}
                          title="Switch to this workflow scope"
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Server Active Jobs Modal / Flyout */}
      {selectedServer && (
        <div className="cr-server-modal-backdrop" onClick={() => setSelectedServer(null)}>
          <div className="cr-server-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="cr-server-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={18} />
                <h3>{selectedServer.name} &mdash; Active Jobs Telemetry</h3>
              </div>
              <button
                type="button"
                className="cr-btn-ghost-icon"
                onClick={() => setSelectedServer(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="cr-server-modal-body">
              <div className="cr-server-meta-grid">
                <div>
                  <span className="meta-label">Host Address:</span>
                  <strong>{selectedServer.host}:{selectedServer.port}</strong>
                </div>
                <div>
                  <span className="meta-label">Machine Slots:</span>
                  <strong>
                    {selectedServer.in_use} / {selectedServer.max_concurrent !== null ? selectedServer.max_concurrent : 'Unlimited'}
                  </strong>
                </div>
                <div>
                  <span className="meta-label">Status:</span>
                  <span className={`cr-server-status-pill ${selectedServer.is_busy ? 'busy' : 'ready'}`}>
                    {selectedServer.is_busy ? 'At Capacity' : 'Slots Available'}
                  </span>
                </div>
              </div>

              <h4 style={{ margin: '16px 0 8px', fontSize: '13px', fontWeight: 600 }}>
                Currently Dispatched Jobs ({selectedServer.active_jobs?.length || 0})
              </h4>
              {selectedServer.active_jobs?.length === 0 ? (
                <p className="cr-empty-sub">No active jobs currently running on this server.</p>
              ) : (
                <div className="cr-server-jobs-table">
                  <table>
                    <thead>
                      <tr>
                        <th>JOB NAME</th>
                        <th>ENVIRONMENT</th>
                        <th>RUN ID</th>
                        <th>STATUS</th>
                        <th>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedServer.active_jobs.map((j, idx) => (
                        <tr key={idx}>
                          <td><strong>{j.job}</strong></td>
                          <td>
                            <span className={`cr-env-pill ${String(j.partition).toLowerCase()}`}>
                              {j.partition}
                            </span>
                          </td>
                          <td className="mono">{j.run_id}</td>
                          <td>
                            <span className="cr-status-badge running">{j.status}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="cr-btn sm outline"
                              onClick={() => {
                                setSelectedServer(null);
                                onSelectScope && onSelectScope({ type: 'job', job: j.job });
                              }}
                            >
                              Inspect Job
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
