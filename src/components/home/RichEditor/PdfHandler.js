import { readFileAsDataUrl, assertWithinSizeLimit, escapeAttr, formatFileSize } from './mediaUtils';

const MAX_PDF_MB = 40;

export async function ingestFile(file) {
  assertWithinSizeLimit(file, MAX_PDF_MB);
  let url;
  if (typeof URL !== 'undefined' && URL.createObjectURL) {
    url = URL.createObjectURL(file);
  } else {
    url = await readFileAsDataUrl(file);
  }
  return { url, filename: file.name, filesize: file.size, mime: file.type || 'application/pdf' };
}

export function isPdfFile(file) {
  return file && file.type === 'application/pdf';
}

/**
 * Clean single-row horizontal PDF card markup.
 */
export function buildPdfMarkup({ url, filename, filesize }) {
  const sizeLabel = filesize ? formatFileSize(filesize) : '';
  const sizeAttr = filesize ? ` data-filesize="${escapeAttr(sizeLabel)}"` : '';
  const filenameAttr = filename ? ` data-filename="${escapeAttr(filename)}"` : '';

  return (
    `<div class="rte-media-card rte-pdf-card" data-media-type="pdf" data-src="${escapeAttr(url)}"${filenameAttr}${sizeAttr} contenteditable="false">` +
    `<div class="rte-media-card-icon">📄</div>` +
    `<div class="rte-media-card-info">` +
    `<span class="rte-media-card-name" title="${escapeAttr(filename || 'Document.pdf')}">${escapeAttr(filename || 'Document.pdf')}</span>` +
    (sizeLabel ? `<span class="rte-media-card-size">${escapeAttr(sizeLabel)}</span>` : '') +
    `</div>` +
    `<div class="rte-media-card-actions">` +
    `<button type="button" class="rte-btn-sm rte-pdf-view-trigger" data-pdf-src="${escapeAttr(url)}" data-pdf-name="${escapeAttr(filename || 'Document.pdf')}">View PDF</button>` +
    `<a href="${escapeAttr(url)}" download="${escapeAttr(filename || 'document.pdf')}" class="rte-btn-sm rte-btn-secondary" style="text-decoration: none;">Download</a>` +
    `<button type="button" class="rte-btn-sm rte-btn-danger rte-media-remove-btn" title="Remove PDF">Remove ×</button>` +
    `</div>` +
    `</div>`
  );
}
