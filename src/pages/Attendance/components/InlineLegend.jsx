import { ATTENDANCE_CODE_MAP } from '../constants';

export function InlineLegend({ codesUsed }) {
  const items = codesUsed.length > 0
    ? ATTENDANCE_CODE_MAP.filter(c => codesUsed.includes(c.code))
    : ATTENDANCE_CODE_MAP;
  return (
    <div className="att-inline-legend">
      {items.map(({ code, label, color }) => (
        <span key={code} className="att-inline-legend-item">
          <span className="att-legend-dot" style={{ backgroundColor: color }} />
          <span className="att-legend-code" style={{ color }}>{code}</span>
          <span className="att-legend-desc">{label}</span>
        </span>
      ))}
    </div>
  );
}

export default InlineLegend;
