import { memo } from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * One category card in the link directory.
 *
 * @param {Object} props
 * @param {string} props.title
 * @param {import('react').ComponentType} [props.icon]
 * @param {{ id: string, label: string, url: string, description: string, tag?: string }[]} props.links
 */
function LinkCategoryComponent({ title, icon: Icon, links }) {
  return (
    <div className="links-category">
      <div className="category-header">
        {Icon ? <Icon size={18} aria-hidden="true" /> : null}
        <h2>{title}</h2>
      </div>

      <div className="links-list">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            className="link-item"
            target="_blank"
            rel="noopener noreferrer"
          >
            <div className="link-content">
              <div className="link-label-row">
                <span className="link-label">{link.label}</span>
                {link.tag ? <span className="link-tag">{link.tag}</span> : null}
              </div>
              <p className="link-description">{link.description}</p>
            </div>
            <ExternalLink size={14} className="link-external-icon" aria-hidden="true" />
          </a>
        ))}
      </div>
    </div>
  );
}

export const LinkCategory = memo(LinkCategoryComponent);
export default LinkCategory;
