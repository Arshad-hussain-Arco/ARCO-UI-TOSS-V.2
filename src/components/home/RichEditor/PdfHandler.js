import { assertWithinSizeLimit, escapeAttr, formatFileSize, uploadMediaFile } from './mediaUtils';
import { getFileTypeIconSvg } from './fileTypeIcons';

const MAX_PDF_MB = 40;

export async function ingestFile(file) {
  assertWithinSizeLimit(file, MAX_PDF_MB);
  const result = await uploadMediaFile(file);
  return { ...result, mime: result.mime || 'application/pdf' };
}

export function isPdfFile(file) {
  return file && file.type === 'application/pdf';
}

/**
 * Clean single-row horizontal PDF card markup.
 * No Download action: the file is already sitting on the server the admin
 * just uploaded it to, so "View PDF" is the only read action that makes
 * sense in-editor. `data-media-id` (the HomeMedia row id) is threaded
 * through so Replace/Delete can clean up the old file on the backend.
 */
export function buildPdfMarkup({ id, url, filename, filesize }) {
  const sizeLabel = filesize ? formatFileSize(filesize) : '';
  const sizeAttr = filesize ? ` data-filesize="${escapeAttr(sizeLabel)}"` : '';
  const filenameAttr = filename ? ` data-filename="${escapeAttr(filename)}"` : '';
  const idAttr = id != null ? ` data-media-id="${escapeAttr(String(id))}"` : '';

  return (
    `<div class="rte-media-card rte-pdf-card" data-media-type="pdf" data-src="${escapeAttr(url)}"${filenameAttr}${sizeAttr}${idAttr} contenteditable="false">` +
    `<div class="rte-media-card-icon">${getFileTypeIconSvg('pdf')}</div>` +
    `<div class="rte-media-card-info">` +
    `<span class="rte-media-card-name rte-pdf-view-trigger" title="${escapeAttr(filename || 'Document.pdf')}" data-pdf-src="${escapeAttr(url)}" data-pdf-name="${escapeAttr(filename || 'Document.pdf')}">${escapeAttr(filename || 'Document.pdf')}</span>` +
    (sizeLabel ? `<span class="rte-media-card-size">${escapeAttr(sizeLabel)}</span>` : '') +
    `</div>` +
    `<div class="rte-media-card-actions">` +
    `<button type="button" class="rte-btn-sm rte-pdf-view-trigger" data-pdf-src="${escapeAttr(url)}" data-pdf-name="${escapeAttr(filename || 'Document.pdf')}">View PDF</button>` +
    `<button type="button" class="rte-btn-sm rte-btn-secondary rte-media-replace-btn" data-media-type="pdf" title="Replace PDF">Replace</button>` +
    `<button type="button" class="rte-btn-sm rte-btn-danger rte-media-remove-btn" title="Delete PDF">Delete ×</button>` +
    `</div>` +
    `</div>`
  );
}
