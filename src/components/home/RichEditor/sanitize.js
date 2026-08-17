import DOMPurify from 'dompurify';

/**
 * Allowlist of every tag/attribute the RichEditor toolbar can legitimately
 * produce. Kept at least as permissive as HomeCard.jsx's render-time
 * DOMPurify.sanitize() call so content the editor emits never silently
 * vanishes when rendered on the live Homepage.
 */
export const RTE_SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'span', 'div', 'button',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sup', 'sub',
    'ul', 'ol', 'li',
    'a', 'img', 'video', 'source', 'embed',
    'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'figure', 'figcaption',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'src', 'alt', 'title', 'style', 'class',
    'colspan', 'rowspan', 'controls', 'type', 'poster', 'download',
    'data-filename', 'data-filesize', 'data-mime', 'data-checked',
    'data-media-type', 'data-src', 'data-pdf-src', 'data-pdf-name',
    'preload', 'playsinline', 'contenteditable', 'width', 'height',
  ],
  ALLOWED_URI_REGEXP: /^(?:(?:https?|data|blob|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.:-]|$))/i,
  // DOMPurify's own default data-URI allowlist (audio/video/img/source/
  // image/track) does NOT cover `embed` or `a` — without this, a data:
  // URI src on <embed> (PDF preview) or href on <a download> (PDF/
  // attachment download links) gets silently stripped even though the
  // tag/attribute itself is allowed above. Verified directly against the
  // installed dompurify build; see the matching note in HomeCard.jsx.
  ADD_DATA_URI_TAGS: ['embed', 'a'],
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'form', 'input', 'textarea', 'select'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
};

/**
 * Sanitizes RichEditor output HTML. Defense in depth — HomeCard.jsx's own
 * DOMPurify.sanitize() call at render time remains the authoritative guard.
 * Note: the checklist feature relies on a real <input type="checkbox">
 * inside <li>, which FORBID_TAGS above intentionally strips for saved
 * output — checklists are instead serialized as data-checked li's styled
 * via CSS (see AttachmentHandler/EditableArea checklist markup).
 */
export function sanitizeEditorHtml(html) {
  if (!html) return '';
  // Strip the invisible zero-width marker used to keep a "pending caret
  // style" span non-empty (see SelectionManager.applyPendingCaretStyle) —
  // harmless left in place, but meaningless once serialized for saving.
  const withoutMarkers = html.replace(/\u200B/g, '');
  return DOMPurify.sanitize(withoutMarkers, RTE_SANITIZE_CONFIG);
}

export default sanitizeEditorHtml;
