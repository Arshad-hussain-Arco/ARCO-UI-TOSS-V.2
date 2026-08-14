import { useEffect, useMemo, useRef, useState } from 'react';
import { useToast } from '@hooks/useToast';
import { RichEditorContext } from './RichEditorContext';
import { createHistoryManager } from './HistoryManager';
import { sanitizeEditorHtml } from './sanitize';
import {
  restoreSelection, saveSelection, getSavedSelection, insertBlockAtSelection, cleanupPendingStyleSpan,
} from './SelectionManager';
import { insertHtmlAtSelection } from './ClipboardManager';
import { useFullscreenManager } from './FullscreenManager';
import { Toolbar } from './Toolbar';
import { EditableArea } from './EditableArea';
import { Preview } from './Preview';
import './RichEditor.css';

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
  // Set-with-collapsed-caret style (font size/color/highlight) parks its
  // pending span here until the user types into it or moves away — see
  // SelectionManager.applyPendingCaretStyle. The currently-selected media
  // wrapper (image/video, for the alignment buttons) lives here too, kept
  // in sync by EditableArea's own selection handling.
  const pendingStyleSpanRef = useRef(null);
  const selectedMediaRef = useRef(null);
  const { isFullscreen, toggle: toggleFullscreen, exit: exitFullscreen } = useFullscreenManager();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [, forceRerender] = useState(0);

  // Toggles the placeholder visibility class. The editable area always
  // has at least a seeded <p><br></p> shell (see the effects below), so
  // CSS :empty never matches — "empty" here means no real text content.
  const updateEmptyState = (el) => {
    el.classList.toggle('rte-empty', el.textContent.trim().length === 0);
  };

  const flushOutwardNow = () => {
    const el = editableRef.current;
    if (!el) return;
    updateEmptyState(el);
    const html = sanitizeEditorHtml(el.innerHTML);
    lastEmittedRef.current = html;
    onChange?.(html);
    forceRerender((n) => n + 1); // refresh toolbar active-state indicators
  };

  // Keep a ref to the latest closure so the debounced function (created
  // once, below) always calls the current `onChange` rather than whichever
  // one was in scope on mount.
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

  // Mount: seed the editable area and history with the initial value. An
  // empty value seeds a real <p><br></p> shell rather than '' — typing
  // into a truly empty contenteditable lands text as a bare text node
  // directly under the root in most browsers, which every block-level
  // command (lists/headings/alignment/indent/quote) can't operate on.
  useEffect(() => {
    if (editableRef.current) {
      editableRef.current.innerHTML = value?.trim() ? value : '<p><br></p>';
      lastEmittedRef.current = value || '';
      history.reset(value || '');
      updateEmptyState(editableRef.current);
    }
    // Intentionally run only on mount — RichEditor is remounted via a
    // `key` prop by the parent whenever switching between cards/Add-Edit,
    // so this never needs to react to `value` changing mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Genuine external value change (rare given the `key` remount pattern,
  // but guards against it anyway) — only overwrite the DOM when the
  // incoming value differs from what this component itself last emitted.
  useEffect(() => {
    if (value !== lastEmittedRef.current && editableRef.current) {
      editableRef.current.innerHTML = value?.trim() ? value : '<p><br></p>';
      lastEmittedRef.current = value || '';
      history.reset(value || '');
      updateEmptyState(editableRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Cleans up a leftover pending-caret-style span the moment the caret
  // moves away from it without the user having typed anything real into
  // it (see applyPendingCaretStyle) — e.g. they set a font size, then
  // just clicked elsewhere instead of continuing to type.
  useEffect(() => {
    const handler = () => cleanupPendingStyleSpan(pendingStyleSpanRef);
    document.addEventListener('selectionchange', handler);
    return () => document.removeEventListener('selectionchange', handler);
  }, []);

  /** Runs a command against the current/saved selection, wrapped in a
   * before+after history checkpoint (programmatic DOM mutations never
   * fire a native `input` event, so checkpoints must be explicit here). */
  const runCommand = (commandFn) => {
    const el = editableRef.current;
    if (!el) return;

    if (document.activeElement !== el) {
      restoreSelection(el, getSavedSelection());
    }

    const sel = window.getSelection();
    const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;

    history.checkpointNow();
    commandFn(range, el);
    history.checkpointNow();
    flushOutwardNow();
  };

  /** Inserts an HTML fragment at the current/saved selection as one atomic,
   * checkpointed operation — used for pasted text/HTML, which should flow
   * inline with the surrounding content rather than split it. */
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

  /** Inserts block-level media (image/video/PDF/attachment) at the caret,
   * splitting the containing paragraph around it instead of embedding a
   * block element as an inline sibling of the surrounding text (which
   * renders as a jarring break mid-line — see insertBlockAtSelection). */
  const insertMediaHtml = (html) => {
    const el = editableRef.current;
    if (!el) return;

    if (document.activeElement !== el) {
      restoreSelection(el, getSavedSelection());
    }

    history.checkpointNow();
    insertBlockAtSelection(html, el);
    history.checkpointNow();
    flushOutwardNow();
  };

  // Deliberately not memoized: runCommand/insertContentHtml/flushOutwardNow
  // close over `onChange` and must stay fresh every render, and the refs/
  // hooks below are cheap to re-read. A stale-but-memoized value here would
  // risk calling an outdated onChange if the parent ever passes a
  // non-stable callback.
  const contextValue = {
    editableRef,
    history,
    runCommand,
    insertContentHtml,
    insertMediaHtml,
    flushOutwardNow,
    scheduleOutwardSync,
    saveSelection: () => saveSelection(editableRef.current),
    toast,
    tableSelectionRef,
    pendingStyleSpanRef,
    selectedMediaRef,
    isFullscreen,
    toggleFullscreen,
  };

  return (
    <RichEditorContext.Provider value={contextValue}>
      <div className={`rte-root ${isFullscreen ? 'rte-fullscreen' : ''}`}>
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
