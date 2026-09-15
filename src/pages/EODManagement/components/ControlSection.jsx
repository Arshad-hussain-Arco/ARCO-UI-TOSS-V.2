import React, { useEffect } from 'react';
import { Play, RefreshCw } from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { useAuth } from '@hooks/useAuth';
import { useEodContext } from '../context/EodContext';
import { CtrlCard } from './CtrlCard';
import { ControlSkeleton } from './EODSkeletons';
import Skeleton from '@/components/feedback/Skeleton/Skeleton';

export function ControlSection() {
  const { hasPermission } = useAuth();
  const canExecute = hasPermission('EOD_CONTROL_EXECUTE');
  const canViewLogs = hasPermission('EOD_CONTROL_VIEW_LOGS');

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
          {canExecute && (
            <button
              type="button"
              className="eod-add-btn"
              onClick={() => {
                const idleEnvs = controlsEnvs.filter(
                  (e) => e.isActive !== false && e.status !== 'running' && e.status !== 'paused'
                );
                idleEnvs.forEach((e) => {
                  handleStartEOD(e.id);
                });
              }}
            >
              <Play size={11} /> Run All Idle
            </button>
          )}
        </div>
      </div>
      <div className="eod-control-grid">
        {isLoadingControls && controlsEnvs.length === 0 ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="eod-ctrl-card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '20px', minHeight: '180px' }}>
              <div className="eod-ctrl-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton height={20} width={120} />
                <Skeleton height={24} width={80} style={{ borderRadius: '12px' }} />
              </div>
              <div className="eod-ctrl-actions" style={{ display: 'flex', gap: '8px' }}>
                <Skeleton height={32} width={80} style={{ borderRadius: '6px' }} />
                <Skeleton height={32} width={80} style={{ borderRadius: '6px' }} />
                <Skeleton height={32} width={80} style={{ borderRadius: '6px' }} />
              </div>
              <div className="eod-ctrl-exec" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton height={14} width="30%" />
                  <Skeleton height={14} width="15%" />
                </div>
                <Skeleton height={6} width="100%" style={{ borderRadius: '3px' }} />
              </div>
            </div>
          ))
        ) : controlsEnvs
          .filter((env) => env.isActive !== false)
          .map((env) => (
            <CtrlCard
              key={env.id}
              env={env}
              onStart={handleStartEOD}
              onPause={handlePauseEOD}
              onStop={handleStopEOD}
              canExecute={canExecute}
              canViewLogs={canViewLogs}
            />
          ))}
      </div>
    </div>
  );
}

export default ControlSection;
