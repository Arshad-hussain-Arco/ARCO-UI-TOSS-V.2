import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Server, Clock, Eye } from 'lucide-react';
import eodService from '../../../services/eodService';
import { settingsService } from '../../../services/settingsService';
import { LogViewerModal } from './LogViewerModal';

const formatSeconds = (totalSecs) => {
  const hrs = String(Math.floor(totalSecs / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSecs % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSecs % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
};

export function CtrlCard({ env, onStart, onPause, onStop }) {
  const isRunning = env.status === 'running';
  const isCompleted = env.status === 'completed';
  const isFailed = env.status === 'failed';
  const isPaused = env.status === 'paused';
  const canStart = env.status === 'idle' || env.status === 'failed';
  const canPause = isRunning;
  const canStop = isRunning || isPaused;

  const [liveLog, setLiveLog] = useState(env.logs || []);
  const [currentStepName, setCurrentStepName] = useState(env.currentStep || 'Idle');
  const [runningJobNo, setRunningJobNo] = useState(env.runningJobNo || 0);
  const [runningJobName, setRunningJobName] = useState(env.runningJobName || '');
  const [nextJobName, setNextJobName] = useState(env.nextJobName || '');
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [heartbeatMs, setHeartbeatMs] = useState(3000);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const logEndRef = useRef(null);

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

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.port === '3000' ? '127.0.0.1:8000' : window.location.host;
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken') || '';
    const wsUrl = `${wsProtocol}//${wsHost}/ws/eod-jobs/${env.id}/${token ? `?token=${token}` : ''}`;
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
          if (data.runningJobNo !== undefined) setRunningJobNo(data.runningJobNo);
          if (data.runningJobName !== undefined) setRunningJobName(data.runningJobName);
          if (data.nextJobName !== undefined) setNextJobName(data.nextJobName);
        } catch (e) {
          console.warn('WS message parse error:', e);
        }
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    } catch (e) {
      setWsConnected(false);
    }

    pollInterval = setInterval(async () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        try {
          const update = await eodService.getEodLiveUpdates(env.id);
          if (update) {
            if (update.logs && update.logs.length > 0) setLiveLog(update.logs);
            if (update.currentStep) setCurrentStepName(update.currentStep);
            if (update.runningJobNo !== undefined) setRunningJobNo(update.runningJobNo);
            if (update.runningJobName !== undefined) setRunningJobName(update.runningJobName);
            if (update.nextJobName !== undefined) setNextJobName(update.nextJobName);
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

  return (
    <>
      <div className={`eod-ctrl-card ${env.status}`}>
        <div className={`eod-ctrl-strip ${env.status}`} />

        <div className="eod-ctrl-head">
          <span className="eod-ctrl-env-name">{env.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

        {/* Action row */}
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

        {/* Progress & Live Timer */}
        {(isRunning || isPaused || isCompleted || isFailed) && (
          <div className="eod-ctrl-exec">
            <div className="eod-ctrl-exec-top">
              <span className="eod-ctrl-exec-label">
                Job {runningJobNo || env.stepsDone || 0} of {env.stepsTotal || 12}
              </span>
              <span
                className="eod-ctrl-exec-pct"
                style={{
                  color: isFailed
                    ? 'var(--c-danger)'
                    : isCompleted
                      ? 'var(--c-success)'
                      : 'var(--c-primary)',
                }}
              >
                {env.progress || 0}%
              </span>
            </div>
            <div className="eod-ctrl-exec-bar">
              <div
                className="eod-ctrl-exec-fill"
                style={{
                  width: `${env.progress || 0}%`,
                  background: isFailed
                    ? 'var(--c-danger)'
                    : isCompleted
                      ? 'var(--c-success)'
                      : 'linear-gradient(90deg, var(--c-primary-light), var(--c-primary))',
                  animation: isRunning ? 'eod-shimmer 2s ease-in-out infinite' : 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="eod-ctrl-exec-step" style={{ fontWeight: 600 }}>
                  Current: {runningJobName || currentStepName}
                </span>
                <span className="eod-ctrl-exec-time" style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                  <Clock size={11} style={{ verticalAlign: '-1px', marginRight: '4px', opacity: 0.7 }} />
                  {displayTime}
                </span>
              </div>
              {nextJobName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="eod-ctrl-exec-step" style={{ color: '#888', fontSize: '11px' }}>
                    Next: {nextJobName}
                  </span>
                </div>
              )}
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
        env={{...env, currentStep: currentStepName}}
      />
    </>
  );
}

export default CtrlCard;
