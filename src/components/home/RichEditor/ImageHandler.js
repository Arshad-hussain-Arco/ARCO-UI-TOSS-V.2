import { assertWithinSizeLimit, escapeAttr, uploadMediaFile } from './mediaUtils';

const MAX_IMAGE_MB = 40;

export async function ingestFile(file) {
  assertWithinSizeLimit(file, MAX_IMAGE_MB);
  return uploadMediaFile(file);
}

export function isImageFile(file) {
  return file && file.type && file.type.startsWith('image/');
}

/**
 * Markup for an inserted image with overlay Remove button.
 */
export function buildImageMarkup({ url, alt = '', align = 'center', caption = '' }) {
  const alignClass = `rte-align-${align}`;
  const removeBtn = `<button type="button" class="rte-media-remove-btn rte-img-remove-btn" title="Remove image">×</button>`;
  const img = `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" />${removeBtn}`;
  const inner = caption
    ? `<figure class="rte-media-wrap ${alignClass}" data-media-type="image" data-src="${escapeAttr(url)}" contenteditable="false">${img}<figcaption>${escapeAttr(caption)}</figcaption></figure>`
    : `<span class="rte-media-wrap ${alignClass}" data-media-type="image" data-src="${escapeAttr(url)}" contenteditable="false">${img}</span>`;
  return inner;
}
