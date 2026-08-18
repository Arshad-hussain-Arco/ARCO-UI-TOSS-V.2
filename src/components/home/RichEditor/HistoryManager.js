import { captureSelectionPath, restoreSelectionFromPath } from './SelectionManager';

const MAX_STACK = 100;
const CHECKPOINT_DEBOUNCE_MS = 500;

/**
 * Custom undo/redo history, independent of the browser's native
 * contenteditable undo stack. Snapshots full innerHTML strings (content
 * here is a single homepage card — a few KB — so a mutation-diff log
 * isn't worth the complexity) plus a serializable selection path for
 * caret restore across an innerHTML swap.
 *
 * Usage: one instance per EditableArea mount.
 */
export function createHistoryManager(editableElRef, onRestore) {
  let undoStack = [];
  let redoStack = [];
  let debounceTimer = null;
  let isApplyingHistory = false;

  function currentHtml() {
    return editableElRef.current?.innerHTML ?? '';
  }

  function flush() {
    debounceTimer = null;
    const el = editableElRef.current;
    if (!el || isApplyingHistory) return;
    const html = el.innerHTML;
    const last = undoStack[undoStack.length - 1];
    if (last && last.html === html) return;
    undoStack.push({ html, selection: captureSelectionPath(el) });
    if (undoStack.length > MAX_STACK) undoStack.shift();
    redoStack = [];
  }

  function scheduleCheckpoint() {
    if (isApplyingHistory) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(flush, CHECKPOINT_DEBOUNCE_MS);
  }

  /** Flushes any pending debounced checkpoint immediately (call before a
   * programmatic command, e.g. toolbar click, media/table insert). */
  function checkpointNow() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    flush();
  }

  function reset(initialHtml) {
    undoStack = [{ html: initialHtml ?? currentHtml(), selection: null }];
    redoStack = [];
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  function applySnapshot(snap) {
    const el = editableElRef.current;
    if (!el || !snap) return;
    isApplyingHistory = true;
    el.innerHTML = snap.html;
    if (snap.selection) restoreSelectionFromPath(el, snap.selection);
    onRestore?.(snap.html);
    // Release on next tick so the input event our own innerHTML write may
    // trigger doesn't get re-captured as a new checkpoint.
    setTimeout(() => {
      isApplyingHistory = false;
    }, 0);
  }

  function undo() {
    if (undoStack.length <= 1) return;
    checkpointNow();
    const el = editableElRef.current;
    const current = { html: currentHtml(), selection: captureSelectionPath(el) };
    const popped = undoStack.pop();
    redoStack.push(current);
    applySnapshot(undoStack[undoStack.length - 1] ?? popped);
  }

  function redo() {
    if (redoStack.length === 0) return;
    const snap = redoStack.pop();
    undoStack.push(snap);
    applySnapshot(snap);
  }

  function canUndo() {
    return undoStack.length > 1;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  return {
    scheduleCheckpoint,
    checkpointNow,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
    get isApplyingHistory() {
      return isApplyingHistory;
    },
  };
}
