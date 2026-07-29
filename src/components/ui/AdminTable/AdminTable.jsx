import { memo } from 'react';
import './AdminTable.css';

/**
 * Enterprise Admin Table Component.
 *
 * @param {Object} props
 * @param {Array<{ key: string, label: string, width?: string, align?: 'left'|'center'|'right', render?: (row: any) => React.ReactNode }>} props.columns - Column definitions.
 * @param {Array<Object>} props.data - Data rows.
 * @param {string} props.keyField - Field name to use as React key.
 * @param {string} [props.emptyText] - Text to show when empty.
 */
export const AdminTable = memo(function AdminTable({
  columns,
  data,
  keyField = 'id',
  emptyText = 'No records found.',
}) {
  return (
    <div className="ui-admin-table-container">
      <table className="ui-admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  width: col.width,
                  textAlign: col.align || 'left',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="ui-admin-table-empty">
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row[keyField]}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{ textAlign: col.align || 'left' }}
                  >
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
});

export default AdminTable;
