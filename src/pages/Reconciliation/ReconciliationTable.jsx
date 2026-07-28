import { memo } from 'react';
import { MoreVertical, Search } from 'lucide-react';

import { ReconciliationStatusBadge } from './ReconciliationStatusBadge';

/** Column widths, preserved from the original layout. */
const COLUMN_WIDTHS = ['10%', '15%', '20%', '15%', '15%', '12%', '8%', '5%'];

const formatAmount = (amount) => amount.toLocaleString(undefined, { minimumFractionDigits: 2 });

/**
 * Transaction comparison table.
 *
 * @param {Object} props
 * @param {Array} props.transactions  Already filtered by the page.
 */
function ReconciliationTableComponent({ transactions }) {
  return (
    <div className="recon-table-wrapper">
      <table className="recon-table">
        <colgroup>
          {COLUMN_WIDTHS.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>

        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Reference</th>
            <th scope="col">Description</th>
            <th scope="col" className="text-right">
              Source A (Ledger)
            </th>
            <th scope="col" className="text-right">
              Source B (Swift)
            </th>
            <th scope="col" className="text-center">
              Status
            </th>
            <th scope="col" className="text-right">
              Difference
            </th>
            <th />
          </tr>
        </thead>

        <tbody>
          {transactions.map((item) => (
            <tr key={item.id} className="recon-row">
              <td className="recon-td-date">{item.date}</td>
              <td className="recon-td-ref">{item.reference}</td>
              <td className="recon-td-desc">
                <div className="recon-desc-text" title={item.description}>
                  {item.description}
                </div>
              </td>

              <td className="recon-td-amount text-right">
                <span className="currency">{item.sideA.currency}</span>
                <span className="amount">{formatAmount(item.sideA.amount)}</span>
              </td>

              <td className="recon-td-amount text-right">
                {item.sideB ? (
                  <>
                    <span className="currency">{item.sideB.currency}</span>
                    <span className="amount">{formatAmount(item.sideB.amount)}</span>
                  </>
                ) : (
                  <span className="text-muted">Missing record</span>
                )}
              </td>

              <td className="text-center">
                <ReconciliationStatusBadge status={item.status} />
              </td>

              <td
                className={`recon-td-diff text-right ${item.difference !== 0 ? 'highlight' : ''}`}
              >
                {item.difference !== 0 ? formatAmount(item.difference) : '-'}
              </td>

              <td className="text-center">
                <button
                  type="button"
                  className="recon-row-action"
                  aria-label={`Actions for ${item.reference}`}
                >
                  <MoreVertical size={14} aria-hidden="true" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {transactions.length === 0 ? (
        <div className="recon-empty">
          <Search size={32} aria-hidden="true" />
          <h3>No records match your filters</h3>
          <p>Try clearing your search or adjusting the status filter.</p>
        </div>
      ) : null}
    </div>
  );
}

export const ReconciliationTable = memo(ReconciliationTableComponent);
export default ReconciliationTable;
