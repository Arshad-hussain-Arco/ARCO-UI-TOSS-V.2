/**
 * Free-layout canvas — DOM helpers shared by the editor (RichEditor) and the
 * read-only renderer (HomeCard). The geometry/validation rules live in
 * freeLayoutCore.js; this file applies them to real elements.
 *
 * Saved HTML shape (see freeLayoutCore.js for the coordinate system):
 *
 *   <div class="rte-canvas" data-rte-canvas="1" data-w="800" data-h="480" contenteditable="false">
 *     <div class="rte-canvas-stage">
 *       <div class="rte-abs rte-abs-text"  data-rte-abs="text"  data-x data-y data-w data-h data-z>
 *         <div class="rte-abs-body">…rich text…</div></div>
 *       <div class="rte-abs rte-abs-image" data-rte-abs="image" … data-media-id="7"><img src alt></div>
 *       <div class="rte-abs rte-abs-video" data-rte-abs="video" … data-media-id="9"><video src …></video></div>
 *     </div>
 *   </div>
 *
 * `data-*` are the source of truth; every inline `style` on the canvas, stage
 * and items is regenerated from them, so stored style text can never move an
 * element somewhere unexpected.
 */
import { env } from '@config/env';
import {
  CANVAS_CLASS, STAGE_CLASS, ITEM_CLASS, BODY_CLASS, ITEM_TYPES,
  parseCanvasSpec, parseGeometry, geometryToAttrs, geometryToStyle, clampGeometry,
  isAllowedMediaSrc, sanitizeInlineStyle, fitScale, hasFreeLayout, minSizeFor,
} from './freeLayoutCore';

export const UI_ATTR = 'data-rte-ui';
const EDITOR_ONLY_CLASSES = ['rte-abs-selected', 'rte-abs-dragging', 'rte-abs-editing', 'rte-abs-preview', 'rte-canvas-active', 'rte-tool-textbox'];

// ------------------------------------------------------------------ helpers

let _origins = null;
export function getAllowedMediaOrigins() {
  if (_origins) return _origins;
  const list = [];
  try { list.push(window.location.origin); } catch { /* non-browser */ }
  try { list.push(new URL(env.apiBaseUrl, window.location.origin).origin); } catch { /* ignore */ }
  _origins = Array.from(new Set(list.filter(Boolean)));
  return _origins;
}

/**
 * Container backed by an INERT document. Markup parsed into a detached node of
 * the live document still starts loading <img>/<video> and fires onerror
 * handlers; in a document created with createHTMLDocument nothing loads or
 * runs, so parse/serialise round-trips are side-effect free.
 */
export function createInertContainer() {
  return document.implementation.createHTMLDocument('').createElement('div');
}

export function getCanvasSpec(canvas) {
  return parseCanvasSpec(canvas.getAttribute('data-w'), canvas.getAttribute('data-h'));
}

export function itemType(item) {
  const t = item.getAttribute('data-rte-abs');
  return ITEM_TYPES.includes(t) ? t : null;
}

export function readGeometry(item, canvasSpec) {
  return parseGeometry(
    {
      x: item.getAttribute('data-x'), y: item.getAttribute('data-y'),
      w: item.getAttribute('data-w'), h: item.getAttribute('data-h'),
      z: item.getAttribute('data-z'),
    },
    canvasSpec,
    itemType(item) || 'image'
  );
}

/** Writes validated geometry to both data-* (persisted) and style (display). */
export function writeGeometry(item, geometry) {
  const attrs = geometryToAttrs(geometry);
  Object.keys(attrs).forEach((k) => item.setAttribute(k, attrs[k]));
  item.setAttribute('style', geometryToStyle(geometry));
}

export function canvasBaseStyle(spec) {
  return `position:relative;display:block;width:100%;aspect-ratio:${spec.w}/${spec.h};`;
}
export function stageBaseStyle(spec) {
  return `position:absolute;left:0;top:0;width:${spec.w}px;height:${spec.h}px;transform-origin:0 0;`;
}

export function writeCanvasSpec(canvas, spec) {
  canvas.setAttribute('data-w', String(spec.w));
  canvas.setAttribute('data-h', String(spec.h));
  canvas.setAttribute('style', canvasBaseStyle(spec));
  const stage = canvas.querySelector(`:scope > .${STAGE_CLASS}`);
  if (stage) stage.setAttribute('style', stageBaseStyle(spec));
}

function directItems(stage) {
  return Array.from(stage.children).filter((c) => c.classList && c.classList.contains(ITEM_CLASS));
}

/** All items of a canvas, back-to-front. */
export function getItems(canvas) {
  const stage = canvas.querySelector(`:scope > .${STAGE_CLASS}`);
  return stage ? directItems(stage) : [];
}

// -------------------------------------------------------------- scaling/fit

/**
 * Applies the uniform fit scale. The outer canvas takes its height from CSS
 * `aspect-ratio`, so only the stage transform needs JS. `--rte-scale` /
 * `--rte-inv` let editor chrome (handles, toolbar) stay a constant on-screen
 * size while the canvas itself is scaled.
 */
export function fitCanvas(canvas) {
  const stage = canvas.querySelector(`:scope > .${STAGE_CLASS}`);
  if (!stage) return 1;
  const spec = getCanvasSpec(canvas);
  const scale = fitScale(canvas.clientWidth, spec.w);
  stage.style.transform = `scale(${scale})`;
  canvas.style.setProperty('--rte-scale', String(scale));
  canvas.style.setProperty('--rte-inv', String(1 / scale));
  return scale;
}

/** Current scale of a canvas as laid out on screen (accounts for ancestor zoom). */
export function measureScale(canvas) {
  const stage = canvas.querySelector(`:scope > .${STAGE_CLASS}`);
  if (!stage || !stage.offsetWidth) return 1;
  const s = stage.getBoundingClientRect().width / stage.offsetWidth;
  return s > 0 ? s : 1;
}

/** Fits every canvas under `container` now and whenever its width changes. Returns a disposer. */
export function observeFit(container, onFit) {
  const canvases = Array.from(container.querySelectorAll(`.${CANVAS_CLASS}[data-rte-canvas]`));
  canvases.forEach((c) => { fitCanvas(c); });
  if (typeof ResizeObserver === 'undefined' || !canvases.length) return () => {};
  const ro = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      fitCanvas(entry.target);
      onFit?.(entry.target);
    });
  });
  canvases.forEach((c) => ro.observe(c));
  return () => ro.disconnect();
}

// ---------------------------------------------------------- normalisation

function stripUi(el) {
  el.querySelectorAll(`[${UI_ATTR}]`).forEach((n) => n.remove());
}

function cleanDescendantStyles(root, kind) {
  root.querySelectorAll('[style]').forEach((el) => {
    const isMedia = el.tagName === 'IMG' || el.tagName === 'VIDEO';
    const k = isMedia ? (kind === 'text' ? 'inline' : 'image') : kind;
    const safe = sanitizeInlineStyle(el.getAttribute('style'), k);
    if (safe) el.setAttribute('style', safe);
    else el.removeAttribute('style');
  });
}

function normalizeTextItem(item, origins) {
  let body = Array.from(item.children).find((c) => c.classList.contains(BODY_CLASS));
  if (!body) {
    body = item.ownerDocument.createElement('div');
    body.className = BODY_CLASS;
    Array.from(item.childNodes).forEach((n) => {
      if (!(n.nodeType === 1 && n.hasAttribute(UI_ATTR))) body.appendChild(n);
    });
    item.insertBefore(body, item.firstChild);
  }
  // Only the body (plus editor UI) may live inside a text item.
  Array.from(item.children).forEach((c) => {
    if (c !== body && !c.hasAttribute(UI_ATTR)) c.remove();
  });
  body.className = BODY_CLASS;
  Array.from(body.attributes).forEach((a) => {
    if (a.name !== 'class' && a.name !== 'contenteditable' && a.name !== 'style' && a.name !== 'spellcheck') body.removeAttribute(a.name);
  });
  // A nested canvas / item inside a text box would be an invalid nesting.
  body.querySelectorAll(`.${CANVAS_CLASS}, .${ITEM_CLASS}, [data-rte-canvas], [data-rte-abs]`).forEach((n) => n.remove());
  // Text boxes hold text, lists, links and uploaded media. No embeds/forms; media
  // may only reference the HomeMedia endpoint (see isAllowedMediaSrc).
  body.querySelectorAll('script, style, link, meta, base, iframe, object, embed, form, input, textarea, select, button, picture, audio, svg, canvas').forEach((n) => {
    if (n.matches('.rte-video-play-trigger')) return; // added by the Home page's lazy video loader
    n.remove();
  });
  body.querySelectorAll('img').forEach((img) => {
    if (!isAllowedMediaSrc(img.getAttribute('src'), origins)) { img.remove(); return; }
    const keep = ['src', 'alt', 'style', 'data-media-id'];
    img.getAttributeNames().forEach((n) => { if (!keep.includes(n)) img.removeAttribute(n); });
    const id = img.getAttribute('data-media-id');
    if (id && !/^\d{1,12}$/.test(id)) img.removeAttribute('data-media-id');
    img.setAttribute('draggable', 'false');
  });
  body.querySelectorAll('video').forEach((video) => {
    const srcs = [video.getAttribute('src'), video.getAttribute('data-video-src')].filter(Boolean);
    if (!srcs.length || !srcs.every((u) => isAllowedMediaSrc(u, origins))) { video.remove(); return; }
    const keep = ['src', 'data-video-src', 'controls', 'preload', 'playsinline', 'loop', 'muted', 'style', 'data-media-id', 'data-mime', 'title', 'class'];
    video.getAttributeNames().forEach((n) => { if (!keep.includes(n)) video.removeAttribute(n); });
    const id = video.getAttribute('data-media-id');
    if (id && !/^\d{1,12}$/.test(id)) video.removeAttribute('data-media-id');
    video.setAttribute('playsinline', '');
    video.querySelectorAll('source').forEach((src) => {
      const v = src.getAttribute('src') || src.getAttribute('data-video-src');
      if (!v || !isAllowedMediaSrc(v, origins)) src.remove();
    });
    video.querySelectorAll('track').forEach((t) => t.remove());
  });
  body.querySelectorAll('source').forEach((src) => { if (!src.closest('video')) src.remove(); });
  body.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((a) => { if (/^on/i.test(a.name)) el.removeAttribute(a.name); });
  });
  if (body.hasAttribute('style')) {
    const safe = sanitizeInlineStyle(body.getAttribute('style'), 'text');
    if (safe) body.setAttribute('style', safe); else body.removeAttribute('style');
  }
  cleanDescendantStyles(body, 'text');
  if (!body.firstChild) body.appendChild(item.ownerDocument.createElement('br'));
  return true;
}

function mediaIdOf(item) {
  const raw = item.getAttribute('data-media-id');
  return raw && /^\d{1,12}$/.test(raw) ? raw : null;
}

function normalizeImageItem(item, origins, keepUi) {
  const imgs = Array.from(item.querySelectorAll('img'));
  const img = imgs[0];
  if (!img || !isAllowedMediaSrc(img.getAttribute('src'), origins)) return false;
  const alt = img.getAttribute('alt') || '';
  const style = sanitizeInlineStyle(img.getAttribute('style'), 'image');
  const ui = keepUi ? Array.from(item.children).filter((c) => c.hasAttribute(UI_ATTR)) : [];
  img.getAttributeNames().forEach((n) => { if (n !== 'src') img.removeAttribute(n); });
  img.setAttribute('alt', alt);
  img.setAttribute('draggable', 'false');
  if (style) img.setAttribute('style', style);
  item.textContent = '';
  item.appendChild(img);
  ui.forEach((u) => item.appendChild(u));
  return true;
}

function normalizeVideoItem(item, origins, keepUi) {
  const video = item.querySelector('video');
  if (!video) return false;
  const srcAttrs = [video.getAttribute('src'), video.getAttribute('data-video-src')].filter(Boolean);
  if (!srcAttrs.length || !srcAttrs.every((s) => isAllowedMediaSrc(s, origins))) return false;
  video.querySelectorAll('source').forEach((s) => {
    const v = s.getAttribute('src') || s.getAttribute('data-video-src');
    if (!v || !isAllowedMediaSrc(v, origins)) s.remove();
  });
  video.querySelectorAll('track').forEach((t) => t.remove());
  // Everything except the <video> subtree, the lazy wrap and play trigger is dropped.
  const keep = new Set();
  let node = video;
  while (node && node !== item) { keep.add(node); node = node.parentNode; }
  const wrap = video.closest('.rte-video-lazy-wrap');
  if (wrap) {
    keep.add(wrap);
    wrap.querySelectorAll('.rte-video-play-trigger').forEach((b) => keep.add(b));
  }
  Array.from(item.querySelectorAll('*')).forEach((el) => {
    if (keep.has(el) || video.contains(el) || (keepUi && el.closest(`[${UI_ATTR}]`))) return;
    if (el.parentNode) el.remove();
  });
  video.setAttribute('playsinline', '');
  if (!video.hasAttribute('preload')) video.setAttribute('preload', 'none');
  video.removeAttribute('style');
  return true;
}

function normalizeItem(item, canvasSpec, origins, { keepUi }) {
  const type = itemType(item);
  if (!type) return false;
  const geo = readGeometry(item, canvasSpec);
  if (!geo) return false;

  if (!keepUi) stripUi(item);
  const keepDataAttrs = new Set(['data-rte-abs', 'data-x', 'data-y', 'data-w', 'data-h', 'data-z', 'data-media-id']);
  Array.from(item.attributes).forEach((a) => {
    if (a.name === 'class' || a.name === 'style' || keepDataAttrs.has(a.name)) return;
    if (keepUi && a.name === 'tabindex') return;
    item.removeAttribute(a.name);
  });
  const mediaId = mediaIdOf(item);
  if (mediaId) item.setAttribute('data-media-id', mediaId); else item.removeAttribute('data-media-id');

  let ok;
  if (type === 'text') ok = normalizeTextItem(item, origins);
  else if (type === 'image') ok = normalizeImageItem(item, origins, keepUi);
  else ok = normalizeVideoItem(item, origins, keepUi);
  if (!ok) return false;

  const keptEditorClasses = keepUi ? EDITOR_ONLY_CLASSES.filter((c) => item.classList.contains(c)) : [];
  item.className = [ITEM_CLASS, `${ITEM_CLASS}-${type}`, ...keptEditorClasses].join(' ');
  writeGeometry(item, geo);
  return true;
}

/**
 * Validates one canvas in place. In 'render' mode all editor chrome is removed
 * and any invalid item is dropped; in 'editor' mode editor UI nodes are kept.
 */
export function normalizeCanvas(canvas, { mode = 'render', origins = getAllowedMediaOrigins() } = {}) {
  const keepUi = mode === 'editor';
  const spec = getCanvasSpec(canvas);
  canvas.className = [CANVAS_CLASS, ...(keepUi ? EDITOR_ONLY_CLASSES.filter((c) => canvas.classList.contains(c)) : [])].join(' ');
  Array.from(canvas.attributes).forEach((a) => {
    if (!['class', 'style', 'data-rte-canvas', 'data-w', 'data-h', 'contenteditable'].includes(a.name)) canvas.removeAttribute(a.name);
  });
  canvas.setAttribute('data-rte-canvas', '1');
  if (keepUi) canvas.setAttribute('contenteditable', 'false'); else canvas.removeAttribute('contenteditable');

  let stage = Array.from(canvas.children).find((c) => c.classList.contains(STAGE_CLASS));
  if (!stage) {
    stage = canvas.ownerDocument.createElement('div');
    stage.className = STAGE_CLASS;
    Array.from(canvas.childNodes).forEach((n) => {
      if (!(n.nodeType === 1 && n.hasAttribute(UI_ATTR))) stage.appendChild(n);
    });
    canvas.insertBefore(stage, canvas.firstChild);
  }
  if (!keepUi) stripUi(canvas);
  stage.className = STAGE_CLASS;
  Array.from(stage.attributes).forEach((a) => { if (a.name !== 'class' && a.name !== 'style') stage.removeAttribute(a.name); });
  // The stage may only hold items — anything else (stray text, br, nested canvas) is dropped.
  Array.from(stage.childNodes).forEach((n) => {
    if (n.nodeType === 1 && n.classList.contains(ITEM_CLASS)) return;
    if (n.nodeType === 1 && keepUi && n.hasAttribute(UI_ATTR)) return;
    n.remove();
  });
  Array.from(canvas.children).forEach((c) => {
    if (c !== stage && !(keepUi && c.hasAttribute(UI_ATTR))) c.remove();
  });

  directItems(stage).forEach((item) => {
    if (!normalizeItem(item, spec, origins, { keepUi })) item.remove();
  });
  writeCanvasSpec(canvas, spec);
  // A canvas with nothing valid left would only leave a blank gap on the Home page.
  if (!keepUi && !directItems(stage).length) canvas.remove();
}

function topLevelCanvases(container) {
  const all = Array.from(container.querySelectorAll(`.${CANVAS_CLASS}[data-rte-canvas], [data-rte-canvas]`));
  const uniq = Array.from(new Set(all));
  const top = [];
  uniq.forEach((c) => {
    const parentCanvas = c.parentElement && c.parentElement.closest('[data-rte-canvas], .rte-canvas');
    if (parentCanvas && container.contains(parentCanvas)) c.remove(); // nested canvas: invalid
    else top.push(c);
  });
  return top;
}

/** Normalises every canvas under a live container (used by the editor after load / source edit). */
export function hydrateFreeLayout(container, opts = {}) {
  const canvases = topLevelCanvases(container);
  canvases.forEach((c) => normalizeCanvas(c, { mode: 'editor', ...opts }));
  return canvases;
}

/**
 * HTML string -> HTML string for the READ-ONLY renderer (HomeCard). Run it
 * AFTER DOMPurify and BEFORE media tokens are attached. Cards without a
 * canvas are returned untouched (byte-identical), so existing content is
 * unaffected.
 */
export function normalizeFreeLayoutHtml(html, opts = {}) {
  if (!hasFreeLayout(html)) return html;
  const container = createInertContainer();
  container.innerHTML = html;
  topLevelCanvases(container).forEach((c) => normalizeCanvas(c, { mode: 'render', ...opts }));
  return container.innerHTML;
}

/**
 * HTML string -> HTML string for PERSISTING from the editor. Removes every
 * piece of editor-only chrome (handles, toolbar, selection classes, runtime
 * contenteditable/tabindex/transform) and re-derives all inline styles from
 * the validated data-* geometry. Returns the input untouched when there is
 * no canvas.
 */
export function cleanEditorHtml(html) {
  if (!hasFreeLayout(html)) return html;
  const container = createInertContainer();
  container.innerHTML = html;
  topLevelCanvases(container).forEach((c) => {
    stripUi(c);
    EDITOR_ONLY_CLASSES.forEach((cls) => { c.classList.remove(cls); c.querySelectorAll(`.${cls}`).forEach((n) => n.classList.remove(cls)); });
    c.removeAttribute('contenteditable');
    c.querySelectorAll('[contenteditable], [tabindex], [spellcheck]').forEach((n) => {
      n.removeAttribute('contenteditable'); n.removeAttribute('tabindex'); n.removeAttribute('spellcheck');
    });
    c.querySelectorAll('video').forEach((v) => v.classList.remove('rte-video-playing'));
    const spec = getCanvasSpec(c);
    // Re-derive geometry styles; do NOT run the render sanitiser here — the
    // editor must not silently discard what the admin typed.
    c.setAttribute('style', canvasBaseStyle(spec));
    const stage = c.querySelector(`:scope > .${STAGE_CLASS}`);
    if (stage) stage.setAttribute('style', stageBaseStyle(spec));
    getItems(c).forEach((item) => {
      const geo = readGeometry(item, spec);
      if (geo) writeGeometry(item, geo);
    });
  });
  return container.innerHTML;
}

// ------------------------------------------------------------- DOM builders

export function createCanvasElement(doc, spec) {
  const canvas = doc.createElement('div');
  canvas.className = CANVAS_CLASS;
  canvas.setAttribute('data-rte-canvas', '1');
  canvas.setAttribute('contenteditable', 'false');
  const stage = doc.createElement('div');
  stage.className = STAGE_CLASS;
  canvas.appendChild(stage);
  writeCanvasSpec(canvas, spec);
  return canvas;
}

function baseItem(doc, type, geometry) {
  const item = doc.createElement('div');
  item.className = `${ITEM_CLASS} ${ITEM_CLASS}-${type}`;
  item.setAttribute('data-rte-abs', type);
  writeGeometry(item, geometry);
  return item;
}

export function createTextItem(doc, geometry) {
  const item = baseItem(doc, 'text', geometry);
  const body = doc.createElement('div');
  body.className = BODY_CLASS;
  body.appendChild(doc.createElement('br'));
  item.appendChild(body);
  return item;
}

export function createImageItem(doc, { url, mediaId, alt = '' }, geometry) {
  const item = baseItem(doc, 'image', geometry);
  if (mediaId != null && /^\d+$/.test(String(mediaId))) item.setAttribute('data-media-id', String(mediaId));
  const img = doc.createElement('img');
  img.setAttribute('src', url);
  img.setAttribute('alt', alt);
  img.setAttribute('draggable', 'false');
  item.appendChild(img);
  return item;
}

export function createVideoItem(doc, { url, mediaId, filename = '', mime = '' }, geometry) {
  const item = baseItem(doc, 'video', geometry);
  if (mediaId != null && /^\d+$/.test(String(mediaId))) item.setAttribute('data-media-id', String(mediaId));
  const video = doc.createElement('video');
  video.className = 'rte-video-element';
  video.setAttribute('src', url);
  video.setAttribute('controls', '');
  video.setAttribute('preload', 'metadata');
  video.setAttribute('playsinline', '');
  if (filename) video.setAttribute('title', filename);
  if (mime) video.setAttribute('data-mime', mime);
  item.appendChild(video);
  return item;
}

export { clampGeometry, minSizeFor };
