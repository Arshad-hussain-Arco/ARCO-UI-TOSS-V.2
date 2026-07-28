import { memo } from 'react';
import { AlertCircle, CheckCircle, Clock, FileX } from 'lucide-react';

/** Reconciliation status → badge icon and label. */
const STATUS_CONFIG = {
  matched: { icon: CheckCircle, label: 'Matched' },
  unmatched: { icon: FileX, label: 'Unmatched' },
  partial: { icon: AlertCircle, label: 'Partial' },
  pending: { icon: Clock, label: 'Pending' },
};

/**
 * Status pill for a reconciliation row.
 *
 * @param {Object} props
 * @param {'matched'|'unmatched'|'partial'|'pending'} props.status
 */
function ReconciliationStatusBadgeComponent({ status }) {
  const config = STATUS_CONFIG[status];

  if (!config) return null;

  const { icon: Icon, label } = config;

  return (
    <span className={`recon-badge ${status}`}>
      <Icon size={12} aria-hidden="true" /> {label}
    </span>
  );
}

export const ReconciliationStatusBadge = memo(ReconciliationStatusBadgeComponent);
export default ReconciliationStatusBadge;
