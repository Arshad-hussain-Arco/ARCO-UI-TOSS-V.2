import { useState, useMemo, useEffect } from 'react';
import { CockpitIcon } from './IconSprite';
import { DependencyGraph } from '../scheduler/components/DependencyGraph';
import {
  cockpitNodeStates,
  graphFromJobs,
  groupMessages,
  mergeFolderGraphs,
} from '../scheduler/schedulerModel';
import './CockpitFlowGraph.css';

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

const statusIs = (job, ...names) => names.includes(job.status);

/**
 * The Flow tab of the Control Run Cockpit. The graph is the SAME component as the Workflow tab (DependencyGraph), coloured by the status
 * of the run chosen in the Cockpit; this file only feeds it (workflow filter, search and status filter, follow) and keeps the Cockpit's
 * own selection bar and details drawer.
 */
export function CockpitFlow({
  definition,
  run,
  onSelectJob,
  selectedJob,
  onOpenDrawer,
  folders = [],
  initialFolder = null,
  onClearFolderFilter,
  stats = [],
  errors = [],
  onPlayJob = null,
  playBusyId = '',
  playBlockedReason = '',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(() => initialFolder || 'ALL');
  const [followActive, setFollowActive] = useState(false);

  useEffect(() => {
    if (initialFolder) {
      setSelectedFolder(initialFolder);
      if (onClearFolderFilter) onClearFolderFilter();
    }
  }, [initialFolder, onClearFolderFilter]);

  const activeFolders = useMemo(
    () => (folders && folders.length > 0 ? folders : run?.folders) || [],
    [folders, run],
  );

  // The workflow definition with the live statuses of the chosen run laid over it, and every job's predecessors and successors.
  const allJobs = useMemo(() => {
    const runJobMap = new Map((run?.jobs || []).map((j) => [j.name, j]));

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

    // Always show the full definition with run statuses overlaid; jobs only the run knows (dynamic or past runs) are added too.
    const defJobs = definition?.jobs || [];
    const defJobNames = new Set(defJobs.map((j) => j.name));
    const extraRunJobs = (run?.jobs || []).filter((rj) => !defJobNames.has(rj.name));
    const baseList = [...defJobs, ...extraRunJobs];
    const effectiveBase = baseList.length > 0 ? baseList : run?.jobs || [];

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

    for (const j of rawList) {
      if (!predsMap.has(j.name)) predsMap.set(j.name, new Set());
      for (const p of j.predecessors || []) predsMap.get(j.name).add(p);
      if (!succsMap.has(j.name)) succsMap.set(j.name, new Set());
      for (const s of j.successors || []) succsMap.get(j.name).add(s);
    }
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
  }, [definition, run, activeFolders]);

  const folderOptions = useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const f of activeFolders) {
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
  }, [activeFolders, allJobs]);

  const isAll = !selectedFolder || selectedFolder === 'ALL';
  const jobs = useMemo(() => {
    if (isAll) return allJobs;
    const filtered = allJobs.filter((j) => (j.folder || j.group) === selectedFolder);
    return filtered.length > 0 ? filtered : allJobs;
  }, [allJobs, selectedFolder, isAll]);

  // The graph of the Workflow tab: the review's own dependency graph per workflow; jobs that only the run knows are added from their predecessors.
  const graph = useMemo(() => {
    const scoped = isAll
      ? activeFolders
      : activeFolders.filter((f) => (f.folder || f.name) === selectedFolder);
    let g;
    if (scoped.length === 1 && scoped[0].graph?.nodes?.length) g = scoped[0].graph;
    else g = mergeFolderGraphs(scoped);
    if (!g.nodes.length) return graphFromJobs(jobs);
    const have = new Set(g.nodes.map((n) => n.id));
    const extra = jobs.filter((j) => !have.has(j.name));
    if (!extra.length) return g;
    const added = graphFromJobs(
      jobs.filter(
        (j) => !have.has(j.name) || extra.some((x) => (j.predecessors || []).includes(x.name)),
      ),
    );
    return {
      nodes: [...g.nodes, ...added.nodes.filter((n) => !have.has(n.id))],
      edges: [...g.edges, ...added.edges.filter((e) => !have.has(e.source) || !have.has(e.target))],
    };
  }, [activeFolders, selectedFolder, isAll, jobs]);

  const states = useMemo(() => cockpitNodeStates(jobs), [jobs]);
  const detail = useMemo(
    () => ({
      jobs: jobs.map((j) => ({
        job: j.name,
        duration_seconds: j.duration_seconds,
        started: j.started_at,
        ended: j.ended_at,
      })),
    }),
    [jobs],
  );

  // Search and status chips fade the jobs that do not match
  const dimmed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q && !statusFilter) return null;
    const out = new Set();
    for (const j of jobs) {
      const matchesSearch =
        !q ||
        j.name.toLowerCase().includes(q) ||
        String(j.command || '')
          .toLowerCase()
          .includes(q);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'Skipped'
          ? statusIs(j, 'Skipped', 'SKIPPED', 'Skip', 'off')
          : statusFilter === 'Done'
          ? statusIs(j, 'Done')
          : statusFilter === 'On hold'
          ? statusIs(j, 'On hold', 'ON HOLD')
          : statusFilter === 'Running'
          ? statusIs(j, 'Running', 'RUNNING')
          : statusFilter === 'Failed'
          ? statusIs(j, 'Failed', 'FAILED')
          : j.status === statusFilter);
      if (!(matchesSearch && matchesStatus)) out.add(j.name);
    }
    return out;
  }, [jobs, searchQuery, statusFilter]);

  // Follow mode: the running job, else a failed one, else one on hold, else the selected one
  const focalJob = useMemo(() => {
    if (!jobs.length) return null;
    return (
      jobs.find((j) => statusIs(j, 'Running', 'RUNNING')) ||
      jobs.find((j) => statusIs(j, 'Failed', 'FAILED')) ||
      jobs.find((j) => statusIs(j, 'On hold', 'ON HOLD')) ||
      (selectedJob ? jobs.find((j) => j.name === selectedJob) : null) ||
      jobs.find((j) => statusIs(j, 'Done')) ||
      jobs[0]
    );
  }, [jobs, selectedJob]);

  const doneCount = jobs.filter((j) => statusIs(j, 'Done')).length;
  const holdCount = jobs.filter((j) => statusIs(j, 'On hold', 'ON HOLD')).length;
  const skippedCount = jobs.filter((j) => statusIs(j, 'Skipped', 'SKIPPED', 'Skip', 'off')).length;
  const runningCount = jobs.filter((j) => statusIs(j, 'Running', 'RUNNING')).length;
  const failedCount = jobs.filter((j) => statusIs(j, 'Failed', 'FAILED')).length;

  if (!jobs.length && !allJobs.length) {
    return (
      <div
        className="cr-flow-container"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div
          style={{
            textAlign: 'center',
            color: 'var(--cr-text-muted)',
            maxWidth: '440px',
            padding: '40px 16px',
          }}
        >
          <CockpitIcon name="i-branch" className="xl" />
          <h3 style={{ fontSize: '18px', margin: '14px 0 6px', color: 'var(--cr-text)' }}>
            No Workflow Definition
          </h3>
          <p style={{ fontSize: '13px', lineHeight: 1.5 }}>
            No batch jobs to display. Upload a Control-M XML file to view the DAG dependency graph
            and execute batch runs.
          </p>
        </div>
      </div>
    );
  }

  const chip = (label, icon, value, cls) => (
    <button
      type="button"
      className={`cr-fchip ${cls} ${statusFilter === label ? 'is-active' : ''}`}
      onClick={() => setStatusFilter(statusFilter === label ? null : label)}
    >
      <CockpitIcon name={icon} className="xs" /> {label} <b>{value}</b>
    </button>
  );

  return (
    <div className="cr-flow-container">
      {/* Summary cards and problems */}
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
        </div>
      )}

      {/* Workflow filter, search, status chips, follow */}
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
        </div>

        {folderOptions.length > 0 && (
          <div className="cr-flow-folder-select-wrap">
            <label className="cr-field-inline">
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cr-text-muted)' }}>
                Workflow:
              </span>
              <select
                className="cr-select sm"
                value={selectedFolder || 'ALL'}
                onChange={(e) => setSelectedFolder(e.target.value)}
              >
                <option value="ALL">All Workflows ({allJobs.length})</option>
                {folderOptions.map((fName) => (
                  <option key={fName} value={fName}>
                    {fName} ({allJobs.filter((j) => (j.folder || j.group) === fName).length})
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <div className="cr-flow-chips">
          {failedCount > 0 && chip('Failed', 'i-failed', failedCount, 'st-failed')}
          {runningCount > 0 && chip('Running', 'i-running', runningCount, 'st-running')}
          {chip('On hold', 'i-hold', holdCount, 'st-hold')}
          {chip('Skipped', 'i-skipped', skippedCount, 'st-skipped')}
          {chip('Done', 'i-done', doneCount, 'st-done')}
          <button
            type="button"
            className={`cr-fchip ${followActive ? 'is-active' : ''}`}
            onClick={() => setFollowActive((v) => !v)}
            title="Keep the view on the job that is running"
          >
            <CockpitIcon name="i-target" className="xs" /> Follow
          </button>
        </div>
      </div>

      {/* The graph of the Workflow tab */}
      <div className="cr-rf-wrap">
        <DependencyGraph
          graph={graph}
          jobs={jobs}
          detail={detail}
          states={states}
          selected={selectedJob}
          onSelect={(name) => {
            onSelectJob(name);
            if (name && onOpenDrawer) onOpenDrawer(name);
          }}
          isAllWorkflows={isAll}
          allowExecute={false}
          dimmed={dimmed}
          followId={followActive ? focalJob?.name : null}
          onPlayJob={onPlayJob}
          playBusyId={playBusyId}
          playBlockedReason={playBlockedReason}
          onOpenDetails={(name) => {
            onSelectJob(name);
            if (onOpenDrawer) onOpenDrawer(name);
          }}
        />
      </div>

      {/* Selected job */}
    </div>
  );
}

export default CockpitFlow;
