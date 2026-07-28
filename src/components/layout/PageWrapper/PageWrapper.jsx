import { useLocation } from 'react-router-dom';

import { Breadcrumb } from '@components/navigation/Breadcrumb/Breadcrumb';
import { BREADCRUMB_TRAILS } from '@constants/navigation';

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

  return (
    <div className="page-wrapper">
      <Breadcrumb items={items} />
      <div className="page-content">{children}</div>
    </div>
  );
}

export default PageWrapper;
