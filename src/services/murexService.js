import api from '@api/httpClient';
import endpoints from '@api/endpoints';
import * as murexMocks from '@mocks/handlers/murexHandlers';
import { clone } from '@utils/async';
import { MUREX_HOURLY_HEATMAP, MUREX_MONTHLY_HEATMAP } from '@mocks/data/murex';

const formatTime = (totalMinutes) => {
  if (isNaN(totalMinutes)) return '00:00:00';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  const s = Math.floor((totalMinutes * 60) % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const murexService = {
  ...murexMocks,
  getRuntimeTrends: async () => {
    try {
      const res = await api.get(endpoints.scriptManager.runtimeFile);
      const rawData = res.data?.data || res.data || {};
      
      const scripts = [];
      let globalTrendMap = {}; // date -> array of runtimes
      
      Object.keys(rawData).forEach((scriptName, index) => {
        const processData = rawData[scriptName];
        const durations = processData.time_duration || [];
        const labels = processData.labels || [];
        
        // Convert to minutes (assuming API returns milliseconds)
        const durationsInMinutes = durations.map(d => d / 60000);
        const minRuntime = durationsInMinutes.length ? Math.min(...durationsInMinutes) : 0;
        const maxRuntime = durationsInMinutes.length ? Math.max(...durationsInMinutes) : 0;
        const avgRuntimeMin = durationsInMinutes.length ? durationsInMinutes.reduce((a, b) => a + b, 0) / durationsInMinutes.length : 0;
        
        // Populate global trend map
        labels.forEach((date, i) => {
           if (!globalTrendMap[date]) globalTrendMap[date] = [];
           globalTrendMap[date].push(durationsInMinutes[i] || 0);
        });

        // Determine category
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

        const history = (processData.steps || []).map((runData, i) => {
          const runDurationMin = durationsInMinutes[i] || 0;
          let runStatus = 'success';
          if (runDurationMin > avgRuntimeMin * 2) runStatus = 'error';
          else if (runDurationMin > avgRuntimeMin * 1.5) runStatus = 'warning';
          
          let runTitle = 'Execution Completed';
          if (runStatus === 'error') runTitle = 'Execution Failed';
          else if (runStatus === 'warning') runTitle = 'Runtime Threshold Exceeded';

          // Optional: we can include the breakdown of individual steps
          const stepBreakdown = (runData.step || []).map((stepName, stepIndex) => ({
             name: stepName,
             cpu_time: (runData.cpu_time || [])[stepIndex] || 0,
             db_time: (runData.db_time || [])[stepIndex] || 0,
             elapsed_time: (runData.elapsed_time || [])[stepIndex] || 0,
          }));

          return {
            date: labels[i] || 'Unknown Date',
            durationFormatted: formatTime(runDurationMin),
            durationMin: Math.round(runDurationMin),
            status: runStatus,
            title: runTitle,
            steps: stepBreakdown,
          };
        }).reverse(); // Most recent first

        scripts.push({
          id: scriptName,
          name: scriptName,
          category,
          lastRun: labels[labels.length - 1] || 'N/A',
          avgRuntime: formatTime(avgRuntimeMin),
          status: 'Active',
          health,
          frequency: 1, // Defaulting to 1 as we don't have this from API
          minRuntime: Math.round(minRuntime),
          maxRuntime: Math.round(maxRuntime),
          trendData: durationsInMinutes.map(Math.round),
          isPinned: false,
          history,
          totalExecutions: labels.length,
          successRate: labels.length > 0 
             ? Math.round((history.filter(h => h.status !== 'error').length / labels.length) * 100 * 10) / 10 
             : 0,
          failedRuns: history.filter(h => h.status === 'error').length,
        });
      });
      
      // Calculate global trend
      const allDates = Object.keys(globalTrendMap).sort();
      const trend = allDates.map(date => {
         const sum = globalTrendMap[date].reduce((a, b) => a + b, 0);
         const average = sum / (Object.keys(rawData).length || 1); // rough average per script
         return {
           date,
           runtime: Math.round(sum),
           average: Math.round(average),
           isOutlier: false,
         };
      });

      // Calculate global summary
      const allRuntimes = trend.map(t => t.runtime);
      const minGlobal = allRuntimes.length ? Math.min(...allRuntimes) : 0;
      const maxGlobal = allRuntimes.length ? Math.max(...allRuntimes) : 0;
      const avgGlobal = allRuntimes.length ? allRuntimes.reduce((a, b) => a + b, 0) / allRuntimes.length : 0;
      const latestGlobal = allRuntimes.length ? allRuntimes[allRuntimes.length - 1] : 0;

      const summary = {
        min: formatTime(minGlobal),
        max: formatTime(maxGlobal),
        avg: formatTime(avgGlobal),
        latest: formatTime(latestGlobal),
        trend: 0,
        outliers: 0,
      };

      return {
        summary,
        trend,
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
