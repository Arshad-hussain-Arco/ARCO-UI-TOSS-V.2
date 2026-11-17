import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Clock, FileText, Play, RefreshCw, Server, Upload, User } from 'lucide-react';
import { Button } from '@components/ui/Button/Button';
import { IconSprite, CockpitIcon } from './IconSprite';
import { CockpitOverview } from './CockpitOverview';
import { CockpitFlow } from './CockpitFlow';
import { CockpitTimeline } from './CockpitTimeline';
import { CockpitHistory } from './CockpitHistory';
import { JobDetailDrawer } from './JobDetailDrawer';
import { ServersQueueTab } from './ServersQueueTab';
import { ScopeNavigator } from './ScopeNavigator';
import { JobOverview } from './JobOverview';
import { WorkflowOverview } from './WorkflowOverview';
import { JobHistoryTable } from './JobHistoryTable';
import { WorkflowHistoryTable } from './WorkflowHistoryTable';
import { JobDriftTimeline } from './JobDriftTimeline';
import { StartRunModal } from './StartRunModal';
import { RunWorkflowsModal } from './RunWorkflowsModal';
import { PlayJobModal } from './PlayJobModal';
import { closure } from './layout';
import { WorkflowFilesModal } from '../scheduler/components/WorkflowFilesModal';
import { DeleteDialog } from '../scheduler/components/DeleteDialog';
import { JobFormModal } from '../scheduler/components/JobFormModal';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';
import { usePolling, useResource } from '../scheduler/useResource';
import { groupMessages, formatClockTime } from '../scheduler/schedulerModel';

import '../scheduler/components/WorkflowPanel.css';
import './Cockpit.css';

const formatWhen = (value) => (value ? new Date(value).toLocaleString() : '—');

const SUB_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'flow', label: 'Flow' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'history', label: 'History' },
  { id: 'servers', label: 'Servers & Queue' },
];

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

export function CockpitTab({ env } = {}) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [activeView, setActiveView] = useState('overview');
  const [selectedJobName, setSelectedJobName] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isRunPaused, setIsRunPaused] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [isStartRunOpen, setIsStartRunOpen] = useState(false);
  const [isRunPickerOpen, setIsRunPickerOpen] = useState(false);
  const [playJob, setPlayJob] = useState(null); // the job waiting for confirmation: { name, folder }
  const [playingJob, setPlayingJob] = useState(''); // the job whose chain is being started (blocks a second click)
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flowFolder, setFlowFolder] = useState(null);

  // 3-Tier Scope State: 'xml' | 'workflow' | 'job'
  const [scope, setScope] = useState({
    type: 'xml',
    folder: null,
    job: null,
  });

  // Clear environment-specific state when switching environments so stale run IDs aren't retained
  useEffect(() => {
    setSelectedRunId('');
    setSelectedJobName(null);
    setScope({ type: 'xml', folder: null, job: null });
  }, [env]);

  const handleNavigateView = (view, folder = null) => {
    if (folder) {
      setFlowFolder(folder);
    }
    setActiveView(view);
  };

  const [filesOpen, setFilesOpen] = useState(false);
  const [jobModal, setJobModal] = useState(null);
  const [del, setDel] = useState(null);
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState('');

  const canUpload = hasPermission('EOD_SCHEDULER_UPLOAD');
  const canEdit = hasPermission('EOD_SCHEDULER_SETTINGS');
  const canExecute = hasPermission('EOD_SCHEDULER_EXECUTE');

  // Load real resources from backend
  const wf = useResource(() => (env ? svc.getWorkflow(env) : Promise.resolve(null)), [env]);
  const def = useResource(
    () => (env ? svc.getCockpitDefinition(env) : Promise.resolve(null)),
    [env],
  );
  const runsList = useResource(
    () => (env ? svc.getCockpitRuns(env).catch(() => svc.listRuns(env)) : Promise.resolve([])),
    [env],
  );

  const runs = useMemo(() => {
    const list = runsList.data || [];
    return list.filter((r) => {
      if (!r) return false;
      const rEnv = r.environment || r.partition;
      return !rEnv || String(rEnv).trim().toUpperCase() === String(env).trim().toUpperCase();
    });
  }, [runsList.data, env]);

  const activeRunningRun = runs.find((r) => {
    const isRun = r.status === 'RUNNING' || r.status === 'Running';
    if (!isRun) return false;
    if (r.started_at || r.started) {
      const ageMs = Date.now() - new Date(r.started_at || r.started).getTime();
      if (ageMs > 30 * 60 * 1000) return false;
    }
    return true;
  });
  const isViewingCurrentWorkflow =
    selectedRunId === 'current_workflow' || (!selectedRunId && !activeRunningRun);
  const currentRunId = isViewingCurrentWorkflow
    ? 'current_workflow'
    : selectedRunId || activeRunningRun?.id || activeRunningRun?.run_id || '';

  const runDetail = useResource(
    () =>
      env && currentRunId && currentRunId !== 'current_workflow'
        ? svc.getCockpitRun(env, currentRunId).catch(() => svc.getRun(env, currentRunId))
        : Promise.resolve(null),
    [env, currentRunId],
  );

  const isRunningBatch =
    runDetail.data?.status === 'Running' || runDetail.data?.status === 'RUNNING';
  const isBackendPaused =
    runDetail.data?.status === 'Paused' || runDetail.data?.status === 'PAUSED';
  const isPaused = isRunPaused || isBackendPaused;
  const waitingForSlot = Boolean(
    runDetail.data?.waiting_for_slot || (runDetail.data?.jobs || []).some((j) => (j.error_message || '').includes('waiting for a free slot'))
  );
  const isRunActive = isRunningBatch || isPaused || waitingForSlot;
  const isOverviewLoading =
    runsList.loading ||
    (Boolean(currentRunId) && currentRunId !== 'current_workflow' && !runDetail.data);

  // Polling for live status. The runs list refreshes every 4s while any run is live; when nothing is running it only needs to notice a
  // scheduled run starting, so every 20s is enough (actions taken here reload it at once anyway).
  const anyRunLive = runs.some((r) =>
    ['RUNNING', 'PAUSED', 'QUEUED'].includes(String(r.status || '').toUpperCase()),
  );
  usePolling(() => runsList.reload(true), anyRunLive || isRunActive ? 4000 : 20000);
  usePolling(() => runDetail.reload(true), 2500, isRunActive);
  usePolling(() => wf.reload(true), 10000, !busy);

  const view = wf.data;

  const files = view?.workflows ?? [];
  const running = (runsList.data ?? []).some(
    (r) => r.status === 'RUNNING' || r.status === 'Running',
  );
  const editHint = running ? 'A run is in progress in this environment' : undefined;

  const stats = [
    ['Workflows', view?.summary?.folders, ''],
    ['Jobs', view?.summary?.jobs, ''],
    ['Dependencies', view?.summary?.dependencies, ''],
    ['Timed jobs', view?.summary?.timed_jobs, ''],
    ['External conditions', view?.summary?.external_conditions, ''],
    ['Warnings', view?.summary?.warnings, 'warn'],
    ['Errors', view?.summary?.errors, 'bad'],
  ];

  // Enrich definition jobs with rich validation/target info from wf.data.folders
  const enrichedDefinition = useMemo(() => {
    if (!def.data) return null;
    if (
      view?.partition &&
      String(view.partition).trim().toUpperCase() !== String(env).trim().toUpperCase()
    ) {
      return null;
    }
    const wfJobsMap = new Map();
    for (const f of view?.folders || []) {
      for (const j of f.jobs || []) {
        wfJobsMap.set(j.name, j);
      }
    }
    return {
      ...def.data,
      jobs: (def.data.jobs || []).map((dj) => {
        const wj = wfJobsMap.get(dj.name);
        return wj ? { ...dj, ...wj } : dj;
      }),
    };
  }, [def.data, view, env]);

  // Staged run representing the current/uploaded workflow ready for execution
  const stagedRun = useMemo(() => {
    if (!def.data && !view) return null;
    if (
      view?.partition &&
      String(view.partition).trim().toUpperCase() !== String(env).trim().toUpperCase()
    ) {
      return null;
    }
    const jobsList = enrichedDefinition?.jobs || [];
    return {
      id: 'READY',
      file_name: view?.meta?.filename || 'batch_workflow.xml',
      environment: env,
      status: 'Ready',
      isReadyState: true,
      started_at: null,
      ended_at: null,
      took: '—',
      counts: {
        total: jobsList.length,
        done: 0,
        failed: 0,
        running: 0,
        on_hold: 0,
        waiting: jobsList.length,
        skipped: 0,
        killed: 0,
        queued: 0,
      },
      options: { simulate_all: false },
      jobs: jobsList.map((j) => ({
        name: j.name,
        group: j.group || j.folder || 'EOD-CORE',
        folder: j.folder || j.group || 'EOD-CORE',
        level: j.level || 1,
        status: 'Waiting',
        action: 'run',
        attempt: 0,
        started_at: null,
        ended_at: null,
        exit_code: null,
        error_message: '',
        predecessors: j.predecessors || [],
        successors: j.successors || [],
        command: j.command,
        target: j.target,
        attempts: [],
      })),
      folders: view?.folders || [],
    };
  }, [def.data, view, enrichedDefinition, env]);

  // Strict environment isolation for active run
  const run = useMemo(() => {
    if (isViewingCurrentWorkflow) return stagedRun;
    const d = runDetail.data;
    if (!d) return null;
    const rEnv = d.environment || d.partition;
    if (rEnv && String(rEnv).trim().toUpperCase() !== String(env).trim().toUpperCase()) {
      return null;
    }
    return d;
  }, [isViewingCurrentWorkflow, stagedRun, runDetail.data, env]);

  // Folder-filtered run for Workflow-scoped timeline & overview
  const filteredWorkflowRun = useMemo(() => {
    if (!run) return null;
    if (scope.type !== 'workflow' || !scope.folder) return run;
    const folderJobs = (run.jobs || []).filter(
      (j) => (j.group || j.folder) === scope.folder,
    );
    return {
      ...run,
      jobs: folderJobs,
    };
  }, [run, scope.type, scope.folder]);

  // Server capacity and slot waiting info
  const serverCapacity = run?.server_capacity || runDetail.data?.server_capacity || def.data?.server_capacity;
  const waitingSlotMessage = run?.waiting_slot_message || runDetail.data?.waiting_slot_message || '';
  const waitingSlotJobs = run?.waiting_slot_jobs || runDetail.data?.waiting_slot_jobs || [];

  // Merged and enriched jobs with full predecessors/successors for cockpit operations
  const allCockpitJobs = useMemo(() => {
    const runJobsMap = new Map((run?.jobs || []).map((j) => [j.name, j]));
    const predsMap = new Map();
    const succsMap = new Map();

    // 1. Dependencies from folders
    for (const f of view?.folders || []) {
      for (const e of f.dependencies || []) {
        if (!e?.source || !e?.target) continue;
        if (!predsMap.has(e.target)) predsMap.set(e.target, new Set());
        predsMap.get(e.target).add(e.source);
        if (!succsMap.has(e.source)) succsMap.set(e.source, new Set());
        succsMap.get(e.source).add(e.target);
      }
    }

    // 2. Base jobs list
    let baseList = [];
    if (run?.jobs?.length) {
      baseList = run.jobs.map((j) => ({
        ...j,
        group: j.group || 'EOD-CORE',
        predecessors: j.predecessors || [],
        successors: j.successors || [],
      }));
    } else {
      const defJobs = enrichedDefinition?.jobs || def.data?.jobs || [];
      baseList = defJobs.map((dj) => {
        const rj = runJobsMap.get(dj.name);
        return {
          ...dj,
          group: dj.group || 'EOD-CORE',
          status: rj?.status || 'Waiting',
          started_at: rj?.started_at || null,
          ended_at: rj?.ended_at || null,
          exit_code: rj?.exit_code ?? null,
          duration_seconds: rj?.duration_seconds,
          predecessors: dj.predecessors || [],
          successors: dj.successors || [],
        };
      });
    }

    // 3. Merge explicit predecessors & successors from jobs
    for (const j of baseList) {
      if (!predsMap.has(j.name)) predsMap.set(j.name, new Set());
      for (const p of j.predecessors || []) predsMap.get(j.name).add(p);

      if (!succsMap.has(j.name)) succsMap.set(j.name, new Set());
      for (const s of j.successors || []) succsMap.get(j.name).add(s);
    }

    // 4. Bi-directional link
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

    return baseList.map((j) => {
      const rj = runJobsMap.get(j.name);
      return {
        ...j,
        status: rj?.status || j.status || 'Waiting',
        started_at: rj?.started_at || j.started_at,
        ended_at: rj?.ended_at || j.ended_at,
        exit_code: rj?.exit_code ?? j.exit_code,
        duration_seconds: rj?.duration_seconds ?? j.duration_seconds,
        predecessors: Array.from(predsMap.get(j.name) || []),
        successors: Array.from(succsMap.get(j.name) || []),
      };
    });
  }, [run?.jobs, enrichedDefinition?.jobs, def.data?.jobs, view?.folders]);

  // Merge selected job properties from workflow definition + active run + enriched graph
  const selectedJobObj = useMemo(() => {
    if (!selectedJobName) return null;
    const fromAll = allCockpitJobs.find((j) => j.name === selectedJobName);
    let wfJob = null;
    for (const f of view?.folders || []) {
      const found = f.jobs?.find((j) => j.name === selectedJobName);
      if (found) {
        wfJob = found;
        break;
      }
    }
    const defJob = def.data?.jobs?.find((j) => j.name === selectedJobName);
    const runJob = run?.jobs?.find((j) => j.name === selectedJobName);
    return { ...defJob, ...wfJob, ...runJob, ...fromAll };
  }, [selectedJobName, view, def.data, run?.jobs, allCockpitJobs]);

  // Actions
  const guarded = async (fn, okMsg) => {
    setBusy(true);
    try {
      const res = await fn();
      if (okMsg) toast.success(okMsg);
      return res;
    } catch (err) {
      toast.error(errorText(err));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;

    const cleanName = (file.name || '').trim();

    // 1. Check if a file with the exact same name already exists in this environment
    const duplicateByName = files.find(
      (f) => (f.filename || '').trim().toLowerCase() === cleanName.toLowerCase(),
    );
    if (duplicateByName) {
      toast.error(
        `Workflow file "${cleanName}" already exists in this environment. Redundant file uploads are not accepted.`,
      );
      return;
    }

    // 2. Check if identical content (SHA-256) already exists in this environment
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const fileHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const duplicateByHash = files.find(
        (f) => (f.sha256 || '').trim().toLowerCase() === fileHash.toLowerCase(),
      );
      if (duplicateByHash) {
        toast.error(
          `An identical workflow already exists as "${duplicateByHash.filename}". Duplicate files are not accepted.`,
        );
        return;
      }
    } catch {
      // Proceed if crypto digest unavailable
    }

    const done = await guarded(() => svc.uploadWorkflow(env, file));
    if (done) {
      if (done.uploaded?.active) {
        toast.success(`${file.name} uploaded and set as active workflow.`);
        setReviewed(false);
        setSelectedJobName(null);
        setSelectedRunId('current_workflow');
      } else {
        toast.success(`${file.name} stored. Choose it in "Workflow file" to view and run it.`);
      }
      const [updatedWf] = await Promise.all([wf.reload(true), def.reload(true), runsList.reload(true)]);
      if (updatedWf?.approval?.digest && (!updatedWf?.errors || updatedWf.errors.length === 0)) {
        try {
          await svc.approve(env, updatedWf.approval.digest);
          await wf.reload(true);
        } catch {
          // Ignore auto-approval errors if not ready
        }
      }
    }
  };

  const activate = async (file) => {
    const done = await guarded(
      () => svc.activateWorkflow(env, file.id),
      `${file.filename} is now the active workflow.`,
    );
    if (done) {
      setSelectedJobName(null);
      setSelectedRunId('current_workflow');
      const [updatedWf] = await Promise.all([wf.reload(true), def.reload(true), runsList.reload(true)]);
      if (updatedWf?.approval?.digest && (!updatedWf?.errors || updatedWf.errors.length === 0)) {
        try {
          await svc.approve(env, updatedWf.approval.digest);
          await wf.reload(true);
        } catch {
          // Ignore
        }
      }
    }
  };

  const suggestions = useMemo(() => {
    const all = (view?.folders ?? []).flatMap((f) => f.jobs || []);
    return {
      nodeids: [...new Set(all.map((j) => j.nodeid).filter(Boolean))].sort(),
      conditions: [
        ...new Set(all.flatMap((j) => [...(j.waits_for ?? []), ...(j.produces ?? [])])),
      ].sort(),
    };
  }, [view]);

  const saveJob = async (payload) => {
    const folderName = jobModal?.folder || view?.folders?.[0]?.folder || 'EOD-CORE';
    const workflowId = view?.meta?.id;
    if (jobModal?.mode === 'edit') {
      await svc.updateJob(env, workflowId, folderName, jobModal.job, payload);
      toast.success(`Job ${jobModal.job} saved.`);
    } else {
      await svc.addJob(env, workflowId, folderName, payload);
      toast.success(`Job ${payload.name} added.`);
    }
    setJobModal(null);
    await Promise.all([wf.reload(true), def.reload(true), runsList.reload(true)]);
  };

  const confirmDelete = async () => {
    if (!del) return;
    setDelBusy(true);
    setDelError('');
    const confirm = Boolean(del.info) || del.kind === 'folder';
    try {
      if (del.kind === 'file') {
        await svc.deleteWorkflow(env, del.file.id);
        toast.success(`${del.file.filename} deleted.`);
      } else if (del.kind === 'folder') {
        await svc.deleteFolder(env, view?.meta?.id, del.folder, {
          confirm,
          baseSha256: view?.meta?.sha256,
        });
        toast.success(`Workflow ${del.folder} deleted.`);
      } else if (del.kind === 'job') {
        await svc.deleteJob(env, view?.meta?.id, del.folder, del.job, {
          confirm,
          baseSha256: view?.meta?.sha256,
        });
        toast.success(`Job ${del.job} deleted. Review and approve the workflow again.`);
      }
      setDel(null);
      await Promise.all([wf.reload(true), def.reload(true), runsList.reload(true)]);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.needs_confirm) setDel({ ...del, info: data });
      else setDelError(errorText(err));
    } finally {
      setDelBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!view?.approval?.digest) return;
    const done = await guarded(
      () => svc.approve(env, view.approval.digest),
      'Approved. Batch is now permitted to execute.',
    );
    if (done) {
      setReviewed(false);
      wf.reload(true);
    }
  };

  const validateExecutionPreflight = (selectedFolders = null) => {
    if (!view?.loaded) {
      toast.error('No workflow uploaded. Please upload a workflow XML file first.');
      return false;
    }

    let foldersToCheck = view?.folders ?? [];
    if (selectedFolders && selectedFolders.length > 0) {
      foldersToCheck = foldersToCheck.filter((f) => selectedFolders.includes(f.folder));
    }

    const allJobs = foldersToCheck.flatMap((f) => f.jobs || []);
    if (!allJobs.length) {
      toast.error('No jobs found in the active workflow.');
      return false;
    }

    // Identify all distinct Node IDs declared in this workflow
    const allWorkflowNodeIds = [
      ...new Set(allJobs.map((j) => j.nodeid).filter(Boolean)),
    ];
    const isMultiServerWorkflow = allWorkflowNodeIds.length > 1;

    // Helper for clean list formatting (caps at max items with a +N remaining count)
    const formatList = (items, max = 4) => {
      if (items.length <= max) return items.join(', ');
      const visible = items.slice(0, max);
      const remaining = items.length - max;
      return `${visible.join(', ')} +${remaining} more`;
    };

    // 1. Check for unmapped Node IDs
    const isJobUnmapped = (j) =>
      !j.target ||
      j.target.code === 'UNMAPPED_NODEID' ||
      j.target.code === 'NO_TARGET_FOR_NODEID' ||
      String(j.target?.target_name || '').toLowerCase() === 'unmapped';

    const unmappedJobs = allJobs.filter(isJobUnmapped);

    if (unmappedJobs.length > 0) {
      const missingNodeIds = [
        ...new Set(unmappedJobs.map((j) => j.nodeid || 'unassigned').filter(Boolean)),
      ];

      // Multi-Server Workflow: All or multiple Node IDs missing
      if (isMultiServerWorkflow && missingNodeIds.length > 1) {
        const isAllMissing = missingNodeIds.length === allWorkflowNodeIds.length;
        if (isAllMissing) {
          toast.error(
            `Cannot execute workflow: This workflow requires multiple target servers. ${missingNodeIds.length} Node IDs (${formatList(missingNodeIds)}) are unmapped. Please add the target servers and map each Node ID in Environment Settings.`,
            { duration: 7000 },
          );
        } else {
          toast.error(
            `Cannot execute workflow: This workflow requires multiple target servers, but ${missingNodeIds.length} Node IDs (${formatList(missingNodeIds)}) are still unmapped. Please add and map the remaining target servers in Environment Settings.`,
            { duration: 7000 },
          );
        }
        return false;
      }

      // Multi-Server Workflow: Exactly one specific Node ID missing (partially mapped)
      if (isMultiServerWorkflow && missingNodeIds.length === 1) {
        toast.error(
          `Cannot execute workflow: Node ID "${missingNodeIds[0]}" is not mapped to any target server. Please add/host its target server and map this Node ID in Environment Settings.`,
          { duration: 7000 },
        );
        return false;
      }

      // Single-Server Workflow: Node ID unmapped
      const nodeText = missingNodeIds.length > 0 ? ` "${missingNodeIds[0]}"` : '';
      toast.error(
        `Cannot execute workflow: Target server is not mapped for Node ID${nodeText}. Please add/host a target server and map the Node ID in Environment Settings first.`,
        { duration: 7000 },
      );
      return false;
    }

    // 2. Check for mapped Node IDs whose target servers failed connectivity / auth / secret check
    const unreachableJobs = allJobs.filter((j) => j.target && j.target.ok === false);
    if (unreachableJobs.length > 0) {
      const failedTargets = [
        ...new Set(
          unreachableJobs.map(
            (j) =>
              `${j.target?.target_name || j.nodeid || j.name} (${j.target?.code || 'UNREACHABLE'})`,
          ),
        ),
      ];

      if (failedTargets.length > 1) {
        toast.error(
          `Cannot execute workflow: Target servers for ${failedTargets.length} nodes failed connection checks: ${formatList(failedTargets)}. Please verify host address, port, credentials, and SSH keys in Environment Settings.`,
          { duration: 7000 },
        );
      } else {
        const singleJob = unreachableJobs[0];
        toast.error(
          `Cannot execute workflow: Target server for Node ID "${singleJob.nodeid || singleJob.name}" is not reachable (${singleJob.target?.code || 'UNREACHABLE'}). Please verify host, port, and credentials in Environment Settings.`,
          { duration: 7000 },
        );
      }
      return false;
    }

    // 3. Other blocking dispatch/review errors reported by engine/parser
    if (view?.errors?.length > 0) {
      const relevantError =
        (selectedFolders && view.errors.find((err) => selectedFolders.some((f) => err.includes(f)))) ||
        view.errors[0];
      toast.error(`Cannot execute workflow: ${relevantError}`, { duration: 7000 });
      return false;
    }

    return true;
  };

  // Ask the engine to start a run and follow it: the same path for "Run All Now", "Run Workflow" and the Play button of a job.
  // `okText` is the message shown when the engine accepted it (text, or a function of the engine's answer).
  const submitRun = async (body, okText) => {
    setBusy(true);
    try {
      // Auto-approve in background if needed
      if (!view?.approved && view?.approval?.digest && (!view?.errors || view.errors.length === 0)) {
        try {
          await svc.approve(env, view.approval.digest);
          await wf.reload(true);
        } catch (approveErr) {
          console.warn('Pre-run auto-approval error:', approveErr);
        }
      }

      const { command_id: id } = await svc.runNow(env, body);
      let answer = null;
      for (let i = 0; i < 34; i += 1) {
        await new Promise((r) => setTimeout(r, 1000));
        answer = await svc.getCommand(env, id);
        if (!['PENDING', 'CLAIMED'].includes(answer.status)) break;
      }
      if (answer?.status === 'DONE') {
        toast.success(typeof okText === 'function' ? okText(answer) : okText);
        await runsList.reload(true);
        const newRunId = answer.result?.runs?.[0]?.run_id;
        if (newRunId) {
          setSelectedRunId(newRunId);
        }
        await runDetail.reload(true);
        setActiveView('flow');
        return true;
      }
      if (answer && !['PENDING', 'CLAIMED'].includes(answer.status)) {
        toast.error(answer.result?.message || `The engine answered ${answer.status}.`);
      } else {
        toast.error(
          'No engine answered within 30 seconds. Verify that an engine is serving this environment.',
        );
      }
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
    return false;
  };

  const handleStartRun = (options = {}) => {
    if (!validateExecutionPreflight(options.folders)) {
      return false;
    }
    return submitRun(
      {
        allow_overlap: options.allow_overlap ?? false,
        // only these workflows (folders) of the active XML; without it the whole XML runs
        ...(options.folders?.length ? { folders: options.folders } : {}),
        name: options.name || 'EOD Batch Run',
        schedule_name: options.name || 'EOD Batch Run',
      },
      'The engine accepted and started the batch run.',
    );
  };

  // The run being viewed (a real one, not the staged workflow) is the one whose finished jobs Play may reuse; the engine checks it is from today.
  const reuseRunId =
    !isViewingCurrentWorkflow && currentRunId && run && !run.isReadyState
      ? String(currentRunId)
      : '';
  const succeededNames = new Set(
    (run?.jobs || []).filter((j) => j.status === 'Done').map((j) => j.name),
  );
  const playBlockedReason = !canExecute
    ? 'You do not have permission to run jobs'
    : isRunningBatch
      ? 'A run is in progress. Wait for it to finish or stop it first.'
      : '';

  // Play on one job: the engine runs it with the prerequisite jobs it needs (its own dependency rules), and nothing else.
  const requestPlay = (name) => {
    const j = (enrichedDefinition?.jobs || []).find((x) => x.name === name);
    setPlayJob({ name, folder: j?.folder || j?.group || '' });
  };
  const confirmPlay = async () => {
    if (!playJob || playingJob) return;
    if (!validateExecutionPreflight([playJob.folder])) return;
    setPlayingJob(playJob.name);
    const ok = await submitRun(
      {
        folders: [playJob.folder],
        job: playJob.name,
        name: `Job: ${playJob.name}`,
        allow_overlap: false,
        ...(reuseRunId ? { reuse_run: reuseRunId } : {}),
      },
      (answer) => {
        const r = answer.result?.runs?.[0];
        const reused = r?.reused?.length
          ? ` (${r.reused.join(', ')} already succeeded, not run again)`
          : '';
        return `Started ${playJob.name}: ${(r?.order || [playJob.name]).join(' → ')}${reused}`;
      },
    );
    setPlayingJob('');
    if (ok) setPlayJob(null);
  };

  const handleCancelRun = async () => {
    if (!currentRunId) return;
    setBusy(true);
    try {
      await svc.cancelRun(env, currentRunId);
      toast.success('Cancel requested. Running jobs are instructed to stop.');
      await Promise.all([runDetail.reload(true), runsList.reload(true)]);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePause = async () => {
    if (!currentRunId) return;
    const nextPaused = !isPaused;
    setIsRunPaused(nextPaused);
    try {
      if (nextPaused) {
        await svc.pauseRun?.(env, currentRunId).catch(() => { });
        toast.success(`Run #${currentRunId} paused. Dispatch has been halted.`);
      } else {
        await svc.resumeRun?.(env, currentRunId).catch(() => { });
        toast.success(`Run #${currentRunId} resumed. Continuing batch execution.`);
      }
      await Promise.all([runDetail.reload(true), runsList.reload(true)]);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const handleJobAction = async (jobName, action, jobObj) => {
    let targetRunId = currentRunId;
    if (!targetRunId || targetRunId === 'current_workflow') {
      const candidate = activeRunningRun || runs[0];
      targetRunId = candidate?.id || candidate?.run_id;
    }

    if (action === 'run' || action === 'rerun') {
      if (!validateExecutionPreflight()) {
        return;
      }

      // Check dependency predecessors
      const allJobs = enrichedDefinition?.jobs || run?.jobs || [];
      const jobMap = new Map(allJobs.map((j) => [j.name, j]));
      const predsSet = closure(jobName, jobMap, 'predecessors');
      const preds = Array.from(predsSet);

      if (preds.length === 0) {
        toast.info(`Job "${jobName}" has no dependencies. Running directly.`);
      } else {
        toast.info(
          `Job "${jobName}" depends on ${preds.length} predecessor(s): ${preds.join(', ')}. Executing predecessors first...`,
        );
      }

      // If a batch run is currently active, rerun predecessors and target in that run
      if (isRunningBatch && targetRunId) {
        try {
          for (const p of preds) {
            await svc.cockpitJobAction(env, targetRunId, p, 'rerun').catch(() => { });
          }
          await svc.cockpitJobAction(env, targetRunId, jobName, 'rerun');
          toast.success(
            `Execution triggered for "${jobName}" and its dependencies (Run #${targetRunId}).`,
          );
          await runDetail.reload(true);
        } catch (err) {
          toast.error(errorText(err));
        }
        return;
      }

      // If no run is currently active, start execution for the batch
      await handleStartRun();
      return;
    }

    if (!targetRunId) {
      toast.error('No batch run found to execute job action.');
      return;
    }
    try {
      await svc.cockpitJobAction(env, targetRunId, jobName, action);
      toast.success(`Action '${action}' applied to ${jobName} (Run #${targetRunId}).`);
      if (selectedRunId === 'current_workflow') {
        setSelectedRunId(targetRunId);
      }
      await Promise.all([runDetail.reload(true), runsList.reload(true)]);
    } catch (err) {
      toast.error(errorText(err));
    }
  };

  const handleSelectRun = (runId) => {
    setSelectedRunId(runId);
  };

  // The newest run of this environment, offered by the Timeline when the current workflow has not run yet
  const latestRunInfo = useMemo(() => {
    const r = runs[0];
    if (!r) return null;
    const started = r.started_at || r.started;
    return {
      id: r.id || r.run_id,
      status: r.status || '',
      when: started
        ? new Date(started).toLocaleString([], {
          hour12: false,
          dateStyle: 'medium',
          timeStyle: 'short',
        })
        : '',
    };
  }, [runs]);

  return (
    <div className="cr-cockpit">
      {/* ── Internal SVG Icon Sprites ── */}
      <IconSprite />

      {/* ── Unified File Header Card (Upload XML Section on Top) ── */}
      <div className="cr-unified-file-card">
        <div className="cr-ufc-left">
          <div className="cr-ufc-icon-box">
            <FileText size={20} className="cr-ufc-icon" />
          </div>
          <div className="cr-ufc-info">
            <div className="cr-ufc-title-row">
              <strong className="cr-ufc-filename">
                {view?.meta?.filename || 'No workflow uploaded'}
              </strong>
              {!view?.loaded && (
                <span
                  className="cr-ufc-badge"
                  style={{
                    backgroundColor: 'rgba(148, 163, 184, 0.15)',
                    color: 'var(--cr-text-muted, #94a3b8)',
                  }}
                >
                  Empty Environment
                </span>
              )}
            </div>
            <div className="cr-ufc-meta">
              {view?.loaded ? (
                <>
                  <span>Uploaded by {view.meta?.uploaded_by || 'unknown'}</span>
                  <span className="cr-ufc-sep">|</span>
                  <span>{formatWhen(view.meta?.uploaded_at)}</span>
                </>
              ) : (
                <span>Upload a Control-M XML file to review jobs and start runs</span>
              )}
            </div>
          </div>
        </div>

        <div className="cr-ufc-right">
          {files.length > 0 && (
            <label className="cr-ufc-select-label">
              <span className="cr-ufc-select-title">Workflow File</span>
              <select
                value={files.find((f) => f.active)?.id ?? ''}
                disabled={busy || !canEdit || running}
                title={editHint}
                onChange={(e) => {
                  const file = files.find((f) => String(f.id) === e.target.value);
                  if (file && !file.active) activate(file);
                }}
                className="cr-ufc-dropdown"
              >
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.filename} {f.active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button
            variant="outline"
            size="sm"
            leadingIcon={FileText}
            onClick={() => setFilesOpen(true)}
          >
            Files ({files.length})
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={RefreshCw}
            onClick={() => {
              wf.reload(true);
              def.reload(true);
              runsList.reload(true);
              runDetail.reload(true);
            }}
            aria-label="Reload"
          />
          {canUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                hidden
                onChange={handleUpload}
                aria-label="Upload XML file"
              />
              <Button
                variant="outline"
                size="sm"
                leadingIcon={Upload}
                isLoading={busy}
                onClick={() => fileInputRef.current?.click()}
              >
                Upload XML
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Headings Section: Subtabs & Action Controls (Below Upload XML Section) ── */}
      <div className="cr-subtabs-bar">
        <div className="cr-subtabs-list" role="tablist">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeView === tab.id}
              className={`cr-subtab-btn ${activeView === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveView(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* RUN dropdown list (moved to the left of the action buttons) */}
          {run && (
            <label
              className="cr-run-switch-label"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--cr-text-muted)' }}>
                RUN
              </span>
              <select
                className="cr-select sm cr-run-switch-select"
                value={currentRunId}
                onChange={(e) => handleSelectRun(e.target.value)}
              >
                <option value="current_workflow">
                  ★ Current Workflow · {view?.meta?.filename || 'batch.xml'}{' '}
                  {run.isReadyState ? '(Active)' : ''}
                </option>
                {runs.map((r) => {
                  const rid = r.id || r.run_id;
                  const rstat = r.status || 'Unknown';
                  const rstart = r.started_at || r.started;
                  return (
                    <option key={rid} value={rid}>
                      #{rid} · {rstat} · {formatClockTime(rstart)}
                      {String(currentRunId) === String(rid) ? ' (viewing)' : ''}
                    </option>
                  );
                })}
              </select>
            </label>
          )}

          {/* Action buttons (placed in the top right corner, aligned together) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isRunActive && (
              <>
                <button
                  type="button"
                  className={`cr-btn sm ${isPaused ? 'primary' : 'outline'}`}
                  disabled={busy}
                  onClick={handleTogglePause}
                  title={isPaused ? 'Resume batch execution' : 'Pause batch execution'}
                >
                  <CockpitIcon name={isPaused ? 'i-play' : 'i-hold'} className="xs" />
                  <span>{isPaused ? 'Resume' : 'Pause'}</span>
                </button>

                <button
                  type="button"
                  className="cr-btn outline sm cr-btn-danger"
                  disabled={busy}
                  onClick={handleCancelRun}
                  title="Cancel batch run"
                >
                  Cancel Run
                </button>
              </>
            )}

            <button
              type="button"
              className="cr-btn outline sm"
              disabled={busy || !canExecute || !(view?.folders || []).length}
              onClick={() => {
                if (!validateExecutionPreflight()) return;
                setIsRunPickerOpen(true);
              }}
              title={
                !canExecute
                  ? 'You do not have permission to execute batch runs'
                  : !(view?.folders || []).length
                    ? 'No workflows loaded in the active file'
                    : 'Run only the workflows you choose from the active XML'
              }
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
            >
              <Play size={13} />
              <span>Run Workflow…</span>
            </button>

            <button
              type="button"
              className="cr-btn primary sm cr-btn-run-all"
              disabled={busy || isRunningBatch || !canExecute || !view?.loaded}
              onClick={() => handleStartRun()}
              title={
                !canExecute
                  ? 'You do not have permission to execute batch runs'
                  : isRunningBatch
                    ? 'A batch run is currently in progress'
                    : !view?.loaded
                      ? 'Upload a workflow XML file first'
                      : 'Execute batch workflow now'
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#059669',
                borderColor: '#059669',
                color: '#ffffff',
                fontWeight: 600,
                borderRadius: '6px',
                padding: '5px 12px',
                cursor:
                  busy || isRunningBatch || !canExecute || !view?.loaded
                    ? 'not-allowed'
                    : 'pointer',
                opacity:
                  busy || isRunningBatch || !canExecute || !view?.loaded ? 0.6 : 1,
              }}
            >
              <Play size={13} fill="currentColor" />
              <span>Run All Now</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 3-Tier Scope Navigator: Whole XML | Workflow (Folder) | Particular Job ── */}
      {activeView !== 'servers' && (
        <ScopeNavigator
          scope={scope}
          onChangeScope={setScope}
          folders={view?.folders || run?.folders || []}
          allJobs={allCockpitJobs}
          xmlFileName={view?.meta?.filename || 'batch_workflow.xml'}
        />
      )}

      {/* ── Run Context Strip: Schedule Name on Left, Triggered By on Right ── */}
      {run ? (
        <div className="cr-run-context-strip">
          <div className="cr-rcs-left">
            <span
              className="cr-run-schedule-pill"
              style={{
                height: '28px',
                boxSizing: 'border-box',
                fontWeight: 600,
                fontSize: '12px',
                padding: '0 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(0, 90, 54, 0.08)',
                color: 'var(--c-primary, #005a36)',
                border: '1px solid rgba(0, 90, 54, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                letterSpacing: '0.01em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
              title={`Schedule Name: ${run.name || (run.target_job ? `Target: ${run.target_job}` : 'EOD Batch Run')}`}
            >
              <CockpitIcon
                name="i-branch"
                className="xs"
                style={{ width: '13px', height: '13px', opacity: 0.85, flexShrink: 0 }}
              />
              <span
                className="cr-pill-label"
                style={{
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  opacity: 0.75,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  lineHeight: 1,
                }}
              >
                Schedule Name:
              </span>
              <span
                className="cr-pill-value"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  lineHeight: 1,
                  fontWeight: 600,
                }}
              >
                {run.name || (run.target_job ? `Target: ${run.target_job}` : 'EOD Batch Run')}
              </span>
            </span>

            {/* Target Server Slot Pill */}
            {serverCapacity?.display_label && (
              <span
                className="cr-server-capacity-pill"
                style={{
                  height: '28px',
                  boxSizing: 'border-box',
                  fontWeight: 600,
                  fontSize: '12px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: waitingForSlot || serverCapacity.any_full ? 'rgba(217, 119, 6, 0.1)' : '#f8fafc',
                  color: waitingForSlot || serverCapacity.any_full ? '#b45309' : '#475569',
                  border: `1px solid ${waitingForSlot || serverCapacity.any_full ? 'rgba(217, 119, 6, 0.35)' : '#cbd5e1'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
                title={
                  serverCapacity.servers
                    ?.map(
                      (s) =>
                        `${s.target_name}: ${s.in_use}/${s.limit ?? '∞'} in use${s.holders?.length ? ` (by: ${s.holders.join(', ')})` : ''}`
                    )
                    .join('\n') || serverCapacity.display_label
                }
              >
                <Server
                  size={13}
                  style={{ width: '13px', height: '13px', opacity: 0.85, flexShrink: 0 }}
                />
                <span
                  className="cr-pill-label"
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    opacity: 0.75,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1,
                  }}
                >
                  Server Slots:
                </span>
                <span
                  className="cr-pill-value"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1,
                    fontWeight: 600,
                  }}
                >
                  {serverCapacity.display_label}
                </span>
              </span>
            )}
          </div>

          <div className="cr-rcs-right">
            {(run.started_by || run.user || !run.isReadyState) && (
              <span
                className="cr-started-by-pill"
                style={{
                  height: '28px',
                  boxSizing: 'border-box',
                  fontSize: '12px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  backgroundColor: '#f1f5f9',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
                title={`Triggered by: ${run.started_by || run.user || '—'}`}
              >
                <User
                  size={13}
                  style={{ width: '13px', height: '13px', opacity: 0.85, flexShrink: 0 }}
                />
                <span
                  className="cr-pill-label"
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    opacity: 0.75,
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1,
                  }}
                >
                  Triggered by:
                </span>
                <span
                  className="cr-pill-value"
                  style={{
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    lineHeight: 1,
                  }}
                >
                  {run.started_by || run.user || '—'}
                </span>
              </span>
            )}
          </div>
        </div>
      ) : null}

      {/* ── Waiting for Server Slot Banner ── */}
      {waitingForSlot && (
        <div
          className="cr-waiting-slot-banner"
          style={{
            margin: '0 16px 12px 16px',
            padding: '10px 14px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            color: '#92400e',
            fontSize: '13px',
          }}
        >
          <Clock size={16} style={{ color: '#d97706', marginTop: '2px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#b45309', marginBottom: '2px' }}>
              Waiting for Target Server Slot
            </div>
            <div style={{ color: '#78350f', fontSize: '12px' }}>
              {waitingSlotMessage ||
                (serverCapacity?.primary_server
                  ? `${serverCapacity.primary_server.target_name} is currently at capacity (${serverCapacity.primary_server.in_use}/${serverCapacity.primary_server.limit} active jobs). Jobs will start automatically as slots free up.`
                  : 'Jobs are waiting for an available execution slot on the target server. They will resume automatically as soon as running jobs complete.')}
            </div>
          </div>
        </div>
      )}

      {/* ── Active View Body ── */}
      <main className="cr-main-pane">
        {busy && (
          <div className="cr-loading-overlay">
            <span className="cr-spinner" />
          </div>
        )}

        {activeView === 'overview' && (
          scope.type === 'job' && scope.job ? (
            <JobOverview
              env={env}
              jobName={scope.job}
              onOpenLog={(jName) => {
                setSelectedJobName(jName);
                setIsDrawerOpen(true);
              }}
            />
          ) : scope.type === 'workflow' && scope.folder ? (
            <WorkflowOverview
              env={env}
              folderName={scope.folder}
              run={run}
              onSelectJob={(jName) => {
                setScope({ type: 'job', folder: scope.folder, job: jName });
              }}
            />
          ) : (
            <CockpitOverview
              isLoading={isOverviewLoading}
              run={run ? { ...run, status: isPaused ? 'Paused' : run.status } : null}
              definition={enrichedDefinition}
              folders={run?.folders || view?.folders || []}
              onSelectJob={(name) => {
                setSelectedJobName(name);
                setIsDrawerOpen(true);
              }}
              onNavigateView={handleNavigateView}
              onStartRun={() => handleStartRun()}
              onCancelRun={handleCancelRun}
              onJobAction={handleJobAction}
              onAddJob={() =>
                setJobModal({
                  mode: 'add',
                  job: null,
                  folder: view?.folders?.[0]?.folder || 'EOD-CORE',
                })
              }
              onEditJob={(j) =>
                setJobModal({
                  mode: 'edit',
                  job: j.name,
                  folder: j.folder || j.group || view?.folders?.[0]?.folder || 'EOD-CORE',
                })
              }
              onDeleteJob={(j) =>
                setDel({
                  kind: 'job',
                  job: j.name,
                  folder: j.folder || j.group || view?.folders?.[0]?.folder || 'EOD-CORE',
                })
              }
              canRun={canExecute}
            />
          )
        )}

        {activeView === 'flow' && (
          <CockpitFlow
            definition={enrichedDefinition}
            run={run ? { ...run, status: isPaused ? 'Paused' : run.status } : null}
            selectedJob={scope.type === 'job' ? scope.job : selectedJobName}
            onSelectJob={(name) => {
              setSelectedJobName(name);
              setScope((prev) => ({
                ...prev,
                type: 'job',
                job: name,
              }));
            }}
            onOpenDrawer={(name) => {
              setSelectedJobName(name);
              setScope((prev) => ({
                ...prev,
                type: 'job',
                job: name,
              }));
              setIsDrawerOpen(true);
            }}
            onCancelRun={handleCancelRun}
            isPaused={isPaused}
            onTogglePause={handleTogglePause}
            folders={run?.folders || view?.folders || []}
            scope={scope}
            onScopeChange={setScope}
            stats={stats}
            errors={view?.errors}
            onPlayJob={requestPlay}
            playBusyId={playingJob}
            playBlockedReason={playBlockedReason}
          />
        )}

        {activeView === 'timeline' && (
          scope.type === 'job' && scope.job ? (
            <JobDriftTimeline env={env} jobName={scope.job} />
          ) : (
            <CockpitTimeline
              run={
                scope.type === 'workflow'
                  ? filteredWorkflowRun
                  : run ? { ...run, status: isPaused ? 'Paused' : run.status } : null
              }
              definition={enrichedDefinition}
              selectedJob={selectedJobName}
              onSelectJob={(name) => {
                setSelectedJobName(name);
                setIsDrawerOpen(true);
              }}
              latestRun={latestRunInfo}
              onOpenRun={handleSelectRun}
            />
          )
        )}

        {activeView === 'history' && (
          scope.type === 'job' && scope.job ? (
            <JobHistoryTable
              env={env}
              jobName={scope.job}
              onOpenLog={(jName) => {
                setSelectedJobName(jName);
                setIsDrawerOpen(true);
              }}
            />
          ) : scope.type === 'workflow' && scope.folder ? (
            <WorkflowHistoryTable
              env={env}
              folderName={scope.folder}
              onSelectRun={(id) => {
                handleSelectRun(id);
                setActiveView('overview');
              }}
            />
          ) : (
            <CockpitHistory
              isLoading={runsList.loading}
              runs={runs}
              currentRunId={currentRunId}
              env={env}
              onSelectRun={(id) => {
                handleSelectRun(id);
                setActiveView('overview');
              }}
            />
          )
        )}

        {activeView === 'servers' && (
          <ServersQueueTab
            env={env}
            onSelectScope={(newScope) => {
              setScope((prev) => ({ ...prev, ...newScope }));
              if (newScope.type === 'job' || newScope.job) {
                setSelectedJobName(newScope.job);
                setIsDrawerOpen(true);
              }
            }}
            onSelectJob={(name) => {
              setSelectedJobName(name);
              setIsDrawerOpen(true);
            }}
          />
        )}
      </main>

      {/* ── Slide-Out Job Detail Drawer ── */}
      {selectedJobName && isDrawerOpen && (
        <JobDetailDrawer
          jobName={selectedJobName}
          job={selectedJobObj}
          allJobs={allCockpitJobs}
          env={env}
          runId={
            currentRunId && currentRunId !== 'current_workflow'
              ? currentRunId
              : activeRunningRun?.id || runs[0]?.id || null
          }
          onClose={() => setIsDrawerOpen(false)}
          onJobAction={handleJobAction}
          onFocusScope={(jName, fName) => {
            setScope({ type: 'job', folder: fName, job: jName });
            setActiveView('overview');
          }}
        />
      )}

      {/* ── Start Run Modal ── */}
      <StartRunModal
        isOpen={isStartRunOpen}
        onClose={() => setIsStartRunOpen(false)}
        onStart={handleStartRun}
        currentEnv={env}
      />

      {/* ── Run Workflow: choose which workflows of the active XML to run ── */}
      <RunWorkflowsModal
        isOpen={isRunPickerOpen}
        onClose={() => setIsRunPickerOpen(false)}
        onRun={handleStartRun}
        filename={view?.meta?.filename}
        workflows={(view?.folders || []).map((f) => ({
          name: f.folder,
          jobs: (f.jobs || []).length,
        }))}
      />

      {/* ── Play on a job: confirm which jobs the engine will run ── */}
      <PlayJobModal
        isOpen={Boolean(playJob)}
        env={env}
        job={playJob}
        workflowId={view?.meta?.id}
        reuseRun={reuseRunId}
        succeeded={succeededNames}
        busy={Boolean(playingJob)}
        onConfirm={confirmPlay}
        onClose={() => !playingJob && setPlayJob(null)}
      />

      {/* ── Add / Edit Job Modal ── */}
      {jobModal && (
        <JobFormModal
          isOpen={Boolean(jobModal)}
          onClose={() => setJobModal(null)}
          env={env}
          workflowId={view?.meta?.id}
          baseSha256={view?.meta?.sha256}
          folder={jobModal.folder || view?.folders?.[0]?.folder || 'EOD-CORE'}
          job={jobModal.job}
          mode={jobModal.mode}
          nodeids={suggestions.nodeids}
          conditions={suggestions.conditions}
          onSave={saveJob}
        />
      )}

      {/* ── Workflow Files Modal & Deletion Dialog ── */}
      <WorkflowFilesModal
        isOpen={filesOpen}
        onClose={() => setFilesOpen(false)}
        files={files}
        canManage={canEdit}
        canRun={canExecute}
        busy={busy}
        onActivate={activate}
        onDelete={(file) => {
          setFilesOpen(false);
          setDel({ kind: 'file', file });
        }}
      />
      <DeleteDialog
        state={del}
        busy={delBusy}
        error={delError}
        onClose={() => !delBusy && setDel(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default CockpitTab;
