/**
 * Flat, colored file-type icons for PDF/attachment cards — pictorial only,
 * no letters baked into the icon (that's what the filename text next to it
 * is for). Plain inline SVG strings since these get embedded into markup
 * built as raw HTML (PdfHandler.js/AttachmentHandler.js), not JSX.
 *
 * Every icon shares the same "page with a folded top-right corner" base
 * shape; only the fill color and the small white pictogram inside change,
 * so they read as one consistent icon family at a glance.
 */

const PAGE_SHAPE = (color) => (
  `<path d="M5 2.5h8l5 5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2z" fill="${color}"/>` +
  `<path d="M13 2.5V7a1 1 0 0 0 1 1h4.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1"/>`
);

const ICONS = {
  pdf: (
    `<path d="M5 2.5h8l5 5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2z" fill="#DC2626"/>` +
    `<path d="M13 2.5V7a1 1 0 0 0 1 1h4.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1"/>` +
    `<path d="M7 12.5h2.2a1.4 1.4 0 1 1 0 2.8H7z" fill="none" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<path d="M12.3 12.5v5" stroke="#fff" stroke-width="1.1"/>` +
    `<path d="M12.3 12.5h1.4a1.9 1.9 0 0 1 0 5h-1.4" fill="none" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/>` +
    `<path d="M16.6 12.5v5m0-2.6h1.6m-1.6-2.4h1.9" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>`
  ),
  docx: (
    PAGE_SHAPE('#2563EB') +
    `<rect x="6.5" y="12" width="9" height="1.4" rx="0.4" fill="#fff"/>` +
    `<rect x="6.5" y="15" width="9" height="1.4" rx="0.4" fill="#fff"/>` +
    `<rect x="6.5" y="18" width="6" height="1.4" rx="0.4" fill="#fff"/>`
  ),
  xlsx: (
    PAGE_SHAPE('#16A34A') +
    `<rect x="6.5" y="11.5" width="9" height="8" rx="0.6" fill="none" stroke="#fff" stroke-width="1"/>` +
    `<path d="M6.5 14.8h9M6.5 17.2h9M11 11.5v8" stroke="#fff" stroke-width="1"/>`
  ),
  pptx: (
    PAGE_SHAPE('#EA580C') +
    `<rect x="6.5" y="11.5" width="9" height="6.2" rx="0.8" fill="none" stroke="#fff" stroke-width="1"/>` +
    `<path d="m9.3 13v3.6l3-1.8z" fill="#fff"/>`
  ),
  zip: (
    `<path d="M5 2.5h8l5 5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2z" fill="#64748B"/>` +
    `<path d="M13 2.5V7a1 1 0 0 0 1 1h4.5" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1"/>` +
    `<rect x="9.5" y="9" width="3" height="2" fill="#fff"/>` +
    `<rect x="9.5" y="12" width="3" height="2" fill="#fff"/>` +
    `<rect x="9.5" y="15" width="3" height="2" fill="#fff"/>` +
    `<circle cx="11" cy="18.5" r="1.6" fill="none" stroke="#fff" stroke-width="1"/>`
  ),
};

const EXTENSION_ALIASES = {
  doc: 'docx', docx: 'docx',
  xls: 'xlsx', xlsx: 'xlsx',
  ppt: 'pptx', pptx: 'pptx',
  pdf: 'pdf',
  zip: 'zip',
};

/** Returns a ready-to-embed <svg>…</svg> string for a file extension, generic-file fallback otherwise. */
export function getFileTypeIconSvg(extension) {
  const key = EXTENSION_ALIASES[(extension || '').toLowerCase()] || 'zip';
  return `<svg class="rte-filetype-icon" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${ICONS[key]}</svg>`;
}
