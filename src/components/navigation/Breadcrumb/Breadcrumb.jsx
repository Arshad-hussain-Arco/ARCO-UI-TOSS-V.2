import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, X } from 'lucide-react';

import './Breadcrumb.css';

/**
 * Breadcrumb trail. Ancestors are real links or click handlers; the final entry
 * is the current page/item with an optional close button.
 *
 * @param {Object} props
 * @param {{ label: string, to?: string, onClick?: () => void, onClose?: () => void }[]} props.items
 * @param {string} [props.ariaLabel='Breadcrumb']
 * @param {React.ReactNode} [props.rightElement]
 */
function BreadcrumbComponent({ items = [], ariaLabel = 'Breadcrumb', rightElement }) {
  if (items.length === 0 && !rightElement) return null;

  return (
    <nav className="breadcrumb-nav" aria-label={ariaLabel} style={{ display: 'flex', alignItems: 'center', }}>
      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={item.to ?? item.label} className="breadcrumb-item">
              {index > 0 ? (
                <ChevronRight className="breadcrumb-separator" aria-hidden="true" />
              ) : null}

              {isLast ? (
                <span className="breadcrumb-current" aria-current="page" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  {item.label}
                  {item.onClose && (
                    <button
                      type="button"
                      className="breadcrumb-close-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        item.onClose();
                      }}
                      title="Close file preview"
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        color: 'var(--text-secondary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        borderRadius: '3px',
                        marginLeft: '4px',
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              ) : item.onClick ? (
                <span
                  className="breadcrumb-link"
                  onClick={item.onClick}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && item.onClick()}
                  style={{ cursor: 'pointer' }}
                >
                  {item.label}
                </span>
              ) : item.to ? (
                <Link to={item.to} className="breadcrumb-link">
                  {item.label}
                </Link>
              ) : (
                <span className="breadcrumb-link">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
      {rightElement && (
        <div className="breadcrumb-right-element">
          {rightElement}
        </div>
      )}
    </nav>
  );
}

export const Breadcrumb = memo(BreadcrumbComponent);
export default Breadcrumb;
