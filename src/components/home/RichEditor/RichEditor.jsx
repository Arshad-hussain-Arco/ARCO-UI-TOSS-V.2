import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import DOMPurify from 'dompurify';
import { useToast } from '@hooks/useToast';
import { attachHomeMediaToken, stripHomeMediaToken, useHomeMediaToken, deleteMediaFile, themeAdaptiveColors, handleUnifiedCopyClick } from './mediaUtils';
import { copyWithToast } from '@utils/copyToClipboard';
import * as ImageHandler from './ImageHandler';
import * as VideoHandler from './VideoHandler';
import * as PdfHandler from './PdfHandler';
import * as AttachmentHandler from './AttachmentHandler';
import { ProgressTooltip } from '@pages/ProjectMonitoring/components/ProgressTooltip';

import './RichEditor.css';
import { initializeIcons } from '@fluentui/react';

initializeIcons(undefined, { disableWarnings: true });

import {
  createRibbonPlugin,
  Ribbon,
  Rooster,
  undoButton,
  redoButton,
  boldButton,
  italicButton,
  underlineButton,
  fontButton,
  fontSizeButton,
  textColorButton,
  backgroundColorButton,
  bulletedListButton,
  numberedListButton,
  decreaseIndentButton,
  increaseIndentButton,
  insertLinkButton,
  removeLinkButton,
  insertImageButton,
  insertTableButton,
  alignLeftButton,
  alignCenterButton,
  alignRightButton,
  alignJustifyButton,
  blockQuoteButton,
  clearFormatButton,
  codeButton,
  decreaseFontSizeButton,
  increaseFontSizeButton,
  ltrButton,
  rtlButton,
  setHeadingLevelButton,
  strikethroughButton,
  subscriptButton,
  superscriptButton,
  showInputDialog,
  createContextMenuPlugin,
  createTableEditMenuProvider
} from "roosterjs-react";

import {
  formatTable,
  setTableCellShade,
  setImageBorder,
  setImageBoxShadow,
  changeImage,
  adjustImageSelection,
  exportContent,
  TableEditPlugin,
  ImageEditPlugin,
  DragAndDropPlugin
} from 'roosterjs';

// ── Code Language Detection ─────────────────────────────────────────────
const CODE_PATTERNS = [
  { lang: 'html', badge: 'HTML', cls: 'rte-code-lang-badge-html', re: /(?:<\/?(?:html|head|body|div|span|p|a|img|table|form|input|button|script|style|link|meta|section|article|header|footer|nav|main|aside|ul|ol|li|h[1-6])\b[^>]*>|<!DOCTYPE\s+html)/i },
  { lang: 'javascript', badge: 'JavaScript', cls: 'rte-code-lang-badge-js', re: /(?:^|\n)\s*(?:(?:const|let|var|function|class|import|export|return|if|else|for|while|switch|case|try|catch|async|await)\s|=>|console\.log|document\.|window\.|require\(|module\.exports)/ },
  { lang: 'python', badge: 'Python', cls: 'rte-code-lang-badge-python', re: /(?:^|\n)\s*(?:def\s+\w+\s*\(|class\s+\w+|import\s+\w|from\s+\w+\s+import|print\s*\(|if\s+__name__|elif\s|except\s|raise\s|lambda\s|self\.)/ },
  { lang: 'css', badge: 'CSS', cls: 'rte-code-lang-badge-css', re: /(?:^|\n)\s*(?:[.#@]\w[\w-]*\s*\{|\w[\w-]*\s*:\s*[\w#(]+.*;|@media\s|@keyframes\s|@import\s)/ },
];

function detectCodeLanguage(text) {
  if (!text || text.trim().length < 10) return null;
  for (const p of CODE_PATTERNS) {
    if (p.re.test(text)) return p;
  }
  // Fallback: if it has 3+ lines and looks "codey" (lots of braces/semicolons/indentation)
  const lines = text.split('\n');
  if (lines.length >= 3) {
    const codeChars = (text.match(/[{};()=<>]/g) || []).length;
    if (codeChars / text.length > 0.03) {
      return { lang: 'code', badge: 'Code', cls: '', re: null };
    }
  }
  return null;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildCodePreviewHtml(code, langInfo) {
  const escaped = escapeHtml(code);
  const isHtml = langInfo.lang === 'html';
  let html = `<div class="rte-code-preview" contenteditable="false">` +
    `<div class="rte-code-header">` +
    `<span class="rte-code-lang-badge ${langInfo.cls}"><span class="rte-code-lang-dot"></span>${langInfo.badge}</span>` +
    `<button class="rte-code-copy-btn" data-code-copy="true" type="button" title="Copy code">` +
    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>` +
    `Copy` +
    `</button>` +
    `</div>` +
    `<div class="rte-code-body"><pre><code>${escaped}</code></pre></div>`;

  if (isHtml) {
    const sanitized = DOMPurify.sanitize(code, { ADD_TAGS: ['style'], ADD_ATTR: ['style'] });
    html += `<div class="rte-code-html-preview">` +
      `<div class="rte-code-html-preview-header">` +
      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>` +
      `Live Preview` +
      `</div>` +
      `<div class="rte-code-html-preview-body">${sanitized}</div>` +
      `</div>`;
  }

  html += `</div><p><br></p>`;
  return html;
}

// ── Fullscreen Insert Link Modal Component ──────────────────────────────
function InsertLinkModal({ isOpen, onClose, onInsert }) {
  const [url, setUrl] = useState('');
  const [displayText, setDisplayText] = useState('');
  const [openInNewTab, setOpenInNewTab] = useState(true);
  const [urlError, setUrlError] = useState('');
  const urlInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setDisplayText('');
      setOpenInNewTab(true);
      setUrlError('');
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    };
    document.addEventListener('keydown', handleKey);
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = orig;
    };
  }, [isOpen, onClose]);

  const handleSubmit = () => {
    let finalUrl = url.trim();
    if (!finalUrl) { setUrlError('Please enter a URL.'); return; }
    try {
      new URL(finalUrl.startsWith('http') ? finalUrl : `https://${finalUrl}`);
    } catch {
      setUrlError('Please enter a valid URL.'); return;
    }
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = `https://${finalUrl}`;
    onInsert({ url: finalUrl, text: displayText.trim() || finalUrl, newTab: openInNewTab });
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="rte-link-modal-overlay" onClick={onClose}>
      <div className="rte-link-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="rte-link-modal-header">
          <h3 className="rte-link-modal-title">
            <span className="rte-link-modal-title-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            </span>
            Insert Link
          </h3>
          <button type="button" className="rte-link-modal-close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="rte-link-modal-body">
          <div className="rte-link-modal-field">
            <label className="rte-link-modal-label">URL <span className="rte-link-modal-required">*</span></label>
            <input
              ref={urlInputRef}
              type="url"
              className={`rte-link-modal-input ${urlError ? 'rte-link-modal-input-error' : ''}`}
              placeholder="https://example.com"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setUrlError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
            {urlError && <span className="rte-link-modal-error">{urlError}</span>}
          </div>

          <div className="rte-link-modal-field">
            <label className="rte-link-modal-label">Display Text</label>
            <input
              type="text"
              className="rte-link-modal-input"
              placeholder="Text to display (defaults to URL)"
              value={displayText}
              onChange={(e) => setDisplayText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
          </div>

          <label className="rte-link-modal-checkbox-row" onClick={() => setOpenInNewTab(v => !v)}>
            <input
              type="checkbox"
              className="rte-link-modal-checkbox"
              checked={openInNewTab}
              onChange={(e) => setOpenInNewTab(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <div>
              <div className="rte-link-modal-checkbox-label">Open in new tab</div>
              <div className="rte-link-modal-checkbox-hint">Link will open in a separate browser tab</div>
            </div>
          </label>
        </div>

        <div className="rte-link-modal-footer">
          <button type="button" className="rte-link-modal-btn rte-link-modal-btn-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="rte-link-modal-btn rte-link-modal-btn-submit" onClick={handleSubmit} disabled={!url.trim()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            Insert Link
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const getEditorHtml = (editor) => {
  if (!editor) return '';
  try {
    // ALWAYS prioritize grabbing the raw innerHTML directly to bypass RoosterJS's strict ContentModel
    // which silently strips out complex layouts like flexbox and CSS gradients.
    const editorDiv = document.querySelector('.rte-root div[contenteditable="true"]');
    if (editorDiv) return editorDiv.innerHTML;

    // Fallback only
    return exportContent(editor);
  } catch (e) {
    console.warn("RoosterJS HTML extraction error:", e);
    return null; // Return null so we don't wipe the editor data on failure
  }
};

// Resize-handle positions for a selected image/video (.rte-media-wrap).
// Ported from the pre-RoosterJS EditableArea.jsx implementation — that file
// is dead code now (RichEditor.jsx switched to RoosterJS's <Rooster> as the
// actual contenteditable surface), but its remove-button/resize logic was
// never re-wired into the new editor, which is why neither worked at all
// after the migration: nothing in RichEditor.jsx ever listened for
// `.rte-media-remove-btn` clicks or attached handles to `.rte-media-wrap`.
const MEDIA_HANDLE_POSITIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function clearMediaResizeHandles(root) {
  if (!root) return;
  root.querySelectorAll('.rte-resize-handle').forEach((h) => h.remove());
  root.querySelectorAll('.rte-media-wrap.rte-selected').forEach((w) => w.classList.remove('rte-selected'));
}

function startMediaResize(e, pos, mediaEl, containerEl, onDone) {
  e.preventDefault();
  e.stopPropagation();
  const startX = e.clientX;
  const startY = e.clientY;
  const rect = mediaEl.getBoundingClientRect();
  const startWidth = rect.width;
  const startHeight = rect.height;
  const aspect = startWidth / (startHeight || 1);
  const isCorner = pos.length === 2;
  const dirX = pos.includes('e') ? 1 : pos.includes('w') ? -1 : 0;
  const containerWidth = containerEl?.clientWidth || 9999;

  const onMove = (moveEvt) => {
    let newWidth = startWidth;
    let newHeight = startHeight;

    if (pos === 'n' || pos === 's') {
      const dirY = pos === 's' ? 1 : -1;
      const dy = (moveEvt.clientY - startY) * dirY;
      newHeight = Math.max(40, startHeight + dy);
    } else {
      const dx = (moveEvt.clientX - startX) * dirX;
      newWidth = Math.max(40, Math.min(containerWidth, startWidth + dx));
      if (isCorner) newHeight = newWidth / aspect;
    }

    mediaEl.style.width = `${newWidth}px`;
    mediaEl.style.height = pos === 'n' || pos === 's' ? `${newHeight}px` : 'auto';
  };

  const onUp = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    onDone?.();
  };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

// Fluent UI's <CommandBar> (rendered internally by roosterjs-react's <Ribbon>)
// looked like the white toolbar bar itself was hardcoded, but the bar's own
// root is basically invisible either way — the real paint comes from EACH
// individual button. CommandBarButton's default styles set
// `backgroundColor: theme.palette.white` on its own root
// (CommandBarButton.styles.js), and since the buttons tile edge-to-edge
// across the row, THAT is what forms the solid white bar, regardless of
// what the CommandBar root itself is set to. `selectors` is Fluent's own
// nested-selector styling API, resolved into the same generated stylesheet
// rule Fluent computes its own theme colors into — overriding `.ms-Button`
// here is what actually reaches the button backgrounds; a plain external
// CSS override on `.ms-CommandBar` never touched them.
const RIBBON_STYLES = {
  root: {
    backgroundColor: 'var(--surface-primary)',
    selectors: {
      // `.ms-Button-icon`/`.ms-Button-label` are two separate slots — each
      // defaults to its own dark `theme.palette.neutralPrimary`/
      // `neutralDark` text color (BaseButton.styles.js / CommandBarButton.
      // styles.js), so overriding just the icon left every text label
      // (dropdown captions like "Merge"/"Split"/"Options") black-on-dark
      // and effectively invisible.
      '.ms-Button': { backgroundColor: 'transparent', color: 'var(--text-secondary)' },
      '.ms-Button-icon': { color: 'var(--text-secondary)' },
      '.ms-Button-label': { color: 'var(--text-secondary)' },
      '.ms-Button-menuIcon': { color: 'var(--text-secondary)' },
      // Disabled buttons (e.g. "Merge"/"Split" with no table selected) get
      // Fluent's own `is-disabled` class — dim them instead of leaving
      // them at full text-secondary so the disabled state stays legible.
      '.ms-Button.is-disabled, .ms-Button.is-disabled .ms-Button-icon, .ms-Button.is-disabled .ms-Button-label': {
        color: 'var(--text-tertiary)',
      },
      '.ms-Button:hover': { backgroundColor: 'var(--bg-secondary)' },
      '.ms-Button:hover .ms-Button-icon, .ms-Button:hover .ms-Button-label': { color: 'var(--c-primary)' },
    },
  },
};

export function RichEditor({ value = '', onChange, placeholder }) {
  const toast = useToast();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState('Main');
  const [showHtmlPreview, setShowHtmlPreview] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const wrapperRef = useRef(null);
  const editorRef = useRef(null);
  const selectedMediaRef = useRef(null);
  const imgInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const isInitialized = useRef(false);
  const activeTabRef = useRef(activeTab);
  const sourceHtmlRef = useRef('');
  const [sourceHtmlState, setSourceHtmlState] = useState('');
  const [tooltipState, setTooltipState] = useState({ visible: false, title: '', targetRect: null });
  const [tableContextMenu, setTableContextMenu] = useState({ visible: false, x: 0, y: 0, targetCell: null, targetTable: null });

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  const mediaToken = useHomeMediaToken();
  const displayHtml = (html) => attachHomeMediaToken(themeAdaptiveColors(html), mediaToken) || html;

  const initialValue = useMemo(() => {
    return displayHtml(value);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      isInitialized.current = true;
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Force roosterjs to accept complex HTML on mount, bypassing its strict ContentModel stripping
  useEffect(() => {
    if (editorRef.current && initialValue) {
      setTimeout(() => {
        try {
          let root = document.querySelector('.rte-root div[contenteditable="true"]');
          if (root && (root.innerHTML === '' || root.innerHTML === '<div><br></div>')) {
            root.innerHTML = initialValue;
          }
        } catch (err) { }
      }, 50); // slight delay to let roosterjs initialize first
    }
  }, [initialValue]);

  const handleChange = useCallback((newContent) => {
    const stripped = stripHomeMediaToken(newContent);
    onChange?.(stripped);
  }, [onChange]);

  const editorSyncPlugin = useMemo(() => {
    let timeout;
    return {
      getName: () => 'EditorSyncPlugin',
      initialize: (editor) => {
        editorRef.current = editor;
      },
      dispose: () => {
        editorRef.current = null;
        clearTimeout(timeout);
      },
      onPluginEvent: (e) => {
        // PluginEventType: 5 = MouseUp, 2 = KeyUp, 6 = ContentChanged, 0 = KeyDown
        if (e.eventType === 5 || e.eventType === 2 || e.eventType === 6 || e.eventType === 0) {
          setTimeout(() => {
            let hasVideo = false;
            if (document.querySelector('.rte-root video.rooster-video-selected')) {
              hasVideo = true;
            } else {
              const sel = window.getSelection();
              if (sel && sel.anchorNode) {
                let node = sel.anchorNode;
                if (node.nodeType === 3) node = node.parentNode;
                if (node.tagName === 'VIDEO' || (node.querySelector && node.querySelector('video'))) {
                  hasVideo = true;
                }
              }
            }
            if (hasVideo && activeTabRef.current !== 'Video') {
              setActiveTab('Video');
            } else if (!hasVideo && activeTabRef.current === 'Video') {
              setActiveTab('Main');
            }
          }, 0);
        }

        clearTimeout(timeout);
        timeout = setTimeout(() => {
          if (editorRef.current) {
            const currentHtml = getEditorHtml(editorRef.current);
            if (currentHtml === null) return; // Prevent wipe on critical extraction error
            // Prevent overwriting initial value with empty state during mount
            if (!isInitialized.current && (!currentHtml || currentHtml === '<div><br></div>') && initialValue) {
              return;
            }
            handleChange(currentHtml);
          }
        }, 150);
      }
    };
  }, [handleChange]);

  // Code paste detection plugin — intercepts paste events to wrap code in preview blocks
  const codePastePlugin = useMemo(() => {
    return {
      getName: () => 'CodePastePlugin',
      initialize: () => { },
      dispose: () => { },
      onPluginEvent: (e) => {
        // PluginEventType.BeforePaste = 9 in roosterjs v8
        if (e.eventType === 9 && e.clipboardData) {
          const plainText = e.clipboardData.text || '';
          const htmlData = e.clipboardData.html || '';
          // Only trigger on plain-text pastes that look like code (not rich content from other editors)
          const isPlainCodePaste = plainText && (!htmlData || htmlData.includes('<!--StartFragment-->'));
          if (isPlainCodePaste) {
            const langInfo = detectCodeLanguage(plainText);
            if (langInfo) {
              if (langInfo.lang === 'html') {
                // HTML pastes: render as actual HTML content (tables, headings, etc.)
                // so the Live Preview shows the rendered output, not raw source code.
                // DOMPurify strips <script>, onclick, javascript: URLs, etc. for safety.
                const sanitized = DOMPurify.sanitize(plainText, {
                  ADD_TAGS: ['style', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
                    'colgroup', 'col', 'caption', 'figure', 'figcaption', 'details', 'summary'],
                  ADD_ATTR: ['style', 'class', 'colspan', 'rowspan', 'border', 'cellpadding',
                    'cellspacing', 'width', 'height', 'align', 'valign', 'scope', 'headers',
                    'target', 'rel', 'href', 'src', 'alt', 'title'],
                  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select'],
                  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
                    'onsubmit', 'onchange', 'onkeydown', 'onkeyup', 'onkeypress'],
                });
                const renderedHtml = themeAdaptiveColors(sanitized) + '<p><br></p>';
                e.fragment = (() => {
                  const template = document.createElement('template');
                  template.innerHTML = renderedHtml;
                  return template.content;
                })();
                if (e.clipboardData) {
                  e.clipboardData.html = renderedHtml;
                  e.clipboardData.text = '';
                }
                return;
              } else {
                // Non-HTML code (JS, Python, CSS, etc.): wrap in formatted code preview block
                // — displayed as code text, never executed
                const codeHtml = buildCodePreviewHtml(plainText, langInfo);
                e.fragment = (() => {
                  const template = document.createElement('template');
                  template.innerHTML = codeHtml;
                  return template.content;
                })();
                if (e.clipboardData) {
                  e.clipboardData.html = codeHtml;
                  e.clipboardData.text = '';
                }
                return;
              }
            }
          }
          if (htmlData) {
            e.clipboardData.html = themeAdaptiveColors(htmlData);
          }
        }
      }
    };
  }, []);

  const ribbonPlugin = useMemo(createRibbonPlugin, []);

  const tableEditMenuProvider = useMemo(createTableEditMenuProvider, []);
  // RoosterJS 9's createContextMenuPlugin does not take providers in this version.
  const contextMenuPlugin = useMemo(() => createContextMenuPlugin(), []);

  const plugins = useMemo(() => [
    ribbonPlugin,
    editorSyncPlugin,
    codePastePlugin,
    new ImageEditPlugin(),
    new TableEditPlugin('.rte-root'),
    new DragAndDropPlugin(),
    contextMenuPlugin,
    tableEditMenuProvider
  ], [ribbonPlugin, editorSyncPlugin, codePastePlugin, contextMenuPlugin, tableEditMenuProvider]);

  // Custom insert link button that opens the fullscreen modal
  const customInsertLinkButton = useMemo(() => ({
    ...insertLinkButton,
    key: 'customInsertLink',
    onClick: () => {
      if (!isFullscreen) setIsFullscreen(true);
      setShowLinkModal(true);
    }
  }), [isFullscreen]);

  // Replaces RoosterJS's stock insertImageButton wherever it would
  // otherwise appear (fullscreen ribbon's Main/Insert/Image tabs). The
  // stock button inserts the picked file as a raw base64 data: URI directly
  // into the DOM — entirely bypassing the SFTP-backed HomeMedia upload
  // pipeline (no size/type validation, no server storage, bloats the saved
  // html_content). Clicking imgInputRef instead routes through the same
  // handleImageUpload the non-fullscreen "Image" button uses, so image
  // handling is identical regardless of which toolbar mode inserted it.
  // (Same open-the-hidden-input logic as handleMediaBtnClick below, inlined
  // here since that helper is declared later and this button is built
  // before it.)
  const customInsertImageButton = useMemo(() => ({
    ...insertImageButton,
    key: 'customInsertImage',
    onClick: () => {
      if (isFullscreen) {
        imgInputRef.current?.click();
      } else {
        setIsFullscreen(true);
        setTimeout(() => imgInputRef.current?.click(), 80);
      }
    }
  }), [isFullscreen]);

  const customInsertVideoButton = useMemo(() => ({
    key: 'customInsertVideo',
    unlocalizedText: 'Upload Video',
    iconName: 'Video',
    onClick: () => {
      if (isFullscreen) {
        videoInputRef.current?.click();
      } else {
        setIsFullscreen(true);
        setTimeout(() => videoInputRef.current?.click(), 80);
      }
    }
  }), [isFullscreen]);

  const toggleSourceView = useCallback(() => {
    setShowHtmlPreview((prev) => {
      if (!prev) {
        const html = editorRef.current ? getEditorHtml(editorRef.current) : '';
        sourceHtmlRef.current = html;
        setSourceHtmlState(html);
      } else {
        if (editorRef.current) {
          const themedSource = themeAdaptiveColors(sourceHtmlRef.current);
          const sanitized = DOMPurify.sanitize(themedSource, {
            ADD_TAGS: ['style', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col', 'caption', 'figure', 'figcaption', 'details', 'summary', 'video', 'source', 'iframe'],
            ADD_ATTR: ['style', 'class', 'colspan', 'rowspan', 'border', 'cellpadding', 'cellspacing', 'width', 'height', 'align', 'valign', 'scope', 'headers', 'target', 'rel', 'href', 'src', 'alt', 'title', 'controls', 'autoplay', 'loop', 'muted', 'poster', 'allowfullscreen', 'frameborder', 'data-media-id', 'data-src', 'data-copy', 'data-code-copy'],
            FORBID_TAGS: ['script', 'object', 'embed'],
            FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onsubmit', 'onchange', 'onkeydown', 'onkeyup', 'onkeypress'],
          });
          const root = document.querySelector('.rte-root div[contenteditable="true"]');
          if (root) {
            root.innerHTML = sanitized;
          } else if (typeof editorRef.current.setContent === 'function') {
            editorRef.current.setContent(sanitized);
          }
          handleChange(getEditorHtml(editorRef.current));
        }
      }
      return !prev;
    });
  }, [handleChange]);

  // Custom code button that toggles HTML Source Edit mode instead of inline code
  const customCodeButton = useMemo(() => ({
    ...codeButton,
    key: 'customCodeButton',
    unlocalizedText: 'Toggle HTML Source Edit Mode',
    onClick: toggleSourceView
  }), [toggleSourceView]);

  // Handle link insertion from the fullscreen modal
  const handleLinkInsert = useCallback(({ url, text, newTab }) => {
    const editor = editorRef.current;
    if (!editor) return;
    const target = newTab ? '_blank' : '';
    const rel = newTab ? 'noopener noreferrer' : '';
    const anchor = `<a href="${url}"${target ? ` target="${target}"` : ''}${rel ? ` rel="${rel}"` : ''}>${escapeHtml(text)}</a>&nbsp;`;

    editor.focus();
    const doc = typeof editor.getDocument === 'function' ? editor.getDocument() : document;
    doc.execCommand('insertHTML', false, anchor);
    handleChange(getEditorHtml(editor));
  }, [handleChange]);

  const insertRawHtml = useCallback((editor, html) => {
    if (!editor) return;
    editor.focus();
    const doc = typeof editor.getDocument === 'function' ? editor.getDocument() : document;
    // Newly-inserted media markup carries a bare (untokenized) URL — fine
    // for video/pdf/attachment since those lazy-load on click, but an
    // <img src="..."> fetches immediately and would show broken until the
    // card is reopened (whenever `value` next flows through displayHtml()).
    // Attach the current token now; handleChange strips it again on the way
    // out via stripHomeMediaToken, so the saved html_content stays bare.
    doc.execCommand('insertHTML', false, attachHomeMediaToken(html, mediaToken) || html);
    handleChange(getEditorHtml(editor));
  }, [getEditorHtml, handleChange, mediaToken]);

  const getSelectedImage = useCallback(() => {
    try {
      if (editorRef.current?.getElementAtCursor) return editorRef.current.getElementAtCursor('img');
    } catch (e) { }
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let node = sel.anchorNode;
      if (node.nodeType === 3) node = node.parentNode;
      if (node.tagName === 'IMG') return node;
      if (node.querySelector) return node.querySelector('img');
    }
    return document.querySelector('.rte-root img.rooster-image-selected') || null;
  }, []);

  const getSelectedVideo = useCallback(() => {
    try {
      if (editorRef.current?.getElementAtCursor) return editorRef.current.getElementAtCursor('video');
    } catch (e) { }
    const sel = window.getSelection();
    if (sel && sel.anchorNode) {
      let node = sel.anchorNode;
      if (node.nodeType === 3) node = node.parentNode;
      if (node.tagName === 'VIDEO') return node;
      if (node.querySelector) return node.querySelector('video');
    }
    return document.querySelector('.rte-root video.rooster-video-selected') || null;
  }, []);

  // "Change Image" in the Image tab's dropdown was a bare `onClick: () => {}`
  // no-op — clicking it did nothing at all. Routes through the same
  // SFTP-backed upload pipeline as every other image insertion (see
  // handleImageUpload further below) rather than roosterjs's own
  // `changeImage()` helper, which embeds the picked file as a raw base64
  // data: URI — exactly the bypass this codebase deliberately avoids
  // elsewhere. Declared here (before imageButtons) rather than next to
  // handleImageUpload — imageButtons' useMemo dependency array references
  // it, and that array is evaluated immediately, so it must already be
  // initialized by the time imageButtons is declared.
  const handleChangeSelectedImage = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selectedImg = getSelectedImage();
    if (!selectedImg || selectedImg.tagName !== 'IMG') {
      toast.error('Select an image first.');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      try {
        toast.info?.('Uploading image…');
        const result = await ImageHandler.ingestFile(file);
        selectedImg.setAttribute('src', result.url);
        selectedImg.setAttribute('alt', file.name);
        const wrap = selectedImg.closest('.rte-media-wrap');
        if (wrap) wrap.setAttribute('data-src', result.url);
        handleChange(getEditorHtml(editor));
      } catch (err) {
        toast.error(err?.message || 'Image upload failed');
      }
    });
    document.body.appendChild(input);
    input.click();
  }, [getSelectedImage, handleChange, toast]);

  const formatPainterButton = useMemo(() => ({
    key: 'formatPainter',
    unlocalizedText: 'Format Painter',
    iconName: 'Brush',
    onClick: () => { }
  }), []);



  // Handle code-copy button clicks, image/video remove, and image/video
  // resize-handle selection inside the editor. Remove + resize used to be
  // handled by EditableArea.jsx's onMouseDown — that file is dead code
  // since the RoosterJS migration, so both silently stopped working; this
  // ports that logic onto the actual current editor surface.
  const handleEditorClick = useCallback((e) => {
    if (handleUnifiedCopyClick(e, toast)) return;

    const copyBtn = e.target.closest('[data-code-copy]');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const codeBlock = copyBtn.closest('.rte-code-preview');
      const codeEl = codeBlock?.querySelector('.rte-code-body code');
      if (codeEl) {
        if (copyBtn.classList.contains('rte-code-copied')) {
          return;
        }
        const originalHTML = copyBtn.innerHTML;
        copyBtn.classList.add('rte-code-copied');
        copyBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Copied \u2713`;
        
        try { copyWithToast(codeEl.textContent); } catch (e) {}
        
        setTimeout(() => {
          copyBtn.classList.remove('rte-code-copied');
          copyBtn.innerHTML = originalHTML;
        }, 2000);
      }
      return;
    }

    const removeBtn = e.target.closest('.rte-media-remove-btn');
    if (removeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const targetBlock = removeBtn.closest('.rte-media-card, .rte-video-block, .rte-media-wrap, .rte-media-block, .rte-pdf-wrap, .rte-attachment-card, .media-pdf-card');
      if (targetBlock) {
        const mediaEl = targetBlock.querySelector('img, video');
        const src = targetBlock.dataset.src || mediaEl?.getAttribute('src');
        if (src && src.startsWith('blob:')) {
          try { URL.revokeObjectURL(src); } catch { /* ignore */ }
        }
        const mediaId = targetBlock.dataset.mediaId;
        if (selectedMediaRef.current === targetBlock) selectedMediaRef.current = null;
        targetBlock.remove();
        if (editorRef.current) handleChange(getEditorHtml(editorRef.current));
        if (mediaId) deleteMediaFile(mediaId);
      }
      return;
    }

    const root = wrapperRef.current;
    const wrap = e.target.closest('.rte-media-wrap');
    if (wrap && root?.contains(wrap)) {
      if (selectedMediaRef.current !== wrap) {
        clearMediaResizeHandles(root);
        const mediaEl = wrap.querySelector('img, video');
        if (mediaEl) {
          wrap.classList.add('rte-selected');
          MEDIA_HANDLE_POSITIONS.forEach((pos) => {
            const handle = document.createElement('div');
            handle.className = `rte-resize-handle rte-resize-${pos}`;
            handle.setAttribute('contenteditable', 'false');
            handle.addEventListener('pointerdown', (ev) =>
              startMediaResize(ev, pos, mediaEl, root, () => {
                if (editorRef.current) handleChange(getEditorHtml(editorRef.current));
              })
            );
            wrap.appendChild(handle);
          });
          selectedMediaRef.current = wrap;
        }
      }
      return;
    }

    if (selectedMediaRef.current) {
      clearMediaResizeHandles(root);
      selectedMediaRef.current = null;
    }
  }, [handleChange]);

  // Categorized Buttons matched exactly to the screenshot's order
  const mainButtons = [
    formatPainterButton,
    clearFormatButton,
    boldButton,
    italicButton,
    underlineButton,
    fontButton,
    fontSizeButton,
    increaseFontSizeButton,
    decreaseFontSizeButton,
    textColorButton,
    backgroundColorButton,
    bulletedListButton,
    numberedListButton,
    decreaseIndentButton,
    increaseIndentButton,
    blockQuoteButton,
    alignLeftButton,
    alignCenterButton,
    alignRightButton,
    alignJustifyButton,
    customInsertLinkButton,
    removeLinkButton,
    insertTableButton,
    superscriptButton,
    subscriptButton,
    strikethroughButton,
    setHeadingLevelButton,
    customCodeButton,
    ltrButton,
    rtlButton
  ];

  const textButtons = useMemo(() => [
    fontButton, fontSizeButton, formatPainterButton, boldButton, italicButton, underlineButton, strikethroughButton,
    subscriptButton, superscriptButton, textColorButton, backgroundColorButton,
    decreaseFontSizeButton, increaseFontSizeButton, clearFormatButton
  ], []);

  const paragraphButtons = [
    bulletedListButton,
    numberedListButton,
    decreaseIndentButton,
    increaseIndentButton,
    blockQuoteButton,
    alignLeftButton,
    alignCenterButton,
    alignRightButton,
    alignJustifyButton,
    setHeadingLevelButton,
    customCodeButton,
    ltrButton,
    rtlButton,
    {
      key: 'listFormatParagraph',
      unlocalizedText: 'List Format',
      iconName: 'NumberField',
      onClick: (editor, key, strings, uiUtilities) => {
        try { window.prompt('Start numbering at:', '1'); } catch (e) { }
      }
    },
    {
      key: 'lineSpacingParagraph',
      unlocalizedText: 'Line Spacing',
      iconName: 'LineSpacing',
      dropDownMenu: {
        items: {
          '1.0': '1.0', '1.15': '1.15', '1.5': '1.5', '2.0': '2.0'
        }
      },
      onClick: (editor, key) => {
        if (editor) {
          editor.formatElements((element) => {
            element.style.lineHeight = key;
          });
        }
      }
    }
  ];

  const insertButtons = useMemo(() => {
    const btns = [
      customInsertLinkButton,
      insertTableButton
    ];
    if (isFullscreen) {
      btns.push(customInsertImageButton, removeLinkButton);
    }
    return btns;
  }, [isFullscreen, customInsertLinkButton, insertTableButton, customInsertImageButton, removeLinkButton]);

  const tableButtons = [
    insertTableButton,
    {
      key: 'table2',
      unlocalizedText: 'Format Table',
      iconName: 'TableComputed',
      dropDownMenu: {
        items: {
          'Table Grid': 'Table Grid',
          'Table Grid Light': 'Table Grid Light',
          'Plain Table 1': 'Plain Table 1',
          'Plain Table 2': 'Plain Table 2',
          'Plain Table 3': 'Plain Table 3',
          'Plain Table 4': 'Plain Table 4',
          'Plain Table 5': 'Plain Table 5',
          'Grid Table 1 Light': 'Grid Table 1 Light',
          'Grid Table 2': 'Grid Table 2',
          'Grid Table 3': 'Grid Table 3',
          'List Table 1 Light': 'List Table 1 Light',
          'List Table 2': 'List Table 2',
          'List Table 3': 'List Table 3'
        }
      },
      onClick: (editor, key) => {
        // Map common table formats to metadata
        const formats = {
          'Table Grid': { topBorderColor: '#000', bottomBorderColor: '#000', verticalBorderColor: '#000' },
          'Table Grid Light': { topBorderColor: '#ccc', bottomBorderColor: '#ccc', verticalBorderColor: '#ccc' },
          'Plain Table 1': { topBorderColor: 'transparent', bottomBorderColor: 'transparent', verticalBorderColor: 'transparent' }
        };
        const format = formats[key] || {};
        formatTable(editor, format);
      }
    },
    {
      ...backgroundColorButton,
      key: 'table3',
      unlocalizedText: 'Set table shade color',
      iconName: 'BackgroundColor',
      onClick: (editor, key) => {
        if (key) setTableCellShade(editor, key);
      }
    },
    {
      key: 'table4',
      unlocalizedText: 'Table Title',
      iconName: 'TableComputed',
      onClick: (editor, key, strings, uiUtilities) => {
        try { window.prompt('Enter Table Title:', ''); } catch (e) { }
      }
    },
    {
      key: 'table5',
      unlocalizedText: 'Options',
      iconName: '',
      commandBarProperties: { text: 'Options', name: 'Options', iconOnly: false },
      dropDownMenu: {
        items: {
          'Header Row': 'Header Row',
          'First Column': 'First Column',
          'Banded Columns': 'Banded Columns',
          'Banded Rows': 'Banded Rows'
        }
      },
      onClick: () => { }
    },
    {
      key: 'table6',
      unlocalizedText: 'Insert',
      iconName: 'InsertColumnsRight',
      dropDownMenu: {
        items: {
          'Insert above': 'Insert above',
          'Insert below': 'Insert below',
          'Insert left': 'Insert left',
          'Insert right': 'Insert right'
        }
      },
      onClick: (editor, key) => {
        const opMap = {
          'Insert above': 'insertAbove',
          'Insert below': 'insertBelow',
          'Insert left': 'insertLeft',
          'Insert right': 'insertRight'
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) editTable(editor, opMap[key]);
        });
      }
    },
    {
      key: 'table7',
      unlocalizedText: 'Delete',
      iconName: 'DeleteTable',
      dropDownMenu: {
        items: {
          'Delete column': 'Delete column',
          'Delete row': 'Delete row',
          'Delete table': 'Delete table',
          'Shift cells up': 'Shift cells up',
          'Shift cells left': 'Shift cells left'
        }
      },
      onClick: (editor, key) => {
        const opMap = {
          'Delete column': 'deleteColumn',
          'Delete row': 'deleteRow',
          'Delete table': 'deleteTable',
          'Shift cells up': 'shiftCellsUp',
          'Shift cells left': 'shiftCellsLeft'
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) editTable(editor, opMap[key]);
        });
      }
    },
    {
      key: 'table8',
      unlocalizedText: 'Table Border',
      iconName: 'TableComputed',
      dropDownMenu: {
        items: {
          'All Borders': 'All Borders',
          'No Borders': 'No Borders',
          'Left Borders': 'Left Borders',
          'Right Borders': 'Right Borders',
          'Top Borders': 'Top Borders',
          'Bottom Borders': 'Bottom Borders',
          'Inside Borders': 'Inside Borders',
          'Outside Borders': 'Outside Borders'
        }
      },
      onClick: (editor, key) => {
        import('roosterjs').then(({ applyTableBorderFormat }) => {
          // RoosterJS TableBorder enum equivalent: All=1, No=2, Left=3, Right=4, Top=5, Bottom=6, Inside=7, Outside=8
          const map = {
            'All Borders': 1, 'No Borders': 2, 'Left Borders': 3, 'Right Borders': 4,
            'Top Borders': 5, 'Bottom Borders': 6, 'Inside Borders': 7, 'Outside Borders': 8
          };
          if (map[key]) applyTableBorderFormat(editor, map[key]);
        });
      }
    },
    {
      ...textColorButton,
      key: 'table9',
      unlocalizedText: 'Table Border Color',
      iconName: 'ColorSolid',
      onClick: () => { }
    },
    {
      key: 'table10',
      unlocalizedText: 'Table Border Width',
      iconName: 'LineThickness',
      dropDownMenu: {
        items: {
          '1/4 pt': '1/4 pt', '1/2 pt': '1/2 pt', '3/4 pt': '3/4 pt', '1 pt': '1 pt',
          '1 1/2 pt': '1 1/2 pt', '2 1/4 pt': '2 1/4 pt', '3 pt': '3 pt', '4 1/2 pt': '4 1/2 pt', '6 pt': '6 pt'
        }
      },
      onClick: () => { }
    },
    {
      key: 'table11',
      unlocalizedText: 'Table Border Style',
      iconName: 'LineStyle',
      dropDownMenu: {
        items: {
          'Solid': 'Solid', 'Dashed': 'Dashed', 'Dotted': 'Dotted', 'Double': 'Double'
        }
      },
      onClick: () => { }
    },
    {
      key: 'table12',
      unlocalizedText: 'Merge',
      iconName: '',
      commandBarProperties: { text: 'Merge', name: 'Merge', iconOnly: false },
      dropDownMenu: {
        items: {
          'Merge cells': 'Merge cells', 'Merge right': 'Merge right', 'Merge down': 'Merge down', 'Merge above': 'Merge above', 'Merge left': 'Merge left', 'Unmerge cells': 'Unmerge cells'
        }
      },
      onClick: (editor, key) => {
        const opMap = {
          'Merge cells': 'mergeCells', 'Merge right': 'mergeRight', 'Merge down': 'mergeBelow',
          'Merge above': 'mergeAbove', 'Merge left': 'mergeLeft'
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) editTable(editor, opMap[key]);
        });
      }
    },
    {
      key: 'table13',
      unlocalizedText: 'Split',
      iconName: '',
      commandBarProperties: { text: 'Split', name: 'Split', iconOnly: false },
      dropDownMenu: {
        items: {
          'Split cell horizontally': 'Split cell horizontally', 'Split cell vertically': 'Split cell vertically'
        }
      },
      onClick: (editor, key) => {
        const opMap = {
          'Split cell horizontally': 'splitHorizontally', 'Split cell vertically': 'splitVertically'
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) editTable(editor, opMap[key]);
        });
      }
    },
    {
      key: 'table14',
      unlocalizedText: 'Align table cell',
      iconName: '',
      commandBarProperties: { text: 'Align table cell', name: 'Align table cell', iconOnly: false },
      dropDownMenu: {
        items: {
          'Top left': 'Top left', 'Top center': 'Top center', 'Top right': 'Top right',
          'Middle left': 'Middle left', 'Middle center': 'Middle center', 'Middle right': 'Middle right',
          'Bottom left': 'Bottom left', 'Bottom center': 'Bottom center', 'Bottom right': 'Bottom right'
        }
      },
      onClick: (editor, key) => {
        const opMap = {
          'Top left': ['alignCellTop', 'alignCellLeft'], 'Top center': ['alignCellTop', 'alignCellCenter'], 'Top right': ['alignCellTop', 'alignCellRight'],
          'Middle left': ['alignCellMiddle', 'alignCellLeft'], 'Middle center': ['alignCellMiddle', 'alignCellCenter'], 'Middle right': ['alignCellMiddle', 'alignCellRight'],
          'Bottom left': ['alignCellBottom', 'alignCellLeft'], 'Bottom center': ['alignCellBottom', 'alignCellCenter'], 'Bottom right': ['alignCellBottom', 'alignCellRight']
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) {
            editTable(editor, opMap[key][0]);
            editTable(editor, opMap[key][1]);
          }
        });
      }
    },
    {
      key: 'table15',
      unlocalizedText: 'Align table',
      iconName: '',
      commandBarProperties: { text: 'Align table', name: 'Align table', iconOnly: false },
      dropDownMenu: {
        items: {
          'Left': 'Left', 'Center': 'Center', 'Right': 'Right'
        }
      },
      onClick: (editor, key) => {
        const opMap = {
          'Left': 'alignLeft', 'Center': 'alignCenter', 'Right': 'alignRight'
        };
        import('roosterjs').then(({ editTable }) => {
          if (opMap[key]) editTable(editor, opMap[key]);
        });
      }
    }
  ];

  const imageButtons = useMemo(() => [
    customInsertImageButton,
    {
      key: 'imageOptionsDropdown',
      unlocalizedText: 'More options',
      iconName: 'More',
      commandBarProperties: {
        text: 'More options',
        iconOnly: true,
        subMenuProps: {
          items: [
            {
              key: 'imageBorderColor',
              text: 'Image Border Color',
              iconProps: { iconName: 'ColorSolid' },
              subMenuProps: {
                items: ['#000000', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff', '#cccccc', 'transparent'].map(color => ({
                  key: color,
                  text: color === 'transparent' ? 'Transparent' : color,
                  onClick: () => {
                    if (editorRef.current) setImageBorder(editorRef.current, { color });
                  }
                }))
              }
            },
            {
              key: 'imageBorderWidth',
              text: 'Image Border Width',
              iconProps: { iconName: 'LineThickness' },
              subMenuProps: {
                items: ['1/4 pt', '1/2 pt', '3/4 pt', '1 pt', '1 1/2 pt', '2 1/4 pt', '3 pt', '4 1/2 pt', '6 pt'].map(pt => ({
                  key: pt,
                  text: pt,
                  onClick: () => {
                    const width = pt === '1/4 pt' ? '0.25pt' : pt === '1/2 pt' ? '0.5pt' : pt === '3/4 pt' ? '0.75pt' : pt === '1 1/2 pt' ? '1.5pt' : pt === '2 1/4 pt' ? '2.25pt' : pt === '4 1/2 pt' ? '4.5pt' : pt;
                    if (editorRef.current) setImageBorder(editorRef.current, { width });
                  }
                }))
              }
            },
            {
              key: 'imageBorderStyle',
              text: 'Image Border Style',
              iconProps: { iconName: 'BorderDash' },
              subMenuProps: {
                items: ['Solid', 'Dashed', 'Dotted', 'Double'].map(style => ({
                  key: style,
                  text: style,
                  onClick: () => {
                    if (editorRef.current) setImageBorder(editorRef.current, { style: style.toLowerCase() });
                  }
                }))
              }
            },
            {
              key: 'removeImageBorder',
              text: 'Remove Image Border',
              iconProps: { iconName: 'Cancel' },
              onClick: () => {
                if (editorRef.current) setImageBorder(editorRef.current, null);
              }
            },
            {
              key: 'changeImage',
              text: 'Change Image',
              iconProps: { iconName: 'ImageSearch' },
              onClick: () => handleChangeSelectedImage()
            },
            {
              key: 'imageShadow',
              text: 'Image Shadow',
              iconProps: { iconName: 'Picture' },
              subMenuProps: {
                items: ['noShadow', 'bottomRight', 'bottom', 'bottomLeft', 'right', 'center', 'left', 'topRight', 'top', 'topLeft'].map(key => ({
                  key,
                  text: key,
                  onClick: () => {
                    const shadowMap = {
                      'noShadow': '', 'bottomRight': '2px 2px 5px rgba(0,0,0,0.5)', 'bottom': '0px 2px 5px rgba(0,0,0,0.5)',
                      'bottomLeft': '-2px 2px 5px rgba(0,0,0,0.5)', 'right': '2px 0px 5px rgba(0,0,0,0.5)', 'center': '0px 0px 5px rgba(0,0,0,0.5)',
                      'left': '-2px 0px 5px rgba(0,0,0,0.5)', 'topRight': '2px -2px 5px rgba(0,0,0,0.5)', 'top': '0px -2px 5px rgba(0,0,0,0.5)', 'topLeft': '-2px -2px 5px rgba(0,0,0,0.5)'
                    };
                    if (editorRef.current) setImageBoxShadow(editorRef.current, shadowMap[key] || '');
                  }
                }))
              }
            },
            {
              key: 'imageCrop',
              text: 'Crop',
              iconProps: { iconName: 'Crop' },
              onClick: () => { }
            },
            {
              key: 'imageRotate',
              text: 'Rotate image',
              iconProps: { iconName: 'Sync' },
              subMenuProps: {
                items: ['Left', 'Right'].map(dir => ({
                  key: dir,
                  text: dir,
                  onClick: () => {
                    if (!editorRef.current) return;
                    const selectedImg = getSelectedImage();
                    if (selectedImg && selectedImg.tagName === 'IMG') {
                      const rotate = dir === 'Left' ? 'rotate(-90deg)' : 'rotate(90deg)';
                      selectedImg.style.transform = selectedImg.style.transform === rotate ? '' : rotate;
                      // Mutating .style directly never fires a RoosterJS
                      // plugin event, so editorSyncPlugin never re-syncs —
                      // the rotation looked applied but was silently lost on
                      // Save (never included in the saved html_content).
                      handleChange(getEditorHtml(editorRef.current));
                    }
                  }
                }))
              }
            },
            {
              key: 'imageFlip',
              text: 'Flip image',
              iconProps: { iconName: 'Sort' },
              subMenuProps: {
                items: ['Flip Horizontally', 'Flip Vertically'].map(flip => ({
                  key: flip,
                  text: flip,
                  onClick: () => {
                    if (!editorRef.current) return;
                    const selectedImg = getSelectedImage();
                    if (selectedImg && selectedImg.tagName === 'IMG') {
                      const scale = flip === 'Flip Horizontally' ? 'scaleX(-1)' : 'scaleY(-1)';
                      selectedImg.style.transform = selectedImg.style.transform === scale ? '' : scale;
                      handleChange(getEditorHtml(editorRef.current));
                    }
                  }
                }))
              }
            },
            {
              key: 'imageSize',
              text: 'Size',
              iconProps: { iconName: 'SizeLegacy' },
              subMenuProps: {
                items: ['Best fit', 'Small', 'Medium', 'Original'].map(size => ({
                  key: size,
                  text: size,
                  onClick: () => {
                    if (!editorRef.current) return;
                    const selectedImg = getSelectedImage();
                    if (selectedImg && selectedImg.tagName === 'IMG') {
                      if (size === 'Best fit') { selectedImg.style.width = '100%'; selectedImg.style.height = 'auto'; }
                      else if (size === 'Small') { selectedImg.style.width = '25%'; selectedImg.style.height = 'auto'; }
                      else if (size === 'Medium') { selectedImg.style.width = '50%'; selectedImg.style.height = 'auto'; }
                      else if (size === 'Original') { selectedImg.style.width = ''; selectedImg.style.height = ''; }
                      handleChange(getEditorHtml(editorRef.current));
                    }
                  }
                }))
              }
            }
          ]
        }
      },
      onClick: () => { }
    }
  ], [getSelectedImage, customInsertImageButton, handleChange, handleChangeSelectedImage]);

  const videoButtons = useMemo(() => [
    customInsertVideoButton,
    {
      key: 'videoWidth',
      unlocalizedText: 'Width',
      iconName: 'SizeLegacy',
      dropDownMenu: { items: { '25%': '25%', '50%': '50%', '100%': '100%' } },
      onClick: (editor, key) => {
        const vid = getSelectedVideo();
        if (vid) vid.style.width = key;
      }
    },
    {
      key: 'videoAutoplay',
      unlocalizedText: 'Toggle Autoplay',
      iconName: 'Play',
      onClick: () => {
        const vid = getSelectedVideo();
        if (vid) vid.autoplay = !vid.autoplay;
      }
    },
    {
      key: 'videoControls',
      unlocalizedText: 'Toggle Controls',
      iconName: 'Settings',
      onClick: () => {
        const vid = getSelectedVideo();
        if (vid) vid.controls = !vid.controls;
      }
    },
    {
      key: 'videoMuted',
      unlocalizedText: 'Toggle Mute',
      iconName: 'VolumeDisabled',
      onClick: () => {
        const vid = getSelectedVideo();
        if (vid) vid.muted = !vid.muted;
      }
    },
    {
      key: 'videoLoop',
      unlocalizedText: 'Toggle Loop',
      iconName: 'RepeatAll',
      onClick: () => {
        const vid = getSelectedVideo();
        if (vid) vid.loop = !vid.loop;
      }
    }
  ], [getSelectedVideo, customInsertVideoButton]);

  // Global right-side buttons handled inline to access state

  const handleContainerBlur = useCallback(() => {
    if (editorRef.current) {
      handleChange(getEditorHtml(editorRef.current));
    }
  }, [handleChange]);

  const handleMediaBtnClick = useCallback((inputRef) => {
    if (isFullscreen) {
      inputRef.current?.click();
    } else {
      setIsFullscreen(true);
      setTimeout(() => inputRef.current?.click(), 80);
    }
  }, [isFullscreen]);

  // Mirrors handleVideoUpload/handlePdfUpload/handleFileUpload below — all
  // three upload to the SFTP-backed HomeMedia pipeline via their handler's
  // ingestFile() and insert a URL-based markup. This one used to instead
  // FileReader.readAsDataURL() the image straight into the DOM as a raw
  // base64 <img src="data:...">, bypassing upload entirely: no size/type
  // validation, no SFTP storage, and bloating the saved html_content (and
  // the Oracle CLOB it's stored in) with inline image bytes on every save.
  // ImageHandler.ingestFile/buildImageMarkup already existed and are used
  // correctly by paste/drag-drop (EditableArea.jsx) — this toolbar button
  // just never called them.
  const handleImageUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;
    e.target.value = '';
    try {
      toast.info?.('Uploading image…');
      const result = await ImageHandler.ingestFile(file);
      const markup = ImageHandler.buildImageMarkup({ url: result.url, alt: file.name });
      insertRawHtml(editorRef.current, markup);
      handleChange(getEditorHtml(editorRef.current));
    } catch (err) {
      toast.error(err?.message || 'Image upload failed');
    }
  }, [handleChange, toast]);

  const handleVideoUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;
    e.target.value = '';
    if (!VideoHandler.isSupportedVideoFile(file)) {
      toast.error('Unsupported video format. Use MP4, WebM or OGG.');
      return;
    }
    try {
      toast.info?.('Uploading video…');
      const result = await VideoHandler.ingestFile(file);
      const markup = VideoHandler.buildVideoMarkup({ url: result.url, filename: file.name, filesize: file.size, mime: file.type });
      insertRawHtml(editorRef.current, markup);
      handleChange(getEditorHtml(editorRef.current));
    } catch (err) {
      // assertWithinSizeLimit's message (e.g. "'clip.mp4' is 25.3 MB — the
      // limit is 19MB.") was previously discarded in favor of this generic
      // text, so a video rejected for being too large looked identical to
      // any other failure — the user just saw "upload failed" with no way
      // to tell it was a size cap. EditableArea's own paste/drag-drop path
      // already surfaces err.message; this now matches it.
      toast.error(err?.message || 'Video upload failed');
    }
  }, [handleChange, toast]);

  const handlePdfUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;
    e.target.value = '';
    try {
      toast.info?.('Uploading PDF…');
      const result = await PdfHandler.ingestFile(file);
      const markup = PdfHandler.buildPdfMarkup({ id: result.id, url: result.url, filename: file.name, filesize: file.size });
      insertRawHtml(editorRef.current, markup);
      handleChange(getEditorHtml(editorRef.current));
    } catch (err) {
      toast.error(err?.message || 'PDF upload failed');
    }
  }, [handleChange, toast]);

  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editorRef.current) return;
    e.target.value = '';
    if (!AttachmentHandler.isSupportedAttachment(file)) {
      toast.error('Unsupported file type. Use doc, docx, xls, xlsx, ppt, pptx or zip.');
      return;
    }
    try {
      toast.info?.('Uploading file…');
      const result = await AttachmentHandler.ingestFile(file);
      const markup = AttachmentHandler.buildAttachmentMarkup({ id: result.id, url: result.url, filename: file.name, filesize: file.size, mime: file.type });
      insertRawHtml(editorRef.current, markup);
      handleChange(getEditorHtml(editorRef.current));
    } catch (err) {
      toast.error(err?.message || 'File upload failed');
    }
  }, [handleChange, toast]);

  const tabs = ['Main', 'Text', 'Paragraph', 'Insert', 'Table', 'Image', 'Video'];

  const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
      chunked.push(array.slice(i, i + size));
    }
    return chunked;
  };

  const getActiveButtons = () => {
    switch (activeTab) {
      case 'Main': {
        const all = [...mainButtons, ...tableButtons, ...imageButtons, ...videoButtons];
        // Deduplicate buttons (like insertImageButton) which exist in both main and contextual arrays
        return all.filter((btn, idx) => all.indexOf(btn) === idx);
      }
      case 'Text': return textButtons;
      case 'Paragraph': return paragraphButtons;
      case 'Insert': return insertButtons;
      case 'Table': return tableButtons;
      case 'Image': return imageButtons;
      case 'Video': return videoButtons;
      default:
        return mainButtons;
    }
  };

  // We removed maroonBase and maroonLight; styling will use CSS variables.

  return (
    <>
      <div
        className={`rte-root rooster-custom-container ${isFullscreen ? 'rte-fullscreen' : ''}`}
        style={isFullscreen ? { zIndex: 9999, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#fff', display: 'flex', flexDirection: 'column' } : {}}
        onBlur={handleContainerBlur}
        onKeyUp={handleContainerBlur}
        onClick={(e) => {
          handleEditorClick(e);
          if (tableContextMenu.visible) setTableContextMenu(prev => ({ ...prev, visible: false }));
        }}
        onContextMenu={(e) => {
          const targetCell = e.target.closest('td, th');
          if (targetCell) {
            e.preventDefault();
            e.stopPropagation();
            setTableContextMenu({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              targetCell,
              targetTable: targetCell.closest('table')
            });
            // Ensure RoosterJS selects this cell so commands apply here
            if (editorRef.current) {
               try { editorRef.current.select(targetCell); } catch(err) {}
            }
          } else if (isFullscreen) {
            e.preventDefault();
          }
        }}
        onMouseEnter={() => document.body.classList.add('rte-hide-fluent-tooltips')}
        onMouseLeave={(e) => {
          document.body.classList.remove('rte-hide-fluent-tooltips');
          // Also hide our custom tooltip just in case
          setTooltipState({ visible: false, title: '', targetRect: null });
        }}
        onMouseOver={(e) => {
          const target = e.target.closest('button, [role="menuitem"], [role="button"]');
          if (target && target.closest('.ms-CommandBar, .ms-ContextualMenu')) {
            let title = target.getAttribute('title');
            if (title) {
              target.setAttribute('data-r-title', title);
              target.removeAttribute('title');
            } else {
              title = target.getAttribute('data-r-title');
            }
            if (!title) title = target.getAttribute('aria-label');
            if (!title) title = target.getAttribute('name');
            if (title && title !== 'Unknown') {
              setTooltipState({ visible: true, title, targetRect: target.getBoundingClientRect() });
            }
          }
        }}
        onMouseOut={(e) => {
          setTooltipState({ visible: false, title: '', targetRect: null });
        }}
      >
        <div style={{ background: 'var(--bg-secondary, #f8fafc)', padding: '0', display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-primary, #e2e8f0)' }}>

          {/* Top Row: Tabs + Global Tools */}
          {isFullscreen && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>

              {/* Left side: Tabs */}
              <div style={{ display: 'flex', gap: '6px', padding: '8px 16px 0 16px' }}>
                {tabs.map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      padding: '8px 18px',
                      height: '38px',
                      backgroundColor: activeTab === tab ? 'var(--surface-primary)' : 'var(--surface-primary)',
                      color: activeTab === tab ? 'var(--c-primary)' : 'var(--text-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderBottom: activeTab === tab ? '1px solid var(--surface-primary)' : 'none',
                      borderRadius: '8px 8px 0 0',
                      cursor: 'pointer',
                      fontWeight: activeTab === tab ? '600' : '500',
                      fontSize: '13px',
                      zIndex: activeTab === tab ? 2 : 1,
                      outline: 'none',
                      marginBottom: activeTab === tab ? '-1px' : '0',
                      boxShadow: activeTab === tab ? '0 -2px 6px rgba(0, 0, 0, 0.02)' : 'none'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Right side: Global Actions */}
              <div style={{ display: 'flex', alignItems: 'center', paddingRight: '8px' }}>
                <Ribbon plugin={ribbonPlugin} styles={RIBBON_STYLES} buttons={[undoButton, redoButton]} />
                <Ribbon plugin={ribbonPlugin} styles={RIBBON_STYLES} buttons={[
                  {
                    key: 'zoomDropdown',
                    unlocalizedText: 'Zoom',
                    iconName: 'ZoomIn',
                    dropDownMenu: {
                      items: {
                        '50': '50%',
                        '75': '75%',
                        '100': '100%',
                        '200': '200%'
                      }
                    },
                    onClick: (editor, key) => {
                      const root = document.querySelector('.rte-root div[contenteditable="true"]');
                      if (root) {
                        root.style.transformOrigin = 'top left';
                        if (key === '100') {
                          root.style.transform = 'scale(1)';
                          root.style.width = '100%';
                        } else {
                          const scale = parseInt(key, 10) / 100;
                          root.style.transform = `scale(${scale})`;
                          root.style.width = `${100 / scale}%`;
                        }
                      }
                    }
                  }
                ]} />
                <Ribbon plugin={ribbonPlugin} styles={RIBBON_STYLES} buttons={[
                  {
                    key: 'fullScreenToggle',
                    unlocalizedText: isFullscreen ? 'Exit Full Screen' : 'Full Screen',
                    iconName: isFullscreen ? 'BackToWindow' : 'FullScreen',
                    onClick: () => setIsFullscreen(!isFullscreen)
                  }
                ]} />
              </div>
            </div>
          )}

          {/* Toolbar: Non-fullscreen — 3 row layout matching the reference image */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              {!isFullscreen ? (
                // ── Non-fullscreen compact toolbar ──
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0', width: '100%' }}>
                  {/* Row 1: Undo/Redo + Text formatting */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--border-primary, #e2e8f0)', padding: '2px 4px' }}>
                    <Ribbon plugin={ribbonPlugin} styles={RIBBON_STYLES} buttons={[undoButton, redoButton, ...textButtons]} />
                  </div>
                  {/* Row 2: Paragraph formatting */}
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--border-primary, #e2e8f0)', padding: '2px 4px' }}>
                    <Ribbon plugin={ribbonPlugin} styles={RIBBON_STYLES} buttons={paragraphButtons} />
                  </div>
                  {/* Row 3: Insert / Media / Fullscreen */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '2px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                      <Ribbon plugin={ribbonPlugin} styles={RIBBON_STYLES} buttons={insertButtons} />
                      <div style={{ width: '1px', height: '16px', background: 'var(--border-primary, #e2e8f0)', margin: '0 4px' }} />
                      <button type="button" onClick={() => handleMediaBtnClick(imgInputRef)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid var(--border-primary)', borderRadius: '4px', background: 'var(--surface-primary)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="14" height="14" rx="2" /><circle cx="5.5" cy="5.5" r="1.5" /><path d="M1 11l4-4 3 3 2-2 5 5" /></svg>
                        Image
                      </button>
                      <button type="button" onClick={() => handleMediaBtnClick(videoInputRef)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid var(--border-primary)', borderRadius: '4px', background: 'var(--surface-primary)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="10" height="10" rx="1.5" /><path d="M11 6l4-2v8l-4-2V6z" /></svg>
                        Video
                      </button>
                      <button type="button" onClick={() => handleMediaBtnClick(pdfInputRef)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid var(--border-primary)', borderRadius: '4px', background: 'var(--surface-primary)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z" /><path d="M9 1v5h5" /></svg>
                        PDF
                      </button>
                      <button type="button" onClick={() => handleMediaBtnClick(fileInputRef)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', border: '1px solid var(--border-primary)', borderRadius: '4px', background: 'var(--surface-primary)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 2a1 1 0 011-1h7l4 4v9a1 1 0 01-1 1H3a1 1 0 01-1-1V2z" /><path d="M9 1v4h4" /></svg>
                        File
                      </button>
                    </div>
                    {/* Fullscreen green button */}
                    <button
                      type="button"
                      onClick={() => setIsFullscreen(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '4px', border: 'none', background: '#006633', color: '#fff', cursor: 'pointer', flexShrink: 0, marginLeft: '8px' }}
                      title="Full Screen"
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M1 1h5v1.5H2.5V7H1V1zm9 0h5v6h-1.5V2.5H10V1zM1 9h1.5v4.5H7V15H1V9zm13 4.5H10V15h5V9h-1.5v4.5z" /></svg>
                    </button>
                  </div>
                </div>
              ) : (
                // Fullscreen mode format toolbar
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', width: '100%', padding: '2px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexGrow: 1, flexWrap: 'wrap' }}>
                    {activeTab === 'Main' ? (
                      <Ribbon plugin={ribbonPlugin} styles={RIBBON_STYLES} buttons={getActiveButtons()} />
                    ) : (
                      getActiveButtons().map((btn, index) => (
                        <Ribbon key={btn.key || index} plugin={ribbonPlugin} styles={RIBBON_STYLES} buttons={[btn]} />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hidden file inputs for media upload */}
          <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
          <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/ogg" style={{ display: 'none' }} onChange={handleVideoUpload} />
          <input ref={pdfInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handlePdfUpload} />
          <input ref={fileInputRef} type="file" accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" style={{ display: 'none' }} onChange={handleFileUpload} />

          {/* Fullscreen bottom border line under tools */}
          {isFullscreen && <div style={{ borderBottom: '1px solid var(--border-primary)', marginTop: '4px', marginBottom: '4px' }} />}
        </div>

        {/* Editor area: In fullscreen split left=HTML preview, right=editor */}
        <div style={{ display: 'flex', flexDirection: isFullscreen ? 'row' : 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 }}>
            <div
              ref={wrapperRef}
              onMouseDownCapture={handleEditorClick}
              onClickCapture={handleEditorClick}
              className={!value || value.trim() === '<div><br></div>' || value.trim() === '' || value.trim() === '<p><br></p>' || value.trim() === '<br>' ? 'rte-empty' : ''}
              data-placeholder={placeholder}
              style={{ position: 'relative', borderTop: isFullscreen ? 'none' : '1px solid var(--border-primary)', borderLeft: isFullscreen ? 'none' : '1px solid var(--border-primary)', borderRight: isFullscreen ? 'none' : '1px solid var(--border-primary)', flex: 1, minHeight: isFullscreen ? 0 : '300px', padding: '16px', background: 'var(--surface-primary)', borderBottomLeftRadius: showHtmlPreview ? '0' : '6px', borderBottomRightRadius: showHtmlPreview ? '0' : '6px', borderBottom: isFullscreen ? 'none' : (showHtmlPreview ? 'none' : '1px solid var(--border-primary)'), overflowY: 'auto' }}>
              <Rooster
                plugins={plugins}
                initialContent={initialValue}
              />
            </div>
            <div style={{ borderTop: showHtmlPreview ? 'none' : '1px solid var(--border-primary)', borderLeft: '1px solid var(--border-primary)', borderRight: '1px solid var(--border-primary)', borderBottom: '1px solid var(--border-primary)', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px', background: 'var(--surface-primary)' }}>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '8px 0 8px 12px',
                  color: 'var(--c-primary)',
                  borderBottom: showHtmlPreview ? '1px solid var(--border-primary)' : 'none'
                }}
                onClick={toggleSourceView}
              >
                {showHtmlPreview ? 'Apply and Hide HTML Source' : 'Edit HTML Source'}
              </button>
              {showHtmlPreview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', background: 'var(--bg-secondary)', borderBottomLeftRadius: '6px', borderBottomRightRadius: '6px', maxHeight: '400px', overflowY: 'auto' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Edit HTML Source</span>
                    </div>
                    <textarea style={{
                      width: '100%',
                      minHeight: '200px',
                      margin: 0,
                      padding: '12px 14px',
                      fontSize: '11px',
                      color: 'var(--text-primary)',
                      background: 'var(--surface-primary)',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      fontFamily: 'monospace',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '6px',
                      resize: 'vertical'
                    }}
                      value={sourceHtmlState}
                      onChange={(e) => {
                        sourceHtmlRef.current = e.target.value;
                        setSourceHtmlState(e.target.value);
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

          </div>


        </div>
        {isFullscreen && (
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              border: '1px solid var(--c-primary)',
              borderRadius: '6px',
              background: 'var(--c-primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 9999
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back
          </button>
        )}

      </div>
      <InsertLinkModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        onInsert={handleLinkInsert}
      />
      <ProgressTooltip
        visible={tooltipState.visible}
        title={tooltipState.title}
        targetRect={tooltipState.targetRect}
        placement="bottom"
        state="none"
      />
      {tableContextMenu.visible && ReactDOM.createPortal(
        <div 
          className="rte-table-context-menu"
          style={{
            position: 'fixed',
            top: tableContextMenu.y,
            left: tableContextMenu.x,
            zIndex: 10000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rte-context-menu-item" onClick={() => {
            const color = prompt('Enter text color (e.g. #ff0000 or red):');
            if (color && editorRef.current) {
              import('roosterjs').then(({ setTextColor }) => {
                setTextColor(editorRef.current, color);
              });
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Text Color
          </div>
          <div className="rte-context-menu-item" onClick={() => {
            const color = prompt('Enter table shade color (e.g. #cccccc or gray):');
            if (color && editorRef.current) {
              import('roosterjs').then(({ setTableCellShade }) => {
                setTableCellShade(editorRef.current, color);
              });
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Table Color
          </div>
          <div className="rte-context-menu-divider" />
          <div className="rte-context-menu-item" onClick={() => {
            if (editorRef.current) {
              import('roosterjs').then(({ editTable }) => editTable(editorRef.current, 'insertAbove'));
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Insert Row Above
          </div>
          <div className="rte-context-menu-item" onClick={() => {
            if (editorRef.current) {
              import('roosterjs').then(({ editTable }) => editTable(editorRef.current, 'insertBelow'));
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Insert Row Below
          </div>
          <div className="rte-context-menu-item" onClick={() => {
            if (editorRef.current) {
              import('roosterjs').then(({ editTable }) => editTable(editorRef.current, 'insertLeft'));
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Insert Column Left
          </div>
          <div className="rte-context-menu-item" onClick={() => {
            if (editorRef.current) {
              import('roosterjs').then(({ editTable }) => editTable(editorRef.current, 'insertRight'));
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Insert Column Right
          </div>
          <div className="rte-context-menu-divider" />
          <div className="rte-context-menu-item" onClick={() => {
            if (editorRef.current) {
              import('roosterjs').then(({ editTable }) => editTable(editorRef.current, 'deleteRow'));
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Delete Row
          </div>
          <div className="rte-context-menu-item" onClick={() => {
            if (editorRef.current) {
              import('roosterjs').then(({ editTable }) => editTable(editorRef.current, 'deleteColumn'));
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Delete Column
          </div>
          <div className="rte-context-menu-item" onClick={() => {
            if (editorRef.current) {
              import('roosterjs').then(({ editTable }) => editTable(editorRef.current, 'deleteTable'));
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Delete Table
          </div>
          <div className="rte-context-menu-divider" />
          <div className="rte-context-menu-item" onClick={() => {
            if (editorRef.current) {
              import('roosterjs').then(({ editTable }) => editTable(editorRef.current, 'mergeCells'));
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Merge Cells
          </div>
          <div className="rte-context-menu-item" onClick={() => {
            if (editorRef.current) {
              import('roosterjs').then(({ editTable }) => editTable(editorRef.current, 'splitVertically'));
            }
            setTableContextMenu(prev => ({ ...prev, visible: false }));
          }}>
            Split Cell
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default RichEditor;
