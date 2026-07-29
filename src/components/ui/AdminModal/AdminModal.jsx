import { useEffect } from 'react';
import { X } from 'lucide-react';

import { dismissBackdrop } from '@utils/interactive';
import './AdminModal.css';

/**
 * A standard enterprise modal shell.
 *
 * @param {Object} props
 * @param {string} props.title - Modal title text.
 * @param {boolean} props.isOpen - Whether the modal is open.
 * @param {() => void} props.onClose - Close handler.
 * @param {'sm' | 'md' | 'lg' | 'xl'} [props.size='md'] - Max width size of the modal.
 * @param {React.ReactNode} props.children - Modal body content.
 * @param {React.ReactNode} [props.footer] - Modal footer actions (buttons).
 */
export function AdminModal({
  title,
  isOpen,
  onClose,
  size = 'md',
  children,
  footer,
}) {
  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="admin-modal-overlay" {...dismissBackdrop(onClose)}>
      <div
        className={`admin-modal-shell size-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
      >
        <div className="admin-modal-header">
          <h2 className="admin-modal-title" id="admin-modal-title">
            {title}
          </h2>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        <div className="admin-modal-body">{children}</div>

        {footer && <div className="admin-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default AdminModal;
