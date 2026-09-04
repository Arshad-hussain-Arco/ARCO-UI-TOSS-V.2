import { assertWithinSizeLimit, escapeAttr, formatFileSize, uploadMediaFile, readFileAsDataUrl } from './mediaUtils';

const MAX_VIDEO_MB = 19;
const ACCEPTED_MIME = ['video/mp4', 'video/webm', 'video/ogg'];

export async function ingestFile(file) {
  assertWithinSizeLimit(file, MAX_VIDEO_MB);
  try {
    const result = await uploadMediaFile(file);
    return { ...result, mime: result.mime || 'video/mp4' };
  } catch (err) {
    // Fallback to data URL if backend is unavailable
    const dataUrl = await readFileAsDataUrl(file);
    return { url: dataUrl, mime: 'video/mp4' };
  }
}

export function isSupportedVideoFile(file) {
  if (!file) return false;
  return ACCEPTED_MIME.includes(file.type) || file.type.startsWith('video/');
}

/**
 * Lightweight production markup for inserted video with compact metadata
 * bar. Built already in "lazy" form — `data-video-src` (not `src`),
 * `preload="none"`, wrapped in `.rte-video-lazy-wrap` with a
 * `.rte-video-play-trigger` overlay — so the video never fires a network
 * request the moment it's inserted/loaded into the editor or the published
 * Homepage; EditableArea's click handler (editor) / HomeCard's
 * handleContentClick (published) both swap `data-video-src` -> `src` only
 * once the user actually presses Play. This exact shape mirrors what
 * mediaUtils.js's deferPublicVideoLoad() would otherwise build after the
 * fact for read-only rendering — producing it here means that transform is
 * a no-op for these blocks (see its `.rte-video-lazy-wrap` guard).
 */
export function buildVideoMarkup({ url, filename, filesize, mime, align = 'center' }) {
  const alignClass = `rte-align-${align}`;
  const filenameAttr = filename ? ` data-filename="${escapeAttr(filename)}"` : '';
  const sizeAttr = filesize ? ` data-filesize="${escapeAttr(formatFileSize(filesize))}"` : '';
  const mimeAttr = mime ? ` data-mime="${escapeAttr(mime)}"` : '';
  const sizeText = filesize ? ` • ${formatFileSize(filesize)}` : '';

  return (
    `<div class="rte-video-block ${alignClass}" data-media-type="video" data-src="${escapeAttr(url)}"${filenameAttr}${sizeAttr}${mimeAttr} contenteditable="false">` +
    `<div class="rte-video-container">` +
    `<div class="rte-video-lazy-wrap">` +
    `<video src="${escapeAttr(url)}" data-video-src="${escapeAttr(url)}" controls preload="none" playsinline class="rte-video-element"></video>` +
    `<button type="button" class="rte-video-play-trigger" aria-label="Play video"></button>` +
    `</div>` +
    `</div>` +
    `<div class="rte-video-meta-bar">` +
    `<div class="rte-video-info">` +
    `<span class="rte-video-icon">🎬</span>` +
    `<span class="rte-video-name" title="${escapeAttr(filename || 'Video')}">${escapeAttr(filename || 'Video')}</span>` +
    `<span class="rte-video-size">${escapeAttr(sizeText)}</span>` +
    `</div>` +
    `<div class="rte-video-actions">` +
    `<button type="button" class="rte-btn-sm rte-btn-danger rte-media-remove-btn" title="Remove video"> × Remove</button>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}
