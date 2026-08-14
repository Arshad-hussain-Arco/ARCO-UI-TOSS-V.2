import { readFileAsDataUrl, assertWithinSizeLimit, escapeAttr } from './mediaUtils';

const MAX_VIDEO_MB = 25;
const ACCEPTED_MIME = ['video/mp4', 'video/webm'];

export async function ingestFile(file) {
  assertWithinSizeLimit(file, MAX_VIDEO_MB);
  const url = await readFileAsDataUrl(file);
  return { url, filename: file.name, filesize: file.size, mime: file.type };
}

export function isSupportedVideoFile(file) {
  return file && ACCEPTED_MIME.includes(file.type);
}

/** Markup for an inserted video, wrapped for the same resize-handle treatment as images. */
export function buildVideoMarkup({ url, mime, align = 'center' }) {
  const alignClass = `rte-align-${align}`;
  return `<span class="rte-media-wrap rte-video-wrap ${alignClass}" contenteditable="false"><video src="${escapeAttr(url)}" controls type="${escapeAttr(mime || 'video/mp4')}"></video></span>`;
}
