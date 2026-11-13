import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  useReactFlow,
  useNodesInitialized,
  ReactFlowProvider,
} from '@xyflow/react';
import { layout as dagreLayout, graphlib } from '@dagrejs/dagre';
import {
  Search,
  Maximize2,
  GitFork,
  ArrowRight,
  ArrowDown,
  Layers,
  Spline,
  Loader2,
  Square,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { JobNode } from './JobNode';
import { WorkflowGroupNode } from './WorkflowGroupNode';
import { edgeStyle, formatDuration, secondsBetween } from '../schedulerModel';
import { buildExecutionPlan } from './jobExecutionEngine';
import { eodSchedulerService as svc } from '@services/eodSchedulerService';

import '@xyflow/react/dist/style.css';
import './DependencyGraph.css';

const NODE_WIDTH = 230;
const NODE_HEIGHT = 80;

const nodeTypes = {
  jobNode: JobNode,
  workflowGroup: WorkflowGroupNode,
};

// Box drawn around each workflow in the "All workflows" graph
const GROUP_PAD = 28;
const GROUP_HEAD = 64;
const GROUP_COLORS = ['#0284c7', '#7c3aed', '#059669', '#d97706', '#db2777', '#0d9488'];

const TONE_COLORS = {
  good: '#16a34a',
  run: '#0284c7',
  bad: '#ef4444',
  wait: '#f59e0b',
  off: '#94a3b8',
  idle: '#cbd5e1',
};

/** Compute upstream closure (all recursive prerequisites) */
function getUpstreamClosure(startId, predsMap) {
  const result = new Set();
  const queue = [startId];
  while (queue.length > 0) {
    const curr = queue.shift();
    const preds = predsMap.get(curr) || [];
    for (const p of preds) {
      if (!result.has(p)) {
        result.add(p);
        queue.push(p);
      }
    }
  }
  return result;
}

/** Compute downstream closure (all recursive successors) */
function getDownstreamClosure(startId, succsMap) {
  const result = new Set();
  const queue = [startId];
  while (queue.length > 0) {
    const curr = queue.shift();
    const succs = succsMap.get(curr) || [];
    for (const s of succs) {
      if (!result.has(s)) {
        result.add(s);
        queue.push(s);
      }
    }
  }
  return result;
}

function DependencyGraphCanvas({
  graph,
  jobs = [],
  detail = null,
  states = {},
  selected,
  onSelect,
  isAllWorkflows = false,
  env,
  folder,
  onRunRecorded,
  onViewLogs,
  allowExecute = true, // false: no per-job play button (the Cockpit shows real runs only, never simulated ones)
  dimmed = null, // Set of job ids to fade (a search or a status filter outside the graph)
  followId = null, // job id the view should keep centred on (Follow)
  onOpenDetails = null, // called with the job id on double click
}) {
  const reactFlowInstance = useReactFlow();
  const [direction, setDirection] = useState('TB'); // 'TB' or 'LR'
  const [edgeType, setEdgeType] = useState('bezier'); // 'bezier' or 'smoothstep'
  const [searchQuery, setSearchQuery] = useState('');
  const [traceActive, setTraceActive] = useState(false);

  // In-memory execution state overrides for real-time play execution
  const [execStates, setExecStates] = useState({});
  const [executingPlan, setExecutingPlan] = useState(null);
  const execAbortRef = useRef(false);

  // Merged states: backend run statuses overlaid with live independent execution states
  const effectiveStates = useMemo(() => {
    return { ...states, ...execStates };
  }, [states, execStates]);

  // Index jobs by name for rich metadata (command, target, folder, etc.)
  const jobsByName = useMemo(() => {
    const map = new Map();
    for (const j of jobs) map.set(j.name, j);
    return map;
  }, [jobs]);

  // Index run job details (duration, timestamps, exit code)
  const runJobsByName = useMemo(() => {
    const map = new Map();
    for (const rj of detail?.jobs || []) {
      map.set(rj.job, rj);
    }
    return map;
  }, [detail]);

  // Adjacency maps for chain tracing & dependency resolution
  const { predsMap, succsMap } = useMemo(() => {
    const preds = new Map();
    const succs = new Map();
    for (const n of graph?.nodes || []) {
      preds.set(n.id, []);
      succs.set(n.id, []);
    }
    for (const e of graph?.edges || []) {
      if (!preds.has(e.target)) preds.set(e.target, []);
      preds.get(e.target).push(e.source);
      if (!succs.has(e.source)) succs.set(e.source, []);
      succs.get(e.source).push(e.target);
    }
    return { predsMap: preds, succsMap: succs };
  }, [graph]);

  // Cancel in-flight execution
  const cancelExecution = useCallback(() => {
    execAbortRef.current = true;
    setExecutingPlan((prev) =>
      prev ? { ...prev, isRunning: false, error: 'Execution stopped by user.' } : null,
    );
  }, []);

  // Independent Job Execution Engine Handler
  const handleExecuteJob = useCallback(
    async (targetJobId, { simulateFailure = false } = {}) => {
      // 6. Prevent duplicate execution of jobs that are already running
      if (executingPlan?.isRunning) {
        return;
      }
      const targetTone = effectiveStates?.[targetJobId]?.tone;
      if (targetTone === 'run') {
        return;
      }

      // 1. Identify Dependencies & 3. Avoid Unnecessary Execution
      const plan = buildExecutionPlan(targetJobId, predsMap, effectiveStates);

      const jobsToExecute = plan.toRun.length > 0 ? plan.toRun : [targetJobId];
      const wavesToExecute = plan.waves.length > 0 ? plan.waves : [[targetJobId]];

      // Set all required uncompleted jobs to Pending
      setExecStates((prev) => {
        const next = { ...prev };
        for (const j of jobsToExecute) {
          next[j] = { label: 'Pending', tone: 'wait' };
        }
        return next;
      });

      const runStartedAt = new Date().toISOString();
      const executedJobsMap = new Map();

      execAbortRef.current = false;
      setExecutingPlan({
        targetJobId,
        currentWaveIndex: 0,
        totalWaves: wavesToExecute.length,
        activeJobs: [],
        isRunning: true,
        error: null,
      });

      let failedJob = null;

      // 2. Execute in Dependency Order (Wave by wave)
      for (let w = 0; w < wavesToExecute.length; w += 1) {
        if (execAbortRef.current) break;

        const wave = wavesToExecute[w];
        setExecutingPlan((prev) => ({
          ...prev,
          currentWaveIndex: w + 1,
          activeJobs: wave,
        }));

        // Set jobs in current wave to Running
        const startTime = Date.now();
        setExecStates((prev) => {
          const next = { ...prev };
          for (const j of wave) {
            next[j] = { label: 'Running', tone: 'run' };
          }
          return next;
        });

        // Execute all parallel jobs in this wave concurrently
        const wavePromises = wave.map(async (jobId) => {
          const jobStartTime = new Date().toISOString();
          // Realistic execution timing (1.2s to 1.8s)
          const runMs = 1200 + Math.floor(Math.random() * 600);
          await new Promise((r) => setTimeout(r, runMs));

          if (execAbortRef.current) {
            throw new Error('Cancelled');
          }

          const jobEndTime = new Date().toISOString();
          const durationSec = Math.round(runMs / 100) / 10;
          // Support failure testing on Shift+Click
          const isFailed = simulateFailure && (jobId === wave[0] || jobId !== targetJobId);

          return {
            jobId,
            ok: !isFailed,
            durationSec,
            duration: `${durationSec}s`,
            startedAt: jobStartTime,
            endedAt: jobEndTime,
          };
        });

        let results;
        try {
          results = await Promise.all(wavePromises);
        } catch {
          break; // Cancelled
        }

        for (const res of results) {
          const jobMeta = jobsByName.get(res.jobId);
          const targetHost =
            jobMeta?.target?.target_name ||
            (jobMeta?.target?.host
              ? `${jobMeta.target.username ? `${jobMeta.target.username}@` : ''}${jobMeta.target.host}`
              : null);
          executedJobsMap.set(res.jobId, {
            job: res.jobId,
            status: res.ok ? 'SUCCESS' : 'FAILED',
            duration: res.durationSec,
            exit_code: res.ok ? 0 : 1,
            started: res.startedAt,
            ended: res.endedAt,
            reason: res.ok ? '' : 'Execution simulated failure',
            target: targetHost || 'LOCAL',
            command: jobMeta?.command || '',
          });
        }

        // 5. Handle Failures: Stop dependent execution, mark remaining as blocked
        const failedResult = results.find((r) => !r.ok);
        if (failedResult) {
          failedJob = failedResult.jobId;

          setExecStates((prev) => {
            const next = { ...prev };
            next[failedJob] = {
              label: 'Failed',
              tone: 'bad',
              duration: failedResult.duration,
            };

            // Mark all downstream dependent jobs as Blocked
            for (let nextW = w + 1; nextW < wavesToExecute.length; nextW += 1) {
              for (const blockedJob of wavesToExecute[nextW]) {
                next[blockedJob] = {
                  label: 'Blocked',
                  tone: 'bad',
                  reason: `Prerequisite ${failedJob} failed`,
                };
              }
            }
            return next;
          });

          for (let nextW = w + 1; nextW < wavesToExecute.length; nextW += 1) {
            for (const blockedJob of wavesToExecute[nextW]) {
              const jobMeta = jobsByName.get(blockedJob);
              executedJobsMap.set(blockedJob, {
                job: blockedJob,
                status: 'BLOCKED',
                duration: 0,
                exit_code: null,
                reason: `Prerequisite ${failedJob} failed`,
                command: jobMeta?.command || '',
              });
            }
          }

          setExecutingPlan((prev) => ({
            ...prev,
            isRunning: false,
            error: `Prerequisite "${failedJob}" failed. Execution of "${targetJobId}" blocked.`,
          }));
          break;
        }

        // 4. Update Completed status
        setExecStates((prev) => {
          const next = { ...prev };
          const waveDuration = `${Math.round((Date.now() - startTime) / 100) / 10}s`;
          for (const res of results) {
            next[res.jobId] = { label: 'Success', tone: 'good', duration: waveDuration };
          }
          return next;
        });
      }

      // Persist run and job logs to backend so they appear in Runs / Logs tab
      const runEndedAt = new Date().toISOString();
      const overallStatus = failedJob ? 'FAILED' : 'SUCCESS';
      const executedJobsList = Array.from(executedJobsMap.values());

      const targetNode = graph?.nodes?.find((n) => n.id === targetJobId);
      const targetJobMeta = jobsByName.get(targetJobId);
      const resolvedFolder =
        targetJobMeta?.folder ||
        targetNode?.data?.job?.folder ||
        folder ||
        (isAllWorkflows ? 'ALL_WORKFLOWS' : 'DEFAULT');

      let recordedRunId = null;
      if (env && executedJobsList.length > 0) {
        try {
          const res = await svc.recordExecution(env, {
            folder: resolvedFolder,
            target_job: targetJobId,
            status: overallStatus,
            started: runStartedAt,
            ended: runEndedAt,
            jobs: executedJobsList,
            all_jobs: (graph?.nodes || []).map((n) => n.id),
          });
          if (res?.run_id) {
            recordedRunId = res.run_id;
            onRunRecorded?.(res.run_id);
          }
        } catch (err) {
          console.error('Failed to record execution to backend:', err);
        }
      }

      setExecutingPlan((prev) => ({
        ...prev,
        isRunning: false,
        isCompleted: !failedJob && !execAbortRef.current,
        activeJobs: [],
        recordedRunId,
        targetJobId,
      }));
    },
    [
      predsMap,
      effectiveStates,
      executingPlan?.isRunning,
      jobsByName,
      graph?.nodes,
      folder,
      isAllWorkflows,
      env,
      onRunRecorded,
    ],
  );

  // Set of nodes in the trace chain if tracing is active
  const chainSet = useMemo(() => {
    if (!traceActive || !selected) return null;
    const up = getUpstreamClosure(selected, predsMap);
    const down = getDownstreamClosure(selected, succsMap);
    return new Set([selected, ...up, ...down]);
  }, [traceActive, selected, predsMap, succsMap]);

  // 1. STABLE LAYOUT: Compute Dagre coordinates ONLY when graph or layout direction changes
  const layoutPositions = useMemo(() => {
    if (!graph?.nodes?.length) return new Map();

    const g = new graphlib.Graph();
    g.setGraph({
      rankdir: direction,
      ranksep: direction === 'LR' ? 95 : 85,
      nodesep: isAllWorkflows ? 110 : direction === 'LR' ? 50 : 60,
      marginx: 35,
      marginy: 35,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const n of graph.nodes) {
      g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    for (const e of graph.edges || []) {
      if (g.hasNode(e.source) && g.hasNode(e.target)) {
        g.setEdge(e.source, e.target);
      }
    }

    dagreLayout(g);

    const posMap = new Map();
    for (const n of graph.nodes) {
      const p = g.node(n.id) || { x: 0, y: 0 };
      posMap.set(n.id, {
        x: p.x - NODE_WIDTH / 2,
        y: p.y - NODE_HEIGHT / 2,
      });
    }
    return posMap;
  }, [graph, direction, isAllWorkflows]);

  // 2. STABLE NODES: Form nodes using computed layoutPositions
  const nodes = useMemo(() => {
    if (!graph?.nodes?.length) return [];

    return graph.nodes.map((n) => {
      const pos = layoutPositions.get(n.id) || { x: 0, y: 0 };
      const job = jobsByName.get(n.id) || (n.folder ? { name: n.id, folder: n.folder } : null);
      const rj = runJobsByName.get(n.id) || null;
      const state = effectiveStates?.[n.id] || null;

      let durationStr = state?.duration || null;
      if (!durationStr && rj) {
        if (rj.duration_seconds != null) {
          durationStr = formatDuration(rj.duration_seconds);
        } else if (rj.started && rj.ended) {
          durationStr = formatDuration(secondsBetween(rj.started, rj.ended));
        }
      }

      const isHot = chainSet ? chainSet.has(n.id) : selected === n.id;
      const isDim = chainSet ? !isHot : Boolean(dimmed && dimmed.has(n.id));

      return {
        id: n.id,
        type: 'jobNode',
        position: pos,
        selected: selected === n.id,
        data: {
          id: n.id,
          job,
          state,
          duration: durationStr,
          direction,
          isHot,
          isDim,
          isAllWorkflows,
          onExecuteJob: allowExecute ? handleExecuteJob : undefined,
        },
      };
    });
  }, [
    graph,
    layoutPositions,
    jobsByName,
    runJobsByName,
    effectiveStates,
    selected,
    chainSet,
    direction,
    isAllWorkflows,
    handleExecuteJob,
    allowExecute,
    dimmed,
  ]);

  // One labelled box per workflow behind its jobs (only when several workflows are shown together)
  const groupNodes = useMemo(() => {
    if (!isAllWorkflows || !graph?.nodes?.length) return [];
    const byFolder = new Map();
    for (const n of graph.nodes) {
      const name = jobsByName.get(n.id)?.folder || n.folder;
      const pos = layoutPositions.get(n.id);
      if (!name || !pos) continue;
      const g = byFolder.get(name) || {
        minX: Infinity,
        minY: Infinity,
        maxX: -Infinity,
        maxY: -Infinity,
        ids: [],
      };
      g.minX = Math.min(g.minX, pos.x);
      g.minY = Math.min(g.minY, pos.y);
      g.maxX = Math.max(g.maxX, pos.x);
      g.maxY = Math.max(g.maxY, pos.y);
      g.ids.push(n.id);
      byFolder.set(name, g);
    }
    if (byFolder.size < 2) return [];
    return [...byFolder.entries()].map(([name, g], i) => ({
      id: `group:${name}`,
      type: 'workflowGroup',
      position: { x: g.minX - GROUP_PAD, y: g.minY - GROUP_PAD - GROUP_HEAD },
      draggable: false,
      selectable: false,
      focusable: false,
      style: {
        width: g.maxX - g.minX + NODE_WIDTH + GROUP_PAD * 2,
        height: g.maxY - g.minY + NODE_HEIGHT + GROUP_PAD * 2 + GROUP_HEAD,
        pointerEvents: 'none',
      },
      data: {
        title: name,
        total: g.ids.length,
        done: g.ids.filter((id) => effectiveStates?.[id]?.tone === 'good').length,
        color: GROUP_COLORS[i % GROUP_COLORS.length],
      },
    }));
  }, [isAllWorkflows, graph, layoutPositions, jobsByName, effectiveStates]);
  const allNodes = useMemo(() => [...groupNodes, ...nodes], [groupNodes, nodes]);

  // 3. STABLE EDGES: Form edges with Bezier routing and on-failure badges
  const edges = useMemo(() => {
    if (!graph?.edges?.length) return [];

    return graph.edges.map((e) => {
      const { tone, dashed } = edgeStyle(e);
      const edgeId = e.id || `${e.source}->${e.target}`;
      const isHot = chainSet ? chainSet.has(e.source) && chainSet.has(e.target) : false;
      const touchesSelected = selected && (e.source === selected || e.target === selected);
      const activeHighlight = touchesSelected || isHot;

      const sourceState = effectiveStates?.[e.source]?.tone;
      const isRunning = sourceState === 'run';

      let strokeColor = '#64748b'; // clear slate for dependencies
      if (tone === 'info') strokeColor = '#0284c7';
      else if (tone === 'danger') strokeColor = '#ef4444';

      const isDim = (chainSet && !isHot) || (selected && !touchesSelected);
      const isFailureBranch = e.branch === 'FAILURE';

      return {
        id: edgeId,
        source: e.source,
        target: e.target,
        type: edgeType,
        animated: isRunning,
        zIndex: activeHighlight ? 10 : 1,
        className: `${activeHighlight ? 'is-connected' : ''} ${isDim ? 'is-dim' : ''}`,
        style: {
          stroke: activeHighlight ? (tone === 'danger' ? '#ef4444' : '#0284c7') : strokeColor,
          strokeWidth: activeHighlight ? 3.0 : 1.7,
          strokeDasharray: dashed ? '6 4' : undefined,
          opacity: isDim ? 0.18 : 1,
        },
        label: isFailureBranch ? 'on failure' : undefined,
        labelStyle: {
          fill: '#ef4444',
          fontWeight: 700,
          fontSize: 10,
        },
        labelBgStyle: {
          fill: 'var(--surface-primary, #ffffff)',
          fillOpacity: 0.95,
          stroke: '#ef4444',
          strokeWidth: 1,
          rx: 4,
          ry: 4,
        },
        labelBgPadding: [4, 3],
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: activeHighlight ? (tone === 'danger' ? '#ef4444' : '#0284c7') : strokeColor,
          width: 16,
          height: 16,
        },
      };
    });
  }, [graph, edgeType, effectiveStates, selected, chainSet]);

  // Fit view ONLY when graph signature or direction changes
  const graphSignature = `${graph?.nodes?.length || 0}-${graph?.edges?.length || 0}-${direction}`;
  // ... and once every node has been measured (the workflow boxes only get their size after the first paint)
  const nodesInitialized = useNodesInitialized();
  useEffect(() => {
    const timer = setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.15, duration: 250 });
    }, 60);
    return () => clearTimeout(timer);
  }, [graphSignature, nodesInitialized, reactFlowInstance]);

  // Node click handler
  const handleNodeClick = useCallback(
    (_, node) => {
      if (node.type === 'workflowGroup') return;
      onSelect?.(node.id);
    },
    [onSelect],
  );

  // Follow: keep the view centred on one job (for example the one that is running)
  useEffect(() => {
    if (!followId) return;
    const pos = layoutPositions.get(followId);
    if (!pos) return;
    reactFlowInstance.setCenter(pos.x + NODE_WIDTH / 2, pos.y + NODE_HEIGHT / 2, {
      zoom: 1.0,
      duration: 400,
    });
  }, [followId, layoutPositions, reactFlowInstance]);

  const handleNodeDoubleClick = useCallback(
    (_, node) => {
      onOpenDetails?.(node.id);
    },
    [onOpenDetails],
  );

  // Search handler
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (!val.trim()) return;

    const match = nodes.find((n) => n.id.toLowerCase().includes(val.trim().toLowerCase()));
    if (match) {
      onSelect?.(match.id);
      reactFlowInstance.setCenter(
        match.position.x + NODE_WIDTH / 2,
        match.position.y + NODE_HEIGHT / 2,
        { zoom: 1.0, duration: 500 },
      );
    }
  };

  const handleFitView = () => {
    reactFlowInstance.fitView({ padding: 0.15, duration: 400 });
  };

  const toggleDirection = () => {
    setDirection((d) => (d === 'LR' ? 'TB' : 'LR'));
  };

  const toggleEdgeType = () => {
    setEdgeType((t) => (t === 'bezier' ? 'smoothstep' : 'bezier'));
  };

  const nodeColor = useCallback(
    (n) => {
      if (n.type === 'workflowGroup') return 'transparent';
      const stateTone = effectiveStates?.[n.id]?.tone || 'idle';
      return TONE_COLORS[stateTone] || '#cbd5e1';
    },
    [effectiveStates],
  );

  if (!graph?.nodes?.length) {
    return (
      <div className="rf-graph-container">
        <div className="rf-empty-graph">
          <Layers size={28} />
          <p>This workflow has no jobs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rf-graph-container">
      {/* ── Top Floating Overlay Toolbar ── */}
      <div className="rf-graph-toolbar">
        <div className="rf-toolbar-left">
          {/* Search Box */}
          <div className="rf-search-box">
            <Search size={13} />
            <input
              type="text"
              placeholder="Find job in flow…"
              value={searchQuery}
              onChange={handleSearchChange}
              aria-label="Search jobs in canvas"
            />
            {searchQuery ? (
              <button
                type="button"
                className="rf-search-clear"
                onClick={() => setSearchQuery('')}
                title="Clear search"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Trace Chain Toggle */}
          <button
            type="button"
            className={`rf-btn-toggle ${traceActive ? 'is-active' : ''}`}
            onClick={() => setTraceActive((v) => !v)}
            title="Highlight entire upstream and downstream chain for the selected job"
          >
            <GitFork size={12} />
            <span>Trace Chain</span>
          </button>

          {/* Curve Type Toggle: Curves vs Steps */}
          <button
            type="button"
            className="rf-btn-toggle"
            onClick={toggleEdgeType}
            title={
              edgeType === 'bezier'
                ? 'Switch to orthogonal stepped lines'
                : 'Switch to smooth curves'
            }
          >
            <Spline size={12} />
            <span>{edgeType === 'bezier' ? 'Curves' : 'Steps'}</span>
          </button>

          {/* Orientation Toggle: TB vs LR */}
          <button
            type="button"
            className="rf-btn-toggle"
            onClick={toggleDirection}
            title={`Switch to ${direction === 'LR' ? 'Top-to-Bottom' : 'Left-to-Right'} layout`}
          >
            {direction === 'LR' ? <ArrowRight size={12} /> : <ArrowDown size={12} />}
            <span>{direction}</span>
          </button>

          {/* Fit View */}
          <button
            type="button"
            className="rf-btn-toggle"
            onClick={handleFitView}
            title="Fit canvas to view"
          >
            <Maximize2 size={12} />
            <span>Fit</span>
          </button>
        </div>

        {/* Legend */}
        <div className="rf-toolbar-right" aria-hidden="true">
          <span className="rf-legend-item">
            <span className="rf-legend-line rf-edge-info" />
            <span>condition</span>
          </span>
          <span className="rf-legend-item">
            <span className="rf-legend-line rf-edge-danger" />
            <span>on failure</span>
          </span>
          <span className="rf-legend-item">
            <span className="rf-legend-line rf-edge-muted" />
            <span>dependency</span>
          </span>
        </div>
      </div>

      {/* ── Real-Time Execution Status Banner ── */}
      {executingPlan && (
        <div
          className={`rf-execution-banner ${executingPlan.error ? 'is-failed' : executingPlan.isCompleted ? 'is-success' : ''}`}
        >
          {executingPlan.isRunning ? (
            <>
              <Loader2 size={14} className="rf-spin" color="#0284c7" />
              <div className="rf-exec-details">
                <span>
                  Executing <strong>{executingPlan.targetJobId}</strong> (Wave{' '}
                  {executingPlan.currentWaveIndex}/{executingPlan.totalWaves}): [
                  {executingPlan.activeJobs.join(', ')}] running…
                </span>
              </div>
              <button
                type="button"
                className="rf-exec-stop-btn"
                onClick={cancelExecution}
                title="Stop execution"
              >
                <Square size={10} fill="currentColor" />
                <span>Stop</span>
              </button>
            </>
          ) : executingPlan.error ? (
            <>
              <AlertCircle size={14} color="#ef4444" />
              <span>{executingPlan.error}</span>
              {executingPlan.recordedRunId && onViewLogs ? (
                <button
                  type="button"
                  className="rf-exec-view-logs"
                  onClick={() => onViewLogs(executingPlan.recordedRunId)}
                  title="View this run and failure logs in the Runs tab"
                >
                  View in Logs Tab →
                </button>
              ) : null}
              <button
                type="button"
                className="rf-search-clear"
                onClick={() => setExecutingPlan(null)}
                title="Dismiss"
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <CheckCircle2 size={14} color="#16a34a" />
              <span>
                Job <strong>{executingPlan.targetJobId}</strong> and all required dependencies
                completed successfully!
              </span>
              {executingPlan.recordedRunId && onViewLogs ? (
                <button
                  type="button"
                  className="rf-exec-view-logs"
                  onClick={() => onViewLogs(executingPlan.recordedRunId)}
                  title="View this run and logs in the Runs tab"
                >
                  View in Logs Tab →
                </button>
              ) : null}
              <button
                type="button"
                className="rf-search-clear"
                onClick={() => setExecutingPlan(null)}
                title="Dismiss"
              >
                ✕
              </button>
            </>
          )}
        </div>
      )}

      {/* ── React Flow Core Canvas ── */}
      <ReactFlow
        nodes={allNodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={onOpenDetails ? handleNodeDoubleClick : undefined}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.06}
        maxZoom={2.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant="dots" gap={16} size={1} color="var(--border-tertiary, #cbd5e1)" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={nodeColor}
          nodeStrokeWidth={2}
          zoomable
          pannable
          style={{ width: 140, height: 90 }}
        />
      </ReactFlow>
    </div>
  );
}

export function DependencyGraph(props) {
  return (
    <ReactFlowProvider>
      <DependencyGraphCanvas {...props} />
    </ReactFlowProvider>
  );
}

export default DependencyGraph;
