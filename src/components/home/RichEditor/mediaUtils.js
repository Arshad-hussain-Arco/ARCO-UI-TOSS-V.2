/**
 * Shared low-level helper reused by ImageHandler / VideoHandler / PdfHandler
 * / AttachmentHandler. Kept separate so each handler's `ingestFile()` stays
 * a one-line body today (read as base64) and a one-line body later (POST to
 * a real upload endpoint) — no other call site needs to change either way.
 */
export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function escapeAttr(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Client-side size guard — base64 inflates payload ~33% and everything
 * here lives in one CLOB field, so large video/PDF/attachment uploads are
 * rejected with a message rather than silently bloating the saved card.
 */
export function assertWithinSizeLimit(file, maxMb) {
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(`"${file.name}" is ${formatFileSize(file.size)} — the limit is ${maxMb}MB.`);
  }
}
