import { assertWithinSizeLimit, escapeAttr, formatFileSize, uploadMediaFile } from './mediaUtils';
import { getFileTypeIconSvg } from './fileTypeIcons';

const MAX_ATTACHMENT_MB = 40;

const ACCEPTED_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip'];

export function getExtension(filename = '') {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match ? match[1].toLowerCase() : '';
}

export function isSupportedAttachment(file) {
  return ACCEPTED_EXTENSIONS.includes(getExtension(file?.name));
}

export async function ingestFile(file) {
  assertWithinSizeLimit(file, MAX_ATTACHMENT_MB);
  return uploadMediaFile(file);
}

/**
 * Clean single-row horizontal document attachment card markup.
 * No Download action: the file is already sitting on the server the admin
 * just uploaded it to. `data-media-id` (the HomeMedia row id) is threaded
 * through so Replace/Delete can clean up the old file on the backend.
 */
// .doc/.ppt are legacy binary (pre-2007) formats — not zip-based, so neither
// mammoth nor a zip-based reader can parse them. Only these four get a View
// button; .doc/.ppt/.zip fall back to Replace/Delete only (see officeViewer.js).
const PREVIEWABLE_EXTENSIONS = ['xlsx', 'xls', 'docx', 'pptx'];

export function buildAttachmentMarkup({ id, url, filename, filesize, mime }) {
  const ext = getExtension(filename);
  const sizeLabel = formatFileSize(filesize);
  const filenameAttr = filename ? ` data-filename="${escapeAttr(filename)}"` : '';
  const filesizeAttr = filesize ? ` data-filesize="${escapeAttr(filesize)}"` : '';
  const idAttr = id != null ? ` data-media-id="${escapeAttr(String(id))}"` : '';
  const isPreviewable = PREVIEWABLE_EXTENSIONS.includes(ext);

  // Clicking the filename itself also opens the preview — same trigger
  // class the "View" button uses, so the existing delegated click handlers
  // in EditableArea.jsx/HomeCard.jsx pick it up with no extra wiring.
  const nameTriggerClass = isPreviewable ? ' rte-office-view-trigger' : '';
  const nameTriggerAttrs = isPreviewable
    ? ` data-office-src="${escapeAttr(url)}" data-office-name="${escapeAttr(filename || 'Document')}"`
    : '';

  const viewBtn = isPreviewable
    ? `<button type="button" class="rte-btn-sm rte-office-view-trigger" data-office-src="${escapeAttr(url)}" data-office-name="${escapeAttr(filename || 'Document')}" title="View">View</button>`
    : '';

  return (
    `<div class="rte-media-card rte-attachment-card" data-media-type="attachment" data-src="${escapeAttr(url)}"${filenameAttr}${filesizeAttr}${idAttr} contenteditable="false">` +
    `<div class="rte-media-card-icon">${getFileTypeIconSvg(ext)}</div>` +
    `<div class="rte-media-card-info">` +
    `<span class="rte-media-card-name${nameTriggerClass}" title="${escapeAttr(filename || 'Document')}"${nameTriggerAttrs}>${escapeAttr(filename || 'Document')}</span>` +
    (sizeLabel ? `<span class="rte-media-card-size">${escapeAttr(sizeLabel)}</span>` : '') +
    `</div>` +
    `<div class="rte-media-card-actions">` +
    viewBtn +
    `<button type="button" class="rte-btn-sm rte-btn-secondary rte-media-replace-btn" data-media-type="attachment" title="Replace attachment">Replace</button>` +
    `<button type="button" class="rte-btn-sm rte-btn-danger rte-media-remove-btn" title="Delete attachment">Delete ×</button>` +
    `</div>` +
    `</div>`
  );
}
