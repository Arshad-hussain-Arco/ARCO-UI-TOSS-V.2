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
  Edit2,
  Check,
  RotateCcw,
  Laptop,
} from 'lucide-react';
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

  // Smooth close state for animation
  const [isClosing, setIsClosing] = useState(false);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || null);

  // Form Fields State
  const initialFormData = useRef({
    name: user?.name || user?.username || '',
    designation: user?.designation || user?.roleName || user?.role || '',
    designationName:
      user?.designationName || user?.designation || user?.roleName || user?.role || '',
    team: user?.team || '',
    manager: user?.manager || '',
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
      designation: user?.designation || user?.roleName || user?.role || '',
      team: user?.team || '',
      manager: user?.manager || '',
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
    if (user?.avatar) setAvatarUrl(user.avatar);
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
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarUrl(event.target?.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    initialFormData.current = { ...formData };
    setIsEditing(false);
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
          {/* Compact Avatar Strip */}
          <div className="eps-compact-avatar-strip">
            <div
              className="eps-avatar-wrapper"
              onClick={() => fileInputRef.current?.click()}
              title="Change Photo"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={formData.name} className="eps-avatar-img" />
              ) : (
                <div className="eps-avatar-initials">{userInitials}</div>
              )}
              <div className="eps-avatar-camera-overlay">
                <Camera size={11} />
              </div>
            </div>
            <div className="eps-avatar-text-details">
              <span className="eps-avatar-name">{formData.name}</span>
              <span className="eps-avatar-tag">{formData.designation}</span>
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
                  <select
                    className="eps-dense-select"
                    value={formData.gender}
                    onChange={(e) => handleChange('gender', e.target.value)}
                  >
                    <option value=" ">Select</option>
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                    <option value="O">Other</option>
                  </select>
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
                    value={formData.designationName}
                    onChange={(e) => handleChange('designationName', e.target.value)}
                  />
                ) : (
                  <span className="eps-row-value">{renderValue(formData.designationName)}</span>
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
                  <select
                    className="eps-dense-select"
                    value={formData.pcAvailable === null ? '' : formData.pcAvailable ? 'Yes' : 'No'}
                    onChange={(e) =>
                      handleChange(
                        'pcAvailable',
                        e.target.value === '' ? null : e.target.value === 'Yes',
                      )
                    }
                  >
                    <option value="">Select</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
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
                <Edit2 size={12} />
                <span>Edit Profile</span>
              </button>
            </>
          ) : (
            <>
              <button type="button" className="eps-btn eps-btn-cancel" onClick={handleCancel}>
                Cancel
              </button>
              <button type="button" className="eps-btn eps-btn-primary" onClick={handleSave}>
                <Check size={12} />
                <span>Save Changes</span>
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

export default ProfileSettingsModal;
