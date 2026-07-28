import { Phone, Mail, Users, Lock, Trash2, Edit, Power, Copy } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import './ConsultantCard.css';
function ConsultantCard({ consultant, onEdit, onChangePassword, onDelete, isInactive, onActivate, onAvatarClick }) {
  const toast = useToast();
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
    toast.success('Employee ID copied');
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
            {consultant.avatar ? (
              <img
                src={consultant.avatar}
                alt={consultant.name}
                className="consultant-avatar-img"
              />
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
              <span className="consultant-designation" title={consultant.designation}>
                {consultant.designation}
              </span>
              <div 
                className="consultant-id-copy" 
                onClick={(e) => handleCopy(e, consultant.userId)}
                onKeyDown={(e) => e.key === 'Enter' && handleCopy(e, consultant.userId)}
                role="button"
                tabIndex={0}
                title="Copy Employee ID"
              >
                <span className="consultant-user-id">{consultant.userId}</span>
                <Copy size={12} className="copy-icon" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="consultant-card-body">
        <div className="consultant-detail-item" title={consultant.team}>
          <Users className="consultant-detail-icon" />
          <span className="consultant-detail-text">{consultant.team}</span>
        </div>
        <div className="consultant-detail-item" title={consultant.phone}>
          <Phone className="consultant-detail-icon" />
          <span className="consultant-detail-text">{consultant.phone}</span>
        </div>
        <div className="consultant-detail-item" title={consultant.email}>
          <Mail className="consultant-detail-icon" />
          <span className="consultant-detail-text">{consultant.email}</span>
        </div>
      </div>

      {/* Card Footer - Action Buttons */}
      <div className="consultant-card-footer">
        {isInactive ? (
          <button
            onClick={() => onActivate && onActivate(consultant)}
            className="consultant-footer-btn consultant-footer-btn-activate"
            title="Activate Consultant"
            style={{ width: '100%', display: 'flex', gap: '8px', color: 'var(--c-success)', justifyContent: 'center' }}
          >
            <Power className="consultant-footer-btn-icon" />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Activate</span>
          </button>
        ) : (
          <>
            <button
              onClick={() => onEdit && onEdit(consultant)}
              className="consultant-footer-btn consultant-footer-btn-edit"
              title="Edit Consultant"
            >
              <Edit className="consultant-footer-btn-icon" />
            </button>
            <button
              onClick={() => onChangePassword && onChangePassword(consultant)}
              className="consultant-footer-btn consultant-footer-btn-password"
              title="Change Password"
            >
              <Lock className="consultant-footer-btn-icon" />
            </button>
            <button
              onClick={() => onDelete && onDelete(consultant)}
              className="consultant-footer-btn consultant-footer-btn-delete"
              title="Delete Consultant"
            >
              <Trash2 className="consultant-footer-btn-icon" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
export { ConsultantCard };
export default ConsultantCard;
