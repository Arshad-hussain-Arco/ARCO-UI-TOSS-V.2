import { useEffect, useState } from 'react';
import { CockpitIcon } from './IconSprite';

/**
 * "Run Workflow": choose which workflows (folders) of the active XML to run now. Choosing every workflow is the same as Run All Now.
 * `workflows` is [{ name, jobs }].
 */
export function RunWorkflowsModal({ isOpen, onClose, onRun, workflows = [], filename = '', defaultFolder = null }) {
  const [chosen, setChosen] = useState(() => new Set());
  const [allowOverlap, setAllowOverlap] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (defaultFolder && workflows.some((w) => w.name === defaultFolder)) {
        setChosen(new Set([defaultFolder]));
      } else {
        setChosen(new Set());
      }
      setAllowOverlap(false);
    }
  }, [isOpen, defaultFolder, workflows]);

  if (!isOpen) return null;

  const toggle = (name) =>
    setChosen((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const allChosen = workflows.length > 0 && chosen.size === workflows.length;
  const jobCount = workflows.filter((w) => chosen.has(w.name)).reduce((n, w) => n + w.jobs, 0);

  const submit = (e) => {
    e.preventDefault();
    if (!chosen.size) return;
    onRun({
      folders: workflows.filter((w) => chosen.has(w.name)).map((w) => w.name),
      allow_overlap: allowOverlap,
    });
    onClose();
  };

  return (
    <div
      className="cr-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // a click on the dark area closes it, a click inside the card does not
      }}
      role="presentation"
    >
      <div className="cr-modal-card" role="dialog" aria-label="Run workflow">
        <header className="cr-modal-header">
          <h3>Run Workflow</h3>
          <button type="button" className="cr-modal-close" onClick={onClose} aria-label="Close">
            <CockpitIcon name="i-x" className="sm" />
          </button>
        </header>

        <form onSubmit={submit} className="cr-modal-form">
          <div className="cr-form-field">
            <span className="cr-form-label">Workflows in {filename || 'the active XML'}</span>
            <label className="cr-checkbox-label" style={{ marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={allChosen}
                onChange={() =>
                  setChosen(allChosen ? new Set() : new Set(workflows.map((w) => w.name)))
                }
              />
              <b>Select all</b>
            </label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 260,
                overflowY: 'auto',
              }}
            >
              {workflows.map((w) => (
                <label key={w.name} className="cr-checkbox-label">
                  <input
                    type="checkbox"
                    checked={chosen.has(w.name)}
                    onChange={() => toggle(w.name)}
                  />
                  <b>{w.name}</b>
                  <span className="cr-form-hint" style={{ marginLeft: 8 }}>
                    {w.jobs} {w.jobs === 1 ? 'job' : 'jobs'}
                  </span>
                </label>
              ))}
            </div>
            <span className="cr-form-hint">
              Each job still waits for its own conditions. Only the chosen workflows start; the
              others are left alone.
            </span>
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
              Start even if another run is still going in this environment. Without it the run is
              refused while one is in progress.
            </span>
          </div>

          <footer className="cr-modal-footer">
            <button type="button" className="cr-btn outline sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="cr-btn primary sm" disabled={!chosen.size}>
              <CockpitIcon name="i-play" className="xs" />{' '}
              {chosen.size
                ? `Run ${chosen.size} workflow${chosen.size === 1 ? '' : 's'} (${jobCount} jobs)`
                : 'Choose a workflow'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

export default RunWorkflowsModal;
