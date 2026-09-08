import { sanitizeEditorHtml } from './sanitize';
import { stripEditorControls, rebuildPublicMediaActions, deferPublicVideoLoad, attachHomeMediaToken, useHomeMediaToken } from './mediaUtils';

/**
 * Read-only panel rendering the sanitized generated HTML exactly as the
 * Homepage will render it (same sanitize allowlist family as HomeCard.jsx's
 * render-time DOMPurify.sanitize call). Collapsed by default in RichEditor
 * since the modal already shows a live `<HomeCard>` preview in its right
 * column — this is the raw-HTML-accurate secondary view.
 */
function handlePreviewClick(e) {
  // Mirrors HomeCard.jsx's data-copy-text handling — see the comment there
  // for why onclick/<script> copy buttons don't work post-sanitize.
  // Unified indestructible copy button handler
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
        const exactText = curr.textContent.trim().toLowerCase();
        if (exactText === 'copy' || exactText === 'copy path') {
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

    const originalHTML = copyBtn.innerHTML;
    
    if (!textToCopy) {
      copyBtn.textContent = 'No text!';
      setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 1500);
      return;
    }

    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('rte-copy-btn-copied');
    
    const showCopied = () => {
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        copyBtn.classList.remove('rte-copy-btn-copied');
      }, 1500);
    };

    const doFallbackCopy = () => {
      const tempInput = document.createElement('textarea');
      tempInput.value = textToCopy;
      document.body.appendChild(tempInput);
      tempInput.select();
      try {
        document.execCommand('copy');
      } catch (err) {}
      document.body.removeChild(tempInput);
      showCopied();
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(textToCopy).then(showCopied).catch(doFallbackCopy);
    } else {
      doFallbackCopy();
    }
    return;
  }

  const playBtn = e.target.closest('.rte-video-play-trigger');
  if (!playBtn) return;
  e.preventDefault();
  const wrapper = playBtn.closest('.rte-video-lazy-wrap');
  const video = wrapper?.querySelector('video');
  if (video) {
    video.querySelectorAll('source[data-video-src]').forEach((source) => {
      source.src = source.getAttribute('data-video-src');
      source.removeAttribute('data-video-src');
    });
    const videoSrc = video.getAttribute('data-video-src');
    if (videoSrc) {
      video.src = videoSrc;
      video.removeAttribute('data-video-src');
    }
    video.setAttribute('preload', 'auto');
    video.load();
    video.play().catch(() => {});
  }
  playBtn.remove();
  wrapper?.classList.add('rte-video-playing');
}

export function Preview({ html }) {
  const mediaToken = useHomeMediaToken();
  return (
    <div className="rte-preview-panel">
      <div className="rte-preview-label">Generated HTML preview</div>
      <div
        className="home-card-html-content rte-preview-content"
        onClick={handlePreviewClick}
        dangerouslySetInnerHTML={{ __html: attachHomeMediaToken(deferPublicVideoLoad(rebuildPublicMediaActions(stripEditorControls(sanitizeEditorHtml(html || '')))), mediaToken) }}
      />
    </div>
  );
}

export default Preview;
