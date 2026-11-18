import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

const E = endpoints.eodScheduler;

/** The readable message of a failed call: the backend answers {"message": ...} (or DRF's {"detail": ...}). */
export function errorText(err) {
  const data = err?.response?.data;
  if (typeof data?.message === 'string') return data.message;
  if (typeof data?.detail === 'string') return data.detail;
  if (data && typeof data === 'object') {
    const first = Object.values(data)
      .flat()
      .find((v) => typeof v === 'string');
    if (first) return first;
  }
  if (err?.response?.status === 403) return 'You do not have permission to do that.';
  if (err?.code === 'ECONNABORTED') return 'The request timed out.';
  return err?.message || 'Something went wrong.';
}

const get = async (url, config) => (await httpClient.get(url, config)).data;
const send = async (method, url, body) =>
  (await httpClient.request({ method, url, data: body })).data;

/** Control-M scheduler API (/api/eod-scheduler/). One environment code scopes every call except the environment list. */
export const eodSchedulerService = {
  // environments
  listEnvironments: () => get(E.environments),
  createEnvironment: (code, name) => send('post', E.environments, { code, name }),
  updateEnvironment: (env, body) => send('patch', E.environment(env), body),

  // workflow review, approval, actions
  getWorkflow: (env) => get(E.workflow(env)),
  uploadWorkflow: async (env, file) => {
    const bytes = await file.arrayBuffer();
    const name = String(file.name || 'controlm.xml').replace(/[^\x20-\x7e]/g, '_');
    return (
      await httpClient.post(E.upload(env), bytes, {
        headers: { 'Content-Type': 'application/octet-stream', 'X-Filename': name },
        timeout: 120000,
      })
    ).data;
  },
  // several workflow files per environment: one is active (the one that runs)
  getWorkflowItem: (env, id) => get(E.workflowItem(env, id)),
  activateWorkflow: (env, id) => send('post', E.workflowActivate(env, id)),
  deleteWorkflow: (env, id) => send('delete', E.workflowItem(env, id)),

  // editing the stored workflow: jobs and folders. `baseSha256` is the hash the user is looking at: a changed file is refused, not overwritten.
  getJobFields: (env, id, folder, job) => get(E.workflowJob(env, id, folder, job)),
  addJob: (env, id, folder, body) => send('post', E.workflowJobs(env, id, folder), body),
  updateJob: (env, id, folder, job, body) =>
    send('patch', E.workflowJob(env, id, folder, job), body),
  deleteJob: (env, id, folder, job, { confirm, baseSha256 } = {}) =>
    httpClient
      .delete(E.workflowJob(env, id, folder, job), {
        params: {
          ...(confirm ? { confirm: 1 } : {}),
          ...(baseSha256 ? { base_sha256: baseSha256 } : {}),
        },
      })
      .then((r) => r.data),
  addFolder: (env, id, body) => send('post', E.workflowFolders(env, id), body),
  deleteFolder: (env, id, folder, { confirm, baseSha256 } = {}) =>
    httpClient
      .delete(E.workflowFolder(env, id, folder), {
        params: {
          ...(confirm ? { confirm: 1 } : {}),
          ...(baseSha256 ? { base_sha256: baseSha256 } : {}),
        },
      })
      .then((r) => r.data),
  approve: (env, digest) => send('post', E.approve(env), { digest }),
  setScheduler: (env, enabled) => send('post', E.scheduler(env), { enabled }),
  runNow: (env, body) => send('post', E.runNow(env), body),
  recordExecution: (env, body) => send('post', E.recordExecution(env), body),
  getCommand: (env, id) => get(E.command(env, id)),

  // UI schedules: workflow or job level, any recurrence
  getXmlTree: (env) => get(E.xmlTree(env)),
  getJobClosure: (env, { workflow, folder, job }) =>
    get(E.jobClosure(env), { params: { workflow, folder, job } }),
  listSchedules: (env) => get(E.schedules(env)),
  createSchedule: (env, body) => send('post', E.schedules(env), body),
  updateSchedule: (env, id, body) => send('patch', E.scheduleItem(env, id), body),
  deleteSchedule: (env, id) => send('delete', E.scheduleItem(env, id)),
  previewRecurrence: (env, recurrence, count = 5) =>
    send('post', E.schedulePreview(env), { recurrence, count }),
  runScheduleNow: (env, id) => send('post', E.scheduleRunNow(env, id)),

  // Custom EOD profiles
  listProfiles: (env) => get(E.profiles(env)),
  createProfile: (env, body) => send('post', E.profiles(env), body),
  deleteProfile: (env, id) => send('delete', E.profileItem(env, id)),

  // settings and schedule
  getSettings: (env) => get(E.settings(env)),
  updateSettings: (env, body) => send('patch', E.settings(env), body),
  getSchedule: (env) => get(E.schedule(env)),

  // runs
  listRuns: (env) => get(E.runs(env)),
  getRun: (env, id) => get(E.run(env, id)),
  getRunLog: (env, id, job) =>
    get(E.runLog(env, id), {
      params: job ? { job } : undefined,
      responseType: 'text',
      transformResponse: [(d) => d],
    }),
  cancelRun: (env, id) => send('post', E.runCancel(env, id)),
  pauseRun: (env, id) => send('post', E.runPause(env, id)),
  resumeRun: (env, id) => send('post', E.runResume(env, id)),

  // SSH target servers, secrets and NODEID mappings
  listTargets: (env) => get(E.targets(env)),
  createTarget: (env, body) => send('post', E.targets(env), body),
  updateTarget: (env, id, body) => send('patch', E.target(env, id), body),
  deleteTarget: (env, id) => send('delete', E.target(env, id)),
  setTargetSecret: (env, id, secret) => send('put', E.targetSecret(env, id), { secret }),
  clearTargetSecret: (env, id) => send('delete', E.targetSecret(env, id)),
  setMapping: (env, nodeid, targetId) =>
    send('post', E.nodeMappings(env), { nodeid, target_id: targetId }),
  deleteMapping: (env, nodeid) =>
    httpClient.delete(E.nodeMappings(env), { params: { nodeid } }).then((r) => r.data),
  getReadiness: (env) => get(E.readiness(env)),

  // Control Run Cockpit
  getCockpitRuns: (env) => get(E.cockpitRuns(env)),
  getCockpitRun: (env, id) => get(E.cockpitRun(env, id)),
  getCockpitDefinition: (env) => get(E.cockpitDefinition(env)),
  cockpitJobAction: (env, runId, jobName, action) =>
    send('post', E.cockpitJobAction(env, runId, jobName, action), {}),

  // Live Telemetry & Scoped Metrics
  getLiveTelemetry: (env) => get(E.liveTelemetry(env)),
  getGlobalTelemetry: () => get(E.globalTelemetry),
  getJobMetrics: (env, job) => get(E.jobMetrics(env, job)),
  getJobHistory: (env, job, limit = 50) => get(E.jobHistory(env, job), { params: { limit } }),
  getWorkflowMetrics: (env, folder) => get(E.workflowMetrics(env, folder)),
  getWorkflowHistory: (env, folder, limit = 50) => get(E.workflowHistory(env, folder), { params: { limit } }),
};

export default eodSchedulerService;
