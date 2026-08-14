import { readFileAsDataUrl, assertWithinSizeLimit, escapeAttr, formatFileSize } from './mediaUtils';

const MAX_ATTACHMENT_MB = 15;

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
  const url = await readFileAsDataUrl(file);
  return { url, filename: file.name, filesize: file.size, mime: file.type };
}

/**
 * Renders as a downloadable "attachment card" — a labeled block with
 * filename/size/extension badge. Filename/size are duplicated into
 * data-* attributes (in addition to the visible text) so the card can be
 * re-parsed/re-rendered consistently after being saved and reloaded as an
 * HTML string.
 */
export function buildAttachmentMarkup({ url, filename, filesize, mime }) {
  const ext = getExtension(filename);
  const label = EXTENSION_LABELS[ext] || ext.toUpperCase() || 'FILE';
  const sizeLabel = formatFileSize(filesize);
  return (
    `<div class="rte-attachment-card" contenteditable="false" ` +
    `data-filename="${escapeAttr(filename)}" data-filesize="${escapeAttr(filesize)}" data-mime="${escapeAttr(mime)}">` +
    `<a href="${escapeAttr(url)}" download="${escapeAttr(filename)}" class="rte-attachment-link">` +
    `<span class="rte-attachment-badge">${escapeAttr(label)}</span>` +
    `<span class="rte-attachment-meta">` +
    `<span class="rte-attachment-name">${escapeAttr(filename)}</span>` +
    `<span class="rte-attachment-size">${escapeAttr(sizeLabel)}</span>` +
    `</span>` +
    `</a>` +
    `</div>`
  );
}
