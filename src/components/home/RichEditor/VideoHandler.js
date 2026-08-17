import { assertWithinSizeLimit, escapeAttr, formatFileSize, uploadMediaFile } from './mediaUtils';

const MAX_VIDEO_MB = 40;
const ACCEPTED_MIME = ['video/mp4', 'video/webm', 'video/ogg'];

export async function ingestFile(file) {
  assertWithinSizeLimit(file, MAX_VIDEO_MB);
  const result = await uploadMediaFile(file);
  return { ...result, mime: result.mime || 'video/mp4' };
}

export function isSupportedVideoFile(file) {
  if (!file) return false;
  return ACCEPTED_MIME.includes(file.type) || file.type.startsWith('video/');
}

/** Lightweight production markup for inserted video with compact metadata bar. */
export function buildVideoMarkup({ url, filename, filesize, mime, align = 'center' }) {
  const alignClass = `rte-align-${align}`;
  const filenameAttr = filename ? ` data-filename="${escapeAttr(filename)}"` : '';
  const sizeAttr = filesize ? ` data-filesize="${escapeAttr(formatFileSize(filesize))}"` : '';
  const mimeAttr = mime ? ` data-mime="${escapeAttr(mime)}"` : '';
  const sizeText = filesize ? ` • ${formatFileSize(filesize)}` : '';

  return (
    `<div class="rte-video-block ${alignClass}" data-media-type="video" data-src="${escapeAttr(url)}"${filenameAttr}${sizeAttr}${mimeAttr} contenteditable="false">` +
    `<div class="rte-video-container">` +
    `<video src="${escapeAttr(url)}" controls preload="metadata" playsinline class="rte-video-element"></video>` +
    `</div>` +
    `<div class="rte-video-meta-bar">` +
    `<div class="rte-video-info">` +
    `<span class="rte-video-icon">🎬</span>` +
    `<span class="rte-video-name" title="${escapeAttr(filename || 'Video')}">${escapeAttr(filename || 'Video')}</span>` +
    `<span class="rte-video-size">${escapeAttr(sizeText)}</span>` +
    `</div>` +
    `<div class="rte-video-actions">` +
    `<button type="button" class="rte-btn-sm rte-btn-danger rte-media-remove-btn" title="Remove video">Remove ×</button>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}
