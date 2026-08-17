/**
 * Local, in-browser rendering for Office file types the RichEditor lets
 * admins attach (xlsx/xls, docx, pptx). Deliberately no third-party viewer
 * service (no Google Docs Viewer / Office Online embed, which would ship
 * the file to an external host) — everything here parses the file's own
 * bytes client-side.
 *
 * Legacy binary formats (.doc, .ppt — pre-2007, not zip-based) aren't
 * supported: mammoth only reads .docx, and there's no lightweight pure-JS
 * reader for the old binary PPT format. Those report `unsupported: true`
 * so the caller can show a plain fallback instead of a fake empty preview.
 */
// Dynamically imported inside each render*() function below, not at module
// top-level — mammoth/jszip/xlsx together are ~500KB, and every page that
// ever imports MediaViewerModal (e.g. the Home page, just to view a PDF)
// would otherwise eagerly download all three even if no one ever previews
// an Office file.

export function getExtension(filename = '') {
  const match = /\.([a-z0-9]+)$/i.exec(filename || '');
  return match ? match[1].toLowerCase() : '';
}

/** xlsx/xls -> an HTML table per sheet, tab-labeled by sheet name. */
export async function renderSpreadsheetToHtml(arrayBuffer) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const table = XLSX.utils.sheet_to_html(sheet, { id: undefined, editable: false });
    return `<section class="office-sheet"><h4 class="office-sheet-title">${escapeHtml(name)}</h4>${table}</section>`;
  }).join('');
}

/** docx -> HTML via mammoth's own style mapping (headings, lists, bold/italic, tables). */
export async function renderDocxToHtml(arrayBuffer) {
  const { default: mammoth } = await import('mammoth');
  const { value } = await mammoth.convertToHtml({ arrayBuffer });
  return value;
}

/**
 * pptx -> a plain per-slide text outline. PPTX is a zip of per-slide XML;
 * this walks ppt/slides/slideN.xml in order and pulls every <a:t> text run.
 * It's a readable outline, not a visual reproduction of the slide layout —
 * there's no lightweight pure-JS pptx renderer that reproduces layout/
 * images/theming, and pulling one in would be a heavy, fragile dependency
 * for what's fundamentally a "preview text content" need.
 */
export async function renderPptxOutline(arrayBuffer) {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(arrayBuffer);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml$/)[1], 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml$/)[1], 10);
      return numA - numB;
    });

  if (slideFiles.length === 0) {
    throw new Error('No slides found in this presentation.');
  }

  const parser = new DOMParser();
  const slidesHtml = await Promise.all(
    slideFiles.map(async (fileName, index) => {
      const xml = await zip.files[fileName].async('text');
      const doc = parser.parseFromString(xml, 'application/xml');
      const textNodes = Array.from(doc.getElementsByTagNameNS('*', 't'));
      const lines = textNodes.map((n) => n.textContent.trim()).filter(Boolean);
      const body = lines.length
        ? `<ul class="office-slide-lines">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
        : '<p class="office-slide-empty">(No text content on this slide)</p>';
      return `<section class="office-slide"><h4 class="office-slide-title">Slide ${index + 1}</h4>${body}</section>`;
    })
  );

  return slidesHtml.join('');
}

const UNSUPPORTED_EXTENSIONS = new Set(['doc', 'ppt']);

export function isUnsupportedLegacyFormat(filename) {
  return UNSUPPORTED_EXTENSIONS.has(getExtension(filename));
}

export function isOfficePreviewable(filename) {
  return ['xlsx', 'xls', 'docx', 'pptx'].includes(getExtension(filename));
}

/**
 * Dispatches to the right renderer for filename's extension. Returns HTML
 * ready to be sanitized by the caller before dangerouslySetInnerHTML.
 */
export async function renderOfficeFileToHtml(arrayBuffer, filename) {
  const ext = getExtension(filename);
  if (ext === 'xlsx' || ext === 'xls') return renderSpreadsheetToHtml(arrayBuffer);
  if (ext === 'docx') return renderDocxToHtml(arrayBuffer);
  if (ext === 'pptx') return renderPptxOutline(arrayBuffer);
  throw new Error(`Preview not supported for .${ext} files.`);
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
