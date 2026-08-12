import api from '@api/httpClient';
import endpoints from '@api/endpoints';
import * as murexMocks from '@mocks/handlers/murexHandlers';
import { clone } from '@utils/async';
import { MUREX_HOURLY_HEATMAP, MUREX_MONTHLY_HEATMAP } from '@mocks/data/murex';

const formatTime = (totalMinutes) => {
  if (isNaN(totalMinutes)) return '0s';
  const totalSeconds = Math.round(totalMinutes * 60);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  
  return parts.join(' ');
};

export const murexService = {
  ...murexMocks,
  getRuntimeTrends: async (timeRange = '7d') => {
    try {
      const paramStr = timeRange ? timeRange.replace('d', 'days') : '7days';
      const kpiRes = await api.get(`${endpoints.scriptManager.runtimeFileKpis}?${paramStr}`);
      const kpiData = kpiRes.data?.data || kpiRes.data || {};
      
      const scripts = [];
      let minRuntimes = [];
      let maxRuntimes = [];
      let avgRuntimes = [];
      
      Object.keys(kpiData).forEach((scriptName) => {
        const scriptKpis = kpiData[scriptName] || {};
        
        const minRuntime = (scriptKpis.min_duration || 0) / 60;
        const maxRuntime = (scriptKpis.max_duration || 0) / 60;
        const avgRuntimeMin = (scriptKpis.average_duration || 0) / 60;
        
        minRuntimes.push(minRuntime);
        maxRuntimes.push(maxRuntime);
        avgRuntimes.push(avgRuntimeMin);
        
        let category = 'Other';
        const upperName = scriptName.toUpperCase();
        if (upperName.includes('ETL')) category = 'ETL';
        else if (upperName.includes('BACKUP')) category = 'Backup';
        else if (upperName.includes('ALERT')) category = 'Alert Check';
        else if (upperName.includes('CLEANUP')) category = 'Cleanup';
        else if (upperName.includes('SYNC')) category = 'Data Sync';

        let health = 'Healthy';
        if (maxRuntime > avgRuntimeMin * 2) health = 'Critical';
        else if (maxRuntime > avgRuntimeMin * 1.5) health = 'Warning';

        scripts.push({
          id: scriptName,
          name: scriptName,
          category,
          lastRun: scriptKpis.latest_run || 'N/A',
          avgRuntime: formatTime(avgRuntimeMin),
          status: 'Active',
          health,
          frequency: 1,
          minRuntime: Math.round(minRuntime),
          maxRuntime: Math.round(maxRuntime),
          minRuntimeFormatted: formatTime(minRuntime),
          maxRuntimeFormatted: formatTime(maxRuntime),
          trendData: [], // Will be populated on expand
          trendSlope: scriptKpis.trend_slope || 0,
          isPinned: false,
          history: [], // Will be populated on expand
          totalExecutions: scriptKpis.run_count || 0,
          runCount: scriptKpis.run_count || 0,
          p95Duration: (scriptKpis.p95_duration || 0) / 60,
          p95DurationFormatted: formatTime((scriptKpis.p95_duration || 0) / 60),
          successRate: 100, // Hardcoded or calculated later
          failedRuns: 0, // Outliers mock
          outlierCount: 0,
        });
      });
      
      const minGlobal = minRuntimes.length ? Math.min(...minRuntimes) : 0;
      const maxGlobal = maxRuntimes.length ? Math.max(...maxRuntimes) : 0;
      const avgGlobal = avgRuntimes.length ? avgRuntimes.reduce((a, b) => a + b, 0) / avgRuntimes.length : 0;

      const summary = {
        min: formatTime(minGlobal),
        max: formatTime(maxGlobal),
        avg: formatTime(avgGlobal),
        latest: 'N/A',
        trend: 0,
        outliers: 0,
      };

      return {
        summary,
        trend: [], // Global trend requires full data, omit for now
        scripts,
        hourlyHeatmap: clone(MUREX_HOURLY_HEATMAP),
        monthlyHeatmap: clone(MUREX_MONTHLY_HEATMAP),
      };
    } catch (err) {
      console.error('Failed to fetch runtime trends:', err);
      // Fallback to mock data if API is not fully up or errors out
      const mock = await murexMocks.getRuntimeTrends();
      return mock;
    }
  },
  fetchScriptTimeseries: async (scriptName, timeRange = '7d') => {
    try {
      const paramStr = timeRange ? timeRange.replace('d', 'days') : '7days';
      const res = await api.get(`${endpoints.scriptManager.runtimeFile}?${paramStr}&script_name=${scriptName}`);
      const rawData = res.data?.data || res.data || {};
      const scriptData = rawData[scriptName] || {};
      const durations = scriptData.time_duration || [];
      const labels = scriptData.labels || [];
      
      const durationsInMinutes = durations.map(d => d / 60);
      const avgRuntimeMin = durationsInMinutes.length ? durationsInMinutes.reduce((a, b) => a + b, 0) / durationsInMinutes.length : 0;
      
      const history = labels.map((date, i) => {
        const runDurationMin = durationsInMinutes[i] || 0;
        let runStatus = 'success';
        if (runDurationMin > avgRuntimeMin * 2) runStatus = 'error';
        else if (runDurationMin > avgRuntimeMin * 1.5) runStatus = 'warning';
        
        let runTitle = 'Execution Completed';
        if (runStatus === 'error') runTitle = 'Execution Failed';
        else if (runStatus === 'warning') runTitle = 'Runtime Threshold Exceeded';

        return {
          date,
          durationFormatted: formatTime(runDurationMin),
          durationMin: Math.round(runDurationMin),
          status: runStatus,
          title: runTitle,
        };
      }).reverse();
      
      return {
        history,
        trendData: durationsInMinutes.map(Math.round)
      };
    } catch (err) {
      console.error('Failed to fetch script timeseries:', err);
      return { history: [], trendData: [] };
    }
  },
  fetchRuntimeDetails: async (params) => {
    try {
      const res = await api.get(endpoints.scriptManager.runtimeFile, { params });
      return res.data;
    } catch (err) {
      console.error('Failed to fetch runtime details:', err);
      return null;
    }
  },
  getCategories: async () => {
    const res = await api.get(endpoints.scriptManager.categories.list);
    return res.data?.categories || res.data?.results || res.data || [];
  },
  createCategory: async (payload) => {
    const res = await api.post(endpoints.scriptManager.categories.create, payload);
    return res.data;
  },
  updateCategory: async (id, payload) => {
    const res = await api.put(endpoints.scriptManager.categories.update(id), payload);
    return res.data;
  },
  deleteCategory: async (id) => {
    const res = await api.delete(endpoints.scriptManager.categories.delete(id));
    return res.data;
  },
};
export default murexService;
