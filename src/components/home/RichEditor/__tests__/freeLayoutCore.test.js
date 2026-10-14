// Run with:  npm run test:free-layout   (uses Node's built-in test runner, no extra deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCanvasSpec, parseGeometry, clampGeometry, geometryToStyle, geometryToAttrs,
  moveGeometry, resizeGeometry, clientDeltaToCanvas, clientPointToCanvas, fitScale,
  minCanvasHeight, nextInsertPosition, fitMediaSize, normalizeZ, reorderZ,
  isAllowedMediaSrc, sanitizeInlineStyle, hasFreeLayout, isEmptyEditorHtml,
  MIN_ITEM_W, MIN_ITEM_H, MIN_TEXT_W, MIN_TEXT_H,
} from '../freeLayoutCore.js';

const canvas = { w: 800, h: 480 };

// ------------------------------------------------------------ positioning
test('clampGeometry keeps boxes inside the canvas and above the minimum size', () => {
  assert.deepEqual(clampGeometry({ x: -50, y: -9, w: 100, h: 50, z: 1 }, canvas, 'image'), { x: 0, y: 0, w: 100, h: 50, z: 1 });
  assert.deepEqual(clampGeometry({ x: 790, y: 470, w: 100, h: 50, z: 1 }, canvas, 'image'), { x: 700, y: 430, w: 100, h: 50, z: 1 });
  const tiny = clampGeometry({ x: 0, y: 0, w: 1, h: 1, z: 1 }, canvas, 'image');
  assert.equal(tiny.w, MIN_ITEM_W);
  assert.equal(tiny.h, MIN_ITEM_H);
  const tinyText = clampGeometry({ x: 0, y: 0, w: 1, h: 1, z: 1 }, canvas, 'text');
  assert.equal(tinyText.w, MIN_TEXT_W);
  assert.equal(tinyText.h, MIN_TEXT_H);
  const huge = clampGeometry({ x: 10, y: 10, w: 5000, h: 5000, z: 1 }, canvas, 'image');
  assert.deepEqual([huge.x, huge.y, huge.w, huge.h], [0, 0, 800, 480]);
});

test('moveGeometry clamps to the canvas edges', () => {
  const start = { x: 100, y: 100, w: 200, h: 100, z: 3 };
  assert.deepEqual(moveGeometry(start, 50, -20, canvas, 'text'), { x: 150, y: 80, w: 200, h: 100, z: 3 });
  assert.deepEqual(moveGeometry(start, 9999, 9999, canvas, 'text'), { x: 600, y: 380, w: 200, h: 100, z: 3 });
  assert.deepEqual(moveGeometry(start, -9999, -9999, canvas, 'text'), { x: 0, y: 0, w: 200, h: 100, z: 3 });
});

test('resizeGeometry: edge handles resize one axis and anchor the opposite edge', () => {
  const start = { x: 100, y: 100, w: 200, h: 100, z: 1 };
  assert.deepEqual(resizeGeometry(start, 'e', 50, 0, canvas, { type: 'text' }), { x: 100, y: 100, w: 250, h: 100, z: 1 });
  const west = resizeGeometry(start, 'w', -40, 0, canvas, { type: 'text' });
  assert.deepEqual([west.x, west.w, west.y, west.h], [60, 240, 100, 100]);
  const north = resizeGeometry(start, 'n', 0, -30, canvas, { type: 'text' });
  assert.deepEqual([north.y, north.h, north.x, north.w], [70, 130, 100, 200]);
  const south = resizeGeometry(start, 's', 0, 25, canvas, { type: 'text' });
  assert.deepEqual([south.y, south.h], [100, 125]);
});

test('resizeGeometry: minimum sizes are enforced and the anchor never moves', () => {
  const start = { x: 100, y: 100, w: 200, h: 100, z: 1 };
  const shrunk = resizeGeometry(start, 'w', 5000, 0, canvas, { type: 'text' });
  assert.equal(shrunk.w, MIN_TEXT_W);
  assert.equal(shrunk.x + shrunk.w, 300); // right edge stays put
  const shortened = resizeGeometry(start, 'n', 0, 5000, canvas, { type: 'text' });
  assert.equal(shortened.h, MIN_TEXT_H);
  assert.equal(shortened.y + shortened.h, 200); // bottom edge stays put
});

test('resizeGeometry: cannot grow beyond the canvas', () => {
  const start = { x: 600, y: 380, w: 100, h: 50, z: 1 };
  const g = resizeGeometry(start, 'se', 9999, 9999, canvas, { type: 'image' });
  assert.ok(g.x + g.w <= canvas.w);
  assert.ok(g.y + g.h <= canvas.h);
  const e = resizeGeometry(start, 'e', 9999, 0, canvas, { type: 'text' });
  assert.equal(e.x + e.w, canvas.w);
});

test('resizeGeometry: corner handles keep the aspect ratio by default; Shift (keepAspect=false) is free', () => {
  const start = { x: 100, y: 100, w: 200, h: 100, z: 1 };
  for (const handle of ['nw', 'ne', 'se', 'sw']) {
    const g = resizeGeometry(start, handle, handle.includes('e') ? 60 : -60, handle.includes('s') ? 10 : -10, canvas, { type: 'image' });
    assert.ok(Math.abs(g.w / g.h - 2) < 0.03, `${handle} ratio ${g.w}/${g.h}`);
  }
  const free = resizeGeometry(start, 'se', 100, 10, canvas, { type: 'image', keepAspect: false });
  assert.deepEqual([free.w, free.h], [300, 110]);
  // anchored corner
  const nw = resizeGeometry(start, 'nw', -40, -20, canvas, { type: 'image' });
  assert.equal(nw.x + nw.w, 300);
  assert.equal(nw.y + nw.h, 200);
});

test('resizeGeometry never produces NaN/non-integers', () => {
  const g = resizeGeometry({ x: 3, y: 7, w: 101, h: 53, z: 2 }, 'se', 17.4, 9.9, canvas, { type: 'image' });
  for (const v of Object.values(g)) assert.ok(Number.isInteger(v));
});

// ------------------------------------------------- coordinates / scaling
test('client deltas and points convert to canvas pixels using the scale (not the viewport)', () => {
  assert.deepEqual(clientDeltaToCanvas(50, -20, 0.5), { dx: 100, dy: -40 });
  assert.deepEqual(clientDeltaToCanvas(50, 20, 0), { dx: 50, dy: 20 }); // guard: bad scale
  const rect = { left: 300, top: 120 }; // canvas scrolled / offset on screen
  assert.deepEqual(clientPointToCanvas(400, 170, rect, 0.5), { x: 200, y: 100 });
  assert.equal(fitScale(400, 800), 0.5);
  assert.equal(fitScale(1000, 800), 1.25);
  assert.equal(fitScale(0, 800), 1);
});

test('drag at one scale and re-render at another keeps relative position (no drift)', () => {
  // Drag by 40 screen px while the canvas is shown at 0.5 => 80 design px.
  const moved = moveGeometry({ x: 100, y: 60, w: 200, h: 100, z: 1 }, ...Object.values(clientDeltaToCanvas(40, 0, 0.5)).map(Math.round), canvas, 'text');
  assert.equal(moved.x, 180);
  // Persist -> parse -> persist 25 times must be a fixed point.
  let g = moved;
  for (let i = 0; i < 25; i += 1) {
    const attrs = geometryToAttrs(g);
    g = parseGeometry({ x: attrs['data-x'], y: attrs['data-y'], w: attrs['data-w'], h: attrs['data-h'], z: attrs['data-z'] }, canvas, 'text');
  }
  assert.deepEqual(g, moved);
});

// ---------------------------------------------------------- serialisation
test('parseGeometry validates untrusted attributes', () => {
  assert.deepEqual(parseGeometry({ x: '10', y: '20', w: '300', h: '150', z: '4' }, canvas, 'text'), { x: 10, y: 20, w: 300, h: 150, z: 4 });
  assert.equal(parseGeometry({ x: '10', y: '20', w: 'abc', h: '150' }, canvas, 'text'), null);
  assert.equal(parseGeometry({ x: '10', y: '20', h: '150' }, canvas, 'text'), null);
  assert.equal(parseGeometry(null, canvas, 'text'), null);
  // out-of-range / hostile numbers are clamped, not trusted
  const hostile = parseGeometry({ x: '-99999', y: '99999999', w: '1e9', h: '1', z: '999999999' }, canvas, 'image');
  assert.ok(hostile.x >= 0 && hostile.x + hostile.w <= canvas.w);
  assert.ok(hostile.y >= 0 && hostile.y + hostile.h <= canvas.h);
  assert.ok(hostile.z <= 9999);
});

test('parseCanvasSpec falls back to safe defaults', () => {
  assert.deepEqual(parseCanvasSpec('800', '480'), { w: 800, h: 480 });
  assert.deepEqual(parseCanvasSpec(undefined, null), { w: 800, h: 480 });
  assert.deepEqual(parseCanvasSpec('1', '1'), { w: 200, h: 120 });
  assert.deepEqual(parseCanvasSpec('99999', '99999'), { w: 2000, h: 4000 });
});

test('geometryToStyle only ever emits numeric absolute positioning', () => {
  assert.equal(geometryToStyle({ x: 10, y: 20, w: 300, h: 150, z: 4 }), 'position:absolute;left:10px;top:20px;width:300px;height:150px;z-index:4;');
});

test('hasFreeLayout / isEmptyEditorHtml', () => {
  assert.equal(hasFreeLayout('<p>hi</p>'), false);
  assert.equal(hasFreeLayout('<div data-rte-canvas="1"></div>'), true);
  assert.equal(hasFreeLayout(null), false);
  assert.equal(isEmptyEditorHtml('<p><br></p>'), true);
  assert.equal(isEmptyEditorHtml('<p>x</p>'), false);
});

test('minCanvasHeight / insert helpers', () => {
  assert.equal(minCanvasHeight([{ y: 300, h: 100 }, { y: 10, h: 20 }]), 400);
  assert.equal(minCanvasHeight([]), 120);
  const a = nextInsertPosition(0, { w: 100, h: 50 }, canvas);
  const b = nextInsertPosition(1, { w: 100, h: 50 }, canvas);
  assert.notDeepEqual([a.x, a.y], [b.x, b.y]);
  assert.deepEqual(fitMediaSize({ w: 2000, h: 1000 }, 400, 300), { w: 400, h: 200 });
  assert.deepEqual(fitMediaSize({ w: 100, h: 50 }, 400, 300), { w: 100, h: 50 }); // never upscaled
  assert.deepEqual(fitMediaSize(null, 400, 300), { w: 320, h: 180 });
});

// ---------------------------------------------------------------- z-order
test('reorderZ gives a predictable stacking order', () => {
  const items = [{ id: 'a', z: 1 }, { id: 'b', z: 2 }, { id: 'c', z: 3 }];
  const order = (list) => list.slice().sort((x, y) => x.z - y.z).map((i) => i.id).join('');
  assert.equal(order(reorderZ(items, 'a', 'front')), 'bca');
  assert.equal(order(reorderZ(items, 'c', 'back')), 'cab');
  assert.equal(order(reorderZ(items, 'a', 'forward')), 'bac');
  assert.equal(order(reorderZ(items, 'c', 'backward')), 'acb');
  assert.equal(order(reorderZ(items, 'c', 'forward')), 'abc'); // already on top
  assert.equal(order(reorderZ(items, 'a', 'backward')), 'abc'); // already at bottom
  assert.deepEqual(reorderZ(items, 'b', 'front').map((i) => i.z).sort(), [1, 2, 3]); // renumbered 1..n
  assert.deepEqual(normalizeZ([{ id: 'x', z: 40 }, { id: 'y', z: 7 }]).map((i) => [i.id, i.z]), [['y', 1], ['x', 2]]);
});

// ------------------------------------------------------------ media URLs
const origins = ['https://toss.example.com', 'http://127.0.0.1:8000'];

test('isAllowedMediaSrc accepts only the HomeMedia endpoint', () => {
  assert.equal(isAllowedMediaSrc('/api/dashboard/home-media/12/', origins), true);
  assert.equal(isAllowedMediaSrc('/api/dashboard/home-media/12', origins), true);
  assert.equal(isAllowedMediaSrc('https://toss.example.com/api/dashboard/home-media/3/', origins), true);
  assert.equal(isAllowedMediaSrc('http://127.0.0.1:8000/api/dashboard/home-media/3/?media_token=abc.DEF-_:12', origins), true);
});

test('isAllowedMediaSrc rejects base64, blob, scripts, foreign hosts and extra params', () => {
  for (const bad of [
    'data:image/png;base64,AAAA',
    'blob:https://toss.example.com/1234',
    'javascript:alert(1)',
    'https://evil.example.com/api/dashboard/home-media/3/',
    '//evil.example.com/api/dashboard/home-media/3/',
    '/api/dashboard/home-media/abc/',
    '/api/dashboard/home-data/',
    '/api/dashboard/home-media/3/../../x',
    '/api/dashboard/home-media/3/?media_token=abc&x=1',
    '/api/dashboard/home-media/3/?next=http://evil',
    'https://toss.example.com/api/dashboard/home-media/3/"onerror=alert(1)',
    '',
    null,
    undefined,
  ]) {
    assert.equal(isAllowedMediaSrc(bad, origins), false, String(bad));
  }
});

// ------------------------------------------------------- style sanitising
test('sanitizeInlineStyle keeps legitimate text formatting', () => {
  const css = 'color: #ff0000; font-size: 24px; font-family: Georgia, serif; font-weight: 700; text-align: center; text-decoration: underline';
  assert.equal(
    sanitizeInlineStyle(css, 'text'),
    'color: #ff0000; font-size: 24px; font-family: Georgia, serif; font-weight: 700; text-align: center; text-decoration: underline;'
  );
});

test('sanitizeInlineStyle drops positioning, resources and viewport-relative sizes', () => {
  const css = 'position: fixed; top: 0; left: 0; z-index: 99999; inset: 0; width: 100vw; height: 100vh; color: red; background: url(https://evil/x.png); behavior: url(x); transform: scale(9)';
  assert.equal(sanitizeInlineStyle(css, 'text'), 'color: red;');
  assert.equal(sanitizeInlineStyle('color: expression(alert(1)); font-size: 12px', 'text'), 'font-size: 12px;');
  assert.equal(sanitizeInlineStyle('width: 50vw', 'text'), '');
  assert.equal(sanitizeInlineStyle(null, 'text'), '');
});

test('sanitizeInlineStyle image mode allows only safe transforms / shadow / border', () => {
  assert.equal(sanitizeInlineStyle('transform: rotate(90deg)', 'image'), 'transform: rotate(90deg);');
  assert.equal(sanitizeInlineStyle('transform: scaleX(-1)', 'image'), 'transform: scaleX(-1);');
  assert.equal(sanitizeInlineStyle('transform: translate(9999px, 9999px)', 'image'), '');
  assert.equal(sanitizeInlineStyle('transform: rotate(90deg) url(x)', 'image'), '');
  assert.equal(sanitizeInlineStyle('width: 9999px; box-shadow: 2px 2px 5px rgba(0,0,0,0.5)', 'image'), 'box-shadow: 2px 2px 5px rgba(0,0,0,0.5);');
});

test('sanitizeInlineStyle inline-media mode keeps sizing but nothing that repositions or loads', () => {
  assert.equal(
    sanitizeInlineStyle('width: 240px; max-width: 100%; height: auto; border-radius: 6px', 'inline'),
    'width: 240px; max-width: 100%; height: auto; border-radius: 6px;'
  );
  assert.equal(sanitizeInlineStyle('position: fixed; top: 0; width: 100vw; background: url(x)', 'inline'), '');
  assert.equal(sanitizeInlineStyle('transform: rotate(90deg)', 'inline'), 'transform: rotate(90deg);');
  assert.equal(sanitizeInlineStyle('transform: translateX(900px)', 'inline'), '');
});

test('text-box colour and background declarations are preserved', () => {
  assert.equal(
    sanitizeInlineStyle('color: rgb(200, 38, 19); background-color: rgb(245, 212, 39)', 'text'),
    'color: rgb(200, 38, 19); background-color: rgb(245, 212, 39);'
  );
});

test('inline media may be placed as a block with a left margin, but not arbitrary display values', () => {
  assert.equal(sanitizeInlineStyle('display: block; margin-left: 40px; width: 200px; height: auto', 'inline'), 'display: block; margin-left: 40px; width: 200px; height: auto;');
  assert.equal(sanitizeInlineStyle('display: flex', 'inline'), '');
  assert.equal(sanitizeInlineStyle('display: none', 'inline'), '');
});
