import React, { useState } from 'react';
import { CockpitIcon } from './IconSprite';

export function StartRunModal({ isOpen, onClose, onStart, currentEnv = '' }) {
  const [runName, setRunName] = useState('EOD Batch Run');
  const [simulateAll, setSimulateAll] = useState(false);
  const [allowOverlap, setAllowOverlap] = useState(false);
  const [maxParallel, setMaxParallel] = useState(30);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onStart({
      name: runName.trim() || 'EOD Batch Run',
      simulate_all: simulateAll,
      allow_overlap: allowOverlap,
      max_parallel: Number(maxParallel),
    });
    onClose();
  };

  return (
    <div className="cr-modal-backdrop" onClick={onClose}>
      <div className="cr-modal-card" onClick={(e) => e.stopPropagation()}>
        <header className="cr-modal-header">
          <h3>Start New Batch Run</h3>
          <button type="button" className="cr-modal-close" onClick={onClose}>
            <CockpitIcon name="i-x" className="sm" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="cr-modal-form">
          <div className="cr-form-field">
            <span className="cr-form-label">Environment</span>
            <div className="cr-env-static-pill">
              <span className="cr-env-pill active">{String(currentEnv).toUpperCase()}</span>
              <span className="cr-form-hint">Run will execute on the current active environment.</span>
            </div>
          </div>

          <div className="cr-form-field">
            <label className="cr-form-label">Run / Schedule Name</label>
            <input
              type="text"
              className="cr-input"
              value={runName}
              placeholder="EOD Batch Run"
              onChange={(e) => setRunName(e.target.value)}
            />
          </div>

          <div className="cr-form-field">
            <label className="cr-form-label">Max Parallel Jobs</label>
            <input
              type="number"
              className="cr-input"
              value={maxParallel}
              min="1"
              max="100"
              onChange={(e) => setMaxParallel(e.target.value)}
            />
          </div>

          <div className="cr-form-field cr-checkbox-field">
            <label className="cr-checkbox-label">
              <input
                type="checkbox"
                checked={allowOverlap}
                onChange={(e) => setAllowOverlap(e.target.checked)}
              />
              <b>Allow Overlap</b>
            </label>
            <span className="cr-form-hint">
              Start this run even if another run is currently running in this environment.
            </span>
          </div>

          <div className="cr-form-field cr-checkbox-field">
            <label className="cr-checkbox-label">
              <input
                type="checkbox"
                checked={simulateAll}
                onChange={(e) => setSimulateAll(e.target.checked)}
              />
              <b>Simulate all jobs (Pretend run)</b>
            </label>
            <span className="cr-form-hint">
              When checked, commands are validated and simulated without invoking remote hosts.
            </span>
          </div>

          <footer className="cr-modal-footer">
            <button type="button" className="cr-btn outline sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cr-btn primary sm">
              <CockpitIcon name="i-play" className="xs" /> Start Run Now
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default StartRunModal;
