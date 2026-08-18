import { sanitizeEditorHtml } from './sanitize';

const DISALLOWED_TAGS = ['script', 'style', 'meta', 'link', 'head', 'title', 'xml'];
// Word emits namespaced tags like <o:p> and <w:sdt> which the HTML parser
// turns into literal (uppercased) tag names — matched case-insensitively.
const WORD_NAMESPACED_TAG_RE = /^(o|w|v|m|st1):/i;

const STYLE_ALLOWLIST = ['fontWeight', 'fontStyle', 'textDecoration', 'color', 'backgroundColor'];

/**
 * Cleans HTML pasted from MS Word / Google Docs / any rich source down to
 * the small tag+style vocabulary the editor understands. Pure function —
 * independently testable, no DOM globals beyond DOMParser.
 */
export function cleanPastedHtml(rawHtml) {
  if (!rawHtml) return '';

  const doc = new DOMParser().parseFromString(rawHtml, 'text/html');

  // 1. Remove disallowed elements and Word namespaced tags outright.
  DISALLOWED_TAGS.forEach((tag) => {
    doc.querySelectorAll(tag).forEach((el) => el.remove());
  });
  Array.from(doc.body.querySelectorAll('*')).forEach((el) => {
    if (WORD_NAMESPACED_TAG_RE.test(el.tagName)) el.remove();
  });

  // 2. Walk every element: drop all attributes except a strict allowlist,
  // and rewrite `style` to only the small set of properties we care about.
  const ATTR_ALLOWLIST = new Set(['href', 'src', 'alt', 'title', 'colspan', 'rowspan']);
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  const elements = [];
  let node = walker.nextNode();
  while (node) {
    elements.push(node);
    node = walker.nextNode();
  }

  elements.forEach((el) => {
    // Strip Mso*-prefixed classes.
    if (el.className && /mso/i.test(el.className)) {
      el.removeAttribute('class');
    }

    const cleanStyle = {};
    STYLE_ALLOWLIST.forEach((prop) => {
      const val = el.style[prop];
      if (val) cleanStyle[prop] = val;
    });

    Array.from(el.attributes).forEach((attr) => {
      if (!ATTR_ALLOWLIST.has(attr.name.toLowerCase())) {
        el.removeAttribute(attr.name);
      }
    });

    if (Object.keys(cleanStyle).length > 0) {
      const styleStr = Object.entries(cleanStyle)
        .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}: ${v}`)
        .join('; ');
      el.setAttribute('style', styleStr);
    } else {
      el.removeAttribute('style');
    }
  });

  // 3. Unwrap now-bare spans/fonts/divs that carry no meaningful attributes.
  ['span', 'font', 'div'].forEach((tag) => {
    doc.body.querySelectorAll(tag).forEach((el) => {
      if (el.attributes.length === 0) {
        el.replaceWith(...el.childNodes);
      }
    });
  });

  return sanitizeEditorHtml(doc.body.innerHTML);
}

/** Splits plain text on blank lines into <p> blocks, HTML-escaping content. */
export function plainTextToHtml(text) {
  const escape = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paragraphs = text.split(/\r?\n\r?\n/).filter((p) => p.trim().length > 0);
  if (paragraphs.length === 0) return `<p>${escape(text)}</p>`;
  return paragraphs
    .map((p) => `<p>${escape(p).replace(/\r?\n/g, '<br>')}</p>`)
    .join('');
}

/** Inserts an HTML fragment at the current selection, collapsing the caret after it. */
export function insertHtmlAtSelection(html) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const fragment = range.createContextualFragment(html);
  const lastNode = fragment.lastChild;
  range.insertNode(fragment);
  if (lastNode) {
    const newRange = document.createRange();
    newRange.setStartAfter(lastNode);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}
