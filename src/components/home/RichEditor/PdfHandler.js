import { readFileAsDataUrl, assertWithinSizeLimit, escapeAttr, formatFileSize } from './mediaUtils';

const MAX_PDF_MB = 15;

export async function ingestFile(file) {
  assertWithinSizeLimit(file, MAX_PDF_MB);
  const url = await readFileAsDataUrl(file);
  return { url, filename: file.name, filesize: file.size, mime: file.type || 'application/pdf' };
}

export function isPdfFile(file) {
  return file && file.type === 'application/pdf';
}

/**
 * <embed> renders the PDF inline in Chrome/Edge/Firefox (native PDF
 * viewer); Safari and any browser without an inline PDF plugin simply
 * shows nothing for <embed>, so a download link is always rendered
 * alongside as the guaranteed fallback per spec.
 */
export function buildPdfMarkup({ url, filename, filesize }) {
  const sizeLabel = filesize ? ` (${escapeAttr(formatFileSize(filesize))})` : '';
  return (
    `<div class="rte-pdf-wrap" contenteditable="false">` +
    `<embed src="${escapeAttr(url)}" type="application/pdf" class="rte-pdf-embed" />` +
    `<a href="${escapeAttr(url)}" download="${escapeAttr(filename || 'document.pdf')}" class="rte-pdf-download">` +
    `Download PDF${escapeAttr(filename ? `: ${filename}` : '')}${sizeLabel}` +
    `</a>` +
    `</div>`
  );
}
