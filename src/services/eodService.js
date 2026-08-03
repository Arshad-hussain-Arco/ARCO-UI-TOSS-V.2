import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';
import { formToCron, cronToHuman } from '@utils/cronUtils';

export const eodService = {
  /**
   * Fetches EOD overview status & metrics directly from /api/eod-jobs/overview/
   */
  getEodOverview: async () => {
    const response = await httpClient.get(endpoints.eodJobs.overview);
    return response.data;
  },

  /**
   * Fetches EOD job configuration records from the revamped API.
   * Maps backend properties to UI-friendly environment state object.
   */
  getEodRecords: async () => {
    const response = await httpClient.get(endpoints.eodJobs.records);
    const data = response.data || [];

    return data.map((item) => {
      const scriptType = (item.last_run_script || '').toLowerCase();
      const isRunning = scriptType === 'start' || scriptType === 'resume';
      const isPaused = scriptType === 'pause';
      const isCompleted = scriptType === 'stop' || scriptType === 'completed';
      let derivedStatus = 'idle';
      if (isRunning) derivedStatus = 'running';
      else if (isPaused) derivedStatus = 'paused';
      else if (isCompleted) derivedStatus = 'completed';

      let elapsedSeconds = 0;
      let startedAtMs = null;
      if ((isRunning || isPaused) && item.modified) {
        const startedTime = new Date(item.modified).getTime();
        if (!isNaN(startedTime)) {
          startedAtMs = startedTime;
          const diff = Math.floor((Date.now() - startedTime) / 1000);
          elapsedSeconds = diff > 0 ? diff : 0;
        }
      }

      const hrs = String(Math.floor(elapsedSeconds / 3600)).padStart(2, '0');
      const mins = String(Math.floor((elapsedSeconds % 3600) / 60)).padStart(2, '0');
      const secs = String(elapsedSeconds % 60).padStart(2, '0');
      const formattedDuration = (isRunning || isPaused) ? `${hrs}:${mins}:${secs}` : '—';

      return {
        id: item.id,
        name: item.environment || '',
        environment: item.environment || '',
        isActive: item.is_active === 'Yes' || item.is_active === 1 || item.is_active === true,
        serverIp: item.server_ip || '',
        userName: item.server_username || item.user_name || '',
        password: item.server_password || '',
        port: item.port_no ? String(item.port_no) : '22',
        logFilePath: item.log_file_path || '',
        scriptPath: item.eod_path || '',
        startScript: item.start_script || 'start.sh',
        pauseScript: item.pause_script || 'pause.sh',
        stopScript: item.stop_script || 'stop.sh',
        statusFileName: item.status_file_name || 'myjobstorun.txt',
        jobsFileName: item.jobs_torun_original_filename || '',
        lastRunScript: item.last_run_script || '',
        modified: item.modified || '',
        // Dynamic Presentation fields derived from last_run_script and start timestamp
        status: derivedStatus,
        startedAtMs,
        elapsedSeconds,
        progress: item.progress !== undefined ? item.progress : (isRunning ? 45 : isCompleted ? 100 : 0),
        color: derivedStatus === 'running' ? '#6366f1' : derivedStatus === 'paused' ? '#f59e0b' : derivedStatus === 'completed' ? '#10b981' : '#64748b',
        logs: item.logs || [],
        stepsDone: item.stepsDone !== undefined ? item.stepsDone : 0,
        stepsTotal: item.stepsTotal !== undefined ? item.stepsTotal : 0,
        runningJobName: item.runningJobName || '',
        runningJobNo: item.runningJobNo || 0,
        nextJobName: item.nextJobName || '',
        currentStep: item.currentStep || '',
        duration: formattedDuration,
        lastRun: item.modified ? new Date(item.modified).toLocaleString() : '—',
        nextRun: '—',
      };
    });
  },

  getEodStatus: async () => {
    try {
      const environments = await eodService.getEodRecords();
      return {
        environments,
        schedules: [],
      };
    } catch (err) {
      console.error('Failed to fetch EOD records from backend API:', err);
      throw err;
    }
  },

  createEodRecord: async (payload) => {
    const body = {
      environment: payload.name || payload.environment,
      eod_path: payload.scriptPath || payload.eod_path || '',
      start_script: payload.startScript || payload.start_script || '',
      pause_script: payload.pauseScript || payload.pause_script || '',
      stop_script: payload.stopScript || payload.stop_script || '',
      log_file_path: payload.logFilePath || payload.log_file_path || '',
      user_name: payload.userName || payload.user_name || '',
      server_ip: payload.serverIp || payload.server_ip || '',
      server_username: payload.userName || payload.server_username || '',
      server_password: payload.password || payload.server_password || '',
      port_no: payload.port ? parseInt(payload.port, 10) : null,
      status_file_name: payload.statusFileName || payload.status_file_name || '',
      jobs_torun_original_filename: payload.jobsFileName || payload.jobs_torun_original_filename || '',
      is_active: Boolean(payload.isActive),
    };
    const response = await httpClient.post(endpoints.eodJobs.createRecord, body);
    return response.data;
  },

  updateEodRecord: async (id, payload) => {
    const body = {
      environment: payload.name || payload.environment,
      eod_path: payload.scriptPath || payload.eod_path || '',
      start_script: payload.startScript || payload.start_script || '',
      pause_script: payload.pauseScript || payload.pause_script || '',
      stop_script: payload.stopScript || payload.stop_script || '',
      log_file_path: payload.logFilePath || payload.log_file_path || '',
      user_name: payload.userName || payload.user_name || '',
      server_ip: payload.serverIp || payload.server_ip || '',
      server_username: payload.userName || payload.server_username || '',
      server_password: payload.password || payload.server_password || '',
      port_no: payload.port ? parseInt(payload.port, 10) : null,
      status_file_name: payload.statusFileName || payload.status_file_name || '',
      jobs_torun_original_filename: payload.jobsFileName || payload.jobs_torun_original_filename || '',
      is_active: Boolean(payload.isActive),
    };
    const response = await httpClient.put(endpoints.eodJobs.updateRecord(id), body);
    return response.data;
  },

  deleteEodRecord: async (id) => {
    const response = await httpClient.delete(endpoints.eodJobs.deleteRecord(id));
    return response.data;
  },

  /**
   * Fetches EOD execution schedule records directly from /api/eod-schedules/eod-schedules/
   * Reads environment_id, environment name, and cron_expression, parsing cron_expression for human UI display.
   */
  getEodSchedules: async () => {
    const response = await httpClient.get(endpoints.eodSchedules.list);
    const data = response.data || [];

    return data.map((item) => {
      const parsedCron = cronToHuman(item.cron_expression, '22:00');
      return {
        id: item.id,
        envId: item.environment_id || '',
        environmentName: item.environment || '',
        cronExpression: item.cron_expression || parsedCron.cronExpression,
        dateGroup: parsedCron.dateGroup,
        time: parsedCron.time,
        recurrence: parsedCron.recurrence,
        selectedDays: parsedCron.selectedDays,
        selectedDate: parsedCron.selectedDate,
        isActive: true,
        lastModifiedBy: item.last_modified_by || '',
        lastModifiedOn: item.last_modified_on || '',
      };
    });
  },

  createEodSchedule: async (payload) => {
    const cronStr = formToCron(payload);
    const body = {
      environment_id: payload.envId || payload.environment_id,
      cron_expression: cronStr,
    };
    const response = await httpClient.post(endpoints.eodSchedules.create, body);
    return response.data;
  },

  updateEodSchedule: async (id, payload) => {
    const cronStr = formToCron(payload);
    const body = {
      environment_id: payload.envId || payload.environment_id,
      cron_expression: cronStr,
    };
    const response = await httpClient.put(endpoints.eodSchedules.update(id), body);
    return response.data;
  },

  deleteEodSchedule: async (id) => {
    const response = await httpClient.delete(endpoints.eodSchedules.delete(id));
    return response.data;
  },

  /**
   * Executes batch script (start, pause, resume, stop) for specified environment id
   */
  executeEodScript: async (id, jobType) => {
    const response = await httpClient.post(endpoints.eodJobs.executeScript, {
      id,
      job_type: jobType,
    });
    return response.data;
  },

  /**
   * Fetches live execution progress and updates for specified environment id
   */
  getEodLiveUpdates: async (id) => {
    const response = await httpClient.get(endpoints.eodJobs.liveUpdates(id));
    return response.data;
  },

  /**
   * Finds the log and answer file content for a specific job
   */
  findJobLog: async (id, jobName) => {
    const response = await httpClient.post(endpoints.eodJobs.findLog, {
      id,
      job_name: jobName,
    });
    return response.data;
  },

  /**
   * Fetches the original list of jobs for an environment
   */
  getAllJobs: async (id) => {
    const response = await httpClient.get(endpoints.eodJobs.allJobs(id));
    return response.data;
  },

  /**
   * Copies the original jobs file to the status file, resetting execution status
   */
  copyReplaceFile: async (id) => {
    const response = await httpClient.get(endpoints.eodJobs.copyReplace(id));
    return response.data;
  },
};

export default eodService;
