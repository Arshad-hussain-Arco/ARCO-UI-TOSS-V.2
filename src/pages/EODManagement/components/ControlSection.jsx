import React, { useEffect } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { Loader } from '@components/feedback/Loader/Loader';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { useEodContext } from '../context/EodContext';
import { CtrlCard } from './CtrlCard';

export function ControlSection() {
  const {
    controlsEnvs,
    isLoadingControls,
    controlsError,
    fetchControlsData,
    handleStartEOD,
    handlePauseEOD,
    handleStopEOD,
  } = useEodContext();

  useEffect(() => {
    fetchControlsData(true);
  }, [fetchControlsData]);

  if (isLoadingControls) {
    return <Loader message="Loading batch control panel…" />;
  }

  if (controlsError) {
    return (
      <ErrorState
        title="Control panel could not be loaded"
        description={controlsError}
        onRetry={() => fetchControlsData(true)}
      />
    );
  }

  return (
    <div className="eod-section">
      <div className="eod-section-bar">
        <p className="eod-section-title">Control Panel</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="eod-add-btn"
            onClick={() => fetchControlsData(false)}
            style={{
              background: 'transparent',
              color: 'var(--c-primary)',
              border: '1px solid var(--c-primary)',
            }}
          >
            <RefreshCw size={11} /> Refresh
          </button>
          <button
            className="eod-add-btn"
            onClick={() =>
              controlsEnvs.forEach((e) => {
                if (e.status !== 'running' && e.status !== 'paused') {
                  handleStartEOD(e.id);
                }
              })
            }
          >
            <Play size={11} /> Run All Idle
          </button>
        </div>
      </div>
      <div className="eod-control-grid">
        {controlsEnvs
          .filter((env) => env.isActive !== false)
          .map((env) => (
            <CtrlCard
              key={env.id}
              env={env}
              onStart={handleStartEOD}
              onPause={handlePauseEOD}
              onStop={handleStopEOD}
            />
          ))}
      </div>
    </div>
  );
}

export default ControlSection;
