/**
 * Free-layout canvas — pure logic (no DOM, no imports) so it can be unit
 * tested with `node --test`.
 *
 * COORDINATE SYSTEM (the contract between editor, saved HTML and HomeCard)
 * ------------------------------------------------------------------------
 * A canvas is a fixed-size "design surface" measured in design pixels:
 *     data-w  = design width  (default 800)
 *     data-h  = design height (default 480, user-adjustable)
 * Every positioned item stores integers relative to the canvas' top-left:
 *     data-x, data-y  = top-left corner of the item
 *     data-w, data-h  = item size
 *     data-z          = stacking order (1 = back, higher = in front)
 * The origin is the canvas, never the viewport, so scrolling, editor zoom and
 * browser resizes cannot affect stored values. At display time the whole
 * canvas is scaled uniformly (scale = rendered width / design width), which
 * keeps every element at the same *relative* position and size whatever
 * width the card is rendered at (50% / 100% card, desktop / mobile).
 */

export const CANVAS_CLASS = 'rte-canvas';
export const STAGE_CLASS = 'rte-canvas-stage';
export const ITEM_CLASS = 'rte-abs';
export const BODY_CLASS = 'rte-abs-body';

export const DEFAULT_CANVAS_W = 800;
export const DEFAULT_CANVAS_H = 480;
export const MIN_CANVAS_W = 200;
export const MAX_CANVAS_W = 2000;
export const MIN_CANVAS_H = 120;
export const MAX_CANVAS_H = 4000;

export const MIN_ITEM_W = 40;
export const MIN_ITEM_H = 24;
export const MIN_TEXT_W = 60;
export const MIN_TEXT_H = 32;
export const MAX_Z = 9999;

export const ITEM_TYPES = ['text', 'image', 'video'];
export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function hasFreeLayout(html) {
  return typeof html === 'string' && html.indexOf('data-rte-canvas') !== -1;
}

export function toInt(value, fallback) {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

export function clamp(value, min, max) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/** Validates the canvas' own data-w / data-h. */
export function parseCanvasSpec(rawW, rawH) {
  return {
    w: clamp(toInt(rawW, DEFAULT_CANVAS_W), MIN_CANVAS_W, MAX_CANVAS_W),
    h: clamp(toInt(rawH, DEFAULT_CANVAS_H), MIN_CANVAS_H, MAX_CANVAS_H),
  };
}

export function minSizeFor(type) {
  return type === 'text' ? { w: MIN_TEXT_W, h: MIN_TEXT_H } : { w: MIN_ITEM_W, h: MIN_ITEM_H };
}

/**
 * Keeps a box inside the canvas and above the minimum size. Size is clamped
 * first (a box can never be larger than the canvas), then the position.
 */
export function clampGeometry(g, canvas, type = 'image') {
  const min = minSizeFor(type);
  const w = clamp(toInt(g.w, min.w), min.w, canvas.w);
  const h = clamp(toInt(g.h, min.h), min.h, canvas.h);
  const x = clamp(toInt(g.x, 0), 0, canvas.w - w);
  const y = clamp(toInt(g.y, 0), 0, canvas.h - h);
  const z = clamp(toInt(g.z, 1), 1, MAX_Z);
  return { x, y, w, h, z };
}

/**
 * Reads untrusted attribute strings and returns a safe geometry, or null if
 * the item has no usable size at all. Missing/garbled values fall back to
 * safe defaults instead of throwing, so old or hand-edited HTML still renders.
 */
export function parseGeometry(attrs, canvas, type) {
  const min = minSizeFor(type);
  if (!attrs) return null;
  const w = toInt(attrs.w, NaN);
  const h = toInt(attrs.h, NaN);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return clampGeometry(
    { x: toInt(attrs.x, 0), y: toInt(attrs.y, 0), w: Math.max(w, min.w), h: Math.max(h, min.h), z: toInt(attrs.z, 1) },
    canvas,
    type
  );
}

export function geometryToAttrs(g) {
  return { 'data-x': String(g.x), 'data-y': String(g.y), 'data-w': String(g.w), 'data-h': String(g.h), 'data-z': String(g.z) };
}

/** The ONLY inline style an item gets; it is always rebuilt from validated numbers. */
export function geometryToStyle(g) {
  return `position:absolute;left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px;z-index:${g.z};`;
}

export function moveGeometry(start, dx, dy, canvas, type) {
  return clampGeometry({ ...start, x: start.x + dx, y: start.y + dy }, canvas, type);
}

/**
 * Resizes `start` by dragging `handle` by (dx, dy) *in canvas pixels*.
 * - Corner handles keep the aspect ratio (unless `keepAspect` is false).
 * - Edge handles resize on one axis only.
 * - The opposite edge/corner stays anchored, minimum sizes are enforced and
 *   the result never leaves the canvas.
 */
export function resizeGeometry(start, handle, dx, dy, canvas, { type = 'image', keepAspect } = {}) {
  const min = minSizeFor(type);
  const isCorner = handle.length === 2;
  const lockAspect = keepAspect === undefined ? isCorner : keepAspect && isCorner;
  const aspect = start.w / (start.h || 1);

  const west = handle.includes('w');
  const east = handle.includes('e');
  const north = handle.includes('n');
  const south = handle.includes('s');

  // Bounds the box may grow into, given which edges are anchored.
  const maxW = east ? canvas.w - start.x : west ? start.x + start.w : start.w;
  const maxH = south ? canvas.h - start.y : north ? start.y + start.h : start.h;

  let w = start.w;
  let h = start.h;
  if (east) w = start.w + dx;
  if (west) w = start.w - dx;
  if (south) h = start.h + dy;
  if (north) h = start.h - dy;

  if (lockAspect) {
    // Follow whichever axis the pointer moved proportionally further on.
    const byW = Math.abs(w - start.w) / (start.w || 1);
    const byH = Math.abs(h - start.h) / (start.h || 1);
    if (byW >= byH) h = w / aspect;
    else w = h * aspect;

    // Clamp both axes against the bounds and minimums while keeping the ratio.
    const minScale = Math.max(min.w / start.w, min.h / start.h);
    const maxScale = Math.min(maxW / start.w, maxH / start.h);
    const scale = clamp(w / start.w, minScale, Math.max(minScale, maxScale));
    w = start.w * scale;
    h = start.h * scale;
  } else {
    if (east || west) w = clamp(w, min.w, maxW);
    if (south || north) h = clamp(h, min.h, maxH);
  }

  w = Math.round(w);
  h = Math.round(h);
  const x = west ? start.x + start.w - w : start.x;
  const y = north ? start.y + start.h - h : start.y;
  return clampGeometry({ x, y, w, h, z: start.z }, canvas, type);
}

/** Pointer delta in viewport pixels -> canvas design pixels. */
export function clientDeltaToCanvas(dxClient, dyClient, scale) {
  const s = scale > 0 ? scale : 1;
  return { dx: dxClient / s, dy: dyClient / s };
}

/** Viewport point -> canvas design point, given the stage's bounding rect. */
export function clientPointToCanvas(clientX, clientY, rect, scale) {
  const s = scale > 0 ? scale : 1;
  return { x: (clientX - rect.left) / s, y: (clientY - rect.top) / s };
}

/** Uniform scale that fits the design width into the available width. */
export function fitScale(availableWidth, designWidth) {
  if (!(availableWidth > 0) || !(designWidth > 0)) return 1;
  return availableWidth / designWidth;
}

/** Smallest canvas height that still contains every item (+ optional padding). */
export function minCanvasHeight(items, padding = 0) {
  let bottom = 0;
  for (const it of items) bottom = Math.max(bottom, it.y + it.h);
  return clamp(bottom + padding, MIN_CANVAS_H, MAX_CANVAS_H);
}

/** Default position for a newly inserted item: cascades so items don't stack exactly. */
export function nextInsertPosition(existingCount, size, canvas) {
  const step = 24;
  const offset = (existingCount % 8) * step;
  return clampGeometry({ x: 24 + offset, y: 24 + offset, w: size.w, h: size.h, z: 1 }, canvas, 'image');
}

/** Fits a natural media size into a max box, preserving aspect ratio. */
export function fitMediaSize(natural, maxW, maxH) {
  const nw = natural && natural.w > 0 ? natural.w : 320;
  const nh = natural && natural.h > 0 ? natural.h : 180;
  const scale = Math.min(1, maxW / nw, maxH / nh);
  return { w: Math.max(MIN_ITEM_W, Math.round(nw * scale)), h: Math.max(MIN_ITEM_H, Math.round(nh * scale)) };
}

// ---------------------------------------------------------------- z-order

/** items: [{ id, z }] -> same list with z renumbered 1..n in stacking order. */
export function normalizeZ(items) {
  return [...items]
    .sort((a, b) => (a.z - b.z) || 0)
    .map((it, i) => ({ ...it, z: i + 1 }));
}

/** Returns new [{id, z}] after moving `id` within the stack. `op`: front | back | forward | backward */
export function reorderZ(items, id, op) {
  const ordered = normalizeZ(items);
  const idx = ordered.findIndex((i) => i.id === id);
  if (idx === -1) return ordered;
  const [moved] = ordered.splice(idx, 1);
  let target = idx;
  if (op === 'front') target = ordered.length;
  else if (op === 'back') target = 0;
  else if (op === 'forward') target = Math.min(idx + 1, ordered.length);
  else if (op === 'backward') target = Math.max(idx - 1, 0);
  ordered.splice(target, 0, moved);
  return ordered.map((it, i) => ({ ...it, z: i + 1 }));
}

// ------------------------------------------------------------ media / style

const MEDIA_PATH = /^\/api\/dashboard\/home-media\/\d+\/?$/;

/**
 * Free-layout images/videos may only reference the app's own HomeMedia
 * endpoint (optionally carrying a media_token, which the renderer adds and
 * the editor strips). `data:`, `blob:`, `javascript:` and foreign hosts are
 * rejected. `allowedOrigins` lists origins permitted for absolute URLs.
 */
export function isAllowedMediaSrc(url, allowedOrigins = []) {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed || /[\s<>"'`\\]/.test(trimmed)) return false;

  let rest = trimmed;
  const abs = /^(https?:\/\/[^/?#]+)(.*)$/i.exec(trimmed);
  if (abs) {
    if (!allowedOrigins.some((o) => o && o.toLowerCase() === abs[1].toLowerCase())) return false;
    rest = abs[2];
  } else if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return false;
  }

  const q = rest.search(/[?#]/);
  const path = q === -1 ? rest : rest.slice(0, q);
  const suffix = q === -1 ? '' : rest.slice(q);
  if (!MEDIA_PATH.test(path)) return false;
  if (suffix === '') return true;
  // Only a (possibly empty) media_token query is acceptable.
  return /^\?media_token=[A-Za-z0-9_\-.:]*$/.test(suffix);
}

const TEXT_STYLE_PROPS = new Set([
  'color', 'background', 'background-color',
  'font', 'font-family', 'font-size', 'font-weight', 'font-style', 'font-variant',
  'text-align', 'text-decoration', 'text-decoration-line', 'text-decoration-style', 'text-decoration-color',
  'text-indent', 'text-transform', 'letter-spacing', 'word-spacing', 'line-height', 'vertical-align',
  'white-space', 'word-break', 'overflow-wrap', 'direction',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-color', 'border-style', 'border-width', 'border-radius', 'border-collapse',
  'list-style', 'list-style-type', 'list-style-position',
  'width', 'height', 'min-width', 'max-width', 'min-height', 'max-height',
]);

const IMAGE_STYLE_PROPS = new Set(['transform', 'box-shadow', 'border', 'border-radius', 'border-color', 'border-style', 'border-width']);
// Inline <img>/<video> inside a text box: sizing + cosmetic props only.
const INLINE_MEDIA_STYLE_PROPS = new Set([
  'width', 'height', 'max-width', 'max-height', 'min-width', 'min-height',
  'transform', 'box-shadow', 'border', 'border-radius', 'border-color', 'border-style', 'border-width',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'vertical-align', 'object-fit', 'display',
]);
const SAFE_TRANSFORM = /^(?:\s*(?:rotate\(-?\d{1,3}(?:\.\d+)?deg\)|scale(?:X|Y)?\(-?\d(?:\.\d+)?\))\s*)+$/;
const SAFE_VALUE_BLOCKLIST = /url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding|\\|<|>/i;

/**
 * Filters an inline style attribute against an allowlist. Anything that could
 * reposition an element out of its box (position, inset, top/left, z-index,
 * transform on text, fixed sizes in vw/vh ...) or load a resource (url()) is
 * dropped. `kind`: 'text' (content inside a text box) | 'image' | 'inline' (media inside a text box).
 */
export function sanitizeInlineStyle(cssText, kind = 'text') {
  if (!cssText || typeof cssText !== 'string') return '';
  const allow = kind === 'image' ? IMAGE_STYLE_PROPS : kind === 'inline' ? INLINE_MEDIA_STYLE_PROPS : TEXT_STYLE_PROPS;
  const out = [];
  for (const decl of cssText.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    let value = decl.slice(idx + 1).trim();
    if (!prop || !value) continue;
    const important = /!\s*important\s*$/i.test(value);
    value = value.replace(/!\s*important\s*$/i, '').trim();
    if (SAFE_VALUE_BLOCKLIST.test(value)) continue;
    if ((kind === 'image' || kind === 'inline') && prop === 'transform') {
      if (!SAFE_TRANSFORM.test(value)) continue;
    } else if (!allow.has(prop)) {
      continue;
    }
    if (prop === 'display' && !/^(block|inline-block|inline)$/i.test(value)) continue;
    // Viewport units would escape the card's coordinate system.
    if (/\d(?:vw|vh|vmin|vmax)\b/i.test(value)) continue;
    out.push(`${prop}: ${value}${important ? ' !important' : ''}`);
  }
  return out.length ? `${out.join('; ')};` : '';
}

export function isEmptyEditorHtml(html) {
  const t = (html || '').trim();
  return !t || t === '<div><br></div>' || t === '<p><br></p>' || t === '<br>';
}
