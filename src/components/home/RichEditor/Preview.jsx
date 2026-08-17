import { sanitizeEditorHtml } from './sanitize';
import { stripEditorControls, rebuildPublicMediaActions } from './mediaUtils';

/**
 * Read-only panel rendering the sanitized generated HTML exactly as the
 * Homepage will render it (same sanitize allowlist family as HomeCard.jsx's
 * render-time DOMPurify.sanitize call). Collapsed by default in RichEditor
 * since the modal already shows a live `<HomeCard>` preview in its right
 * column — this is the raw-HTML-accurate secondary view.
 */
export function Preview({ html }) {
  return (
    <div className="rte-preview-panel">
      <div className="rte-preview-label">Generated HTML preview</div>
      <div
        className="home-card-html-content rte-preview-content"
        dangerouslySetInnerHTML={{ __html: rebuildPublicMediaActions(stripEditorControls(sanitizeEditorHtml(html || ''))) }}
      />
    </div>
  );
}

export default Preview;
