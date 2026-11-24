import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';

/**
 * Confirms deleting a job, a workflow (folder) or a stored workflow file. When the backend says other jobs would be left waiting for a
 * condition that only the deleted job(s) produce, `state.info` carries them and the button turns into "Delete anyway".
 *
 * state: { kind: 'job' | 'folder' | 'file', folder?, job?, file?, info?: { message, removes?, impact? } } | null
 */
export function DeleteDialog({ state, busy, error, onClose, onConfirm }) {
  if (!state) return null;
  const { kind, folder, job, file, info } = state;
  const title =
    kind === 'job'
      ? `Delete job ${job}?`
      : kind === 'folder'
        ? `Delete workflow ${folder}?`
        : `Delete ${file?.filename}?`;
  const warned = Boolean(info);
  return (
    <AdminModal
      title={title}
      isOpen
      onClose={() => !busy && onClose()}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} isLoading={busy}>
            {warned ? 'Delete anyway' : 'Delete'}
          </Button>
        </>
      }
    >
      <div className="eodsch-stack">
        {kind === 'job' && !warned ? (
          <p>The job is removed from the workflow file. The workflow must be approved again.</p>
        ) : null}
        {kind === 'file' ? (
          <p>
            This removes the stored XML file. Runs and their logs are not affected. This cannot be
            undone.
          </p>
        ) : null}
        {warned ? <p>{info.message}</p> : null}
        {info?.removes?.length ? (
          <div>
            <strong>Jobs deleted with it ({info.removes.length}):</strong>
            <ul className="eodsch-bullets">
              {info.removes.slice(0, 15).map((n) => (
                <li key={n}>{n}</li>
              ))}
              {info.removes.length > 15 ? <li>…and {info.removes.length - 15} more</li> : null}
            </ul>
          </div>
        ) : null}
        {info?.impact?.length ? (
          <div>
            <strong>Jobs that would wait forever ({info.impact.length}):</strong>
            <ul className="eodsch-bullets">
              {info.impact.slice(0, 15).map((i) => (
                <li key={`${i.folder}/${i.job}`}>
                  {i.folder}/{i.job}{' '}
                  <span className="eodsch-muted">waits for {i.waits_for.join(', ')}</span>
                </li>
              ))}
              {info.impact.length > 15 ? <li>…and {info.impact.length - 15} more</li> : null}
            </ul>
          </div>
        ) : null}
        {error ? (
          <div className="eodsch-error" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </AdminModal>
  );
}

export default DeleteDialog;
