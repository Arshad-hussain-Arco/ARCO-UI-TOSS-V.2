import { sanitizeEditorHtml } from './sanitize';
import { stripEditorControls, rebuildPublicMediaActions, deferPublicVideoLoad, attachHomeMediaToken, useHomeMediaToken } from './mediaUtils';

/**
 * Read-only panel rendering the sanitized generated HTML exactly as the
 * Homepage will render it (same sanitize allowlist family as HomeCard.jsx's
 * render-time DOMPurify.sanitize call). Collapsed by default in RichEditor
 * since the modal already shows a live `<HomeCard>` preview in its right
 * column — this is the raw-HTML-accurate secondary view.
 */
function handlePreviewClick(e) {
  const playBtn = e.target.closest('.rte-video-play-trigger');
  if (!playBtn) return;
  e.preventDefault();
  const wrapper = playBtn.closest('.rte-video-lazy-wrap');
  const video = wrapper?.querySelector('video');
  if (video) {
    video.querySelectorAll('source[data-video-src]').forEach((source) => {
      source.src = source.getAttribute('data-video-src');
      source.removeAttribute('data-video-src');
    });
    const videoSrc = video.getAttribute('data-video-src');
    if (videoSrc) {
      video.src = videoSrc;
      video.removeAttribute('data-video-src');
    }
    video.setAttribute('preload', 'auto');
    video.load();
    video.play().catch(() => {});
  }
  playBtn.remove();
  wrapper?.classList.add('rte-video-playing');
}

export function Preview({ html }) {
  const mediaToken = useHomeMediaToken();
  return (
    <div className="rte-preview-panel">
      <div className="rte-preview-label">Generated HTML preview</div>
      <div
        className="home-card-html-content rte-preview-content"
        onClick={handlePreviewClick}
        dangerouslySetInnerHTML={{ __html: attachHomeMediaToken(deferPublicVideoLoad(rebuildPublicMediaActions(stripEditorControls(sanitizeEditorHtml(html || '')))), mediaToken) }}
      />
    </div>
  );
}

export default Preview;
