import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@hooks/useToast';
import { RichEditorContext } from './RichEditorContext';
import { createHistoryManager } from './HistoryManager';
import { sanitizeEditorHtml } from './sanitize';
import {
  restoreSelection, saveSelection, getSavedSelection, insertBlockAtSelection, cleanupPendingStyleSpan,
  ensureActiveSelectionAndFocus,
} from './SelectionManager';
import { insertHtmlAtSelection } from './ClipboardManager';
import { useFullscreenManager } from './FullscreenManager';
import { Toolbar } from './Toolbar';
import { EditableArea } from './EditableArea';
import { Preview } from './Preview';
import './RichEditor.css';

import { formatFileSize, buildUploadingPlaceholder, fileKindLabel, useHomeMediaToken, attachHomeMediaToken, stripHomeMediaToken } from './mediaUtils';
import * as ImageHandler from './ImageHandler';
import * as VideoHandler from './VideoHandler';
import * as PdfHandler from './PdfHandler';
import * as AttachmentHandler from './AttachmentHandler';

function debounce(fn, wait) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/**
 * Fully custom rich text editor — controlled `value`/`onChange(html)`
 * contract, drop-in replacement for a `<textarea>`. Built from React +
 * contenteditable + native browser APIs only (no third-party RTE library).
 */
export function RichEditor({ value = '', onChange, placeholder }) {
  const toast = useToast();
  const editableRef = useRef(null);
  const lastEmittedRef = useRef(value);
  const tableSelectionRef = useRef({ table: null, anchor: null, cells: new Set() });
  const pendingStyleSpanRef = useRef(null);
  const selectedMediaRef = useRef(null);

  // Permanently mounted file input refs (Root level to guarantee 100% upload reliability across mode switches)
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const attachmentInputRef = useRef(null);

  const { isFullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreenManager();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [, forceRerender] = useState(0);
  // The editor's own contenteditable DOM needs media_token attached to
  // actually load images/videos/PDFs while editing (HomeMediaContentView's
  // GET requires it) — but html_content must never be SAVED with a token
  // baked in, since it expires. displayHtml()/flushOutwardNow below keep
  // "what's in the DOM" (tokenized) and "what's emitted via onChange"
  // (bare) permanently in sync with each other.
  const mediaToken = useHomeMediaToken();
  const displayHtml = (html) => attachHomeMediaToken(html, mediaToken) || html;

  // Toggles the placeholder visibility class.
  const updateEmptyState = (el) => {
    el.classList.toggle('rte-empty', el.textContent.trim().length === 0);
  };

  const flushOutwardNow = () => {
    const el = editableRef.current;
    if (!el) return;
    updateEmptyState(el);
    const html = stripHomeMediaToken(sanitizeEditorHtml(el.innerHTML));
    lastEmittedRef.current = html;
    onChange?.(html);
    forceRerender((n) => n + 1);
  };

  const flushOutwardNowRef = useRef(flushOutwardNow);
  flushOutwardNowRef.current = flushOutwardNow;

  const scheduleOutwardSync = useMemo(
    () => debounce(() => flushOutwardNowRef.current(), 300),
    []
  );

  const history = useMemo(
    () => createHistoryManager(editableRef, null),
    []
  );

  useEffect(() => {
    if (editableRef.current) {
      editableRef.current.innerHTML = displayHtml(value?.trim() ? value : '<p><br></p>');
      lastEmittedRef.current = value || '';
      history.reset(value || '');
      updateEmptyState(editableRef.current);
    }
  }, []);

  useEffect(() => {
    if (value !== lastEmittedRef.current && editableRef.current) {
      editableRef.current.innerHTML = displayHtml(value?.trim() ? value : '<p><br></p>');
      lastEmittedRef.current = value || '';
      history.reset(value || '');
      updateEmptyState(editableRef.current);
    }
  }, [value]);

  useEffect(() => {
    const handler = () => cleanupPendingStyleSpan(pendingStyleSpanRef);
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  const runCommand = (commandFn, options = {}) => {
    const el = editableRef.current;
    if (!el) return;

    if (document.activeElement !== el && !options.skipFocus) {
      restoreSelection(el, getSavedSelection(), options);
    } else if (getSavedSelection()) {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        restoreSelection(el, getSavedSelection(), { skipFocus: true });
      }
    }

    const sel = window.getSelection();
    const range = (sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null) || getSavedSelection();

    history.checkpointNow();
    commandFn(range, el);
    history.checkpointNow();
    flushOutwardNow();
  };

  const insertContentHtml = (html) => {
    const el = editableRef.current;
    if (!el) return;

    if (document.activeElement !== el) {
      restoreSelection(el, getSavedSelection());
    }

    history.checkpointNow();
    insertHtmlAtSelection(html);
    history.checkpointNow();
    flushOutwardNow();
  };

  useEffect(() => {
    if (isFullscreen && editableRef.current) {
      setTimeout(() => {
        ensureActiveSelectionAndFocus(editableRef.current);
      }, 50);
    }
  }, [isFullscreen]);

  const insertMediaHtml = (html) => {
    const el = editableRef.current;
    if (!el) return;

    ensureActiveSelectionAndFocus(el);

    history.checkpointNow();
    insertBlockAtSelection(html, el);
    history.checkpointNow();
    flushOutwardNow();
  };

  const getMediaInputRef = (type) => {
    switch (type) {
      case 'image': return imageInputRef;
      case 'video': return videoInputRef;
      case 'pdf': return pdfInputRef;
      case 'attachment': return attachmentInputRef;
      default: return null;
    }
  };

  const triggerMediaAction = (type) => {
    ensureActiveSelectionAndFocus(editableRef.current);
    saveSelection(editableRef.current);

    // FIRST CLICK (minimized): Maximize editor ONLY, then terminate immediately.
    if (!isFullscreen) {
      toggleFullscreen();
      return; // CRITICAL: Stop execution here. No file input click. No auto-continuation.
    }

    // SECOND CLICK (maximized): Trigger file picker directly from user click gesture.
    const ref = getMediaInputRef(type);
    if (ref?.current) {
      ref.current.value = '';
      ref.current.click();
    }
  };

  const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024; // 40 MB
  const MAX_VIDEO_FILE_SIZE_BYTES = 19 * 1024 * 1024; // 19 MB — matches VideoHandler's MAX_VIDEO_MB / backend HOME_MEDIA_VIDEO_MAX_BYTES

  const handleRootFileSelected = async (e, handler, buildMarkup) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const maxBytes = handler === VideoHandler ? MAX_VIDEO_FILE_SIZE_BYTES : MAX_FILE_SIZE_BYTES;
    if (file.size > maxBytes) {
      toast?.error?.(`"${file.name}" (${formatFileSize(file.size)}) exceeds the ${maxBytes / (1024 * 1024)} MB size limit.`);
      return;
    }

    const { id: placeholderId, html: placeholderHtml } = buildUploadingPlaceholder(fileKindLabel(file));
    insertMediaHtml(placeholderHtml);

    try {
      const ingested = await handler.ingestFile(file);
      const placeholder = editableRef.current?.querySelector(`#${placeholderId}`);
      const finalHtml = displayHtml(buildMarkup(ingested, file));
      if (placeholder) {
        placeholder.outerHTML = finalHtml;
      } else {
        insertMediaHtml(finalHtml);
      }
      history.checkpointNow();
      flushOutwardNow();
    } catch (err) {
      editableRef.current?.querySelector(`#${placeholderId}`)?.remove();
      flushOutwardNow();
      toast?.error?.(err.message || 'Failed to insert file.');
    }
  };

  const contextValue = {
    editableRef,
    history,
    runCommand,
    insertContentHtml,
    insertMediaHtml,
    triggerMediaAction,
    flushOutwardNow,
    scheduleOutwardSync,
    saveSelection: () => saveSelection(editableRef.current),
    toast,
    tableSelectionRef,
    pendingStyleSpanRef,
    selectedMediaRef,
    isFullscreen,
    toggleFullscreen,
    mediaToken,
    displayHtml,
  };

  return (
    <RichEditorContext.Provider value={contextValue}>
      <div className={`rte-root ${isFullscreen ? 'rte-fullscreen' : ''}`}>
        {/* Permanently mounted hidden file inputs at root level for 100% upload stability */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleRootFileSelected(e, ImageHandler, (ing, file) => ImageHandler.buildImageMarkup({ url: ing.url, alt: file.name }))}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm"
          style={{ display: 'none' }}
          onChange={(e) => handleRootFileSelected(e, VideoHandler, (ing) => VideoHandler.buildVideoMarkup({ url: ing.url, filename: ing.filename, filesize: ing.filesize, mime: ing.mime }))}
        />
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleRootFileSelected(e, PdfHandler, (ing) => PdfHandler.buildPdfMarkup(ing))}
        />
        <input
          ref={attachmentInputRef}
          type="file"
          accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"
          style={{ display: 'none' }}
          onChange={(e) => handleRootFileSelected(e, AttachmentHandler, (ing) => AttachmentHandler.buildAttachmentMarkup(ing))}
        />

        <Toolbar />
        <EditableArea placeholder={placeholder} />
        <div className="rte-preview-toggle-row">
          <button
            type="button"
            className="rte-preview-toggle"
            onClick={() => setIsPreviewOpen((v) => !v)}
          >
            {isPreviewOpen ? 'Hide generated HTML preview' : 'Show generated HTML preview'}
          </button>
        </div>
        {isPreviewOpen && <Preview html={value} />}
        {isFullscreen && (
          <button type="button" className="rte-fullscreen-exit-hint" onClick={exitFullscreen}>
            Press ESC or click here to exit fullscreen
          </button>
        )}
      </div>
    </RichEditorContext.Provider>
  );
}

export default RichEditor;
