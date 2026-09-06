import { useLocation, Link } from 'react-router-dom';
import { FileText, ExternalLink } from 'lucide-react';

import { Breadcrumb } from '@components/navigation/Breadcrumb/Breadcrumb';
import { BREADCRUMB_TRAILS } from '@constants/navigation';
import { ROUTES } from '@constants/routes';
import { UploadTimestampDisplay } from '@components/ui/UploadTimestampDisplay/UploadTimestampDisplay';

import './PageWrapper.css';

/**
 * Standard page chrome: a breadcrumb trail derived from the current route, plus a
 * scrollable content region. Pages opt out simply by not being wrapped in it.
 *
 * @param {Object} props
 * @param {{ label: string, to?: string }[]} [props.breadcrumbItems]  Overrides the
 *   route-derived trail — use for detail pages whose trail includes a record name.
 * @param {import('react').ReactNode} [props.children]
 */
export function PageWrapper({ breadcrumbItems, children }) {
  const { pathname } = useLocation();
  const items = breadcrumbItems ?? BREADCRUMB_TRAILS[pathname] ?? [];

  let rightElement = null;
  if (pathname === ROUTES.MUREX_RUNTIME) {
    rightElement = <UploadTimestampDisplay fileKey="runTimeFilePath" label="Runtime File Last Updated on" />;
  } else if (pathname === ROUTES.PROJECT_MONITORING) {
    rightElement = (
      <UploadTimestampDisplay configs={[
        { fileKey: 'wofilePath', label: 'WO File Last Updated on' },
        { fileKey: 'crfilePath', label: 'CR File Last Updated on' }
      ]} />
    );
  } else if (pathname === ROUTES.CAPACITY_PLANNING) {
    rightElement = (
      <UploadTimestampDisplay configs={[
        { fileKey: 'crfilePath', label: 'CR File Last Updated on' }
      ]} />
    );
  } else if (pathname === ROUTES.ADMIN_HOME_MANAGEMENT) {
    rightElement = (
      <Link
        to={ROUTES.ADMIN_HOME_MANAGEMENT_USER_GUIDE}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '38px',
          padding: '0 16px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          background: 'var(--surface-primary)',
          border: '1px solid var(--border-primary)',
          borderRadius: '6px',
          cursor: 'pointer',
          textDecoration: 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <FileText size={14} />
        <span>User Guide</span>
        <ExternalLink size={14} />
      </Link>
    );
  }

  return (
    <div className="page-wrapper">
      <Breadcrumb items={items} rightElement={rightElement} />
      <div className="page-content">{children}</div>
    </div>
  );
}

export default PageWrapper;
