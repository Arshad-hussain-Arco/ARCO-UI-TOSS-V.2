export function GenderBadge({ value }) {
  if (value === 'M') return <span className="lc-badge lc-badge-male">&#9794; Male</span>;
  if (value === 'F') return <span className="lc-badge lc-badge-female">&#9792; Female</span>;
  return <span className="lc-badge lc-badge-all">All</span>;
}

export function CategoryTag({ value }) {
  const label = value ? value.charAt(0) + value.slice(1).toLowerCase() : '—';
  const cls =
    value === 'CLAIM' ? 'lc-tag-claim' : value === 'NOMINAL' ? 'lc-tag-nominal' : 'lc-tag-actual';
  return <span className={`lc-category-tag ${cls}`}>{label}</span>;
}
