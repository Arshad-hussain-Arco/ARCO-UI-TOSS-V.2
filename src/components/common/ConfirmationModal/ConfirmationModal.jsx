import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Button } from '@components/ui/Button/Button';

import styles from './ConfirmationModal.module.css';

/**
 * Standard Cancel/Confirm dialog built on the shared modal shell.
 * Use for delete/deactivate/discard-style confirmations across the app.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {() => void} props.onConfirm
 * @param {string} props.title
 * @param {React.ReactNode} props.description
 * @param {string} [props.confirmLabel='Confirm']
 * @param {string} [props.cancelLabel='Cancel']
 * @param {'primary'|'danger'} [props.confirmVariant='danger']
 * @param {boolean} [props.isLoading=false]
 */
export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'danger',
  isLoading = false,
}) {
  return (
    <AdminModal
      title={title}
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      footer={
        <div className={styles.footer}>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description ? <p className={styles.description}>{description}</p> : null}
    </AdminModal>
  );
}

export default ConfirmationModal;
