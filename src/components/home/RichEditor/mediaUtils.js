import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';
import { isOfficePreviewable } from '@components/media/officeViewer';
import { getFileTypeIconSvg } from './fileTypeIcons';

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

/**
 * Saved html_content carries the editor's own "Remove ×" / "×" buttons
 * baked into the markup (rte-media-remove-btn and friends) — they only do
 * anything inside the editor's contenteditable surface (EditableArea.jsx's
 * delegated mousedown handler), so any read-only render of that HTML
 * (HomeCard's live Homepage render, RichEditor's own Preview panel) should
 * strip them rather than show dead, misleading controls.
 */
export function stripEditorControls(html) {
  if (!html) return html;
  const container = document.createElement('div');
  container.innerHTML = html;
  container.querySelectorAll('.rte-media-remove-btn').forEach((btn) => btn.remove());
  return container.innerHTML;
}

export function escapeAttr(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Rebuilds the PDF/attachment card's action row for read-only rendering
 * (HomeCard's live Homepage render, RichEditor's own Preview panel) as
 * View + Download, regardless of what Replace/Delete/legacy-Download
 * markup the card actually has baked into its saved html_content — the
 * editor's own Replace/Delete actions only make sense to someone editing
 * the card (who has the original file locally already); a homepage visitor
 * has neither, so they get View + Download instead. Driving this from
 * `data-src`/`data-filename` at render time (rather than baking one fixed
 * action set into the saved HTML) means every card gets the current
 * design regardless of when it was saved.
 */
function extensionOf(filename = '') {
  const match = /\.([a-z0-9]+)$/i.exec(filename || '');
  return match ? match[1].toLowerCase() : '';
}

export function rebuildPublicMediaActions(html) {
  if (!html) return html;
  const container = document.createElement('div');
  container.innerHTML = html;

  container.querySelectorAll('.rte-pdf-card').forEach((card) => {
    const icon = card.querySelector('.rte-media-card-icon');
    const nameEl = card.querySelector('.rte-media-card-name');
    const actions = card.querySelector('.rte-media-card-actions');
    const src = card.dataset.src || '';
    const filename = card.dataset.filename || 'Document.pdf';

    if (icon) icon.innerHTML = getFileTypeIconSvg('pdf');
    if (nameEl) {
      nameEl.classList.add('rte-pdf-view-trigger');
      nameEl.dataset.pdfSrc = src;
      nameEl.dataset.pdfName = filename;
    }
    if (actions) {
      actions.innerHTML =
        `<button type="button" class="rte-pdf-view-trigger media-card-action-btn media-card-action-primary" data-pdf-src="${escapeAttr(src)}" data-pdf-name="${escapeAttr(filename)}">View</button>` +
        `<a href="${escapeAttr(src)}" download="${escapeAttr(filename)}" class="media-card-action-btn">Download</a>`;
    }
  });

  container.querySelectorAll('.rte-attachment-card').forEach((card) => {
    const icon = card.querySelector('.rte-media-card-icon');
    const nameEl = card.querySelector('.rte-media-card-name');
    const actions = card.querySelector('.rte-media-card-actions');
    const src = card.dataset.src || '';
    const filename = card.dataset.filename || 'Document';
    const previewable = isOfficePreviewable(filename);

    if (icon) icon.innerHTML = getFileTypeIconSvg(extensionOf(filename));
    if (nameEl && previewable) {
      nameEl.classList.add('rte-office-view-trigger');
      nameEl.dataset.officeSrc = src;
      nameEl.dataset.officeName = filename;
    }
    if (actions) {
      const viewBtn = previewable
        ? `<button type="button" class="rte-office-view-trigger media-card-action-btn media-card-action-primary" data-office-src="${escapeAttr(src)}" data-office-name="${escapeAttr(filename)}">View</button>`
        : '';
      actions.innerHTML =
        viewBtn +
        `<a href="${escapeAttr(src)}" download="${escapeAttr(filename)}" class="media-card-action-btn">Download</a>`;
    }
  });

  return container.innerHTML;
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

/**
 * The upload endpoint returns a server-relative path (e.g.
 * "/api/dashboard/home-media/3/"). It gets embedded as a raw <img>/<video>
 * src in the saved html_content, so it must be absolute against the API
 * origin — a relative path would resolve against whatever page happens to
 * render the card instead. Mirrors the same origin-resolution convention
 * used for consultant avatar URLs in pages/Consultants/utils.js.
 */
function toAbsoluteMediaUrl(path) {
  if (!path || !path.startsWith('/')) return path;
  const apiOrigin = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api')
    .replace(/\/api\/?$/, '');
  return `${apiOrigin}${path}`;
}

/**
 * Uploads a rich-editor media file to the backend so it resolves to a
 * stable URL instead of a tab-local blob URL. Returns the shape every
 * handler's `ingestFile()` already returns: {url, filename, filesize, mime}.
 */
export async function uploadMediaFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await httpClient.post(endpoints.systemSettings.uploadHomeMedia, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const data = response.data;
  return {
    id: data.id,
    url: toAbsoluteMediaUrl(data.url),
    filename: data.filename || file.name,
    filesize: data.filesize ?? file.size,
    mime: data.mime || file.type,
  };
}

/**
 * Best-effort cleanup: removes the SFTP file + HomeMedia row for a media
 * item that's being deleted or replaced from the editor. Deliberately
 * fire-and-forget from call sites — a failed cleanup just leaves one
 * orphaned file on SFTP, which is far less disruptive than blocking the
 * user's delete/replace action on it.
 */
export async function deleteMediaFile(id) {
  if (!id) return;
  try {
    await httpClient.delete(endpoints.systemSettings.homeMediaContent(id));
  } catch {
    // Swallow — orphaned SFTP file is an acceptable trade-off here.
  }
}

let uploadPlaceholderSeq = 0;

/** Human label for the "Uploading …" placeholder, based on the file being ingested. */
export function fileKindLabel(file) {
  if (file?.type?.startsWith('image/')) return 'image';
  if (file?.type?.startsWith('video/')) return 'video';
  if (file?.type === 'application/pdf') return 'PDF';
  return 'file';
}

/**
 * `ingestFile()` now awaits a real network upload instead of resolving
 * instantly (blob URL), so callers insert this placeholder block first,
 * then swap it for the real markup (or drop it on failure) once the
 * upload settles — see RichEditor.jsx's handleRootFileSelected and
 * EditableArea.jsx's insertFileAsMarkup, the two insertion call sites.
 */
export function buildUploadingPlaceholder(kindLabel) {
  uploadPlaceholderSeq += 1;
  const id = `rte-uploading-${Date.now()}-${uploadPlaceholderSeq}`;
  const html = (
    `<div class="rte-media-uploading" id="${id}" contenteditable="false">` +
    `<span class="rte-spinner" aria-hidden="true"></span>` +
    `<span>Uploading ${escapeAttr(kindLabel)}…</span>` +
    `</div>`
  );
  return { id, html };
}
