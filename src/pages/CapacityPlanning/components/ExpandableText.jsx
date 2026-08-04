import { useState } from 'react';

const TOGGLE_BTN_STYLE = {
  background: 'none',
  border: 'none',
  color: '#006838',
  padding: '0',
  font: 'inherit',
  fontWeight: 600,
  cursor: 'pointer',
  textDecoration: 'underline',
  display: 'inline',
};

/** Truncates long text with a Show more/less toggle; optionally splits a leading "REF: rest" prefix. */
export function ExpandableText({ text, hasRefPrefix = false, maxLength = 30 }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (!text) return <span>N/A</span>;

  let prefix = '';
  let body = text;

  if (hasRefPrefix) {
    const parts = text.split(':');
    if (parts.length >= 2) {
      const ref = parts[0].trim();
      prefix = ref ? (ref.startsWith('#') ? ref : `#${ref}`) : '';
      body = parts.slice(1).join(':').trim();
    }
  }

  if (body.length <= maxLength) {
    return (
      <span>
        {prefix && <strong style={{ color: '#64748b' }}>{prefix} · </strong>}
        {body}
      </span>
    );
  }

  return (
    <span>
      {prefix && <strong style={{ color: '#64748b' }}>{prefix} · </strong>}
      {isExpanded ? body : `${body.slice(0, maxLength)}...`}{' '}
      <button type="button" onClick={() => setIsExpanded(!isExpanded)} style={TOGGLE_BTN_STYLE}>
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </span>
  );
}

export default ExpandableText;
