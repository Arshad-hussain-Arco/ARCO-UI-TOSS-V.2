import { readFileAsDataUrl, assertWithinSizeLimit, escapeAttr, formatFileSize } from './mediaUtils';

const MAX_ATTACHMENT_MB = 40;

const ACCEPTED_EXTENSIONS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip'];

const EXTENSION_LABELS = {
  doc: 'DOC', docx: 'DOCX',
  xls: 'XLS', xlsx: 'XLSX',
  ppt: 'PPT', pptx: 'PPTX',
  zip: 'ZIP',
};

export function getExtension(filename = '') {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match ? match[1].toLowerCase() : '';
}

export function isSupportedAttachment(file) {
  return ACCEPTED_EXTENSIONS.includes(getExtension(file?.name));
}

export async function ingestFile(file) {
  assertWithinSizeLimit(file, MAX_ATTACHMENT_MB);
  let url;
  if (typeof URL !== 'undefined' && URL.createObjectURL) {
    url = URL.createObjectURL(file);
  } else {
    url = await readFileAsDataUrl(file);
  }
  return { url, filename: file.name, filesize: file.size, mime: file.type };
}

/**
 * Clean single-row horizontal document attachment card markup.
 */
export function buildAttachmentMarkup({ url, filename, filesize, mime }) {
  const ext = getExtension(filename);
  const label = EXTENSION_LABELS[ext] || ext.toUpperCase() || 'FILE';
  const sizeLabel = formatFileSize(filesize);
  const filenameAttr = filename ? ` data-filename="${escapeAttr(filename)}"` : '';
  const filesizeAttr = filesize ? ` data-filesize="${escapeAttr(filesize)}"` : '';

  return (
    `<div class="rte-media-card rte-attachment-card" data-media-type="attachment" data-src="${escapeAttr(url)}"${filenameAttr}${filesizeAttr} contenteditable="false">` +
    `<div class="rte-media-card-icon"><span class="rte-attachment-badge">${escapeAttr(label)}</span></div>` +
    `<div class="rte-media-card-info">` +
    `<span class="rte-media-card-name" title="${escapeAttr(filename || 'Document')}">${escapeAttr(filename || 'Document')}</span>` +
    (sizeLabel ? `<span class="rte-media-card-size">${escapeAttr(sizeLabel)}</span>` : '') +
    `</div>` +
    `<div class="rte-media-card-actions">` +
    `<a href="${escapeAttr(url)}" download="${escapeAttr(filename || 'document')}" class="rte-btn-sm rte-btn-secondary" style="text-decoration: none;">Download</a>` +
    `<button type="button" class="rte-btn-sm rte-btn-danger rte-media-remove-btn" title="Remove attachment">Remove ×</button>` +
    `</div>` +
    `</div>`
  );
}
