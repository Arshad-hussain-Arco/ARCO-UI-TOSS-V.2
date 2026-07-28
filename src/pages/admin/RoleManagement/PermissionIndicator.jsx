import { memo } from 'react';
import { Check, Minus, X } from 'lucide-react';

import { PERMISSION_LEVELS } from '@mocks/data/roles';

/** Permission level → indicator glyph, modifier class and accessible label. */
const LEVEL_CONFIG = {
  [PERMISSION_LEVELS.ALLOWED]: { icon: Check, className: 'rm-perm-allowed', label: 'Allowed' },
  [PERMISSION_LEVELS.PARTIAL]: { icon: Minus, className: 'rm-perm-partial', label: 'Partial' },
  [PERMISSION_LEVELS.DENIED]: { icon: X, className: 'rm-perm-denied', label: 'Denied' },
};

/**
 * Single cell of the permission matrix.
 *
 * @param {Object} props
 * @param {'allowed'|'partial'|'denied'|'not_set'} props.level
 * @param {boolean} [props.decorative=false]
 *   True in the legend, where the adjacent text already names the level.
 */
function PermissionIndicatorComponent({ level, decorative = false }) {
  const config = LEVEL_CONFIG[level];

  if (!config) {
    return (
      <div
        className="rm-perm-notset"
        role={decorative ? undefined : 'img'}
        aria-label={decorative ? undefined : 'Not set'}
      />
    );
  }

  const { icon: Icon, className, label } = config;

  return (
    <div
      className={`rm-perm-indicator ${className}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
    >
      <Icon size={14} strokeWidth={3} aria-hidden="true" />
    </div>
  );
}

export const PermissionIndicator = memo(PermissionIndicatorComponent);
export default PermissionIndicator;
