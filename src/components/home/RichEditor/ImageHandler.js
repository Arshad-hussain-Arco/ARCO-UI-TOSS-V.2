import { readFileAsDataUrl, assertWithinSizeLimit, escapeAttr } from './mediaUtils';

const MAX_IMAGE_MB = 8;

/**
 * Single seam to swap for a real upload API later: change only this
 * function's body to POST `file` and resolve `{ url: <server URL>, ... }`
 * instead of a data URI. Every call site only ever consumes the resolved
 * `{ url, filename, filesize, mime }` shape.
 */
export async function ingestFile(file) {
  assertWithinSizeLimit(file, MAX_IMAGE_MB);
  const url = await readFileAsDataUrl(file);
  return { url, filename: file.name, filesize: file.size, mime: file.type };
}

export function isImageFile(file) {
  return file && file.type && file.type.startsWith('image/');
}

/**
 * Markup for an inserted image: wrapped in a contenteditable="false"
 * positioning span so EditableArea's resize-handle overlay can be
 * absolutely positioned against it, and so the image itself is treated as
 * an atomic unit (arrow-key/backspace navigation skips over it, not into
 * its interior).
 */
export function buildImageMarkup({ url, alt = '', align = 'center', caption = '' }) {
  const alignClass = `rte-align-${align}`;
  const img = `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" />`;
  const inner = caption
    ? `<figure class="rte-media-wrap ${alignClass}" contenteditable="false">${img}<figcaption>${escapeAttr(caption)}</figcaption></figure>`
    : `<span class="rte-media-wrap ${alignClass}" contenteditable="false">${img}</span>`;
  return inner;
}
