import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

import './Breadcrumb.css';

/**
 * Breadcrumb trail. Ancestors are real links; the final entry is the current
 * page and is not interactive.
 *
 * @param {Object} props
 * @param {{ label: string, to?: string }[]} props.items
 * @param {string} [props.ariaLabel='Breadcrumb']
 */
function BreadcrumbComponent({ items = [], ariaLabel = 'Breadcrumb' }) {
  if (items.length === 0) return null;

  return (
    <nav className="breadcrumb-nav" aria-label={ariaLabel}>
      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.to ?? item.label} className="breadcrumb-item">
              {index > 0 ? (
                <ChevronRight className="breadcrumb-separator" aria-hidden="true" />
              ) : null}

              {isLast ? (
                <span className="breadcrumb-current" aria-current="page">
                  {item.label}
                </span>
              ) : item.to ? (
                <Link to={item.to} className="breadcrumb-link">
                  {item.label}
                </Link>
              ) : (
                // Ancestor without a destination — same styling, not interactive.
                <span className="breadcrumb-link">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export const Breadcrumb = memo(BreadcrumbComponent);
export default Breadcrumb;
