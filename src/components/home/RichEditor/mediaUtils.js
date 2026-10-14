import { useEffect, useState } from 'react';
import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';
import { env } from '@config/env';
import { isOfficePreviewable } from '@components/media/officeViewer';
import { getFileTypeIconSvg } from './fileTypeIcons';
import { createInertContainer } from './freeLayoutDom';

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
  const container = createInertContainer();
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
  const container = createInertContainer();
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
export function toAbsoluteMediaUrl(path) {
  if (!path || !path.startsWith('/')) return path;
  const apiOrigin = env.apiBaseUrl.replace(/\/api\/?$/, '');
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
/**
 * HomeMediaContentView's GET is AllowAny at the DRF layer (a plain
 * <img>/<video> tag request can't carry our JWT header) but requires a
 * short-lived signed `media_token` query param instead (see backend
 * dashboard/media_tokens.py) — minted only via an IsAuthenticated endpoint,
 * so holding one is proof of the same "logged-in employee" check every
 * other Homepage endpoint uses. This fetches it once per session (shared
 * across every HomeCard instance) and refetches automatically once it's
 * past its safety margin.
 */
let _cachedMediaToken = null;
let _cachedMediaTokenExpiresAt = 0;
let _mediaTokenPromise = null;

export async function getHomeMediaToken() {
  const now = Date.now();
  if (_cachedMediaToken && now < _cachedMediaTokenExpiresAt) {
    return _cachedMediaToken;
  }
  if (_mediaTokenPromise) return _mediaTokenPromise;

  _mediaTokenPromise = (async () => {
    try {
      const response = await httpClient.get(endpoints.systemSettings.homeMediaToken);
      const { token, expires_in: expiresIn } = response.data;
      _cachedMediaToken = token;
      // Refresh a bit before actual expiry rather than racing it.
      _cachedMediaTokenExpiresAt = Date.now() + Math.max((expiresIn - 60) * 1000, 0);
      return token;
    } finally {
      _mediaTokenPromise = null;
    }
  })();
  return _mediaTokenPromise;
}

const HOME_MEDIA_URL_PATTERN = /\/api\/dashboard\/home-media\/\d+\/(?:[?#]|$)/;

/** Strips any existing `media_token` param from a single URL string, leaving other params/URL shape intact. */
function stripMediaTokenFromUrl(url) {
  if (!url || !url.includes('media_token=')) return url;
  return url
    .replace(/([?&])media_token=[^&#]*&/, '$1')
    .replace(/[?&]media_token=[^&#]*(?=[#]|$)/, (m) => (m[0] === '?' ? '?' : ''))
    .replace(/\?$/, '');
}

// Idempotent — safe to call on a URL that may already carry a (possibly
// stale) token, so re-tokenizing never produces duplicate media_token
// params or leaves an old one sitting alongside a new one.
function appendMediaToken(url, token) {
  if (!url || !token || !HOME_MEDIA_URL_PATTERN.test(url)) return url;
  const bare = stripMediaTokenFromUrl(url);
  return bare.includes('?') ? `${bare}&media_token=${token}` : `${bare}?media_token=${token}`;
}

/**
 * Rewrites every home-media reference in rich-text HTML to carry the
 * current session's media_token — done at render time, never at save time,
 * so the stored html_content stays a stable bare URL and doesn't go stale
 * when the token expires. Covers every shape rebuildPublicMediaActions()/
 * deferPublicVideoLoad() produce: video src, <source> data-video-src,
 * the pdf/office card's own data-src, and the View/Download actions
 * rebuildPublicMediaActions() rebuilds from it (data-pdf-src,
 * data-office-src, and the Download anchor's href).
 */
export function attachHomeMediaToken(html, token) {
  if (!html || !token) return html;
  const container = createInertContainer();
  container.innerHTML = html;

  container.querySelectorAll('video[data-video-src], source[data-video-src]').forEach((el) => {
    el.setAttribute('data-video-src', appendMediaToken(el.getAttribute('data-video-src'), token));
  });
  container.querySelectorAll('video[src], source[src], img[src]').forEach((el) => {
    el.setAttribute('src', appendMediaToken(el.getAttribute('src'), token));
  });
  container.querySelectorAll('a[href]').forEach((el) => {
    el.setAttribute('href', appendMediaToken(el.getAttribute('href'), token));
  });
  container.querySelectorAll('[data-src]').forEach((el) => {
    el.setAttribute('data-src', appendMediaToken(el.getAttribute('data-src'), token));
  });
  container.querySelectorAll('[data-pdf-src]').forEach((el) => {
    el.setAttribute('data-pdf-src', appendMediaToken(el.getAttribute('data-pdf-src'), token));
  });
  container.querySelectorAll('[data-office-src]').forEach((el) => {
    el.setAttribute('data-office-src', appendMediaToken(el.getAttribute('data-office-src'), token));
  });

  return container.innerHTML;
}

const TOKENIZABLE_SELECTOR = [
  'video[data-video-src]', 'source[data-video-src]',
  'video[src]', 'source[src]', 'img[src]',
  'a[href]', '[data-src]', '[data-pdf-src]', '[data-office-src]',
].join(', ');
const TOKENIZABLE_ATTRS = ['data-video-src', 'src', 'href', 'data-src', 'data-pdf-src', 'data-office-src'];

/**
 * Inverse of attachHomeMediaToken — strips `media_token` back out of every
 * home-media reference. The Rich Text Editor displays tokenized URLs in its
 * live contenteditable DOM (so images/videos/PDFs actually load while
 * editing) but must never persist a token into the saved html_content: it
 * expires, and baking one in would make the card break itself later.
 * RichEditor.jsx calls this on every outward sync (flushOutwardNow).
 */
/**
 * Awaits a CONFIRMED token (not whatever mediaToken state happens to be
 * mid-render) and returns `url` with it applied — idempotent, so it's safe
 * to call on a URL that may already carry a stale/missing token. Use this
 * at the moment of actually playing/opening media (click handlers), not at
 * render time, to close the race where a component renders with the token
 * still in flight and mounts a request that's doomed to 401.
 */
export async function withFreshMediaToken(url) {
  const token = await getHomeMediaToken();
  return appendMediaToken(url, token);
}

export function stripHomeMediaToken(html) {
  if (!html || !html.includes('media_token=')) return html;
  const container = createInertContainer();
  container.innerHTML = html;

  container.querySelectorAll(TOKENIZABLE_SELECTOR).forEach((el) => {
    TOKENIZABLE_ATTRS.forEach((attr) => {
      const value = el.getAttribute(attr);
      if (value) el.setAttribute(attr, stripMediaTokenFromUrl(value));
    });
  });

  return container.innerHTML;
}

/** Shared by every HomeCard/Preview instance — one token fetch per session, not one per card. */
export function useHomeMediaToken() {
  const [token, setToken] = useState(_cachedMediaToken);

  useEffect(() => {
    let cancelled = false;
    getHomeMediaToken().then((t) => {
      if (!cancelled) setToken(t);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return token;
}

export async function deleteMediaFile(id) {
  if (!id) return;
  try {
    await httpClient.delete(endpoints.systemSettings.homeMediaContent(id));
  } catch {
    // Swallow — orphaned SFTP file is an acceptable trade-off here.
  }
}

/**
 * Rich-text video embeds must not auto-fetch on homepage load — a page with
 * several video cards would otherwise fire one full/range GET per video the
 * instant the HTML is injected via dangerouslySetInnerHTML (the browser
 * starts loading a <video> as soon as it's attached to the DOM, even with
 * no user interaction). This strips `src`/`<source src>` into
 * `data-video-src` and forces preload="none", replacing the network-visible
 * markup with an inert one until the reader explicitly presses Play — wired
 * up by HomeCard's click handler for `.rte-video-play-trigger`.
 */
export function deferPublicVideoLoad(html) {
  if (!html) return html;
  const container = createInertContainer();
  container.innerHTML = html;

  container.querySelectorAll('video').forEach((video) => {
    if (video.closest('.rte-video-lazy-wrap')) return;

    video.removeAttribute('autoplay');
    video.setAttribute('preload', 'none');

    const src = video.getAttribute('src');
    if (src) {
      video.removeAttribute('src');
      video.setAttribute('data-video-src', src);
    }
    video.querySelectorAll('source').forEach((source) => {
      const sourceSrc = source.getAttribute('src');
      if (sourceSrc) {
        source.removeAttribute('src');
        source.setAttribute('data-video-src', sourceSrc);
      }
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'rte-video-lazy-wrap';
    // A video placed inside a free text box carries its own size / horizontal
    // offset; move those onto the wrapper (which is what the lazy loader
    // lays out) and let the video fill it.
    if (video.closest('.rte-abs-body')) {
      const { width, marginLeft } = video.style;
      if (width) wrapper.style.width = width;
      if (marginLeft) wrapper.style.marginLeft = marginLeft;
      wrapper.style.maxWidth = '100%';
      video.removeAttribute('style');
    }
    video.parentNode.insertBefore(wrapper, video);
    wrapper.appendChild(video);

    const playBtn = document.createElement('button');
    playBtn.setAttribute('type', 'button');
    playBtn.className = 'rte-video-play-trigger';
    playBtn.setAttribute('aria-label', 'Play video');
    wrapper.appendChild(playBtn);
  });

  return container.innerHTML;
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

/**
 * Classifies an arbitrary inline color (from pasted Word/Outlook/browser
 * HTML) into one of the adaptive buckets HomeCard.css defines, or null if
 * it doesn't clearly fit one — in which case the dark-mode blanket rule in
 * HomeCard.css (which strips any remaining hardcoded color to
 * var(--text-primary) for readability) is the correct fallback.
 * Named colors are deliberately NOT resolved here — browsers always
 * serialize inline `color` as rgb()/rgba() once parsed, so raw HTML only
 * ever contains a name if it was written by hand, which the WYSIWYG editor
 * itself never produces.
 */
export function classifyAdaptiveColor(r, g, b) {
  if (r < 60 && g < 60 && b < 60) return 'var(--adaptive-text)';
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 20 && max < 130) return 'var(--adaptive-text-secondary)';
  // Only genuinely blue colours: the old, looser test (b > r + 20 && b > g + 10)
  // also caught purples and violets, so a purple picked in the editor was
  // silently rendered blue on the Home page.
  if (b > r + 60 && b > g + 30) return 'var(--adaptive-blue)';
  return null;
}

/**
 * Rewrites every inline `color:` declaration in pasted/authored HTML to an
 * adaptive CSS variable where it's confidently classifiable (black/dark-grey
 * text, mid-grey text, blue links/emphasis) — `!important` on the
 * replacement is required: HomeCard.css's dark-mode rule that strips any
 * OTHER hardcoded color to var(--text-primary) also uses `!important`, and
 * a plain inline style always loses to any `!important` stylesheet rule
 * regardless of selector specificity. Without it here, a correctly
 * classified color would still render as flat white in dark mode.
 */
export function themeAdaptiveColors(html) {
  let processed = html || '';

  // 1. Strip default RoosterJS / MS Word fonts so the text automatically inherits the app's native theme typography
  processed = processed.replace(/font-family:\s*["']?(?:Calibri|Arial|Times New Roman|sans-serif|serif)["']?[^;"]*;?/gi, '');
  processed = processed.replace(/font-size:\s*(?:11pt|14px|15px|1em|medium)\s*;?/gi, '');

  // 2. Rewrite text colors
  processed = processed.replace(
    /color:\s*(?:rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)|#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\s*;?/gi,
    (match, r, g, b, hex) => {
      let rr = r, gg = g, bb = b;
      if (hex) {
        const h = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
        rr = parseInt(h.slice(0, 2), 16);
        gg = parseInt(h.slice(2, 4), 16);
        bb = parseInt(h.slice(4, 6), 16);
      } else {
        rr = Number(r);
        gg = Number(g);
        bb = Number(b);
      }
      const adaptive = classifyAdaptiveColor(rr, gg, bb);
      return adaptive ? `color: ${adaptive} !important;` : match;
    }
  );

  // 3. Rewrite white/light backgrounds to transparent so dark mode isn't blinded, but preserve intentional colored highlights
  processed = processed.replace(
    /background-color:\s*(?:rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)|#([0-9a-fA-F]{6}|[0-9a-fA-F]{3}))\s*;?/gi,
    (match, r, g, b, hex) => {
      let rr = r, gg = g, bb = b;
      if (hex) {
        const h = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
        rr = parseInt(h.slice(0, 2), 16);
        gg = parseInt(h.slice(2, 4), 16);
        bb = parseInt(h.slice(4, 6), 16);
      } else {
        rr = Number(r);
        gg = Number(g);
        bb = Number(b);
      }
      // If it's a very light background (like white or near-white), strip it so the theme background applies
      if (rr > 240 && gg > 240 && bb > 240) return 'background-color: transparent !important;';
      return match;
    }
  );

  return processed;
}

/**
 * Shared copy button handler for data-copy-text and generic copy buttons.
 * Used by both HomeCard.jsx (read-only render) and RichEditor.jsx (edit surface).
 */
export function handleUnifiedCopyClick(e, toast) {
  let copyBtn = e.target.closest('[data-copy-text], [data-copy], .il-dynamic-copy-btn, .copy-btn, [data-copy-btn]');
  if (!copyBtn) {
    let curr = e.target;
    while (curr && curr !== e.currentTarget) {
      if (curr.nodeType === Node.ELEMENT_NODE) {
        // Match standard buttons
        if (curr.matches('button, .btn, a, .arco-btn, [role="button"]') && curr.textContent.trim().toLowerCase().includes('copy')) {
          copyBtn = curr;
          break;
        }
        // Match ANY element (like span, div, td) if its EXACT text is just "Copy" or "Copy Path"
        const exactText = curr.textContent.replace(/[\u200B-\u200D\uFEFF\xA0]/g, '').trim().toLowerCase();
        if (exactText === 'copy' || exactText === 'copy path' || (exactText.includes('copy') && exactText.length < 12 && curr.nodeName !== 'TD' && curr.nodeName !== 'TH')) {
          copyBtn = curr;
          break;
        }
      }
      curr = curr.parentNode;
    }
  }

  if (copyBtn) {
    e.preventDefault();
    e.stopPropagation();
    
    let textToCopy = copyBtn.getAttribute('data-copy-text') || copyBtn.getAttribute('data-copy') || '';

    if (!textToCopy) {
      const td = copyBtn.closest('td, th');
      if (td) {
        const clone = td.cloneNode(true);
        const btns = clone.querySelectorAll('button, .btn, .copy-btn, .il-dynamic-copy-btn, [data-copy-btn], a');
        btns.forEach(b => b.remove());
        textToCopy = clone.textContent.replace(/\u200B/g, '').trim();
      }

      if (!textToCopy) {
        let curr = copyBtn;
        while (curr && curr !== e.currentTarget && !textToCopy) {
          let prev = curr.previousSibling; 
          while (prev && !textToCopy) {
            if (prev.nodeType === Node.TEXT_NODE) {
              textToCopy = prev.textContent.replace(/\u200B/g, '').trim();
            } else if (prev.nodeType === Node.ELEMENT_NODE) {
              const prevClone = prev.cloneNode(true);
              const btns = prevClone.querySelectorAll('button, .btn, .copy-btn, .il-dynamic-copy-btn, [data-copy-btn], a');
              btns.forEach(b => b.remove());
              textToCopy = prevClone.textContent.replace(/\u200B/g, '').trim();
            }
            prev = prev.previousSibling;
          }
          curr = curr.parentNode;
        }
      }
    }

    if (copyBtn.classList.contains('rte-copy-btn-copied')) {
      e.preventDefault();
      e.stopPropagation();
      return true;
    }

    const originalHTML = copyBtn.innerHTML;
    
    if (!textToCopy) {
      copyBtn.textContent = 'No text!';
      setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 2000);
      return true;
    }

    copyBtn.textContent = 'Copied \u2713';
    copyBtn.classList.add('rte-copy-btn-copied');
    
    const showCopied = () => {
      toast?.success('Text copied!');
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        copyBtn.classList.remove('rte-copy-btn-copied');
      }, 2000);
    };

    const doFallbackCopy = () => {
      const tempInput = document.createElement('textarea');
      tempInput.value = textToCopy;
      document.body.appendChild(tempInput);
      tempInput.select();
      try {
        const success = document.execCommand('copy');
        if (!success) throw new Error('Copy failed');
        showCopied();
      } catch (err) {
        toast?.error('Failed to copy to clipboard.');
        copyBtn.innerHTML = originalHTML;
        copyBtn.classList.remove('rte-copy-btn-copied');
      } finally {
        document.body.removeChild(tempInput);
      }
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).then(showCopied).catch((err) => {
        console.warn('Clipboard API failed, falling back...', err);
        doFallbackCopy();
      });
    } else {
      doFallbackCopy();
    }
    return true;
  }
  return false;
}
