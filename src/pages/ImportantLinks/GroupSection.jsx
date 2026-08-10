import { memo } from 'react';
import { ExternalLink, Pencil, Trash2 } from 'lucide-react';

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
          <Pencil size={12} />
        </button>

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
          <Trash2 size={12} />
        </button>

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
function GroupCardComponent({ id, title, icon: Icon, links, onEditLink, onDeleteLink }) {
  return (
    <article className="il-group-card" aria-labelledby={`group-heading-${id}`}>

      {/* Card Header */}
      <div className="il-group-card-header">
        {Icon && (
          <Icon size={14} className="il-group-card-icon" aria-hidden="true" />
        )}
        <h2 className="il-group-card-title" id={`group-heading-${id}`}>
          {title}
        </h2>
        <span className="il-group-card-count" aria-label={`${links.length} links`}>
          {links.length}
        </span>
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
              onEdit={onEditLink}
              onDelete={onDeleteLink}
            />
          ))
        )}
      </div>

    </article>
  );
}

export const GroupCard = memo(GroupCardComponent);
export default GroupCard;
