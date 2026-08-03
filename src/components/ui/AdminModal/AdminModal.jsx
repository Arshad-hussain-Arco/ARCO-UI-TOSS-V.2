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
 * @param {'center' | 'panel'} [props.variant='center'] - 'center' is the standard centered dialog;
 *   'panel' is a full-height slide-over anchored to the right edge, for longer multi-section forms.
 * @param {string} [props.subtitle] - Optional one-line description shown under the title (panel variant only).
 * @param {React.ReactNode} props.children - Modal body content.
 * @param {React.ReactNode} [props.footer] - Modal footer actions (buttons).
 */
export function AdminModal({
  title,
  subtitle,
  isOpen,
  onClose,
  size = 'md',
  variant = 'center',
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

  const isPanel = variant === 'panel';

  return (
    <div className={`admin-modal-overlay ${isPanel ? 'variant-panel' : ''}`} {...dismissBackdrop(onClose)}>
      <div
        className={`admin-modal-shell size-${size} ${isPanel ? 'variant-panel' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-modal-title"
      >
        {isPanel ? (
          <div className="admin-modal-header">
            <div>
              <h2 className="admin-modal-title" id="admin-modal-title">
                {title}
              </h2>
              {subtitle && <p className="admin-modal-subtitle">{subtitle}</p>}
            </div>
            <button
              type="button"
              className="admin-modal-close variant-panel"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="admin-modal-close"
              onClick={onClose}
              aria-label="Close modal"
            >
              <X size={15} />
            </button>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title" id="admin-modal-title">
                {title}
              </h2>
            </div>
          </>
        )}

        <div className="admin-modal-body">{children}</div>

        {footer && <div className="admin-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export default AdminModal;
