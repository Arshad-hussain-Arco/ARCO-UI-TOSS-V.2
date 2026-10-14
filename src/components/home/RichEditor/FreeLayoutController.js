/**
 * Free-layout controller — the editor-side behaviour for the positioned
 * canvas (text boxes, images, videos). Framework-agnostic: RichEditor.jsx
 * creates one, calls attach()/detach(), and wires its toolbar to the public
 * methods below.
 *
 * WHY A SEPARATE LAYER (architecture note)
 * ----------------------------------------
 * RoosterJS owns the editable surface and re-derives it from a content model,
 * so making Rooster's own paragraphs/images `position:absolute` would break
 * caret handling, copy/paste, undo and HTML round-tripping. Instead the free
 * layout lives in ONE non-editable block (`.rte-canvas`, contenteditable=false)
 * inside the Rooster document — the same trick the existing PDF/video/code
 * blocks use — and this controller manages everything inside it:
 *   - text boxes are small independent contenteditable regions (formatting is
 *     done with a floating toolbar via execCommand, since Rooster's ribbon
 *     cannot see a nested editable region);
 *   - images/videos are plain wrappers around the existing uploaded media;
 *   - selection frame, handles and toolbar live in a separate editor-only UI
 *     layer (`[data-rte-ui]`) that is never part of the persisted HTML.
 * Events inside the canvas are kept away from Rooster (stopPropagation) so its
 * keyboard / paste / image-edit plugins don't try to "fix" nested content.
 */
import DOMPurify from 'dompurify';
import {
  CANVAS_CLASS, STAGE_CLASS, ITEM_CLASS, BODY_CLASS, DEFAULT_CANVAS_W, DEFAULT_CANVAS_H, HANDLES,
  clamp, clampGeometry, moveGeometry, resizeGeometry, clientDeltaToCanvas, clientPointToCanvas,
  minCanvasHeight, nextInsertPosition, fitMediaSize, reorderZ, parseCanvasSpec, MAX_CANVAS_H, MAX_Z,
} from './freeLayoutCore';
import * as tbl from './freeLayoutTable';
import {
  UI_ATTR, getCanvasSpec, getItems, itemType, readGeometry, writeGeometry, writeCanvasSpec,
  fitCanvas, measureScale, hydrateFreeLayout, createCanvasElement, createTextItem, createImageItem, createVideoItem,
} from './freeLayoutDom';

const LAYER_ATTR = 'data-rte-ui-layer';
const MOVE_THRESHOLD_PX = 3;
const FONT_SIZES = [10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 64];
// Arial / Times / generic serif+sans are deliberately absent: themeAdaptiveColors()
// strips those families so text follows the app's typography, which would
// silently drop the author's choice on the next load.
const FONT_FAMILIES = [
  ['', 'Font'], ['Georgia, "Palatino Linotype", serif', 'Georgia'], ['Verdana, Geneva, sans-serif', 'Verdana'],
  ['"Trebuchet MS", Helvetica, sans-serif', 'Trebuchet'], ['Tahoma, Geneva, sans-serif', 'Tahoma'],
  ['"Courier New", Courier, monospace', 'Courier'], ['Impact, Charcoal, sans-serif', 'Impact'],
];
const ISOLATED_EVENTS = [
  'keydown', 'keyup', 'keypress', 'input', 'beforeinput', 'cut', 'copy',
  'compositionstart', 'compositionupdate', 'compositionend',
  'mousedown', 'mouseup', 'click', 'dblclick', 'pointerup', 'touchstart', 'touchend', 'contextmenu',
];
const PASTE_TAGS = ['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote'];

const T = {
  move: '☰', up: '↥', down: '↧', fwd: '↑', back: '↓', del: '🗑',
  ul: '•', ol: '1.', link: '🔗', play: '▶',
};

function el(doc, tag, props = {}, children = []) {
  const node = doc.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  });
  children.forEach((c) => node.appendChild(c));
  return node;
}

export function createFreeLayoutController({ getWrapper, getRoot, onChange, notify, onSelect, getDesignWidth, requestLink, requestInlineMedia }) {
  let attached = false;
  let selected = null; // the selected .rte-abs item
  let mode = null; // 'textbox' while waiting for a placement click
  let drag = null;
  let lastRange = null;
  let changeTimer = null;
  let resizeObserver = null;
  const bound = new WeakSet();

  // ------------------------------------------------------------ utilities
  const doc = () => getRoot()?.ownerDocument || document;
  const say = (kind, msg) => { try { notify?.(kind, msg); } catch { /* ignore */ } };
  const emitChange = (immediate = false) => {
    clearTimeout(changeTimer);
    if (immediate) { onChange?.(); return; }
    changeTimer = setTimeout(() => onChange?.(), 150);
  };

  const canvasOf = (node) => (node && node.closest ? node.closest(`.${CANVAS_CLASS}[data-rte-canvas]`) : null);
  const itemOf = (node) => (node && node.closest ? node.closest(`.${ITEM_CLASS}[data-rte-abs]`) : null);
  const stageOf = (canvas) => canvas.querySelector(`:scope > .${STAGE_CLASS}`);
  const layerOf = (canvas) => {
    let layer = canvas.querySelector(`:scope > [${LAYER_ATTR}]`);
    if (!layer) {
      layer = el(doc(), 'div', { class: 'rte-ui-layer', [UI_ATTR]: '1', [LAYER_ATTR]: '1', contenteditable: 'false' });
      layer.appendChild(el(doc(), 'div', { class: 'rte-hgrip', 'data-rte-hgrip': '1', [UI_ATTR]: '1', title: 'Drag to change the canvas height', 'aria-label': 'Change canvas height' }));
      layer.appendChild(el(doc(), 'button', { type: 'button', class: 'rte-canvas-remove', 'data-act': 'remove-canvas', [UI_ATTR]: '1', title: 'Remove canvas', 'aria-label': 'Remove canvas', text: '×' }));
      canvas.appendChild(layer);
      syncLayerSize(canvas);
    }
    return layer;
  };
  const syncLayerSize = (canvas) => {
    const stage = stageOf(canvas);
    const layer = canvas.querySelector(`:scope > [${LAYER_ATTR}]`);
    if (!stage || !layer) return;
    const spec = getCanvasSpec(canvas);
    layer.style.cssText = `position:absolute;left:0;top:0;width:${spec.w}px;height:${spec.h}px;transform-origin:0 0;transform:${stage.style.transform || 'none'};`;
  };
  const refit = (canvas) => { fitCanvas(canvas); syncLayerSize(canvas); };
  const bodyOf = (item) => (item ? item.querySelector(`:scope > .${BODY_CLASS}`) : null);

  // ---------------------------------------------------------- hydration
  function bindCanvas(canvas) {
    if (bound.has(canvas)) return;
    bound.add(canvas);
    ISOLATED_EVENTS.forEach((type) => {
      canvas.addEventListener(type, (e) => {
        // Keep Rooster (and its image-edit / keyboard / undo plugins) out of
        // anything that happens inside the free canvas.
        e.stopPropagation();
        if (type === 'input' && itemOf(e.target)) {
          convertFontTags(bodyOf(itemOf(e.target)));
          updateMediaFrame();
          emitChange();
        }
      });
    });
    canvas.addEventListener('paste', onPaste);
    ['dragover', 'drop'].forEach((t) => canvas.addEventListener(t, (e) => {
      // Never let a dropped file navigate away or be inlined as base64.
      if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
        e.preventDefault();
        e.stopPropagation();
        if (t === 'drop') say('error', 'Use the Image or Video button to add media to the layout.');
      }
    }));
    canvas.addEventListener('dragstart', (e) => {
      const t = e.target;
      if (!t.closest || !t.closest(`.${BODY_CLASS}`) || t.tagName === 'IMG' || t.tagName === 'VIDEO') e.preventDefault();
    });
  }

  function ensureCanvasChrome(canvas) {
    layerOf(canvas);
    refit(canvas);
    bindCanvas(canvas);
    getItems(canvas).forEach((item) => {
      if (itemType(item) === 'text') {
        const body = bodyOf(item);
        if (body) body.setAttribute('spellcheck', 'false');
      }
    });
    // A paragraph after the canvas so the caret can always leave it.
    const root = getRoot();
    if (root && canvas.parentElement === root && !canvas.nextElementSibling) {
      const p = doc().createElement('div');
      p.appendChild(doc().createElement('br'));
      root.appendChild(p);
    }
  }

  function hydrate() {
    const root = getRoot();
    if (!root) return [];
    const canvases = hydrateFreeLayout(root);
    canvases.forEach(ensureCanvasChrome);
    observe(canvases);
    if (selected && !root.contains(selected)) { selected = null; }
    return canvases;
  }

  /** Cheap check run on editor events: re-hydrates canvases Rooster (e.g. undo) re-created. */
  function ensureHydrated() {
    if (getCanvases().some((c) => !bound.has(c))) hydrate();
  }

  function observe(canvases) {
    if (typeof ResizeObserver === 'undefined') return;
    if (!resizeObserver) {
      resizeObserver = new ResizeObserver((entries) => {
        entries.forEach((entry) => { refit(entry.target); if (selected && canvasOf(selected) === entry.target) updateFrame(); });
      });
    }
    canvases.forEach((c) => resizeObserver.observe(c));
  }

  // ------------------------------------------------------------- canvas
  function getCanvases() {
    const root = getRoot();
    return root ? Array.from(root.querySelectorAll(`.${CANVAS_CLASS}[data-rte-canvas]`)) : [];
  }

  /** Returns the (single) canvas, creating one at the end of the document if needed. */
  function ensureCanvas() {
    const root = getRoot();
    if (!root) return null;
    const existing = getCanvases()[0];
    if (existing) return existing;
    const designW = parseCanvasSpec(getDesignWidth?.() || DEFAULT_CANVAS_W, DEFAULT_CANVAS_H).w;
    const canvas = createCanvasElement(doc(), { w: designW, h: DEFAULT_CANVAS_H });
    // Drop a trailing empty placeholder paragraph so the canvas isn't preceded by a blank line.
    const last = root.lastElementChild;
    if (last && last.tagName === 'DIV' && last.innerHTML === '<br>') last.remove();
    root.appendChild(canvas);
    ensureCanvasChrome(canvas);
    observe([canvas]);
    emitChange(true);
    return canvas;
  }

  function growCanvasToFit(canvas, geo) {
    const spec = getCanvasSpec(canvas);
    if (geo.y + geo.h > spec.h) {
      writeCanvasSpec(canvas, { w: spec.w, h: Math.min(MAX_CANVAS_H, geo.y + geo.h + 24) });
      refit(canvas);
    }
  }

  function topZ(canvas) {
    return getItems(canvas).reduce((m, it) => Math.max(m, readGeometry(it, getCanvasSpec(canvas))?.z || 0), 0);
  }

  // --------------------------------------------------------- insertion
  function addItem(canvas, item) {
    stageOf(canvas).appendChild(item);
    selectItem(item);
    emitChange(true);
    return item;
  }

  function addTextAt(canvas, x, y) {
    const spec = getCanvasSpec(canvas);
    const geo = clampGeometry({ x, y, w: 260, h: 110, z: topZ(canvas) + 1 }, spec, 'text');
    const item = addItem(canvas, createTextItem(doc(), geo));
    focusBody(item, true);
    return item;
  }

  function probeMediaSize(kind, url) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 4000);
      const done = (size) => { clearTimeout(timer); resolve(size); };
      try {
        if (kind === 'image') {
          const img = new Image();
          img.onload = () => done({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => done(null);
          img.src = url;
        } else {
          const v = doc().createElement('video');
          v.preload = 'metadata';
          v.onloadedmetadata = () => done({ w: v.videoWidth, h: v.videoHeight });
          v.onerror = () => done(null);
          v.src = url;
        }
      } catch { done(null); }
    });
  }

  /** `url` must be the URL to DISPLAY now (token already attached); it is stripped on sync. */
  async function addMedia(kind, { url, mediaId, alt, filename, mime }) {
    const canvas = ensureCanvas();
    if (!canvas) return null;
    const spec = getCanvasSpec(canvas);
    const natural = await probeMediaSize(kind, url);
    const size = fitMediaSize(natural, Math.round(spec.w * 0.5), Math.round(spec.h * 0.7));
    const base = nextInsertPosition(getItems(canvas).length, size, spec);
    const geo = clampGeometry({ ...base, z: topZ(canvas) + 1 }, spec, kind);
    growCanvasToFit(canvas, geo);
    const item = kind === 'image'
      ? createImageItem(doc(), { url, mediaId, alt }, geo)
      : createVideoItem(doc(), { url, mediaId, filename, mime }, geo);
    return addItem(canvas, item);
  }

  const addImage = (opts) => addMedia('image', opts);
  const addVideo = (opts) => addMedia('video', opts);

  function beginTextBox() {
    const canvas = ensureCanvas();
    if (!canvas) return;
    mode = 'textbox';
    getWrapper()?.classList.add('rte-tool-textbox');
    say('info', 'Click inside the canvas to place the text box (Esc to cancel).');
    canvas.scrollIntoView?.({ block: 'nearest' });
  }
  function cancelMode() {
    mode = null;
    getWrapper()?.classList.remove('rte-tool-textbox');
  }

  // --------------------------------------------------------- selection
  function focusBody(item, selectAll) {
    const body = bodyOf(item);
    if (!body) return;
    body.setAttribute('contenteditable', 'true');
    item.classList.add('rte-abs-editing');
    setTimeout(() => {
      body.focus({ preventScroll: true });
      const sel = doc().defaultView.getSelection();
      const r = doc().createRange();
      r.selectNodeContents(body);
      if (!selectAll) r.collapse(false); else r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }, 0);
  }

  function selectItem(item) {
    if (selected === item) return;
    deselect();
    if (!item) return;
    selected = item;
    item.classList.add('rte-abs-selected');
    if (itemType(item) === 'text') {
      const body = bodyOf(item);
      if (body) { body.setAttribute('contenteditable', 'true'); item.classList.add('rte-abs-editing'); }
    }
    buildFrame(item);
    onSelect?.(itemType(item));
  }

  function deselect() {
    deselectMedia();
    if (!selected) return;
    const item = selected;
    selected = null;
    item.classList.remove('rte-abs-selected', 'rte-abs-editing', 'rte-abs-preview', 'rte-abs-dragging');
    const body = bodyOf(item);
    if (body) {
      body.removeAttribute('contenteditable');
      if (doc().activeElement === body) body.blur();
    }
    const canvas = canvasOf(item);
    const layer = canvas && canvas.querySelector(`:scope > [${LAYER_ATTR}]`);
    if (layer) layer.querySelectorAll('.rte-frame').forEach((f) => f.remove());
    lastRange = null;
    onSelect?.(null);
  }

  function frameOf(item) {
    const canvas = canvasOf(item);
    return canvas ? canvas.querySelector(`:scope > [${LAYER_ATTR}] .rte-frame`) : null;
  }

  function updateFrame() {
    if (!selected) return;
    const frame = frameOf(selected);
    const canvas = canvasOf(selected);
    if (!frame || !canvas) return;
    const g = readGeometry(selected, getCanvasSpec(canvas));
    if (!g) return;
    frame.style.cssText = `left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px;`;
    positionBar(frame, canvas);
    updateMediaFrame();
  }

  /** Keeps the (wide) floating toolbar inside the editor viewport instead of being clipped at its edges. */
  function positionBar(frame, canvas) {
    const bar = frame.querySelector(':scope > .rte-bar');
    const wrapper = getWrapper();
    if (!bar || !wrapper) return;
    bar.style.left = '0px';
    const scale = measureScale(canvas);
    const wr = wrapper.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    const maxRight = wr.right - 8;
    const minLeft = wr.left + 8;
    let shift = 0;
    if (br.right > maxRight) shift = -(br.right - maxRight) / scale;
    const left = br.left + shift * scale;
    if (left < minLeft) shift += (minLeft - left) / scale;
    if (shift) bar.style.left = `${Math.round(shift)}px`;
  }

  function buildFrame(item) {
    const canvas = canvasOf(item);
    if (!canvas) return;
    const layer = layerOf(canvas);
    layer.querySelectorAll('.rte-frame').forEach((f) => f.remove());
    const d = doc();
    const type = itemType(item);
    const frame = el(d, 'div', { class: `rte-frame rte-frame-${type}`, [UI_ATTR]: '1', tabindex: '0', 'aria-label': `${type} element — arrow keys move, Delete removes` });
    HANDLES.forEach((h) => frame.appendChild(el(d, 'div', { class: `rte-handle rte-handle-${h}`, 'data-rte-handle': h, [UI_ATTR]: '1' })));
    frame.appendChild(buildBar(type));
    layer.appendChild(frame);
    updateFrame();
    if (type !== 'text') setTimeout(() => frame.focus({ preventScroll: true }), 0);
  }

  function barButton(act, label, title, extra = {}) {
    return el(doc(), 'button', { type: 'button', class: 'rte-bar-btn', 'data-act': act, title, 'aria-label': title, text: label, ...extra });
  }
  const sep = () => el(doc(), 'span', { class: 'rte-bar-sep' });

  /** Labelled native colour input: a swatch glyph over the picker, so it reads clearly in the toolbar. */
  function colorField(act, title, glyph, initial) {
    const d = doc();
    const wrap = el(d, 'label', { class: 'rte-bar-colorfield', title });
    wrap.appendChild(el(d, 'span', { class: 'rte-bar-colorglyph', text: glyph }));
    wrap.appendChild(el(d, 'input', { type: 'color', class: 'rte-bar-color', 'data-act': act, 'aria-label': title, value: initial }));
    return wrap;
  }

  // Four-line alignment icons (same look as the ribbon's alignment buttons).
  const ALIGN_LINES = {
    'align-left': [[2, 14], [2, 10], [2, 14], [2, 10], [2, 14]],
    'align-center': [[2, 14], [4, 12], [2, 14], [4, 12], [2, 14]],
    'align-right': [[2, 14], [6, 14], [2, 14], [6, 14], [2, 14]],
    'align-justify': [[2, 14], [2, 14], [2, 14], [2, 14], [2, 14]],
  };
  function alignButton(act, title) {
    const btn = barButton(act, '', title);
    const lines = ALIGN_LINES[act].map(([x1, x2], i) => `<line x1="${x1}" y1="${3 + i * 2.5}" x2="${x2}" y2="${3 + i * 2.5}"/>`).join('');
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true" focusable="false">${lines}</svg>`;
    return btn;
  }

  function buildBar(type) {
    const d = doc();
    const bar = el(d, 'div', { class: 'rte-bar', [UI_ATTR]: '1', role: 'toolbar', 'aria-label': 'Element tools' });
    bar.appendChild(el(d, 'span', { class: 'rte-bar-grip', 'data-rte-grip': '1', title: 'Drag to move', 'aria-label': 'Drag to move', text: T.move }));
    if (type === 'text') {
      bar.appendChild(barButton('bold', 'B', 'Bold', { style: 'font-weight:700' }));
      bar.appendChild(barButton('italic', 'I', 'Italic', { style: 'font-style:italic' }));
      bar.appendChild(barButton('underline', 'U', 'Underline', { style: 'text-decoration:underline' }));
      bar.appendChild(barButton('size-down', 'A−', 'Smaller text'));
      bar.appendChild(barButton('size-up', 'A+', 'Larger text'));
      const fam = el(d, 'select', { class: 'rte-bar-select', 'data-act': 'font-family', title: 'Font family', 'aria-label': 'Font family' });
      FONT_FAMILIES.forEach(([v, label]) => fam.appendChild(el(d, 'option', { value: v, text: label })));
      bar.appendChild(fam);
      const size = el(d, 'select', { class: 'rte-bar-select', 'data-act': 'font-size', title: 'Font size', 'aria-label': 'Font size' });
      size.appendChild(el(d, 'option', { value: '', text: 'Size' }));
      FONT_SIZES.forEach((s) => size.appendChild(el(d, 'option', { value: String(s), text: `${s}` })));
      bar.appendChild(size);
      bar.appendChild(colorField('color', 'Text colour', 'A', '#c82613'));
      bar.appendChild(colorField('hilite', 'Text background colour', '\u25A0', '#f5d427'));
      bar.appendChild(barButton('clear-format', 'T\u2093', 'Clear formatting (colour, size, font...)'));
      bar.appendChild(alignButton('align-left', 'Align left'));
      bar.appendChild(alignButton('align-center', 'Align centre'));
      bar.appendChild(alignButton('align-right', 'Align right'));
      bar.appendChild(alignButton('align-justify', 'Justify'));
      bar.appendChild(barButton('ul', T.ul, 'Bulleted list'));
      bar.appendChild(barButton('ol', T.ol, 'Numbered list'));
      bar.appendChild(barButton('link', T.link, 'Insert link'));
      bar.appendChild(barButton('inline-image', '\uD83D\uDDBC', 'Insert image into this text box'));
      bar.appendChild(barButton('inline-video', '\uD83C\uDFAC', 'Insert video into this text box'));
      bar.appendChild(sep());
    }
    if (type === 'video') {
      bar.appendChild(barButton('preview', T.play, 'Preview playback (turns off dragging by the video)'));
    }
    // Layer-order buttons are not offered for text boxes (images / videos only).
    if (type !== 'text') {
      bar.appendChild(barButton('front', T.up, 'Bring to front'));
      bar.appendChild(barButton('forward', T.fwd, 'Bring forward'));
      bar.appendChild(barButton('backward', T.back, 'Send backward'));
      bar.appendChild(barButton('back', T.down, 'Send to back'));
    }
    bar.appendChild(sep());
    bar.appendChild(barButton('delete', T.del, 'Delete element', { class: 'rte-bar-btn rte-bar-danger' }));
    return bar;
  }

  // -------------------------------------------------------- geometry ops
  function setGeometry(item, geo, { silent } = {}) {
    const canvas = canvasOf(item);
    if (!canvas) return;
    growCanvasToFit(canvas, geo);
    writeGeometry(item, geo);
    if (item === selected) updateFrame();
    if (!silent) emitChange();
  }

  function patchSelected(patch, type) {
    if (!selected) return;
    const canvas = canvasOf(selected);
    const spec = getCanvasSpec(canvas);
    const cur = readGeometry(selected, spec);
    setGeometry(selected, clampGeometry({ ...cur, ...patch }, spec, type || itemType(selected)));
  }

  function reorder(op) {
    if (!selected) return;
    const canvas = canvasOf(selected);
    const spec = getCanvasSpec(canvas);
    const items = getItems(canvas);
    const list = items.map((it, i) => ({ id: i, z: readGeometry(it, spec)?.z || i + 1 }));
    const next = reorderZ(list, items.indexOf(selected), op);
    next.forEach(({ id, z }) => {
      const geo = readGeometry(items[id], spec);
      if (geo) writeGeometry(items[id], { ...geo, z: Math.min(z, MAX_Z) });
    });
    emitChange(true);
  }

  /** Resizes the selected image/video to a fraction of the canvas width (or its natural size), keeping aspect. */
  function resizeSelectedPreset(preset) {
    if (selMedia && selMedia.isConnected && selected && preset != null) {
      const cw = bodyContentWidth(bodyOf(selected));
      const nat = selMedia.naturalWidth || selMedia.videoWidth || selMedia.offsetWidth;
      const w = clamp(Math.round(preset === 'natural' ? nat : cw * preset), 40, cw);
      const ml = clamp(parseFloat(selMedia.style.marginLeft) || 0, 0, Math.max(0, cw - w));
      applyMedia(selMedia, { w, ml });
      updateMediaFrame();
      growTextItemToFit(selected);
      emitChange(true);
      return true;
    }
    if (!selected || preset == null) return false;
    const type = itemType(selected);
    if (type !== 'image' && type !== 'video') return false;
    const canvas = canvasOf(selected);
    const spec = getCanvasSpec(canvas);
    const cur = readGeometry(selected, spec);
    let w = Math.round(spec.w * preset);
    if (preset === 'natural') {
      const m = selected.querySelector('img');
      w = (m && m.naturalWidth) || cur.w;
    }
    const aspect = cur.w / (cur.h || 1);
    patchSelected({ w, h: Math.round(w / aspect) });
    return true;
  }

  function deleteSelected() {
    if (!selected) return;
    const item = selected;
    deselect();
    // Intentionally does NOT delete the uploaded HomeMedia: the card may be
    // cancelled (restoring the saved version that still references it) and the
    // nightly orphan sweep reclaims unreferenced media safely.
    item.remove();
    emitChange(true);
  }

  // ----------------------------------------------------------- pointer
  function pointOnCanvas(e, canvas) {
    const stage = stageOf(canvas);
    return clientPointToCanvas(e.clientX, e.clientY, stage.getBoundingClientRect(), measureScale(canvas));
  }

  // ------------------------------------------- media inside a text box
  const MEDIA_HANDLES = ['nw', 'ne', 'se', 'sw', 'w', 'e'];

  function mediaAtPoint(item, x, y) {
    const body = bodyOf(item);
    if (!body) return null;
    const list = Array.from(body.querySelectorAll('img, video')).reverse();
    return list.find((m) => {
      const r = m.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }) || null;
  }

  /** Sizes / offsets an inline media element. Always its own line, so margin-left moves it horizontally. */
  function applyMedia(m, { w, ml }) {
    m.style.display = 'block';
    if (w != null) m.style.width = `${w}px`;
    m.style.height = 'auto';
    m.style.maxWidth = '100%';
    if (ml != null) m.style.marginLeft = `${ml}px`;
  }

  function bodyContentWidth(body) {
    const cs = doc().defaultView.getComputedStyle(body);
    return Math.max(40, body.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
  }

  function mediaFrameOf(canvas) {
    return canvas ? canvas.querySelector(`:scope > [${LAYER_ATTR}] .rte-mframe`) : null;
  }

  function selectMedia(m) {
    if (selMedia === m) { updateMediaFrame(); return; }
    deselectMedia();
    if (!m || !selected) return;
    selMedia = m;
    const canvas = canvasOf(selected);
    const layer = layerOf(canvas);
    const d = doc();
    const f = el(d, 'div', { class: 'rte-mframe', [UI_ATTR]: '1' });
    MEDIA_HANDLES.forEach((h) => f.appendChild(el(d, 'div', { class: `rte-handle rte-handle-${h}`, 'data-rte-mhandle': h, [UI_ATTR]: '1' })));
    const bar = el(d, 'div', { class: 'rte-mbar', [UI_ATTR]: '1', role: 'toolbar', 'aria-label': 'Media tools' });
    bar.appendChild(el(d, 'span', { class: 'rte-bar-grip', 'data-rte-mgrip': '1', title: 'Drag left / right to move', 'aria-label': 'Drag left or right to move', text: '\u2194' }));
    bar.appendChild(barButton('media-delete', T.del, 'Remove this media', { class: 'rte-bar-btn rte-bar-danger' }));
    f.appendChild(bar);
    layer.appendChild(f);
    updateMediaFrame();
  }

  function deselectMedia() {
    if (!selMedia) return;
    const canvas = canvasOf(selected || selMedia);
    mediaFrameOf(canvas)?.remove();
    selMedia = null;
  }

  function updateMediaFrame() {
    if (!selMedia) return;
    if (!selMedia.isConnected || !selected || !selected.contains(selMedia)) { deselectMedia(); return; }
    const canvas = canvasOf(selected);
    const f = mediaFrameOf(canvas);
    if (!f) return;
    const stage = stageOf(canvas);
    const sr = stage.getBoundingClientRect();
    const s = measureScale(canvas);
    const mr = selMedia.getBoundingClientRect();
    const br = bodyOf(selected).getBoundingClientRect();
    const visible = mr.bottom > br.top && mr.top < br.bottom && mr.right > br.left && mr.left < br.right;
    f.style.display = visible ? '' : 'none';
    f.style.cssText = `left:${(mr.left - sr.left) / s}px;top:${(mr.top - sr.top) / s}px;width:${mr.width / s}px;height:${mr.height / s}px;${visible ? '' : 'display:none;'}`;
  }

  /** Grows the selected text box (within the canvas) so its content is not clipped. */
  function growTextItemToFit(item) {
    const body = bodyOf(item);
    if (!item || !body || !item.isConnected) return;
    const spec = getCanvasSpec(canvasOf(item));
    const cur = readGeometry(item, spec);
    if (body.scrollHeight > cur.h + 1) setGeometry(item, clampGeometry({ ...cur, h: body.scrollHeight }, spec, 'text'));
  }

  function beginMediaDrag(e, kind, item, handle) {
    const m = selMedia;
    if (!m) return;
    const body = bodyOf(item);
    beginDrag(e, kind, item, handle, null);
    if (!drag) return;
    drag.media = m;
    drag.contentW = bodyContentWidth(body);
    drag.w0 = m.offsetWidth;
    drag.ml0 = parseFloat(m.style.marginLeft) || 0;
    drag.mediaStyle = m.getAttribute('style') || '';
  }

  function beginDrag(e, kind, item, handle, canvasArg) {
    const canvas = canvasArg || canvasOf(item);
    const spec = getCanvasSpec(canvas);
    const start = item ? readGeometry(item, spec) : null;
    if (item && !start) return;
    drag = {
      kind, item, handle, canvas, spec, start, type: item ? itemType(item) : null,
      x0: e.clientX, y0: e.clientY, moved: false, pointerId: e.pointerId,
      scale: measureScale(canvas),
    };
    item?.classList.add('rte-abs-dragging');
    getWrapper()?.classList.add('rte-is-dragging');
    const d = doc();
    d.addEventListener('pointermove', onPointerMove, true);
    d.addEventListener('pointerup', onPointerUp, true);
    d.addEventListener('pointercancel', onPointerCancel, true);
    d.addEventListener('keydown', onDragKey, true);
  }

  function endDrag() {
    if (!drag) return;
    const d = doc();
    d.removeEventListener('pointermove', onPointerMove, true);
    d.removeEventListener('pointerup', onPointerUp, true);
    d.removeEventListener('pointercancel', onPointerCancel, true);
    d.removeEventListener('keydown', onDragKey, true);
    drag.item?.classList.remove('rte-abs-dragging');
    getWrapper()?.classList.remove('rte-is-dragging');
    drag = null;
  }

  function onPointerMove(e) {
    if (!drag) return;
    const dxC = e.clientX - drag.x0;
    const dyC = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dxC, dyC) < MOVE_THRESHOLD_PX) return;
    drag.moved = true;
    e.preventDefault();
    const { dx, dy } = clientDeltaToCanvas(dxC, dyC, drag.scale);
    if (drag.kind === 'move') {
      setGeometry(drag.item, moveGeometry(drag.start, Math.round(dx), Math.round(dy), drag.spec, drag.type), { silent: true });
    } else if (drag.kind === 'resize') {
      setGeometry(drag.item, resizeGeometry(drag.start, drag.handle, dx, dy, drag.spec, { type: drag.type, keepAspect: !e.shiftKey }), { silent: true });
    } else if (drag.kind === 'media-move') {
      const ml = clamp(Math.round(drag.ml0 + dx), 0, Math.max(0, drag.contentW - drag.w0));
      applyMedia(drag.media, { ml });
      updateMediaFrame();
    } else if (drag.kind === 'media-resize') {
      const west = drag.handle.includes('w');
      const maxW = west ? drag.ml0 + drag.w0 : drag.contentW - drag.ml0;
      const w = clamp(Math.round(drag.w0 + (west ? -dx : dx)), 40, Math.max(40, maxW));
      applyMedia(drag.media, { w, ml: west ? drag.ml0 + drag.w0 - w : drag.ml0 });
      updateMediaFrame();
    } else if (drag.kind === 'canvas-height') {
      const items = getItems(drag.canvas).map((it) => readGeometry(it, drag.spec)).filter(Boolean);
      const h = Math.min(MAX_CANVAS_H, Math.max(minCanvasHeight(items), Math.round(drag.spec.h + dy)));
      writeCanvasSpec(drag.canvas, { w: drag.spec.w, h });
      refit(drag.canvas);
      updateFrame();
    }
  }

  function onPointerUp() {
    if (!drag) return;
    const wasMoved = drag.moved;
    const grew = drag.kind === 'media-resize' ? drag.item : null;
    endDrag();
    if (grew) growTextItemToFit(grew);
    if (wasMoved) emitChange(true);
  }

  function onPointerCancel() { cancelDrag(); }

  function cancelDrag() {
    if (!drag) return;
    const { kind, item, start, canvas, spec } = drag;
    if (kind === 'media-move' || kind === 'media-resize') {
      drag.media.setAttribute('style', drag.mediaStyle);
    } else if (kind === 'canvas-height') {
      writeCanvasSpec(canvas, spec);
      refit(canvas);
    } else {
      writeGeometry(item, start);
    }
    endDrag();
    updateFrame();
    updateMediaFrame();
  }

  function onDragKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelDrag();
    }
  }

  function selectBeneath(e, canvas) {
    const stack = (doc().elementsFromPoint(e.clientX, e.clientY) || [])
      .map((n) => itemOf(n))
      .filter((n, i, arr) => n && canvasOf(n) === canvas && arr.indexOf(n) === i);
    if (stack.length < 2) return stack[0] || null;
    const idx = stack.indexOf(selected);
    return stack[(idx + 1) % stack.length];
  }

  function onPointerDown(e) {
    if (!attached) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const root = getRoot();
    const target = e.target;
    if (!root || !root.contains(target)) return;
    let canvas = canvasOf(target);
    if (canvas && !bound.has(canvas)) { hydrate(); canvas = canvasOf(target); }

    // Text-box placement mode.
    if (mode === 'textbox') {
      if (!canvas) { cancelMode(); return; }
      cancelMode();
      const hit = itemOf(target);
      if (hit) { selectItem(hit); return; } // never nest a box inside another element
      if (target.closest(`[${UI_ATTR}]`)) return;
      e.preventDefault();
      e.stopPropagation();
      const p = pointOnCanvas(e, canvas);
      addTextAt(canvas, Math.round(p.x), Math.round(p.y));
      return;
    }

    if (!canvas) { if (selected && !target.closest('.rte-bar')) deselect(); return; }

    // UI of a media element inside a text box (resize handles / horizontal grip).
    const mHandle = target.closest('[data-rte-mhandle]');
    if (mHandle && selMedia && selected) {
      e.preventDefault();
      beginMediaDrag(e, 'media-resize', selected, mHandle.getAttribute('data-rte-mhandle'));
      return;
    }
    if (target.closest('[data-rte-mgrip]') && selMedia && selected) {
      e.preventDefault();
      beginMediaDrag(e, 'media-move', selected, null);
      return;
    }
    if (target.closest('.rte-mbar')) return;

    // UI: resize handle / move grip / canvas height grip.
    const handleEl = target.closest('[data-rte-handle]');
    if (handleEl && selected) {
      e.preventDefault();
      beginDrag(e, 'resize', selected, handleEl.getAttribute('data-rte-handle'));
      return;
    }
    if (target.closest('[data-rte-grip]') && selected) {
      e.preventDefault();
      beginDrag(e, 'move', selected);
      return;
    }
    if (target.closest('[data-rte-hgrip]')) {
      e.preventDefault();
      deselect();
      beginDrag(e, 'canvas-height', null, null, canvas);
      return;
    }
    if (target.closest(`.rte-bar, [data-act="remove-canvas"]`)) return; // clicks handled in onClick

    let item = itemOf(target);
    if (item && e.altKey) item = selectBeneath(e, canvas) || item;
    if (!item) { deselect(); return; }

    const wasSelected = item === selected;
    selectItem(item);
    const type = itemType(item);
    if (type === 'text') {
      // Text bodies edit normally (caret / selection); moving is via the grip.
      // A click on media inside the box selects it (resize handles, horizontal drag).
      const m = mediaAtPoint(item, e.clientX, e.clientY);
      if (m) {
        e.preventDefault();
        selectMedia(m);
        beginMediaDrag(e, 'media-move', item, null);
      } else {
        deselectMedia();
      }
      return;
    }
    // Image / video: dragging the media itself moves it (unless preview mode).
    if (item.classList.contains('rte-abs-preview')) return;
    e.preventDefault();
    beginDrag(e, 'move', item);
    if (!wasSelected) frameOf(item)?.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------- keyboard
  function onKeyDown(e) {
    if (!attached) return;
    const t = e.target;
    if (mode === 'textbox' && e.key === 'Escape') { cancelMode(); e.preventDefault(); return; }
    if (!t.closest) return;
    if (t.closest('.rte-bar')) return;
    const frame = t.closest('.rte-frame');
    if (frame && selected) {
      const canvas = canvasOf(selected);
      const spec = getCanvasSpec(canvas);
      const type = itemType(selected);
      const step = e.shiftKey ? 10 : 1;
      const cur = readGeometry(selected, spec);
      const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (arrows[e.key]) {
        e.preventDefault();
        const [ax, ay] = arrows[e.key];
        if (e.ctrlKey || e.metaKey) {
          setGeometry(selected, resizeGeometry(cur, 'se', ax * step, ay * step, spec, { type, keepAspect: false }));
        } else {
          setGeometry(selected, moveGeometry(cur, ax * step, ay * step, spec, type));
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        deleteSelected();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        deselect();
      } else if (e.key === 'Tab') {
        const items = getItems(canvas);
        const idx = items.indexOf(selected);
        const next = items[(idx + (e.shiftKey ? items.length - 1 : 1)) % items.length];
        if (next && next !== selected) { e.preventDefault(); selectItem(next); if (itemType(next) === 'text') frameOf(next)?.focus({ preventScroll: true }); }
      }
      return;
    }
    // Inside a text body: only Escape is ours (hands focus back to the frame).
    if (e.key === 'Escape' && t.closest(`.${BODY_CLASS}`) && selected) {
      e.preventDefault();
      t.blur();
      frameOf(selected)?.focus({ preventScroll: true });
    }
  }

  // -------------------------------------------------------- bar clicks
  function onMouseDownCapture(e) {
    // Keep the text selection alive when pressing toolbar buttons.
    const btn = e.target.closest && e.target.closest('.rte-bar-btn');
    if (btn) e.preventDefault();
  }

  function onClick(e) {
    const t = e.target;
    if (!t.closest) return;
    const remove = t.closest('[data-act="remove-canvas"]');
    if (remove) {
      const canvas = canvasOf(remove);
      if (!canvas) return;
      if (getItems(canvas).length && !window.confirm('Remove the whole layout canvas and everything on it?')) return;
      deselect();
      canvas.remove();
      emitChange(true);
      return;
    }
    const mdel = t.closest('[data-act="media-delete"]');
    if (mdel && selMedia) {
      const m = selMedia;
      deselectMedia();
      m.remove();
      emitChange(true);
      return;
    }
    const act = t.closest('[data-act]');
    if (!act || !selected || !act.closest('.rte-bar')) return;
    const a = act.getAttribute('data-act');
    if (act.tagName === 'SELECT' || act.tagName === 'INPUT') return; // handled on 'change'
    runAction(a);
  }

  function onChangeEvent(e) {
    const t = e.target;
    if (!t.closest || !t.closest('.rte-bar') || !selected) return;
    const a = t.getAttribute('data-act');
    if (a === 'font-family') { if (t.value) exec('fontName', t.value); }
    else if (a === 'font-size') { if (t.value) applyFontSizePx(parseInt(t.value, 10)); t.value = ''; }
    else if (a === 'color') exec('foreColor', t.value);
    else if (a === 'hilite') exec('hiliteColor', t.value);
  }

  function onScrollCapture(e) {
    if (selMedia && e.target && e.target.classList && e.target.classList.contains(BODY_CLASS)) updateMediaFrame();
  }

  let colorTimer = null;
  let selMedia = null; // an <img>/<video> selected inside the selected text box
  /** Native colour pickers fire `input` continuously while dragging; apply the settled value. */
  function onInputEvent(e) {
    const t = e.target;
    if (!t.closest || !t.closest('.rte-bar') || !selected) return;
    const a = t.getAttribute('data-act');
    if (a !== 'color' && a !== 'hilite') return;
    clearTimeout(colorTimer);
    colorTimer = setTimeout(() => exec(a === 'color' ? 'foreColor' : 'hiliteColor', t.value), 140);
  }

  function runAction(a) {
    switch (a) {
      case 'bold': exec('bold'); break;
      case 'italic': exec('italic'); break;
      case 'underline': exec('underline'); break;
      case 'size-up': stepFontSize(1); break;
      case 'size-down': stepFontSize(-1); break;
      case 'align-left': exec('justifyLeft'); break;
      case 'align-center': exec('justifyCenter'); break;
      case 'align-right': exec('justifyRight'); break;
      case 'align-justify': exec('justifyFull'); break;
      case 'ul': exec('insertUnorderedList'); break;
      case 'ol': exec('insertOrderedList'); break;
      case 'link': rememberRange(); requestLink?.(); break;
      case 'inline-image': rememberRange(); requestInlineMedia?.('image'); break;
      case 'inline-video': rememberRange(); requestInlineMedia?.('video'); break;
      case 'clear-format': exec('removeFormat'); break;
      case 'front': case 'forward': case 'backward': case 'back': reorder(a); break;
      case 'delete': deleteSelected(); break;
      case 'preview': {
        const on = selected.classList.toggle('rte-abs-preview');
        say('info', on ? 'Preview mode: the video can be played. Toggle again to drag it.' : 'Preview off.');
        break;
      }
      default: break;
    }
  }

  // ----------------------------------------------------------- text ops
  function rememberRange() {
    const sel = doc().defaultView.getSelection();
    const body = selected && bodyOf(selected);
    if (sel && sel.rangeCount && body && body.contains(sel.anchorNode)) lastRange = sel.getRangeAt(0).cloneRange();
  }
  function restoreRange() {
    const body = selected && bodyOf(selected);
    if (!body) return false;
    if (doc().activeElement !== body) body.focus({ preventScroll: true });
    if (lastRange && body.contains(lastRange.commonAncestorContainer)) {
      const sel = doc().defaultView.getSelection();
      sel.removeAllRanges();
      sel.addRange(lastRange);
    }
    return true;
  }
  function exec(cmd, value) {
    if (!restoreRange()) return;
    const d = doc();
    try {
      d.execCommand('styleWithCSS', false, cmd !== 'fontSize');
      d.execCommand(cmd, false, value);
    } catch { /* unsupported in this browser */ }
    convertFontTags(bodyOf(selected));
    rememberRange();
    emitChange();
  }
  function applyFontSizePx(px) {
    if (!restoreRange()) return;
    const d = doc();
    // Set before exec: execCommand fires 'input' synchronously and that handler
    // also converts <font> tags, so it must already know the requested size.
    pendingPx = px;
    d.execCommand('styleWithCSS', false, false);
    d.execCommand('fontSize', false, '7');
    convertFontTags(bodyOf(selected), px);
    rememberRange();
    emitChange();
  }
  function currentFontSize() {
    const sel = doc().defaultView.getSelection();
    let n = sel && sel.anchorNode;
    if (n && n.nodeType === 3) n = n.parentElement;
    const body = selected && bodyOf(selected);
    if (!n || !body || !body.contains(n)) return 14;
    return Math.round(parseFloat(doc().defaultView.getComputedStyle(n).fontSize)) || 14;
  }
  function stepFontSize(dir) {
    restoreRange();
    const cur = currentFontSize();
    const idx = dir > 0 ? FONT_SIZES.findIndex((s) => s > cur) : [...FONT_SIZES].reverse().findIndex((s) => s < cur);
    if (idx === -1) return;
    applyFontSizePx(dir > 0 ? FONT_SIZES[idx] : [...FONT_SIZES].reverse()[idx]);
  }
  let pendingPx = null;
  /** execCommand('fontSize') emits <font size=7>; turn it into a real px size and keep the selection on it. */
  function convertFontTags(body, px) {
    if (!body) return;
    if (px) pendingPx = px;
    const converted = [];
    body.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = doc().createElement('span');
      span.style.fontSize = `${pendingPx || 14}px`;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
      converted.push(span);
    });
    body.querySelectorAll('font').forEach((f) => {
      const span = doc().createElement('span');
      if (f.getAttribute('color')) span.style.color = f.getAttribute('color');
      if (f.getAttribute('face')) span.style.fontFamily = f.getAttribute('face');
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });
    if (converted.length) {
      // Replacing the nodes dropped the selection; re-select what was just resized.
      const r = doc().createRange();
      r.setStartBefore(converted[0].firstChild || converted[0]);
      r.setEndAfter(converted[converted.length - 1].lastChild || converted[converted.length - 1]);
      const sel = doc().defaultView.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }

  // ------------------------------------- tables, blocks, media styling
  function currentCell() {
    const body = selected && bodyOf(selected);
    if (!body) return null;
    const sel = doc().defaultView.getSelection();
    let node = sel && sel.rangeCount && body.contains(sel.anchorNode) ? sel.anchorNode : (lastRange && lastRange.startContainer);
    if (node && node.nodeType === 3) node = node.parentElement;
    const cell = node && node.closest ? node.closest('td, th') : null;
    return cell && body.contains(cell) ? cell : null;
  }

  function selectedCells() {
    const body = selected && bodyOf(selected);
    const sel = doc().defaultView.getSelection();
    if (!body || !sel || !sel.rangeCount) return [];
    const r = sel.getRangeAt(0);
    const hit = Array.from(body.querySelectorAll('td, th')).filter((c) => r.intersectsNode(c));
    return hit.length ? hit : [currentCell()].filter(Boolean);
  }

  const BLOCK_SEL = 'p, div, li, h1, h2, h3, h4, h5, h6, blockquote, td, th';
  /** Block elements touched by the selection (falls back to the text box body itself). */
  function selectedBlocks() {
    const body = selected && bodyOf(selected);
    if (!body) return [];
    const sel = doc().defaultView.getSelection();
    if (!sel || !sel.rangeCount) return [body];
    const r = sel.getRangeAt(0);
    const out = new Set();
    Array.from(body.querySelectorAll(BLOCK_SEL)).forEach((b) => { if (r.intersectsNode(b) && !b.querySelector(BLOCK_SEL)) out.add(b); });
    if (!out.size) {
      let n = sel.anchorNode;
      if (n && n.nodeType === 3) n = n.parentElement;
      const b = n && n.closest ? n.closest(BLOCK_SEL) : null;
      out.add(b && body.contains(b) ? b : body);
    }
    return Array.from(out);
  }

  const PT = { '1/4 pt': '0.25pt', '1/2 pt': '0.5pt', '3/4 pt': '0.75pt', '1 pt': '1pt', '1 1/2 pt': '1.5pt', '2 1/4 pt': '2.25pt', '3 pt': '3pt', '4 1/2 pt': '4.5pt', '6 pt': '6pt' };

  function tableCommand(cmd, v) {
    if (!restoreRange()) return true;
    const cell = currentCell();
    if (!cell) { say('info', 'Place the caret inside a table cell first.'); return true; }
    const table = cell.closest('table');
    if (!table) return true;
    switch (cmd) {
      case 'table-format': tbl.applyFormat(table, v); break;
      case 'table-shade': if (v) selectedCells().forEach((c) => { c.style.backgroundColor = v; }); break;
      case 'table-option': tbl.toggleOption(table, v); break;
      case 'table-insert': {
        const map = { 'Insert above': () => tbl.insertRow(table, cell, false), 'Insert below': () => tbl.insertRow(table, cell, true), 'Insert left': () => tbl.insertColumn(table, cell, false), 'Insert right': () => tbl.insertColumn(table, cell, true) };
        (map[v] || (() => {}))();
        break;
      }
      case 'table-delete': {
        const map = { 'Delete column': () => tbl.deleteColumn(table, cell), 'Delete row': () => tbl.deleteRow(table, cell), 'Delete table': () => table.remove() };
        if (map[v]) map[v](); else say('info', 'That option is not available inside a text box.');
        break;
      }
      case 'table-border': {
        const map = { 'All Borders': 'all', 'No Borders': 'none', 'Left Borders': 'left', 'Right Borders': 'right', 'Top Borders': 'top', 'Bottom Borders': 'bottom', 'Inside Borders': 'inside', 'Outside Borders': 'outside' };
        if (map[v]) tbl.setBorders(table, map[v], { color: table.dataset.rteBorderColor || '#94a3b8', width: table.dataset.rteBorderWidth || '1px', style: table.dataset.rteBorderStyle || 'solid' });
        break;
      }
      case 'table-border-color': if (v) { table.dataset.rteBorderColor = v; tbl.restyleBorders(table, { color: v }); } break;
      case 'table-border-width': { const w = PT[v]; if (w) { table.dataset.rteBorderWidth = w; tbl.restyleBorders(table, { width: w }); } break; }
      case 'table-border-style': { const st = String(v || '').toLowerCase(); if (st) { table.dataset.rteBorderStyle = st; tbl.restyleBorders(table, { style: st }); } break; }
      case 'table-merge': {
        const map = { 'Merge cells': 'right', 'Merge right': 'right', 'Merge down': 'below', 'Merge above': 'above', 'Merge left': 'left' };
        if (v === 'Unmerge cells') tbl.unmerge(table, cell);
        else if (map[v] && !tbl.mergeCells(table, cell, map[v])) say('info', 'Those cells cannot be merged (they do not line up).');
        break;
      }
      case 'table-split': tbl.splitCell(table, cell, v === 'Split cell vertically' ? 'vertical' : 'horizontal'); break;
      case 'table-cell-align': {
        const [vv, hh] = String(v || '').toLowerCase().split(' ');
        tbl.alignCell(cell, { v: { top: 'top', middle: 'middle', bottom: 'bottom' }[vv], h: { left: 'left', center: 'center', right: 'right' }[hh] });
        break;
      }
      case 'table-align': tbl.alignTable(table, String(v || '').toLowerCase()); break;
      default: return false;
    }
    rememberRange();
    growTextItemToFit(selected);
    emitChange(true);
    return true;
  }

  /** Style an image/video the user selected (canvas image item, or media inside a text box). */
  function mediaTarget() {
    if (selMedia && selMedia.isConnected) return selMedia;
    if (selected && itemType(selected) === 'image') return selected.querySelector('img');
    return null;
  }
  function setMediaStyle(prop, value) {
    const m = mediaTarget();
    if (!m) return false;
    m.style[prop] = value || '';
    updateMediaFrame();
    emitChange(true);
    return true;
  }
  function setMediaBorder(b) {
    const m = mediaTarget();
    if (!m) return false;
    if (b === null) { m.style.border = ''; m.style.borderStyle = ''; m.style.borderWidth = ''; m.style.borderColor = ''; }
    else {
      if (!m.style.borderStyle || m.style.borderStyle === 'none') m.style.borderStyle = 'solid';
      if (!m.style.borderWidth) m.style.borderWidth = '1px';
      if (b.color) m.style.borderColor = b.color;
      if (b.width) m.style.borderWidth = b.width;
      if (b.style) m.style.borderStyle = b.style;
    }
    updateMediaFrame();
    emitChange(true);
    return true;
  }

  /** True while a free text box is the active editing target (ribbon commands are forwarded to it). */
  function isTextActive() {
    return !!(selected && itemType(selected) === 'text');
  }

  /** Runs a ribbon command (Rooster's can't see a nested editable) against the active text box. */
  function applyCommand(cmd, value) {
    if (!isTextActive()) return false;
    switch (cmd) {
      case 'bold': exec('bold'); break;
      case 'italic': exec('italic'); break;
      case 'underline': exec('underline'); break;
      case 'strikethrough': exec('strikeThrough'); break;
      case 'subscript': exec('subscript'); break;
      case 'superscript': exec('superscript'); break;
      case 'ul': exec('insertUnorderedList'); break;
      case 'ol': exec('insertOrderedList'); break;
      case 'left': exec('justifyLeft'); break;
      case 'center': exec('justifyCenter'); break;
      case 'right': exec('justifyRight'); break;
      case 'justify': exec('justifyFull'); break;
      case 'indent': exec('indent'); break;
      case 'outdent': exec('outdent'); break;
      case 'clear': exec('removeFormat'); break;
      case 'font': if (value) exec('fontName', value); break;
      case 'size': { const px = Math.round(parseFloat(value) * (/pt$/i.test(String(value)) ? 4 / 3 : 1)); if (px) applyFontSizePx(px); break; }
      case 'size-up': stepFontSize(1); break;
      case 'size-down': stepFontSize(-1); break;
      case 'color': exec('foreColor', value); break;
      case 'background': exec('hiliteColor', value); break;
      case 'quote': exec('formatBlock', 'blockquote'); break;
      case 'unlink': exec('unlink'); break;
      case 'heading': {
        const n = ['buttonNameNoHeading', 'buttonNameHeading1', 'buttonNameHeading2', 'buttonNameHeading3', 'buttonNameHeading4', 'buttonNameHeading5', 'buttonNameHeading6'].indexOf(value);
        exec('formatBlock', n > 0 ? `h${n}` : 'div');
        break;
      }
      case 'ltr': case 'rtl': {
        if (!restoreRange()) break;
        selectedBlocks().forEach((b) => { b.setAttribute('dir', cmd); });
        rememberRange();
        emitChange(true);
        break;
      }
      case 'line-height': {
        if (!restoreRange()) break;
        selectedBlocks().forEach((b) => { b.style.lineHeight = String(value); });
        rememberRange();
        emitChange(true);
        break;
      }
      case 'table': {
        if (!restoreRange()) break;
        const [r, c] = String(value || '2,2').split(',');
        doc().execCommand('insertHTML', false, tbl.buildTableHtml(r, c));
        rememberRange();
        growTextItemToFit(selected);
        emitChange(true);
        break;
      }
      default:
        if (String(cmd).startsWith('table-')) return tableCommand(cmd, value);
        return false;
    }
    return true;
  }

  /** Inserts an uploaded image/video at the caret of the selected text box. `url` is the display URL (token attached). */
  async function insertInlineMedia(kind, { url, mediaId, filename }) {
    if (!selected || itemType(selected) !== 'text') { say('error', 'Select a text box first.'); return false; }
    const item = selected;
    const body = bodyOf(item);
    const geo = readGeometry(item, getCanvasSpec(canvasOf(item)));
    const natural = await probeMediaSize(kind, url);
    const maxW = Math.max(40, geo.w - 24);
    const w = Math.min(natural ? natural.w : 320, maxW);
    const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const id = mediaId != null && /^\d+$/.test(String(mediaId)) ? ` data-media-id="${mediaId}"` : '';
    const html = kind === 'image'
      ? `<img src="${esc(url)}" alt="${esc(filename || '')}"${id} data-rte-new="1" draggable="false">`
      : `<video src="${esc(url)}" controls preload="metadata" playsinline${id} data-rte-new="1"></video>`;
    if (!restoreRange()) return false;
    doc().execCommand('insertHTML', false, html);
    rememberRange();
    const media = body.querySelector('[data-rte-new]');
    if (media) {
      media.removeAttribute('data-rte-new');
      applyMedia(media, { w, ml: 0 });
      const refresh = () => { growTextItemToFit(item); updateMediaFrame(); };
      media.addEventListener('load', refresh, { once: true });
      media.addEventListener('loadedmetadata', refresh, { once: true });
      selectMedia(media);
    }
    growTextItemToFit(item);
    emitChange(true);
    return true;
  }

  /** Inserts an uploaded PDF / Office file as a download link at the caret of the selected text box. */
  function insertInlineFile({ url, mediaId, filename }) {
    if (!selected || itemType(selected) !== 'text') { say('error', 'Select a text box first.'); return false; }
    if (!restoreRange()) return false;
    const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const id = mediaId != null && /^\d+$/.test(String(mediaId)) ? ` data-media-id="${mediaId}"` : '';
    doc().execCommand('insertHTML', false, `<a href="${esc(url)}" download="${esc(filename || 'file')}"${id}>\uD83D\uDCC4 ${esc(filename || 'file')}</a>&nbsp;`);
    rememberRange();
    emitChange(true);
    return true;
  }

  function insertLink({ url, text, newTab }) {
    if (!restoreRange()) return false;
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const a = `<a href="${esc(url)}"${newTab ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(text)}</a>`;
    doc().execCommand('insertHTML', false, a);
    emitChange();
    return true;
  }

  function onPaste(e) {
    const body = e.target.closest && e.target.closest(`.${BODY_CLASS}`);
    if (!body) return;
    e.preventDefault();
    e.stopPropagation();
    const cd = e.clipboardData;
    if (!cd) return;
    const html = cd.getData('text/html');
    const text = cd.getData('text/plain');
    if (html) {
      const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS: PASTE_TAGS, ALLOWED_ATTR: ['href'] });
      doc().execCommand('insertHTML', false, clean);
    } else if (text) {
      doc().execCommand('insertText', false, text);
    }
    emitChange();
  }

  // ------------------------------------------------------------- media
  function selectedMedia(tag) {
    if (selMedia && selMedia.isConnected && selMedia.tagName.toLowerCase() === tag) return selMedia;
    if (!selected) return null;
    const t = itemType(selected);
    if (tag === 'img' && t === 'image') return selected.querySelector('img');
    if (tag === 'video' && t === 'video') return selected.querySelector('video');
    return null;
  }

  /** Re-applies a (possibly newly arrived) media token to every media element in the canvas. */
  function refreshMediaTokens(withFreshToken) {
    getCanvases().forEach((c) => {
      c.querySelectorAll('img[src], video[src]').forEach((m) => {
        const cur = m.getAttribute('src');
        Promise.resolve(withFreshToken(cur)).then((u) => { if (u && u !== cur && m.isConnected) m.setAttribute('src', u); }).catch(() => {});
      });
    });
  }

  // ------------------------------------------------------- lifecycle
  function onSelectionChange() {
    if (selected && itemType(selected) === 'text') rememberRange();
  }

  function attach() {
    const w = getWrapper();
    if (!w || attached) return;
    attached = true;
    w.addEventListener('pointerdown', onPointerDown, true);
    w.addEventListener('keydown', onKeyDown, true);
    w.addEventListener('mousedown', onMouseDownCapture, true);
    w.addEventListener('click', onClick, true);
    w.addEventListener('change', onChangeEvent, true);
    w.addEventListener('input', onInputEvent, true);
    w.addEventListener('scroll', onScrollCapture, true);
    doc().addEventListener('selectionchange', onSelectionChange);
  }

  function detach() {
    const w = getWrapper();
    if (w) {
      w.removeEventListener('pointerdown', onPointerDown, true);
      w.removeEventListener('keydown', onKeyDown, true);
      w.removeEventListener('mousedown', onMouseDownCapture, true);
      w.removeEventListener('click', onClick, true);
      w.removeEventListener('change', onChangeEvent, true);
      w.removeEventListener('input', onInputEvent, true);
      w.removeEventListener('scroll', onScrollCapture, true);
    }
    doc().removeEventListener('selectionchange', onSelectionChange);
    cancelDrag();
    clearTimeout(changeTimer);
    resizeObserver?.disconnect();
    resizeObserver = null;
    attached = false;
  }

  return {
    attach, detach, hydrate, ensureHydrated, isTextActive, applyCommand, insertInlineMedia, insertInlineFile,
    setMediaStyle, setMediaBorder, rememberRange, resizeSelectedPreset, ensureCanvas, beginTextBox, cancelMode, addImage, addVideo,
    selectItem, deselect, deleteSelected, reorder, setGeometry, patchSelected, insertLink,
    selectedMedia, refreshMediaTokens,
    getSelected: () => selected,
    getSelectedType: () => (selected ? itemType(selected) : null),
    getSelectedGeometry: () => (selected ? readGeometry(selected, getCanvasSpec(canvasOf(selected))) : null),
    getCanvasSpecOf: () => { const c = getCanvases()[0]; return c ? getCanvasSpec(c) : null; },
    hasCanvas: () => getCanvases().length > 0,
    isPlacing: () => mode === 'textbox',
  };
}
