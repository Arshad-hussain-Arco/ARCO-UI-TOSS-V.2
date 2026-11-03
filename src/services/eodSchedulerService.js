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
  approve: (env, digest) => send('post', E.approve(env), { digest }),
  setScheduler: (env, enabled) => send('post', E.scheduler(env), { enabled }),
  runNow: (env, body) => send('post', E.runNow(env), body),
  getCommand: (env, id) => get(E.command(env, id)),

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
};

export default eodSchedulerService;
