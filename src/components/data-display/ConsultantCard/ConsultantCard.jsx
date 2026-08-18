import { useState, useEffect } from 'react';
import { Phone, Mail, Users, Lock, UserX, Edit, Power, Copy } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { consultantService } from '@services/consultantService';
import './ConsultantCard.css';

function ConsultantCard({ consultant, onEdit, onChangePassword, onDelete, isInactive, onActivate, onAvatarClick, isActivating }) {
  const toast = useToast();
  const getPhoto = (c) => {
    if (c.avatar) return c.avatar;
    if (c.photo) {
      if (c.photo.startsWith('data:')) return c.photo;
      return `data:image/jpeg;base64,${c.photo}`;
    }
    return null;
  };

  const [photoUrl, setPhotoUrl] = useState(getPhoto(consultant));
  const [isFetchingPhoto, setIsFetchingPhoto] = useState(false);

  useEffect(() => {
    setPhotoUrl(getPhoto(consultant));
  }, [consultant.avatar, consultant.photo]);

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  const handleCopy = (e, text) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success('Username copied');
  };
  
  return (
    <div className="consultant-card">
      {/* Card Header */}
      <div className="consultant-card-header">
        <div className="consultant-header-left">
          {/* Avatar */}
          <div 
            className="consultant-avatar" 
            style={{ cursor: 'pointer' }}
            onClick={() => onAvatarClick && onAvatarClick(consultant)}
            onKeyDown={(e) => e.key === 'Enter' && onAvatarClick && onAvatarClick(consultant)}
            role="button"
            tabIndex={0}
            title="View Profile"
          >
            {isFetchingPhoto ? (
              <div className="consultant-avatar-skeleton"></div>
            ) : photoUrl ? (
              <img
                src={photoUrl}
                alt={consultant.name}
                className="consultant-avatar-img"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  setPhotoUrl(''); // Clear so initials fallback renders
                }}
              />
            ) : consultant.is_team ? (
              <div className="consultant-avatar-initials" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--c-primary)' }}>
                <Users size={20} />
              </div>
            ) : (
              <div className="consultant-avatar-initials">{getInitials(consultant.name)}</div>
            )}
          </div>

          {/* Name and User ID */}
          <div className="consultant-info">
            <h3 className="consultant-name" title={consultant.name}>
              {consultant.name}
            </h3>
            <div className="consultant-meta">
              {consultant.designation && (
                <span className="consultant-designation" title={consultant.designation}>
                  {consultant.designation}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="consultant-card-body">
        {/* Absolute Pill on the break line */}
        {consultant.userId && (
          <div 
            className="consultant-id-copy consultant-id-copy-absolute" 
            onClick={(e) => handleCopy(e, String(consultant.userId || ''))}
            title="Copy Username"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleCopy(e, String(consultant.userId || ''))}
          >
            <span className="consultant-user-id">{consultant.userId}</span>
            <Copy size={12} className="copy-icon" />
          </div>
        )}

        {consultant.team && (
          <div className="consultant-detail-item" title={consultant.team}>
            <Users className="consultant-detail-icon" />
            <span className="consultant-detail-text">{consultant.team}</span>
          </div>
        )}
        {consultant.phone && (
          <div className="consultant-detail-item" title={consultant.phone}>
            <Phone className="consultant-detail-icon" />
            <span className="consultant-detail-text">{consultant.phone}</span>
          </div>
        )}
        {consultant.email && (
          <div className="consultant-detail-item" title={consultant.email}>
            <Mail className="consultant-detail-icon" />
            <span className="consultant-detail-text">{consultant.email}</span>
          </div>
        )}
      </div>

      {/* Card Footer - Action Buttons */}
      {!consultant.is_team && (
        <div className="consultant-card-footer">
          {isInactive ? (
            onActivate && (
              <button
                onClick={() => onActivate(consultant)}
                className="consultant-footer-btn consultant-footer-btn-activate"
                title="Activate Consultant"
                disabled={isActivating}
                style={{ width: '100%', display: 'flex', gap: '8px', color: 'var(--c-success)', justifyContent: 'center', opacity: isActivating ? 0.6 : 1, cursor: isActivating ? 'not-allowed' : 'pointer' }}
              >
                {isActivating ? (
                  <span className="spin-animation" style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid var(--c-success)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                ) : (
                  <Power className="consultant-footer-btn-icon" />
                )}
                <span style={{ fontSize: '13px', fontWeight: 600 }}>{isActivating ? 'Activating...' : 'Activate'}</span>
              </button>
            )
          ) : (
            <>
              {onEdit && (
                <button
                  onClick={() => onEdit(consultant)}
                  className="consultant-footer-btn consultant-footer-btn-edit"
                  title="Edit Consultant"
                >
                  <Edit className="consultant-footer-btn-icon" />
                </button>
              )}
              {onChangePassword && (
                <button
                  onClick={() => onChangePassword(consultant)}
                  className="consultant-footer-btn consultant-footer-btn-password"
                  title="Change Password"
                >
                  <Lock className="consultant-footer-btn-icon" />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(consultant)}
                  className="consultant-footer-btn consultant-footer-btn-delete"
                  title="Deactivate Consultant"
                >
                  <UserX className="consultant-footer-btn-icon" />
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
export function ConsultantCardSkeleton() {
  return (
    <div className="consultant-card">
      <div className="consultant-card-header">
        <div className="consultant-header-left">
          <div className="consultant-avatar consultant-avatar-skeleton" style={{ width: 44, height: 44 }}></div>
          <div className="consultant-info" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="consultant-skeleton-block" style={{ width: '120px', height: '16px' }}></div>
            <div className="consultant-skeleton-block" style={{ width: '80px', height: '12px' }}></div>
          </div>
        </div>
      </div>
      <div className="consultant-card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
        <div className="consultant-skeleton-block" style={{ width: '90%', height: '14px' }}></div>
        <div className="consultant-skeleton-block" style={{ width: '70%', height: '14px' }}></div>
        <div className="consultant-skeleton-block" style={{ width: '80%', height: '14px' }}></div>
      </div>
      <div className="consultant-card-footer" style={{ padding: '12px 20px', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
         <div className="consultant-skeleton-block" style={{ width: '32px', height: '32px', borderRadius: '6px' }}></div>
         <div className="consultant-skeleton-block" style={{ width: '32px', height: '32px', borderRadius: '6px' }}></div>
         <div className="consultant-skeleton-block" style={{ width: '32px', height: '32px', borderRadius: '6px' }}></div>
      </div>
    </div>
  );
}

export { ConsultantCard };
export default ConsultantCard;
