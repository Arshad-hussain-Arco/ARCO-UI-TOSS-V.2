import api from '@api/httpClient';
import endpoints from '@api/endpoints';
import * as murexMocks from '@mocks/handlers/murexHandlers';
import { clone } from '@utils/async';
import { MUREX_HOURLY_HEATMAP, MUREX_MONTHLY_HEATMAP } from '@mocks/data/murex';
import { shapeOverviewRuns } from '@pages/MurexRuntimeTrends/overviewApiTransform';

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
      let paramStr = '';
      if (timeRange && timeRange !== 'all') {
        const days = timeRange.replace(/[^0-9]/g, '');
        paramStr = `days=${days}`;
      }
      const query = paramStr ? `?${paramStr}` : '';
      const kpiRes = await api.get(`${endpoints.scriptManager.runtimeFileKpis}${query}`);
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
      
      // If the backend explicitly returned a 'No runs found' message (or any 404), do not fall back to mocks
      const errorMessage = err.response?.data?.detail || '';
      if (errorMessage.toLowerCase().includes('no runs found') || err.response?.status === 404) {
        return {
          summary: { min: '0s', max: '0s', avg: '0s', latest: 'N/A', trend: 0, outliers: 0 },
          trend: [],
          scripts: [],
          hourlyHeatmap: [],
          monthlyHeatmap: [],
        };
      }

      // Fallback to mock data if API is not fully up or it's a completely different error
      const mock = await murexMocks.getRuntimeTrends();
      return mock;
    }
  },
  fetchScriptTimeseries: async (scriptName) => {
    try {
      const res = await api.get(`${endpoints.scriptManager.runtimeFile}?script_name=${scriptName}`);
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
      
      // Calculate Trend according to provided logic
      let calculatedTrend = { direction: 'stable', percentage: 0 };
      if (durationsInMinutes.length >= 2) {
        const recent = durationsInMinutes.slice(-5);
        const older = durationsInMinutes.slice(-10, -5);
        if (recent.length > 0 && older.length > 0) {
          const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
          const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
          const change = ((recentAvg - olderAvg) / olderAvg) * 100;
          if (Math.abs(change) >= 5) {
            calculatedTrend = {
              direction: change > 0 ? 'up' : 'down',
              percentage: Math.abs(change)
            };
          } else {
             calculatedTrend.percentage = Math.abs(change);
          }
        }
      }

      // Calculate Frequency according to provided logic
      let calculatedFrequency = 'N/A';
      if (labels.length >= 2) {
        const dates = labels.map(cat => new Date(cat)).sort((a, b) => a - b);
        const daysDiff = (dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24);
        const frequency = labels.length / Math.max(daysDiff, 1);
        if (frequency >= 1) calculatedFrequency = `${frequency.toFixed(1)}/day`;
        else if (frequency >= 0.14) calculatedFrequency = `${(frequency * 7).toFixed(1)}/week`;
        else calculatedFrequency = `${(frequency * 30).toFixed(1)}/month`;
      }

      // Calculate Status Info according to provided logic
      let calculatedStatus = { status: 'normal', color: 'primary' };
      if (durationsInMinutes.length > 0) {
        const hasRecentOutliers = history.some(run => {
          if (run.status !== 'error') return false;
          const outlierTime = new Date(run.date).getTime();
          const recentTime = Date.now() - (24 * 60 * 60 * 1000);
          return outlierTime > recentTime;
        });
        const latestValue = durationsInMinutes[durationsInMinutes.length - 1];
        if (hasRecentOutliers) {
          calculatedStatus = { status: 'warning', color: 'warning' };
        } else if (latestValue > avgRuntimeMin * 1.5) {
          calculatedStatus = { status: 'error', color: 'danger' };
        } else if (latestValue < avgRuntimeMin * 0.8) {
          calculatedStatus = { status: 'success', color: 'success' };
        }
      }

      return {
        history,
        trendData: durationsInMinutes.map(Math.round),
        calculatedTrend,
        calculatedFrequency,
        calculatedStatus
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
  getOverviewAvailableDates: async () => {
    try {
      const res = await api.get(endpoints.scriptManager.runtimeFileOverview, {
        params: { dates_only: true },
      });
      return res.data?.dates || [];
    } catch (err) {
      console.error('Failed to fetch overview available dates:', err);
      return murexMocks.getOverviewAvailableDates();
    }
  },
  getOverviewTimeline: async (isoDate) => {
    try {
      const res = await api.get(endpoints.scriptManager.runtimeFileOverview, {
        params: { date: isoDate },
      });
      const runs = res.data?.data || [];
      return shapeOverviewRuns(runs, isoDate);
    } catch (err) {
      // A 404 here just means "no runs recorded for this date" - not an error condition
      if (err.response?.status === 404) {
        return { matrixJobs: [], timelineList: [] };
      }
      console.error('Failed to fetch overview timeline:', err);
      const mockRuns = await murexMocks.getOverviewRuns(isoDate);
      return shapeOverviewRuns(mockRuns, isoDate);
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
