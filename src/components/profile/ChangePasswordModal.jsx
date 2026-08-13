import { useState, useEffect } from 'react';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Button } from '@components/ui/Button/Button';
import { useToast } from '@hooks/useToast';
import { authService } from '@services/authService';
import './ChangePasswordModal.css';

/**
 * Change Password Modal Component.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 */
export function ChangePasswordModal({ isOpen, onClose }) {
  const toast = useToast();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens or closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setErrors({});
      setApiError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setErrors({});
    setApiError(null);
    onClose();
  };

  const validate = () => {
    const newErrors = {};

    if (!currentPassword.trim()) {
      newErrors.currentPassword = 'Current password is required.';
    }

    if (!newPassword.trim()) {
      newErrors.newPassword = 'New password is required.';
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please re-enter new password.';
    } else if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'New passwords do not match.';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError(null);

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await authService.changePassword({
        password: currentPassword,
        new_password: newPassword,
      });

      const successMessage = response?.message || 'Password updated successfully.';
      toast.success(successMessage);
      handleClose();
    } catch (error) {
      let errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update password. Please try again.';

      if (
        typeof errorMessage === 'string' &&
        errorMessage.toLowerCase().includes('username or password')
      ) {
        errorMessage = 'Current password is incorrect.';
      }

      setApiError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const footer = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClose}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        isLoading={isSubmitting}
        disabled={isSubmitting}
      >
        Update Password
      </Button>
    </>
  );

  return (
    <AdminModal
      title="Change Password"
      isOpen={isOpen}
      onClose={handleClose}
      size="sm"
      footer={footer}
    >
      <p className="cp-modal-header-desc">
        Update your account password to keep your account secure.
      </p>

      {apiError && (
        <div className="cp-error-banner" role="alert">
          <AlertCircle size={16} className="cp-error-banner-icon" />
          <span>{apiError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="cp-form-stack" noValidate>
        {/* Current Password Field */}
        <div className="cp-form-group">
          <label htmlFor="cp-current-password" className="cp-label">
            Current Password <span className="cp-label-required">*</span>
          </label>
          <div className="cp-input-wrapper">
            <input
              id="cp-current-password"
              type={showCurrent ? 'text' : 'password'}
              className={`cp-input ${errors.currentPassword ? 'has-error' : ''}`}
              placeholder="Enter current password"
              value={currentPassword}
              disabled={isSubmitting}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (errors.currentPassword) {
                  setErrors((prev) => ({ ...prev, currentPassword: undefined }));
                }
              }}
            />
            <button
              type="button"
              className="cp-toggle-visibility-btn"
              onClick={() => setShowCurrent((prev) => !prev)}
              aria-label={showCurrent ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.currentPassword && (
            <span className="cp-field-error">{errors.currentPassword}</span>
          )}
        </div>

        {/* New Password Field */}
        <div className="cp-form-group">
          <label htmlFor="cp-new-password" className="cp-label">
            New Password <span className="cp-label-required">*</span>
          </label>
          <div className="cp-input-wrapper">
            <input
              id="cp-new-password"
              type={showNew ? 'text' : 'password'}
              className={`cp-input ${errors.newPassword ? 'has-error' : ''}`}
              placeholder="Enter new password"
              value={newPassword}
              disabled={isSubmitting}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (errors.newPassword) {
                  setErrors((prev) => ({ ...prev, newPassword: undefined }));
                }
              }}
            />
            <button
              type="button"
              className="cp-toggle-visibility-btn"
              onClick={() => setShowNew((prev) => !prev)}
              aria-label={showNew ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.newPassword && (
            <span className="cp-field-error">{errors.newPassword}</span>
          )}
        </div>

        {/* Re-enter New Password Field */}
        <div className="cp-form-group">
          <label htmlFor="cp-confirm-password" className="cp-label">
            Re-enter New Password <span className="cp-label-required">*</span>
          </label>
          <div className="cp-input-wrapper">
            <input
              id="cp-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              className={`cp-input ${errors.confirmPassword ? 'has-error' : ''}`}
              placeholder="Re-enter new password"
              value={confirmPassword}
              disabled={isSubmitting}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (errors.confirmPassword) {
                  setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              }}
            />
            <button
              type="button"
              className="cp-toggle-visibility-btn"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
              tabIndex={0}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <span className="cp-field-error">{errors.confirmPassword}</span>
          )}
        </div>
      </form>
    </AdminModal>
  );
}

export default ChangePasswordModal;
