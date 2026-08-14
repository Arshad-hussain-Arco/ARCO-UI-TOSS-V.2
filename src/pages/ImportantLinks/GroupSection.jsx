import { memo } from 'react';
import { ExternalLink, Edit, Trash } from 'lucide-react';

import './ImportantLinksPage.css';

/** Maps tag → CSS class */
const TAG_CLASS_MAP = {
  internal: 'il-badge-internal',
  mandatory: 'il-badge-mandatory',
  critical: 'il-badge-critical',
  docs: 'il-badge-docs',
};

/**
 * Single link row rendered inside a group card.
 */
function LinkItem({ link, onEdit, onDelete }) {
  const badgeMod = link.tag
    ? (TAG_CLASS_MAP[(link.tag || '').toLowerCase()] ?? 'il-badge-default')
    : null;

  return (
    <div className="il-link-item">
      <div className="il-link-item-body">
        <span className="il-link-item-name" title={link.label}>{link.label}</span>
        {link.tag && (
          <span className={`il-badge ${badgeMod}`}>{link.tag}</span>
        )}
      </div>

      <div className="il-link-item-actions">
        {onEdit && (
          <button
            type="button"
            className="action-icon-btn edit"
            title="Edit link"
            aria-label={`Edit ${link.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(link);
            }}
          >
            <Edit size={12} />
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            className="action-icon-btn delete"
            title="Delete link"
            aria-label={`Delete ${link.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(link);
            }}
          >
            <Trash size={12} />
          </button>
        )}

        <a
          href={link.url}
          className="action-icon-btn"
          target="_blank"
          rel="noopener noreferrer"
          title={`Open ${link.label}`}
          aria-label={`Open ${link.label} in a new tab`}
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}

/**
 * A group card in the enterprise resource hub.
 * Shows a header (icon + title + count) and a scrollable list of link items.
 *
 * @param {Object} props
 * @param {string} props.id
 * @param {string} props.title
 * @param {import('react').ComponentType} [props.icon]
 * @param {{ id: string, label: string, url: string, description?: string, tag?: string }[]} props.links
 * @param {(link: Object) => void} props.onEditLink   Called when user clicks the edit icon on a link.
 * @param {(link: Object) => void} props.onDeleteLink Called when user clicks the delete icon on a link.
 */
function GroupCardComponent({ id, title, icon: Icon, links, isPinned, onTogglePinGroup, canEdit, canDelete, onEditLink, onDeleteLink }) {
  return (
    <article className="il-group-card" aria-labelledby={`group-heading-${id}`}>

      {/* Card Header */}
      <div className="il-group-card-header">
        {Icon && (
          <Icon size={14} className="il-group-card-icon" aria-hidden="true" />
        )}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 className="il-group-card-title" id={`group-heading-${id}`} style={{ flex: '0 1 auto', flexGrow: 0 }}>
            {title}
          </h2>
          <span className="il-group-card-count" aria-label={`${links.length} links`} style={{ flexShrink: 0 }}>
            {links.length}
          </span>
        </div>
        {onTogglePinGroup && (
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Pin to header</span>
            <label className="il-toggle" aria-label="Pin to header" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => onTogglePinGroup(isPinned)}
              />
              <span className="il-toggle-track" />
              <span className="il-toggle-thumb" />
            </label>
          </div>
        )}
      </div>

      {/* Card Body — scrollable */}
      <div className="il-group-card-body">
        {links.length === 0 ? (
          <div className="il-group-card-empty">No links in this group</div>
        ) : (
          links.map((link) => (
            <LinkItem
              key={link.id}
              link={link}
              onEdit={canEdit ? onEditLink : undefined}
              onDelete={canDelete ? onDeleteLink : undefined}
            />
          ))
        )}
      </div>

    </article>
  );
}

export const GroupCard = memo(GroupCardComponent);
export default GroupCard;
