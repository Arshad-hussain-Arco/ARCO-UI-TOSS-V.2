import React, { useEffect } from 'react';
import { RunDetail } from '../scheduler/components/RunsPanel';

/**
 * RunDetailModal:
 * Popup dialog displaying the complete run information including
 * job executions, attempts, conditions, and real-time execution logs.
 * Closes via top-right 'X' button, backdrop click, or ESC key.
 */
export function RunDetailModal({ isOpen, runId, env, onClose }) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !runId) return null;

  return (
    <div
      className="cr-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="cr-run-detail-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cr-run-detail-modal-title"
      >
        <div className="cr-modal-header">
          <div className="cr-modal-title-wrap">
            <h2 className="cr-modal-title" id="cr-run-detail-modal-title">
              Run Execution Details — <span className="mono">#{runId}</span>
            </h2>
            <span className="cr-modal-subtitle">
              Environment: <strong>{String(env).toUpperCase()}</strong>
            </span>
          </div>
          <button
            type="button"
            className="cr-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
            title="Close dialog (Esc)"
          >
            ✕
          </button>
        </div>

        <div className="cr-modal-body eodsch">
          <RunDetail env={env} runId={runId} />
        </div>
      </div>
    </div>
  );
}

export default RunDetailModal;
