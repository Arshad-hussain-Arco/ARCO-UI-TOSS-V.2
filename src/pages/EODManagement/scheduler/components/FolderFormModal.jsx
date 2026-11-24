import { useState } from 'react';
import { Button } from '@components/ui/Button/Button';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { errorText } from '@services/eodSchedulerService';

/** Add a workflow (a Control-M folder) to the active workflow file. */
export function FolderFormModal({ isOpen, onClose, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (busy) return;
    setName('');
    setDescription('');
    setError('');
    onClose();
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await onSave({ name, ...(description.trim() ? { description } : {}) });
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal
      title="Add workflow"
      isOpen={isOpen}
      onClose={close}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={busy} disabled={!name.trim()}>
            Add
          </Button>
        </>
      }
    >
      <div className="eodsch-form">
        <label className="eodsch-field">
          Name
          <input
            type="text"
            value={name}
            maxLength={255}
            onChange={(e) => setName(e.target.value)}
            placeholder="EOD_BATCH"
          />
        </label>
        <label className="eodsch-field">
          Description (optional)
          <input
            type="text"
            value={description}
            maxLength={1000}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {error ? (
          <div className="eodsch-error" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </AdminModal>
  );
}

export default FolderFormModal;
