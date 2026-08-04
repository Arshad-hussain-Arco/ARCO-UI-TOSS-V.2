import { CODE_LOOKUP, PLAIN_TEXT_CODES } from '../constants';

export function StatusBadge({ code }) {
  const cfg = CODE_LOOKUP[code] || { code, label: code, color: '#6b7280', bg: '#f9fafb' };
  const isPlain = PLAIN_TEXT_CODES.has(code);
  return (
    <span
      className={isPlain ? 'att-cell-plain' : 'att-cell-badge'}
      style={
        isPlain
          ? { color: cfg.color }
          : { color: cfg.color, backgroundColor: cfg.bg, borderColor: `${cfg.color}30` }
      }
      title={cfg.label}
    >
      {code}
    </span>
  );
}

export default StatusBadge;
