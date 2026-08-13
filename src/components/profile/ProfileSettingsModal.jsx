import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Building,
  Briefcase,
  Calendar,
  Monitor,
  MapPin,
  Camera,
  Edit,
  Check,
  RotateCcw,
  Laptop,
  Upload,
  Trash,
} from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { authService } from '@services/authService';
import { consultantService } from '@services/consultantService';
import './ProfileSettingsModal.css';

/**
 * Modern Right-Side Profile Settings Enterprise Overlay (Drawer).
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {Object} props.user
 */
export function ProfileSettingsModal({ isOpen, onClose, user }) {
  const modalRef = useRef(null);
  const fileInputRef = useRef(null);
  const toast = useToast();

  // Smooth close state for animation
  const [isClosing, setIsClosing] = useState(false);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null);

  // Form Fields State
  const initialFormData = useRef({
    name: user?.name || user?.username || '',
    designation: user?.designationName || user?.designation || user?.roleName || user?.role || '',
    team: user?.teamName || user?.team || '',
    manager: user?.reportingManager || user?.manager || '',
    gender: user?.gender || '',
    doj: user?.doj || '',
    email: user?.email || '',
    mobile: user?.mobile || '',
    landline: user?.landline || '',
    pcAvailable: user?.pcAvailable !== undefined ? user?.pcAvailable : null,
    computerName: user?.computerName || '',
    computerLocation: user?.computerLocation || '',
    locationRef: user?.locationRef || '',
  });

  const [formData, setFormData] = useState(initialFormData.current);

  // Sync state if user changes
  useEffect(() => {
    initialFormData.current = {
      name: user?.name || user?.username || '',
      designation: user?.designationName || user?.designation || user?.roleName || user?.role || '',
      team: user?.teamName || user?.team || '',
      manager: user?.reportingManager || user?.manager || '',
      gender: user?.gender || '',
      doj: user?.doj || '',
      email: user?.email || '',
      mobile: user?.mobile || '',
      landline: user?.landline || '',
      pcAvailable: user?.pcAvailable !== undefined ? user?.pcAvailable : null,
      computerName: user?.computerName || '',
      computerLocation: user?.computerLocation || '',
      locationRef: user?.locationRef || '',
    };
    setFormData(initialFormData.current);
    if (user?.avatar) {
      setAvatarUrl(user.avatar);
    }
  }, [user]);

  // Smooth close handler
  const handleAnimatedClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  }, [onClose]);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleAnimatedClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleAnimatedClose]);

  const handleChange = (field, value) => {
    if (field === 'mobile') {
      const digitsOnly = value.replace(/\D/g, '');
      if (digitsOnly.length > 10) return;
      setFormData((prev) => ({ ...prev, [field]: digitsOnly }));
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result;
        try {
          // Keep UI responsive while uploading
          setAvatarUrl(base64Data);

          // Strip the data URL prefix (e.g. "data:image/jpeg;base64,")
          const pureBase64 = base64Data.split(',')[1] || base64Data;

          await consultantService.uploadPhoto(user.emp_id || user.id, pureBase64);
          toast.success('Photo uploaded successfully');
        } catch (error) {
          toast.error(error.message || 'Failed to upload photo.');
          // Revert on failure
          setAvatarUrl(user?.avatar || null);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoRemove = async () => {
    try {
      await consultantService.deletePhoto(user.emp_id || user.id);
      setAvatarUrl(null);
      toast.success('Photo removed successfully');
    } catch (error) {
      toast.error(error.message || 'Failed to remove photo.');
    }
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await authService.updateUserInfo({
        mobile: formData.mobile,
        email: formData.email,
      });

      toast.success('User info updated successfully.');
      initialFormData.current = { ...formData };
      setIsEditing(false);
    } catch (error) {
      toast.error(error.message || 'Failed to update user info.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({ ...initialFormData.current });
    setIsEditing(false);
  };

  const renderValue = (val) => {
    if (val === null || val === undefined || String(val).trim() === '') {
      return <span className="eps-val-na">Not Available</span>;
    }
    return val;
  };

  if (!isOpen && !isClosing) return null;

  const userInitials = (formData.name || 'User')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  return (
    <div
      className={`eps-drawer-overlay ${isClosing ? 'closing' : ''}`}
      onClick={handleAnimatedClose}
      role="presentation"
    >
      <div
        className={`eps-drawer-panel ${isClosing ? 'closing' : ''}`}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="eps-drawer-title"
      >
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handlePhotoUpload}
          onClick={(e) => (e.target.value = null)}
          accept="image/*"
          style={{ display: 'none' }}
        />

        {/* ── Compact Header ───────────────────────────────────── */}
        <header className="eps-drawer-header">
          <div className="eps-header-user-info">
            <h3 id="eps-drawer-title" className="eps-drawer-title">
              Profile Settings
            </h3>
            <p className="eps-drawer-user-subtitle">
              {formData.name} &bull; <span className="eps-sub-role">{formData.designation}</span>{' '}
              &bull; {formData.team}
            </p>
          </div>

          <button
            type="button"
            className="eps-drawer-close-btn"
            onClick={handleAnimatedClose}
            aria-label="Close settings"
          >
            <X size={15} />
          </button>
        </header>

        {/* ── Compact Body Content ─────────────────────────────── */}
        <div className="eps-drawer-body">
          {/* Avatar Upload Component */}
          <div className="eps-avatar-upload">
            <div
              className="eps-avatar-circle"
              onClick={() => fileInputRef.current?.click()}
              title="Change Photo"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={formData.name} className="eps-avatar-img" />
              ) : (
                <div className="eps-avatar-initials">{userInitials}</div>
              )}
              <div className="eps-avatar-overlay">
                <Camera size={16} color="white" />
              </div>
            </div>
            <div className="eps-avatar-actions">
              <span className="eps-avatar-name">{formData.name}</span>
              <span className="eps-avatar-tag">{formData.designation}</span>
              <div className="eps-avatar-btns">
                {avatarUrl ? (
                  <>
                    <button
                      type="button"
                      className="eps-btn-avatar"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <RotateCcw size={10} /> Replace
                    </button>
                    <button
                      type="button"
                      className="eps-btn-avatar danger"
                      onClick={handlePhotoRemove}
                    >
                      <Trash size={10} /> Remove
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="eps-btn-avatar"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={10} /> Upload
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 1: Personal Details */}
          <section className="eps-card-section">
            <div className="eps-section-header">
              <User size={13} className="eps-sec-icon" />
              <h4 className="eps-sec-title">Personal Details</h4>
            </div>

            <div className="eps-fields-stack">
              {/* Full Name */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <User size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Full Name</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={formData.name}
                    disabled
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.name)}</span>
                )}
              </div>

              {/* Gender */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <User size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Gender</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={
                      formData.gender === 'M'
                        ? 'Male'
                        : formData.gender === 'F'
                          ? 'Female'
                          : formData.gender === 'O'
                            ? 'Other'
                            : formData.gender || ''
                    }
                    disabled
                    onChange={() => {}}
                  />
                ) : (
                  <span className="eps-row-value">
                    {formData.gender === 'M'
                      ? 'Male'
                      : formData.gender === 'F'
                        ? 'Female'
                        : renderValue(formData.gender)}
                  </span>
                )}
              </div>

              {/* Designation */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <Briefcase size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Designation Name</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={formData.designation}
                    disabled
                    onChange={(e) => handleChange('designation', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.designation)}</span>
                )}
              </div>

              {/* Team */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <Building size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Team Name</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={formData.team}
                    disabled
                    onChange={(e) => handleChange('team', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.team)}</span>
                )}
              </div>

              {/* Reporting Manager */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <User size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Reporting Manager</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={formData.manager}
                    disabled
                    onChange={(e) => handleChange('manager', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.manager)}</span>
                )}
              </div>

              {/* Date of Joining */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <Calendar size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Date of Joining</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={formData.doj}
                    disabled
                    onChange={(e) => handleChange('doj', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.doj)}</span>
                )}
              </div>
            </div>
          </section>

          {/* Section 2: Contact Details */}
          <section className="eps-card-section">
            <div className="eps-section-header">
              <Mail size={13} className="eps-sec-icon" />
              <h4 className="eps-sec-title">Contact Details</h4>
            </div>

            <div className="eps-fields-stack">
              {/* Email */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <Mail size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Email Address</span>
                </div>
                {isEditing ? (
                  <input
                    type="email"
                    className="eps-dense-input"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.email)}</span>
                )}
              </div>

              {/* Mobile */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <Phone size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Mobile Number</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={formData.mobile}
                    maxLength="10"
                    onChange={(e) => handleChange('mobile', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.mobile)}</span>
                )}
              </div>

              {/* Landline */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <Phone size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Landline</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    placeholder="—"
                    value={formData.landline}
                    disabled
                    onChange={(e) => handleChange('landline', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.landline)}</span>
                )}
              </div>
            </div>
          </section>

          {/* Section 3: System Details */}
          <section className="eps-card-section">
            <div className="eps-section-header">
              <Monitor size={13} className="eps-sec-icon" />
              <h4 className="eps-sec-title">System Details</h4>
            </div>

            <div className="eps-fields-stack">
              {/* Physical PC Available */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <Laptop size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Physical PC</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={formData.pcAvailable === null ? '' : formData.pcAvailable ? 'Yes' : 'No'}
                    disabled
                    onChange={() => {}}
                  />
                ) : (
                  <span className="eps-row-value">
                    {formData.pcAvailable === null
                      ? renderValue(null)
                      : formData.pcAvailable
                        ? 'Yes'
                        : 'No'}
                  </span>
                )}
              </div>

              {/* Computer Name */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <Monitor size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Computer Name</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={formData.computerName}
                    disabled
                    onChange={(e) => handleChange('computerName', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.computerName)}</span>
                )}
              </div>

              {/* Computer Location */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <MapPin size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Computer Location</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={formData.computerLocation}
                    disabled
                    onChange={(e) => handleChange('computerLocation', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.computerLocation)}</span>
                )}
              </div>

              {/* Location Reference */}
              <div className="eps-row-field">
                <div className="eps-row-label-group">
                  <MapPin size={12} className="eps-field-icon" />
                  <span className="eps-row-label">Computer Location Reference</span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    className="eps-dense-input"
                    value={formData.locationRef}
                    disabled
                    onChange={(e) => handleChange('locationRef', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.locationRef)}</span>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* ── Minimal Footer ───────────────────────────────────── */}
        <footer className="eps-drawer-footer">
          {!isEditing ? (
            <>
              <button
                type="button"
                className="eps-btn eps-btn-cancel"
                onClick={handleAnimatedClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="eps-btn eps-btn-primary"
                onClick={() => setIsEditing(true)}
              >
                <Edit size={12} />
                <span>Edit Profile</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="eps-btn eps-btn-cancel" onClick={handleCancel}>
                Cancel
              </button>
              <button
                type="button"
                className="eps-btn eps-btn-primary"
                onClick={handleSave}
                disabled={isSaving}
              >
                <Check size={12} />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

export default ProfileSettingsModal;
