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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEnvironments = useCallback(async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setError(null);
    try {
      const records = await eodService.getEodRecords();
      // Initialize elapsedSeconds starting from 0 if running
      const initializedRecords = records.map((item) => {
        const isRunning = item.status === 'running';
        const isPaused = item.status === 'paused';
        const initialSecs = isRunning || isPaused ? item.elapsedSeconds || 0 : 0;
        return {
          ...item,
          elapsedSeconds: initialSecs,
          duration: isRunning || isPaused ? formatSeconds(initialSecs) : '—',
        };
      });
      setEnvironments(initializedRecords);
    } catch (err) {
      console.error('Failed to fetch EOD environment state:', err);
      setError(err?.message || 'Failed to load EOD environments');
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments(true);
  }, [fetchEnvironments]);

  // Global live timer ticker for all running environments
  useEffect(() => {
    const timer = setInterval(() => {
      setEnvironments((prevEnvs) => {
        const hasRunning = prevEnvs.some((e) => e.status === 'running');
        if (!hasRunning) return prevEnvs;

        return prevEnvs.map((e) => {
          if (e.status === 'running') {
            const nextSecs = (e.elapsedSeconds || 0) + 1;
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
    setEnvironments((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'running',
              lastRunScript: 'start',
              progress: 5,
              stepsDone: 1,
              currentStep: 'Executing start script...',
              color: '#6366f1',
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
    setEnvironments((prev) =>
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
      })
    );
    try {
      await eodService.executeEodScript(id, jobType);
    } catch (err) {
      console.error(`Failed to trigger ${jobType} script:`, err);
    }
  }, []);

  const handleStopEOD = useCallback(async (id) => {
    setEnvironments((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: 'idle',
              lastRunScript: 'stop',
              progress: 0,
              stepsDone: 0,
              currentStep: 'Stopped',
              color: '#64748b',
              elapsedSeconds: 0,
              duration: '—',
            }
          : e
      )
    );
    try {
      await eodService.executeEodScript(id, 'stop');
    } catch (err) {
      console.error('Failed to trigger stop script:', err);
    }
  }, []);

  const metrics = useMemo(() => {
    const total = environments.length;
    const running = environments.filter((e) => e.status === 'running').length;
    const completed = environments.filter((e) => e.status === 'completed').length;
    const failed = environments.filter((e) => e.status === 'failed').length;
    const runningEnv = environments.find((e) => e.status === 'running');

    return { total, running, completed, failed, runningEnv };
  }, [environments]);

  const value = useMemo(
    () => ({
      environments,
      isLoading,
      error,
      refreshEnvironments: () => fetchEnvironments(false),
      handleStartEOD,
      handlePauseEOD,
      handleStopEOD,
      metrics,
    }),
    [environments, isLoading, error, fetchEnvironments, handleStartEOD, handlePauseEOD, handleStopEOD, metrics]
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
