import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Server, Clock, Eye } from 'lucide-react';
import eodService from '../../../services/eodService';
import { settingsService } from '../../../services/settingsService';
import { LogViewerModal } from './LogViewerModal';
import { env as appEnv } from '../../../config/env';

const formatSeconds = (totalSecs) => {
  const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSecs % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
};

export function CtrlCard({ env, onStart, onPause, onStop, canExecute, canViewLogs }) {
  const isRunning = env.status === 'running';
  const isCompleted = env.status === 'completed';
  const isFailed = env.status === 'failed';
  const isPaused = env.status === 'paused';
  const isStopped = env.status === 'stopped' || env.status === 'idle';
  const canStart = env.status === 'idle' || env.status === 'failed' || env.status === 'stopped' || env.status === 'completed';
  const canPause = isRunning;
  const canStop = isRunning || isPaused;

  const [liveLog, setLiveLog] = useState(env.logs || []);
  const [currentStepName, setCurrentStepName] = useState(env.currentStep || 'Idle');
  const [liveRunningJobName, setLiveRunningJobName] = useState(env.runningJobName || '');
  const [liveRunningJobNo, setLiveRunningJobNo] = useState(env.runningJobNo || 0);
  const [liveNextJobName, setLiveNextJobName] = useState(env.nextJobName || '');
  const [liveStepsDone, setLiveStepsDone] = useState(env.stepsDone || 0);
  const [liveStepsTotal, setLiveStepsTotal] = useState(env.stepsTotal || 0);
  const [liveProgress, setLiveProgress] = useState(env.progress || 0);
  const [wsConnected, setWsConnected] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [heartbeatMs, setHeartbeatMs] = useState(3000);
  const wsRef = useRef(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    if (env.runningJobName !== undefined) setLiveRunningJobName(env.runningJobName);
    if (env.runningJobNo !== undefined) setLiveRunningJobNo(env.runningJobNo);
    if (env.nextJobName !== undefined) setLiveNextJobName(env.nextJobName);
    if (env.stepsDone !== undefined) setLiveStepsDone(env.stepsDone);
    if (env.stepsTotal !== undefined) setLiveStepsTotal(env.stepsTotal);
    if (env.progress !== undefined) setLiveProgress(env.progress);
  }, [env.runningJobName, env.runningJobNo, env.nextJobName, env.stepsDone, env.stepsTotal, env.progress]);

  // Fetch eodHeartbeatInterval from system settings (app module)
  useEffect(() => {
    const fetchHeartbeatConfig = async () => {
      try {
        const config = await settingsService.getEnvironmentConfig();
        if (config && config.eodHeartbeatInterval) {
          const secondsVal = parseInt(config.eodHeartbeatInterval, 10);
          if (!isNaN(secondsVal) && secondsVal > 0) {
            setHeartbeatMs(secondsVal * 1000);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch eodHeartbeatInterval config:', err);
      }
    };
    fetchHeartbeatConfig();
  }, []);

  // WebSocket connection & live polling fallback using configured eodHeartbeatInterval
  useEffect(() => {
    if (!isRunning) {
      setWsConnected(false);
      return;
    }

    const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    
    // Derive WS base from the centralized API config (convert http(s) to ws(s))
    // Fall back to window.location if appEnv.apiBaseUrl is empty
    const wsBase = appEnv.apiBaseUrl 
      ? appEnv.apiBaseUrl.replace(/^http/, 'ws') 
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;
      
    const wsUrl = `${wsBase}/ws/eod-jobs/${env.id}/${token ? `?token=${token}` : ''}`;
    let ws = null;
    let pollInterval = null;

    try {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.logs) setLiveLog(data.logs);
          if (data.currentStep) setCurrentStepName(data.currentStep);
          if (data.runningJobName !== undefined) setLiveRunningJobName(data.runningJobName);
          if (data.runningJobNo !== undefined) setLiveRunningJobNo(data.runningJobNo);
          if (data.nextJobName !== undefined) setLiveNextJobName(data.nextJobName);
          if (data.stepsDone !== undefined) setLiveStepsDone(data.stepsDone);
          if (data.stepsTotal !== undefined) setLiveStepsTotal(data.stepsTotal);
          if (data.progress !== undefined) setLiveProgress(data.progress);
        } catch (e) {
          console.warn('WS message parse error:', e);
        }
      };

      ws.onerror = () => { };
    } catch (e) { }

    pollInterval = setInterval(async () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        try {
          const update = await eodService.getEodLiveUpdates(env.id);
          if (update) {
            if (update.logs && update.logs.length > 0) setLiveLog(update.logs);
            if (update.currentStep) setCurrentStepName(update.currentStep);
            if (update.runningJobName !== undefined) setLiveRunningJobName(update.runningJobName);
            if (update.runningJobNo !== undefined) setLiveRunningJobNo(update.runningJobNo);
            if (update.nextJobName !== undefined) setLiveNextJobName(update.nextJobName);
            if (update.stepsDone !== undefined) setLiveStepsDone(update.stepsDone);
            if (update.stepsTotal !== undefined) setLiveStepsTotal(update.stepsTotal);
            if (update.progress !== undefined) setLiveProgress(update.progress);
          }
        } catch (e) {
          // Silent catch for polling
        }
      }
    }, heartbeatMs);

    return () => {
      if (ws) ws.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [isRunning, env.id, heartbeatMs]);

  const displayTime = env.duration || '—';
  const totalJobs = liveStepsTotal || env.stepsTotal || 0;
  const currentJobNo = isCompleted
    ? totalJobs
    : (liveRunningJobNo || env.runningJobNo || liveStepsDone || env.stepsDone || (isRunning ? 1 : 0));
  const currentJobName = isCompleted
    ? 'All Jobs Completed'
    : (liveRunningJobName || env.runningJobName || currentStepName || '—');
  const nextJobName = isCompleted
    ? '—'
    : (liveNextJobName || env.nextJobName || 'None');
  const currentProgress = liveProgress !== undefined ? liveProgress : (env.progress || 0);

  return (
    <>
      <div className={`eod-ctrl-card ${env.status}`}>
        <div className={`eod-ctrl-strip ${env.status}`} />

        <div className="eod-ctrl-head">
          <span className="eod-ctrl-env-name">{env.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {canViewLogs && (
              <button
                onClick={() => setIsLogModalOpen(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                }}
                title="View Logs"
              >
                <Eye size={16} />
              </button>
            )}
            <div
              className="eod-ctrl-status"
              style={{ color: env.color || '#6366f1', background: `${env.color || '#6366f1'}18` }}
            >
              {isRunning && (
                <span className="eod-pill-dot" style={{ background: env.color || '#6366f1' }} />
              )}
              {(env.status || 'idle').toUpperCase()}
            </div>
          </div>
        </div>

        {/* Action row — Start/Pause/Resume/Stop all require EOD_CONTROL_EXECUTE */}
        {canExecute && (
          <div className="eod-ctrl-actions">
            <button
              className="eod-ctrl-btn eod-ctrl-btn-start"
              disabled={!canStart}
              onClick={() => onStart(env.id)}
            >
              <Play size={12} /> Start
            </button>
            <button
              className="eod-ctrl-btn eod-ctrl-btn-pause"
              disabled={!canPause && !isPaused}
              onClick={() => onPause(env.id)}
            >
              {isPaused ? (
                <>
                  <Play size={12} /> Resume
                </>
              ) : (
                <>
                  <Pause size={12} /> Pause
                </>
              )}
            </button>
            <button
              className="eod-ctrl-btn eod-ctrl-btn-stop"
              disabled={!canStop}
              onClick={() => onStop(env.id)}
            >
              <Square size={12} /> Stop
            </button>
          </div>
        )}

        {/* Progress & Live Execution Info */}
        {(isRunning || isPaused || isCompleted || isFailed) && (
          <div className="eod-ctrl-exec">
            <div className="eod-ctrl-exec-top">
              <span className="eod-ctrl-exec-label" style={{ fontWeight: 600, letterSpacing: '0.5px' }}>
                JOB {currentJobNo} OF {totalJobs}
              </span>
              <span
                className="eod-ctrl-exec-pct"
                style={{
                  fontWeight: 700,
                  color: isFailed
                    ? 'var(--c-danger)'
                    : isCompleted
                      ? 'var(--c-success)'
                      : 'var(--c-primary)',
                }}
              >
                {currentProgress}%
              </span>
            </div>
            <div className="eod-ctrl-exec-bar">
              <div
                className="eod-ctrl-exec-fill"
                style={{
                  width: `${currentProgress}%`,
                  background: isFailed
                    ? 'var(--c-danger)'
                    : isCompleted
                      ? 'var(--c-success)'
                      : 'linear-gradient(90deg, var(--c-primary-light), var(--c-primary))',
                  animation: isRunning ? 'eod-shimmer 2s ease-in-out infinite' : 'none',
                }}
              />
            </div>

            {/* Detailed Job Queue Section */}
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
              {/* Current Job Name */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-tertiary)', fontWeight: 500 }}>Current Job:</span>
                <span style={{
                  color: isCompleted ? 'var(--c-success)' : isFailed ? 'var(--c-danger)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontFamily: 'monospace'
                }}>
                  {currentJobName}
                </span>
              </div>

              {/* Next Job Name in Queue */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Next Job:</span>
                <span style={{
                  color: isCompleted ? 'var(--text-secondary)' : '#6366f1',
                  fontWeight: 600,
                  fontFamily: 'monospace'
                }}>
                  {nextJobName}
                </span>
              </div>

              {/* Live Timer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px', paddingTop: '4px', borderTop: '1px dashed rgba(0,0,0,0.1)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Elapsed Time:</span>
                <span className="eod-ctrl-exec-time" style={{ display: 'flex', alignItems: 'center', fontWeight: 600, fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                  <Clock size={11} style={{ verticalAlign: '-1px', marginRight: '4px', opacity: 0.7 }} />
                  {displayTime}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="eod-ctrl-foot">
          <span className="eod-ctrl-foot-item">
            <Server size={10} />
            {env.serverIp || '—'}
          </span>
          <span className="eod-ctrl-foot-item" style={{ marginLeft: 'auto' }}>
            <Clock size={10} />
            {env.lastRun || '—'}
          </span>
        </div>
      </div>

      <LogViewerModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        env={{ ...env, currentStep: currentStepName }}
      />
    </>
  );
}

export default CtrlCard;
