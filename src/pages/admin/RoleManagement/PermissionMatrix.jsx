import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { PERMISSION_ACTIONS, PERMISSION_LEVELS, PERMISSION_MODULES } from '@mocks/data/roles';

import { PermissionIndicator } from './PermissionIndicator';

const LEGEND = [
  { level: PERMISSION_LEVELS.ALLOWED, label: 'Allowed' },
  { level: PERMISSION_LEVELS.PARTIAL, label: 'Partial' },
  { level: PERMISSION_LEVELS.DENIED, label: 'Denied' },
  { level: PERMISSION_LEVELS.NOT_SET, label: 'Not Set' },
];

/**
 * Module-by-action permission grid, its legend and pagination footer.
 *
 * @param {Object} props
 * @param {Record<string, Record<string, string>>} props.matrix
 */
function PermissionMatrixComponent({ matrix }) {
  return (
    <>
      <div className="rm-table-container">
        <table className="rm-table">
          <thead>
            <tr>
              <th scope="col">Module</th>
              {PERMISSION_ACTIONS.map((action) => (
                <th key={action.key} scope="col" style={{ width: '100px', textAlign: 'center' }}>
                  {action.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {PERMISSION_MODULES.map((module) => (
              <tr key={module}>
                <td>{module}</td>
                {PERMISSION_ACTIONS.map((action) => (
                  <td key={action.key} style={{ textAlign: 'center' }}>
                    <PermissionIndicator level={matrix[module]?.[action.key]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rm-rp-footer">
        <div className="rm-legend">
          {LEGEND.map(({ level, label }) => (
            <div key={level} className="rm-legend-item">
              <PermissionIndicator level={level} decorative />
              {label}
            </div>
          ))}
        </div>

        <div className="rm-pagination">
          <span style={{ marginRight: '8px' }}>Page 1 of 1</span>
          <button type="button" className="rm-page-btn" disabled aria-label="Previous page">
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <button type="button" className="rm-page-btn" disabled aria-label="Next page">
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}

export const PermissionMatrix = memo(PermissionMatrixComponent);
export default PermissionMatrix;
