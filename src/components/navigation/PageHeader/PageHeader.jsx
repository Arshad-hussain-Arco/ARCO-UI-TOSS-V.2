import { memo } from 'react';
import { Breadcrumb } from '@components/navigation/Breadcrumb/Breadcrumb';
import './PageHeader.css';

/**
 * Reusable Page Header / Breadcrumb Header component with dynamic right-hand action slot.
 *
 * @param {Object} props
 * @param {string} [props.title] Page title
 * @param {{ label: string, to?: string }[]} [props.items] Breadcrumb trail items
 * @param {import('react').ReactNode} [props.actions] Dynamic right-aligned action slot / controls
 * @param {import('react').ReactNode} [props.children] Alias for actions
 * @param {string} [props.className] Additional CSS container classes
 */
function PageHeaderComponent({
  title,
  items,
  actions,
  children,
  className = '',
}) {
  const rightActions = actions ?? children;
  const breadcrumbItems = items ?? (title ? [{ label: title }] : []);

  return (
    <header className={`page-header-container ${className}`}>
      {/* Left Block: Title & Breadcrumbs */}
      <div className="page-header-left">
        {breadcrumbItems.length > 0 ? <Breadcrumb items={breadcrumbItems} /> : null}
      </div>

      {/* Right Block: Dynamic Action Slot */}
      {rightActions ? <div className="page-header-right">{rightActions}</div> : null}
    </header>
  );
}

export const PageHeader = memo(PageHeaderComponent);
export default PageHeader;
