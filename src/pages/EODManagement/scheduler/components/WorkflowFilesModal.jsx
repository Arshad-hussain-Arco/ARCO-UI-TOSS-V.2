import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';

const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

/**
 * Every Control-M XML uploaded to this environment. Exactly one is active (the one the engine, the schedule and "Run all now" use); an upload
 * only adds a file, it never switches the active one. Only a file that is not active can be deleted.
 */
export function WorkflowFilesModal({
  isOpen,
  onClose,
  files,
  canManage,
  canRun,
  busy,
  onActivate,
  onDelete,
}) {
  return (
    <AdminModal
      title="Workflow files in this environment"
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="eodsch-table-wrap">
        <table className="eodsch-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Uploaded</th>
              <th>Last edited</th>
              <th>Approval</th>
              <th>Status</th>
              {canManage ? <th aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id} data-selected={f.active}>
                <td>
                  <strong>{f.filename}</strong>
                </td>
                <td>
                  {when(f.uploaded_at)}
                  <div className="eodsch-muted">{f.uploaded_by || 'unknown'}</div>
                </td>
                <td>
                  {f.edited_at ? (
                    <>
                      {when(f.edited_at)}
                      <div className="eodsch-muted">{f.edited_by || 'unknown'}</div>
                    </>
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {f.approval_recorded ? (
                    <span title="An approval is recorded for this file. It only counts while the file, settings and targets are unchanged.">
                      Approved by {f.approved_by || 'unknown'}
                    </span>
                  ) : (
                    <span className="eodsch-muted">Not approved</span>
                  )}
                </td>
                <td>
                  {f.active ? (
                    <span className="eodsch-chip eodsch-tone-good">Active</span>
                  ) : (
                    <span className="eodsch-muted">Stored</span>
                  )}
                </td>
                {canManage ? (
                  <td>
                    <div className="eodsch-actions">
                      {!f.active ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || !canRun}
                            title={!canRun ? 'A run is in progress in this environment' : undefined}
                            onClick={() => onActivate(f)}
                          >
                            Make active
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => onDelete(f)}
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
            {!files.length ? (
              <tr>
                <td colSpan={canManage ? 6 : 5} className="eodsch-muted">
                  Nothing has been uploaded yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="eodsch-muted">
        Uploading adds a file here; it does not change which workflow runs. Make a file active to
        review, approve and run it.
      </p>
    </AdminModal>
  );
}

export default WorkflowFilesModal;
