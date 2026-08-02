import React from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { Loader } from '@components/feedback/Loader/Loader';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { useEodContext } from '../context/EodContext';
import { CtrlCard } from './CtrlCard';

export function ControlSection() {
  const {
    environments,
    isLoading,
    error,
    refreshEnvironments,
    handleStartEOD,
    handlePauseEOD,
    handleStopEOD,
  } = useEodContext();

  if (isLoading) {
    return <Loader message="Loading batch control panel…" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Control panel could not be loaded"
        description={error}
        onRetry={refreshEnvironments}
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
            onClick={refreshEnvironments}
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
              environments.forEach((e) => {
                if (e.status === 'idle') handleStartEOD(e.id);
              })
            }
          >
            <Play size={11} /> Run All Idle
          </button>
        </div>
      </div>
      <div className="eod-control-grid">
        {environments.map((env) => (
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
