import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { CockpitIcon } from './IconSprite';
import { computeLayout, fitTransform, closure } from './layout';
import { groupMessages } from '../scheduler/schedulerModel';

function Problems({ title, tone, messages, open }) {
  const groups = useMemo(() => groupMessages(messages), [messages]);
  if (!groups.length) return null;
  return (
    <details className={`eodw-problems eodw-problems-${tone}`} open={open}>
      <summary>
        <span className="eodw-problems-title">{title}</span>
        <span className="eodw-problems-count">{messages.length}</span>
      </summary>
      <ul>
        {groups.map((g) => (
          <li key={g.text}>
            {g.count > 1 ? <strong>{g.count} jobs: </strong> : null}
            {g.text}
            {g.where.length ? (
              <span className="eodw-muted">
                {' '}
                — {g.where.join(', ')}
                {g.count > g.where.length ? ', …' : ''}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function CockpitFlow({
  definition,
  run,
  onSelectJob,
  selectedJob,
  onCancelRun,
  isPaused = false,
  onTogglePause,
  onOpenDrawer,
  folders = [],
  initialFolder = null,
  onClearFolderFilter,
  stats = [],
  warnings = [],
  errors = [],
}) {
  const rootRef = useRef(null);
  const viewportRef = useRef(null);
  const [scale, setScale] = useState(0.18);
  const [offset, setOffset] = useState({ x: 120, y: 24 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(() => initialFolder || 'ALL');
  const [traceChainActive, setTraceChainActive] = useState(false);
  const [followActive, setFollowActive] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const scrollHintTimeoutRef = useRef(null);

  useEffect(() => {
    if (initialFolder) {
      setSelectedFolder(initialFolder);
      if (onClearFolderFilter) onClearFolderFilter();
    }
  }, [initialFolder, onClearFolderFilter]);

  // Combine definition graph topology, folder edges, and live run statuses
  const allJobs = useMemo(() => {
    const runJobMap = new Map((run?.jobs || []).map((j) => [j.name, j]));

    // Extract edges from all folders
    const activeFolders = (folders && folders.length > 0 ? folders : run?.folders) || [];
    const predsMap = new Map();
    const succsMap = new Map();
    for (const f of activeFolders) {
      for (const e of f?.graph?.edges || []) {
        if (!predsMap.has(e.target)) predsMap.set(e.target, new Set());
        predsMap.get(e.target).add(e.source);
        if (!succsMap.has(e.source)) succsMap.set(e.source, new Set());
        succsMap.get(e.source).add(e.target);
      }
    }

    // Base jobs: always display the full workflow definition with run statuses overlaid.
    // If run has extra jobs not in definition (e.g. dynamic/past runs), include them as well.
    const defJobs = definition?.jobs || [];
    const defJobNames = new Set(defJobs.map((j) => j.name));
    const extraRunJobs = (run?.jobs || []).filter((rj) => !defJobNames.has(rj.name));
    const baseList = [...defJobs, ...extraRunJobs];
    const effectiveBase = baseList.length > 0 ? baseList : (run?.jobs || []);

    const rawList = effectiveBase.map((dj) => {
      const rj = runJobMap.get(dj.name);
      return {
        ...dj,
        status: rj?.status || (run ? 'Waiting' : 'Idle'),
        started_at: rj?.started_at || dj.started_at || null,
        ended_at: rj?.ended_at || dj.ended_at || null,
        exit_code: rj?.exit_code ?? dj.exit_code ?? null,
        duration_seconds: rj?.duration_seconds ?? dj.duration_seconds,
        attempts: rj?.attempts || dj.attempts || [],
      };
    });

    // Merge in existing job predecessors & successors
    for (const j of rawList) {
      if (!predsMap.has(j.name)) predsMap.set(j.name, new Set());
      for (const p of j.predecessors || []) predsMap.get(j.name).add(p);

      if (!succsMap.has(j.name)) succsMap.set(j.name, new Set());
      for (const s of j.successors || []) succsMap.get(j.name).add(s);
    }

    // Bi-directionally cross-link predecessors and successors
    for (const [target, preds] of predsMap.entries()) {
      for (const p of preds) {
        if (!succsMap.has(p)) succsMap.set(p, new Set());
        succsMap.get(p).add(target);
      }
    }
    for (const [source, succs] of succsMap.entries()) {
      for (const s of succs) {
        if (!predsMap.has(s)) predsMap.set(s, new Set());
        predsMap.get(s).add(source);
      }
    }

    return rawList.map((j) => ({
      ...j,
      predecessors: Array.from(predsMap.get(j.name) || []),
      successors: Array.from(succsMap.get(j.name) || []),
    }));
  }, [definition, run, folders]);

  const folderOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const f of folders || []) {
      const fName = f.folder || f.name;
      if (fName && !seen.has(fName)) {
        seen.add(fName);
        list.push(fName);
      }
    }
    for (const j of allJobs) {
      const jf = j.folder || j.group;
      if (jf && !seen.has(jf)) {
        seen.add(jf);
        list.push(jf);
      }
    }
    return list;
  }, [folders, allJobs]);

  // Filter jobs based on selected folder (default 'ALL' shows all jobs unified)
  const jobs = useMemo(() => {
    if (!selectedFolder || selectedFolder === 'ALL') return allJobs;
    const filtered = allJobs.filter((j) => (j.folder || j.group) === selectedFolder);
    return filtered.length > 0 ? filtered : allJobs;
  }, [allJobs, selectedFolder]);

  const defIndex = useMemo(() => new Map(jobs.map((j) => [j.name, j])), [jobs]);
  const L = useMemo(() => (jobs.length ? computeLayout(jobs) : null), [jobs]);

  // Trace chain closure: upstream predecessors + downstream successors
  const chainSet = useMemo(() => {
    if (!traceChainActive || !selectedJob) return null;
    const up = closure(selectedJob, defIndex, 'predecessors');
    const down = closure(selectedJob, defIndex, 'successors');
    return new Set([selectedJob, ...up, ...down]);
  }, [traceChainActive, selectedJob, defIndex]);

  // Fit view directly to canvas viewport
  const fit = useCallback(() => {
    if (!L || !viewportRef.current) return;
    const box = {
      w: viewportRef.current.clientWidth || 800,
      h: viewportRef.current.clientHeight || 500,
    };
    const t = fitTransform(L, box, {
      min: 0.35,
      max: 1.0,
      padLeft: 64, // Keep room for left Level Axis
      padTop: 56, // Keep room for top floating toolbar
      padRight: 36,
      padBottom: 48, // Breathing room above bottom legend
    });
    setIsAnimating(true);
    setScale(t.k);
    setOffset({ x: Math.round(t.x), y: Math.round(t.y) });
    setTimeout(() => setIsAnimating(false), 300);
  }, [L]);

  useEffect(() => {
    const timer = setTimeout(fit, 80);
    return () => clearTimeout(timer);
  }, [definition, selectedFolder, fit]);

  // Camera center on a target node
  const centerOnNode = useCallback((jobName) => {
    if (!L || !viewportRef.current || !jobName) return;
    const node = L.nodes.get(jobName);
    if (!node) return;
    const containerW = viewportRef.current.clientWidth || 800;
    const containerH = viewportRef.current.clientHeight || 500;
    const targetScale = Math.max(0.35, Math.min(0.85, scale < 0.28 ? 0.45 : scale));
    setIsAnimating(true);
    setScale(targetScale);
    const targetX = containerW / 2 - (node.x + node.w / 2) * targetScale;
    const targetY = containerH / 2 - (node.y + node.h / 2) * targetScale;
    setOffset({ x: Math.round(targetX), y: Math.round(targetY) });
    setTimeout(() => setIsAnimating(false), 300);
  }, [L, scale]);

  // Compute focal job for Follow mode (running -> failed -> on-hold -> selected -> first)
  const focalJob = useMemo(() => {
    if (!jobs.length) return null;
    const running = jobs.find((j) => j.status === 'Running' || j.status === 'RUNNING');
    if (running) return running;
    const failed = jobs.find((j) => j.status === 'Failed' || j.status === 'FAILED');
    if (failed) return failed;
    const onHold = jobs.find((j) => j.status === 'On hold' || j.status === 'ON HOLD');
    if (onHold) return onHold;
    if (selectedJob) {
      const sel = jobs.find((j) => j.name === selectedJob);
      if (sel) return sel;
    }
    return jobs.find((j) => j.status === 'Done') || jobs[0];
  }, [jobs, selectedJob]);

  // Auto-follow active execution node
  useEffect(() => {
    if (followActive && focalJob) {
      centerOnNode(focalJob.name);
    }
  }, [followActive, focalJob?.name, focalJob?.status, centerOnNode]);

  // Cursor-centric mouse wheel zoom with Ctrl/Meta requirement to preserve page scrolling
  const handleWheel = (e) => {
    // Zoom if holding Ctrl (or Cmd on Mac, or trackpad pinch gesture which sets ctrlKey: true)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Smooth damped exponential scaling: handles fast mouse wheel clicks & trackpad micro-ticks
      const delta = Math.max(-100, Math.min(100, e.deltaY));
      const factor = Math.exp(-delta * 0.0035);

      const minScale = 0.22;
      const maxScale = 2.5;
      const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));
      if (Math.abs(newScale - scale) < 0.001) return;

      // Anchor zoom directly at the mouse cursor
      const graphX = (mouseX - offset.x) / scale;
      const graphY = (mouseY - offset.y) / scale;

      const newOffsetX = mouseX - graphX * newScale;
      const newOffsetY = mouseY - graphY * newScale;

      setScale(newScale);
      setOffset({ x: Math.round(newOffsetX), y: Math.round(newOffsetY) });
    } else {
      // Normal wheel scrolling: do NOT preventDefault so user can scroll page up & down freely!
      // Show subtle transient guidance pill
      setShowScrollHint(true);
      if (scrollHintTimeoutRef.current) clearTimeout(scrollHintTimeoutRef.current);
      scrollHintTimeoutRef.current = setTimeout(() => setShowScrollHint(false), 1400);
    }
  };

  // Center-centric zoom button handlers
  const handleZoomBy = (direction) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const factor = direction > 0 ? 1.2 : 0.833;
    const minScale = 0.22;
    const maxScale = 2.5;
    const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));
    if (Math.abs(newScale - scale) < 0.001) return;

    const graphX = (centerX - offset.x) / scale;
    const graphY = (centerY - offset.y) / scale;

    const newOffsetX = centerX - graphX * newScale;
    const newOffsetY = centerY - graphY * newScale;

    setIsAnimating(true);
    setScale(newScale);
    setOffset({ x: Math.round(newOffsetX), y: Math.round(newOffsetY) });
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Mouse pan initiation
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    if (
      e.target.closest('.cr-node') ||
      e.target.closest('.cr-floating-toolbar') ||
      e.target.closest('.cr-minimap') ||
      e.target.closest('.cr-flow-status-banner') ||
      e.target.closest('.cr-flow-selection-bar') ||
      e.target.closest('.cr-flow-toolbar')
    ) {
      return;
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  // Global window listeners for smooth, bounded panning
  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e) => {
      const boxW = viewportRef.current?.clientWidth || 800;
      const boxH = viewportRef.current?.clientHeight || 500;
      const graphW = (L?.width || 800) * scale;
      const graphH = (L?.height || 600) * scale;

      const rawX = e.clientX - panStart.x;
      const rawY = e.clientY - panStart.y;

      // Soft boundary clamp so graph never gets lost
      const minX = -graphW + 120;
      const maxX = boxW - 120;
      const minY = -graphH + 80;
      const maxY = boxH - 80;

      const clampedX = Math.min(Math.max(rawX, minX), maxX);
      const clampedY = Math.min(Math.max(rawY, minY), maxY);

      setOffset({ x: Math.round(clampedX), y: Math.round(clampedY) });
    };

    const onUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isPanning, panStart, L, scale]);

  // Status counts for chips
  const doneCount = jobs.filter((j) => j.status === 'Done').length;
  const holdCount = jobs.filter((j) => j.status === 'On hold' || j.status === 'ON HOLD').length;
  const runningCount = jobs.filter((j) => j.status === 'Running' || j.status === 'RUNNING').length;
  const failedCount = jobs.filter((j) => j.status === 'Failed' || j.status === 'FAILED').length;

  const isRunningBatch = run?.status === 'Running' || run?.status === 'RUNNING';
  const isRunActive = isRunningBatch || isPaused || run?.status === 'Paused' || run?.status === 'PAUSED';

  const minimapVp = useMemo(() => {
    const vw = viewportRef.current?.clientWidth || 800;
    const vh = viewportRef.current?.clientHeight || 500;
    const gw = Math.max(1, L?.width || 1200);
    const gh = Math.max(1, L?.height || 800);

    const vpW = Math.min(100, Math.max(12, ((vw / scale) / gw) * 100));
    const vpH = Math.min(100, Math.max(12, ((vh / scale) / gh) * 100));
    const vpX = Math.min(100 - vpW, Math.max(0, ((-offset.x / scale) / gw) * 100));
    const vpY = Math.min(100 - vpH, Math.max(0, ((-offset.y / scale) / gh) * 100));

    return {
      left: `${vpX.toFixed(1)}%`,
      top: `${vpY.toFixed(1)}%`,
      width: `${vpW.toFixed(1)}%`,
      height: `${vpH.toFixed(1)}%`,
    };
  }, [offset.x, offset.y, scale, L?.width, L?.height]);

  if (!jobs.length && !allJobs.length) {
    return (
      <div className="cr-flow-container" ref={rootRef} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'var(--cr-text-muted)', maxWidth: '440px', padding: '40px 16px' }}>
          <CockpitIcon name="i-branch" className="xl" />
          <h3 style={{ fontSize: '18px', margin: '14px 0 6px', color: 'var(--cr-text)' }}>No Workflow Definition</h3>
          <p style={{ fontSize: '13px', lineHeight: 1.5 }}>
            No batch jobs to display. Upload a Control-M XML file to view the DAG dependency graph and execute batch runs.
          </p>
        </div>
      </div>
    );
  }

  const selectedJobData = selectedJob ? defIndex.get(selectedJob) : null;

  return (
    <div className="cr-flow-container" ref={rootRef}>
      {/* ── Summary Definition KPI Cards (Workflows, Jobs, Dependencies, etc. moved into Flow as requested) ── */}
      {stats && stats.length > 0 && (
        <div className="cr-flow-stats-header">
          <div className="eodw-stats">
            {stats.map(([label, value, tone]) => (
              <div
                key={label}
                className="eodw-stat"
                data-tone={tone && value > 0 ? tone : undefined}
              >
                <span className="eodw-stat-value">{value ?? 0}</span>
                <span className="eodw-stat-label">{label}</span>
              </div>
            ))}
          </div>

          {errors && errors.length > 0 && (
            <Problems title="Problems to fix" tone="bad" messages={errors} open />
          )}
          {warnings && warnings.length > 0 && (
            <Problems title="Notes and warnings" tone="warn" messages={warnings} />
          )}
        </div>
      )}

      {/* ── Flow Filters & Actions Bar ── */}
      <div className="cr-flow-toolbar">
        <div className="cr-flow-search-box">
          <CockpitIcon name="i-search" className="sm" />
          <input
            type="search"
            className="cr-search-input"
            placeholder="Search anything: name, command..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <kbd>/</kbd>
        </div>

        {folderOptions.length > 0 && (
          <div className="cr-flow-folder-select-wrap">
            <label className="cr-field-inline">
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cr-text-muted)' }}>Folder:</span>
              <select
                className="cr-select sm"
                value={selectedFolder || 'ALL'}
                onChange={(e) => setSelectedFolder(e.target.value)}
              >
                <option value="ALL">All Folders ({allJobs.length})</option>
                {folderOptions.map((fName) => {
                  const fJobs = allJobs.filter((j) => (j.folder || j.group) === fName).length;
                  return (
                    <option key={fName} value={fName}>
                      {fName} ({fJobs})
                    </option>
                  );
                })}
              </select>
            </label>
          </div>
        )}

        <div className="cr-flow-chips">
          {failedCount > 0 && (
            <button
              type="button"
              className={`cr-fchip st-failed ${statusFilter === 'Failed' ? 'is-active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'Failed' ? null : 'Failed')}
            >
              <CockpitIcon name="i-failed" className="xs" /> Failed <b>{failedCount}</b>
            </button>
          )}

          {runningCount > 0 && (
            <button
              type="button"
              className={`cr-fchip st-running ${statusFilter === 'Running' ? 'is-active' : ''}`}
              onClick={() => setStatusFilter(statusFilter === 'Running' ? null : 'Running')}
            >
              <CockpitIcon name="i-running" className="xs" /> Running <b>{runningCount}</b>
            </button>
          )}

          <button
            type="button"
            className={`cr-fchip st-hold ${statusFilter === 'On hold' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'On hold' ? null : 'On hold')}
          >
            <CockpitIcon name="i-hold" className="xs" /> On hold <b>{holdCount}</b>
          </button>

          <button
            type="button"
            className={`cr-fchip st-done ${statusFilter === 'Done' ? 'is-active' : ''}`}
            onClick={() => setStatusFilter(statusFilter === 'Done' ? null : 'Done')}
          >
            <CockpitIcon name="i-done" className="xs" /> Done <b>{doneCount}</b>
          </button>
        </div>
      </div>

      {/* ── Main Canvas Area with Drag & Pan ── */}
      <div
        className={`cr-canvas-viewport ${isPanning ? 'is-panning' : ''}`}
        ref={viewportRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
      >
        {/* ── Floating Zoom / Pan / Follow / Trace Toolbar (Inside Flow Grid) ── */}
        <div className="cr-floating-toolbar">
          <button type="button" className="cr-tool-btn" title="Zoom out" onClick={() => (typeof handleZoomBy === 'function' ? handleZoomBy(-1) : setScale((s) => Math.max(0.08, s / 1.3)))}>
            <CockpitIcon name="i-minus" className="sm" />
          </button>
          <span className="cr-zoom-text">{Math.round(scale * 100)}%</span>
          <button type="button" className="cr-tool-btn" title="Zoom in" onClick={() => (typeof handleZoomBy === 'function' ? handleZoomBy(1) : setScale((s) => Math.min(2.5, s * 1.3)))}>
            <CockpitIcon name="i-plus" className="sm" />
          </button>
          <button type="button" className="cr-tool-btn" title="Fit the whole batch (Fit to view)" onClick={fit}>
            <CockpitIcon name="i-fit" className="sm" />
          </button>
          <div className="cr-tool-divider" />
          <button
            type="button"
            className={`cr-tool-btn-text trace-btn ${traceChainActive ? 'is-active' : ''}`}
            onClick={() => {
              const next = !traceChainActive;
              setTraceChainActive(next);
              if (next && !selectedJob) {
                const target = focalJob?.name || jobs[0]?.name;
                if (target) onSelectJob(target);
              }
            }}
            title="Highlight upstream prerequisites and downstream dependents"
          >
            <span className="cr-dot-icon" /> Trace chain
          </button>
          <button
            type="button"
            className={`cr-tool-btn-text follow-btn ${followActive ? 'is-active' : ''}`}
            onClick={() => {
              const next = !followActive;
              setFollowActive(next);
              if (next && focalJob) {
                centerOnNode(focalJob.name);
              }
            }}
            title="Follow active running job automatically"
          >
            <span className="cr-crosshair-icon" /> Follow
          </button>
        </div>

        {/* ── Status Banners for Follow & Trace Chain (Inside Flow Grid) ── */}
        {followActive && focalJob && (
          <div className="cr-flow-status-banner following">
            <CockpitIcon name={focalJob.status === 'Running' ? 'i-running' : 'i-target'} className="xs" />
            <span>
              Following: <strong>{focalJob.name}</strong> ({focalJob.status})
            </span>
            <button
              type="button"
              className="cr-flow-banner-btn"
              onClick={() => centerOnNode(focalJob.name)}
              title="Snap to followed job"
            >
              Snap
            </button>
            <button
              type="button"
              className="cr-flow-banner-btn close"
              onClick={() => setFollowActive(false)}
              title="Stop following"
            >
              ✕
            </button>
          </div>
        )}

        {traceChainActive && (
          <div className="cr-flow-status-banner trace">
            <CockpitIcon name="i-branch" className="xs" />
            {selectedJob ? (
              <span>
                Trace chain for <strong>{selectedJob}</strong>: {chainSet ? chainSet.size : 1} connected jobs
              </span>
            ) : (
              <span>Trace Chain Active: Click any job to inspect its upstream & downstream dependencies</span>
            )}
            <button
              type="button"
              className="cr-flow-banner-btn close"
              onClick={() => setTraceChainActive(false)}
              title="Exit trace chain"
            >
              ✕
            </button>
          </div>
        )}
        {/* Left Level Axis Indicators */}
        <div
          className={`cr-level-axis ${isAnimating ? 'is-animating' : ''}`}
          style={{ transform: `translateY(${offset.y}px)` }}
        >
          {L?.rows?.map((row) => {
            const count = row.names.length;
            const yPos = row.y * scale;
            return (
              <div
                key={row.level}
                className="cr-axis-level"
                style={{ top: `${yPos}px`, height: `${26 * scale + 14}px` }}
              >
                <span className="cr-lvl-num">L{row.level}</span>
                {count > 1 && <span className="cr-lvl-multiplier">×{count}</span>}
              </div>
            );
          })}
        </div>

        {/* Transform Layer for Graph */}
        <div
          className={`cr-graph-transform ${isAnimating ? 'is-animating' : ''}`}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: `${L?.width || 1200}px`,
            height: `${L?.height || 800}px`,
          }}
        >
          {/* Parallel row tint backgrounds */}
          {L?.rows?.map((row) => {
            if (row.names.length <= 1) return null;
            const rowNodes = row.names.map((n) => L.nodes.get(n)).filter(Boolean);
            if (!rowNodes.length) return null;
            const minX = Math.min(...rowNodes.map((n) => n.x));
            const maxX = Math.max(...rowNodes.map((n) => n.x + n.w));
            const rowW = maxX - minX;
            return (
              <div
                key={`tint-${row.level}`}
                className="cr-parallel-row-tint"
                style={{
                  top: `${row.y - 6}px`,
                  height: `${26 + 12}px`,
                  left: `${minX - 10}px`,
                  width: `${rowW + 20}px`,
                  borderRadius: '6px',
                }}
              />
            );
          })}

          {/* SVG Dependency Edges */}
          <svg
            className="cr-edges-svg"
            width={L?.width || 1200}
            height={L?.height || 800}
          >
            {L?.edges?.map((e, idx) => {
              const hot = chainSet && chainSet.has(e.from) && chainSet.has(e.to);
              const dim = chainSet && !hot;
              return (
                <path
                  key={idx}
                  d={e.d}
                  className={`cr-edge-path ${hot ? 'hot' : ''} ${dim ? 'dim' : ''}`}
                />
              );
            })}
          </svg>

          {/* Job Nodes */}
          {Array.from(L?.nodes?.values() || []).map((n) => {
            const job = defIndex.get(n.name) || { name: n.name, status: 'Idle', folder: selectedFolder };
            const status = job.status || 'Idle';
            const matchesSearch = !searchQuery || n.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = !statusFilter || status === statusFilter;
            const isMatch = matchesSearch && matchesStatus;
            const isSelected = selectedJob === n.name;
            const isInChain = chainSet && chainSet.has(n.name);
            const isDim = chainSet ? !isInChain : (!isMatch);
            const isFollowing = followActive && focalJob?.name === n.name;

            return (
              <div
                key={n.name}
                className={`cr-node st-${status.toLowerCase().replace(/\s+/g, '-')} ${isSelected ? 'is-selected' : ''} ${isInChain ? 'is-in-chain' : ''} ${isDim ? 'is-dim' : ''} ${isFollowing ? 'is-following' : ''}`}
                style={{
                  left: `${n.x}px`,
                  top: `${n.y}px`,
                  width: `${n.w}px`,
                  height: `${n.h}px`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectJob(n.name);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onSelectJob(n.name);
                  if (onOpenDrawer) onOpenDrawer(n.name);
                }}
                title={`${n.name}\nLevel ${n.level} · Folder: ${job.folder || job.group || selectedFolder}\nStatus: ${status}\nPredecessors: ${job.predecessors?.length || 0} · Successors: ${job.successors?.length || 0}\n(Double-click for details & logs)`}
              >
                <CockpitIcon
                  name={
                    status === 'Done' ? 'i-done' :
                    status === 'On hold' ? 'i-hold' :
                    status === 'Running' ? 'i-running' :
                    status === 'Failed' ? 'i-failed' : 'i-waiting'
                  }
                  className="xs"
                />
                <span className="cr-node-name">{n.name}</span>
              </div>
            );
          })}
        </div>

        {/* ── Mini-Map (Bottom Right Inside Flow Grid) ── */}
        <div className="cr-minimap">
          <svg viewBox={`0 0 ${L?.width || 1200} ${L?.height || 800}`} className="cr-minimap-svg">
            {Array.from(L?.nodes?.values() || []).map((n) => (
              <rect
                key={n.name}
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                className="cr-minimap-node"
              />
            ))}
          </svg>
          <div
            className="cr-minimap-viewport"
            style={{
              top: `${Math.max(0, -offset.y / (L?.height || 1) * 70)}%`,
              left: `${Math.max(0, -offset.x / (L?.width || 1) * 70)}%`,
              width: '45%',
              height: '40%',
            }}
          />
        </div>
      </div>

      {/* ── Floating Node Selection Card ── */}
      {selectedJob && (
        <div className="cr-flow-selection-bar">
          <div className="cr-fsb-info">
            <span
              className={`cr-fsb-dot st-${(selectedJobData?.status || 'idle').toLowerCase().replace(/\s+/g, '-')}`}
            />
            <strong>{selectedJob}</strong>
            <span className="cr-fsb-meta">
              Folder: {selectedJobData?.folder || selectedJobData?.group || selectedFolder} · Level L{selectedJobData?.level || 1} · {selectedJobData?.predecessors?.length || 0} upstream, {selectedJobData?.successors?.length || 0} downstream
            </span>
          </div>
          <div className="cr-fsb-actions">
            <button
              type="button"
              className={`cr-btn sm ${traceChainActive ? 'primary' : 'outline'}`}
              onClick={() => setTraceChainActive(!traceChainActive)}
              title="Toggle chain tracing for this job"
            >
              <CockpitIcon name="i-branch" className="xs" />
              {traceChainActive ? 'Tracing Chain' : 'Trace Chain'}
            </button>
            {onOpenDrawer && (
              <button
                type="button"
                className="cr-btn sm primary"
                onClick={() => onOpenDrawer(selectedJob)}
                title="Open slide-out drawer with run logs and operator actions"
              >
                Inspect Details & Logs
              </button>
            )}
            <button
              type="button"
              className="cr-btn sm outline"
              onClick={() => onSelectJob(null)}
              title="Deselect this job"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* ── Mini-Map (Bottom Right) ── */}
      <div className="cr-minimap">
        <svg viewBox={`0 0 ${L?.width || 1200} ${L?.height || 800}`} className="cr-minimap-svg">
          {Array.from(L?.nodes?.values() || []).map((n) => (
            <rect
              key={n.name}
              x={n.x}
              y={n.y}
              width={n.w}
              height={n.h}
              className="cr-minimap-node"
            />
          ))}
        </svg>
        <div
          className="cr-minimap-viewport"
          style={minimapVp}
        />
      </div>

      {/* ── Scroll vs Zoom guidance hint ── */}
      {showScrollHint && (
        <div className="cr-scroll-hint">
          Ctrl + Scroll to zoom · Drag to pan
        </div>
      )}
      {/* ── Bottom Legend Strip ── */}
      <footer className="cr-flow-legend">
        <span className="cr-fl-item"><i className="cr-badge-chip hold">HOLD</i> On hold</span>
        <span className="cr-fl-item"><i className="cr-badge-chip sim">SIM</i> Pretend to run</span>
        <span className="cr-fl-item"><i className="cr-badge-chip done">✓</i> Done straight away</span>
        <span className="cr-fl-item"><span className="cr-tint-sample" /> Tinted row = jobs that can run together (×N)</span>
        <span className="cr-fl-item">Plain row = one job at a time</span>
        <span className="cr-fl-item mute">Rows = dependency steps, not time</span>
      </footer>
    </div>
  );
}

export default CockpitFlow;
