import { useEffect, useState } from 'react';
import { CockpitIcon } from './IconSprite';
import { eodSchedulerService as svc, errorText } from '@services/eodSchedulerService';

/** "A → B + C → D": jobs in one step do not depend on each other. */
const orderText = (waves) => waves.map((w) => w.join(' + ')).join(' → ');

/**
 * Confirm "Play" on one job. The engine works out the chain from its own dependency graph (the same call the schedule form uses), so what is
 * listed here is exactly what will run: the prerequisites in order, then the job. Nothing after the job runs.
 *
 * `succeeded` is the set of job names that are Done in the run being viewed; with `reuseRun` set, the engine does not run those again when that
 * run is from today (it decides; this only tells the user what to expect).
 */
export function PlayJobModal({
  isOpen,
  env,
  job,
  workflowId,
  reuseRun = '',
  succeeded = new Set(),
  busy = false,
  onConfirm,
  onClose,
}) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !job?.name || !job?.folder) return undefined;
    let live = true;
    setPlan(null);
    setError('');
    svc
      .getJobClosure(env, { workflow: workflowId || undefined, folder: job.folder, job: job.name })
      .then((c) => live && setPlan(c))
      .catch((err) => live && setError(errorText(err)));
    return () => {
      live = false;
    };
  }, [isOpen, env, job?.name, job?.folder, workflowId]);

  if (!isOpen || !job) return null;

  const needed = plan ? [...plan.prerequisites, plan.job] : [];
  const reused = plan && reuseRun ? plan.prerequisites.filter((n) => succeeded.has(n)) : [];
  const toRun = needed.length - reused.length;

  return (
    <div
      className="cr-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="presentation"
    >
      <div className="cr-modal-card" role="dialog" aria-label={`Run ${job.name}`}>
        <header className="cr-modal-header">
          <h3>Run {job.name}</h3>
          <button
            type="button"
            className="cr-modal-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <CockpitIcon name="i-x" className="sm" />
          </button>
        </header>

        <div className="cr-modal-form">
          <div className="cr-form-field">
            <span className="cr-form-label">Workflow</span>
            <span>{job.folder}</span>
          </div>

          {!plan && !error ? (
            <p className="cr-form-hint">Working out the prerequisite jobs…</p>
          ) : null}
          {error ? (
            <p
              className="cr-form-hint"
              role="alert"
              style={{ color: 'var(--cr-st-failed-fg, #b91c1c)' }}
            >
              {error}
            </p>
          ) : null}

          {plan ? (
            <>
              <div className="cr-form-field">
                <span className="cr-form-label">
                  {plan.prerequisites.length
                    ? `${plan.prerequisites.length} prerequisite job${plan.prerequisites.length === 1 ? '' : 's'} run first, in this order`
                    : 'No prerequisites: only this job runs'}
                </span>
                <strong style={{ fontSize: 13 }}>{orderText(plan.waves)}</strong>
                <span className="cr-form-hint">
                  Jobs that do not lead to {job.name} (including everything after it) do not run. If
                  a prerequisite fails, {job.name} is skipped.
                </span>
              </div>
              {reused.length ? (
                <div className="cr-form-field">
                  <span className="cr-form-label">
                    Already succeeded in the run you are viewing
                  </span>
                  <strong style={{ fontSize: 13 }}>{reused.join(', ')}</strong>
                  <span className="cr-form-hint">
                    These are not run again, as long as that run is from today. Their results still
                    count for the jobs that follow.
                  </span>
                </div>
              ) : null}
            </>
          ) : null}

          <footer className="cr-modal-footer">
            <button type="button" className="cr-btn outline sm" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="cr-btn primary sm"
              disabled={!plan || busy}
              onClick={onConfirm}
              title={`Run ${job.name} with the prerequisite jobs it needs`}
            >
              {busy ? (
                <>
                  <span className="cr-spinner" style={{ width: 12, height: 12 }} /> Starting…
                </>
              ) : (
                <>
                  <CockpitIcon name="i-play" className="xs" /> Run{' '}
                  {plan ? `${toRun} job${toRun === 1 ? '' : 's'}` : job.name}
                </>
              )}
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default PlayJobModal;
