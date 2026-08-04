import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import eodService from '../../../services/eodService';

const EodContext = createContext(null);

const formatSeconds = (totalSecs) => {
  if (totalSecs === undefined || totalSecs === null || totalSecs < 0) return '00:00:00';
  const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSecs % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
};

export function EodProvider({ children }) {
  const [environments, setEnvironments] = useState([]);
  const [controlsEnvs, setControlsEnvs] = useState([]);
  const [backendMetrics, setBackendMetrics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingControls, setIsLoadingControls] = useState(true);
  const [error, setError] = useState(null);
  const [controlsError, setControlsError] = useState(null);

  const fetchEnvironments = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setError(null);
    try {
      const { environments: records, metrics: apiMetrics } = await eodService.getEodOverview();
      const initializedRecords = records.map((item) => {
        const isRunning = item.status === 'running';
        const isPaused = item.status === 'paused';
        const startedAtMs = (isRunning || isPaused) && item.startedAtMs ? item.startedAtMs : ((isRunning || isPaused) && item.lastRun && item.lastRun !== '—' ? new Date(item.lastRun).getTime() : null);
        const initialSecs = startedAtMs ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)) : (item.elapsedSeconds || 0);
        return {
          ...item,
          startedAtMs,
          elapsedSeconds: initialSecs,
          duration: (isRunning || isPaused) ? formatSeconds(initialSecs) : item.duration || '—',
        };
      });
      setEnvironments(initializedRecords);
      setBackendMetrics(apiMetrics);
    } catch (err) {
      console.error('Failed to fetch EOD environment state:', err);
      setError(err?.message || 'Failed to load EOD environments');
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, []);

  const fetchControlsData = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoadingControls(true);
    setControlsError(null);
    try {
      const data = await eodService.getEodControls();
      const initializedControls = data.map((item) => {
        const isRunning = item.status === 'running';
        const isPaused = item.status === 'paused';
        const startedAtMs = (isRunning || isPaused) && item.startedAtMs ? item.startedAtMs : ((isRunning || isPaused) && item.modified ? new Date(item.modified).getTime() : null);
        const initialSecs = startedAtMs ? Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)) : (item.elapsedSeconds || 0);
        return {
          ...item,
          startedAtMs,
          elapsedSeconds: initialSecs,
          duration: (isRunning || isPaused) ? formatSeconds(initialSecs) : item.duration || '—',
        };
      });
      setControlsEnvs(initializedControls);
    } catch (err) {
      console.error('Failed to fetch EOD controls data:', err);
      setControlsError(err?.message || 'Failed to load control panel');
    } finally {
      if (showLoader) setIsLoadingControls(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments(true);
  }, [fetchEnvironments]);

  // Global live timer ticker — derives elapsed from server startedAtMs so all tabs stay in sync
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();

      // Tick Overview Environments
      setEnvironments((prevEnvs) => {
        const hasActiveRun = prevEnvs.some((e) => e.status === 'running' || e.status === 'paused');
        if (!hasActiveRun) return prevEnvs;
        return prevEnvs.map((e) => {
          if (e.status === 'running' || e.status === 'paused') {
            const nextSecs = e.startedAtMs
              ? Math.max(0, Math.floor((now - e.startedAtMs) / 1000))
              : (e.elapsedSeconds || 0) + 1;
            return {
              ...e,
              elapsedSeconds: nextSecs,
              duration: formatSeconds(nextSecs),
            };
          }
          return e;
        });
      });

      // Tick Controls Environments
      setControlsEnvs((prevEnvs) => {
        const hasActiveRun = prevEnvs.some((e) => e.status === 'running' || e.status === 'paused');
        if (!hasActiveRun) return prevEnvs;
        return prevEnvs.map((e) => {
          if (e.status === 'running' || e.status === 'paused') {
            const nextSecs = e.startedAtMs
              ? Math.max(0, Math.floor((now - e.startedAtMs) / 1000))
              : (e.elapsedSeconds || 0) + 1;
            return {
              ...e,
              elapsedSeconds: nextSecs,
              duration: formatSeconds(nextSecs),
            };
          }
          return e;
        });
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleStartEOD = useCallback(async (id) => {
    const nowMs = Date.now();
    setEnvironments((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'running',
              lastRunScript: 'start',
              progress: 5,
              color: '#6366f1',
              startedAtMs: nowMs,
              elapsedSeconds: 0,
              duration: '00:00:00',
            }
          : e
      )
    );
    setControlsEnvs((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'running',
              progress: 5,
              color: '#6366f1',
              startedAtMs: nowMs,
              elapsedSeconds: 0,
              duration: '00:00:00',
            }
          : e
      )
    );
    try {
      await eodService.executeEodScript(id, 'start');
    } catch (err) {
      console.error('Failed to trigger start script:', err);
    }
  }, []);

  const handlePauseEOD = useCallback(async (id) => {
    let jobType = 'pause';
    const updateFn = (prev) =>
      prev.map((e) => {
        if (e.id === id) {
          const isCurrentlyPaused = e.status === 'paused';
          jobType = isCurrentlyPaused ? 'resume' : 'pause';
          const nextStatus = isCurrentlyPaused ? 'running' : 'paused';
          return {
            ...e,
            status: nextStatus,
            lastRunScript: jobType,
            color: nextStatus === 'running' ? '#6366f1' : '#f59e0b',
          };
        }
        return e;
      });

    setEnvironments(updateFn);
    setControlsEnvs(updateFn);

    try {
      await eodService.executeEodScript(id, jobType);
    } catch (err) {
      console.error(`Failed to trigger ${jobType} script:`, err);
    }
  }, []);

  const handleStopEOD = useCallback(async (id) => {
    const updateFn = (prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'stopped',
              lastRunScript: 'stop',
              progress: 0,
              stepsDone: 0,
              currentStep: 'Stopped',
              color: '#64748b',
              elapsedSeconds: 0,
              duration: '—',
            }
          : e
      );

    setEnvironments(updateFn);
    setControlsEnvs(updateFn);

    try {
      await eodService.executeEodScript(id, 'stop');
    } catch (err) {
      console.error('Failed to trigger stop script:', err);
    }
  }, []);

  const metrics = useMemo(() => {
    const total = backendMetrics?.total !== undefined ? backendMetrics.total : environments.length;
    const running = environments.filter((e) => e.status === 'running').length;
    const completed = environments.filter((e) => e.status === 'completed').length;
    const failed = environments.filter((e) => e.status === 'failed').length;

    const liveRunningEnv = environments.find((e) => e.status === 'running');
    const runningEnv = liveRunningEnv
      ? {
          ...(backendMetrics?.runningEnv || {}),
          ...liveRunningEnv,
          duration: liveRunningEnv.duration,
        }
      : null;

    return { total, running, completed, failed, runningEnv };
  }, [environments, backendMetrics]);

  const value = useMemo(
    () => ({
      environments,
      controlsEnvs,
      isLoading,
      isLoadingControls,
      error,
      controlsError,
      refreshEnvironments: () => fetchEnvironments(false),
      fetchControlsData,
      handleStartEOD,
      handlePauseEOD,
      handleStopEOD,
      metrics,
    }),
    [
      environments,
      controlsEnvs,
      isLoading,
      isLoadingControls,
      error,
      controlsError,
      fetchEnvironments,
      fetchControlsData,
      handleStartEOD,
      handlePauseEOD,
      handleStopEOD,
      metrics,
    ]
  );

  return <EodContext.Provider value={value}>{children}</EodContext.Provider>;
}

export function useEodContext() {
  const context = useContext(EodContext);
  if (!context) {
    throw new Error('useEodContext must be used within an EodProvider');
  }
  return context;
}
