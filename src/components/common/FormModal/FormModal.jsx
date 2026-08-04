import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Button } from '@components/ui/Button/Button';

import styles from './FormModal.module.css';

/**
 * Standard add/edit form modal with a consistent Cancel/Submit footer.
 * Body content (the form fields) is passed as children.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {(e: React.FormEvent) => void} [props.onSubmit] - called on submit button click and form submit
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {'sm'|'md'|'lg'|'xl'} [props.size='md']
 * @param {'center'|'panel'} [props.variant='center']
 * @param {string} [props.submitLabel='Save']
 * @param {string} [props.cancelLabel='Cancel']
 * @param {boolean} [props.isSubmitting=false]
 * @param {boolean} [props.submitDisabled=false]
 */
export function FormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  subtitle,
  size = 'md',
  variant = 'center',
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  submitDisabled = false,
  children,
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(e);
  };

  return (
    <AdminModal
      title={title}
      subtitle={subtitle}
      isOpen={isOpen}
      onClose={onClose}
      size={size}
      variant={variant}
      footer={
        <div className={styles.footer}>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {cancelLabel}
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={submitDisabled}
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        {children}
      </form>
    </AdminModal>
  );
}

export default FormModal;
