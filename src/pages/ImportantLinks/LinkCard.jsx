import { memo } from 'react';
import { ExternalLink } from 'lucide-react';

import './ImportantLinksPage.css';

/** Maps a tag value to its CSS modifier class. */
const TAG_CLASS_MAP = {
  internal: 'il-badge-internal',
  mandatory: 'il-badge-mandatory',
  critical: 'il-badge-critical',
  docs: 'il-badge-docs',
};

/**
 * A single clickable link card in the resource hub.
 *
 * @param {Object} props
 * @param {string} props.id
 * @param {string} props.label           Display name of the link.
 * @param {string} props.url
 * @param {string} [props.description]
 * @param {string} [props.tag]           Badge label (Internal, Mandatory, Critical, Docs, …)
 */
function LinkCardComponent({ id, label, url, description, tag }) {
  const badgeMod = tag
    ? (TAG_CLASS_MAP[(tag || '').toLowerCase()] ?? 'il-badge-default')
    : null;

  return (
    <a
      id={`link-card-${id}`}
      href={url}
      className="il-card"
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
    >
      <div className="il-card-body">
        <div className="il-card-label-row">
          <span className="il-card-label">{label}</span>
          {tag && (
            <span className={`il-badge ${badgeMod}`}>{tag}</span>
          )}
        </div>
        {description && (
          <p className="il-card-description">{description}</p>
        )}
      </div>
      <ExternalLink size={14} className="il-card-arrow" aria-hidden="true" />
    </a>
  );
}

export const LinkCard = memo(LinkCardComponent);
export default LinkCard;
