import { useEffect, useState, useRef } from 'react';
import { useRichEditorContext } from './RichEditorContext';
import { cleanPastedHtml, plainTextToHtml } from './ClipboardManager';
import * as ImageHandler from './ImageHandler';
import * as VideoHandler from './VideoHandler';
import * as PdfHandler from './PdfHandler';
import * as AttachmentHandler from './AttachmentHandler';
import { buildGrid, findCellPosition, findAncestorTable, findAncestorCell } from './TableHandler';
import { indent, outdent } from './commands';
import { MediaViewerModal } from '@components/media/MediaViewerModal';

const HANDLE_POSITIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

function clearResizeHandles(root) {
  root.querySelectorAll('.rte-resize-handle').forEach((h) => h.remove());
  root.querySelectorAll('.rte-media-wrap.rte-selected').forEach((w) => w.classList.remove('rte-selected'));
}

function startResize(e, pos, wrapperEl, mediaEl, containerEl, onDone) {
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

function placeCaretAtPoint(x, y) {
  let range = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (range) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

/**
 * The contenteditable surface. Uncontrolled during typing — innerHTML is
 * the live source of truth; RichEditor syncs it out on a debounced input
 * and back in only on a genuine external value change (see RichEditor.jsx).
 */
export function EditableArea({ placeholder = 'Start writing your homepage content...' }) {
  const {
    editableRef,
    history,
    runCommand,
    insertContentHtml,
    insertMediaHtml,
    flushOutwardNow,
    scheduleOutwardSync,
    toast,
    tableSelectionRef,
    selectedMediaRef,
  } = useRichEditorContext();

  const [activeMediaModal, setActiveMediaModal] = useState({ isOpen: false, src: '', fileName: '', mediaType: 'pdf' });
  const objectUrlsRef = useRef([]);

  useEffect(() => {
    // Chrome/Edge/Firefox still honor this for contenteditable Enter
    // behavior — keeps paragraph continuation predictable (<p> not <div>).
    try {
      document.execCommand('defaultParagraphSeparator', false, 'p');
    } catch {
      /* no-op — cosmetic only */
    }

    return () => {
      // Clean up all object URLs created during the editor session
      objectUrlsRef.current.forEach((url) => {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      });
      objectUrlsRef.current = [];
    };
  }, []);

  const insertFileAsMarkup = async (file) => {
    try {
      if (ImageHandler.isImageFile(file)) {
        const ingested = await ImageHandler.ingestFile(file);
        insertMediaHtml(ImageHandler.buildImageMarkup({ url: ingested.url, alt: file.name }));
      } else if (VideoHandler.isSupportedVideoFile(file)) {
        const ingested = await VideoHandler.ingestFile(file);
        insertMediaHtml(VideoHandler.buildVideoMarkup({ url: ingested.url, mime: ingested.mime }));
      } else if (PdfHandler.isPdfFile(file)) {
        const ingested = await PdfHandler.ingestFile(file);
        insertMediaHtml(PdfHandler.buildPdfMarkup(ingested));
      } else if (AttachmentHandler.isSupportedAttachment(file)) {
        const ingested = await AttachmentHandler.ingestFile(file);
        insertMediaHtml(AttachmentHandler.buildAttachmentMarkup(ingested));
      } else {
        toast?.error?.(`Unsupported file type: ${file.name}`);
      }
    } catch (err) {
      toast?.error?.(err.message || 'Failed to insert file.');
    }
  };

  const handleInput = () => {
    if (history.isApplyingHistory) return;
    history.scheduleCheckpoint();
    scheduleOutwardSync();
  };

  const handleBeforeInput = (e) => {
    if (e.inputType === 'historyUndo') {
      e.preventDefault();
      history.undo();
      flushOutwardNow();
    } else if (e.inputType === 'historyRedo') {
      e.preventDefault();
      history.redo();
      flushOutwardNow();
    }
  };

  const handleKeyDown = (e) => {
    const ctrlOrMeta = e.ctrlKey || e.metaKey;

    if (ctrlOrMeta && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      history.undo();
      flushOutwardNow();
      return;
    }
    if ((ctrlOrMeta && e.key.toLowerCase() === 'y') || (ctrlOrMeta && e.shiftKey && e.key.toLowerCase() === 'z')) {
      e.preventDefault();
      history.redo();
      flushOutwardNow();
      return;
    }
    if (ctrlOrMeta && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      runCommand(() => document.execCommand('bold', false, null));
      return;
    }
    if (ctrlOrMeta && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      runCommand(() => document.execCommand('italic', false, null));
      return;
    }
    if (ctrlOrMeta && e.key.toLowerCase() === 'u') {
      e.preventDefault();
      runCommand(() => document.execCommand('underline', false, null));
      return;
    }

    if (e.key === 'Tab') {
      const sel = window.getSelection();
      const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
      const cell = findAncestorCell(range?.startContainer);
      if (cell) {
        e.preventDefault();
        const table = findAncestorTable(cell);
        const cells = Array.from(table.querySelectorAll('td, th'));
        const idx = cells.indexOf(cell);
        const nextCell = e.shiftKey ? cells[idx - 1] : cells[idx + 1];
        if (nextCell) {
          const r = document.createRange();
          r.selectNodeContents(nextCell);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
        }
        return;
      }
      e.preventDefault();
      runCommand((r, el) => (e.shiftKey ? outdent(r, el) : indent(r, el)));
      return;
    }

    if (e.key === 'Enter') {
      history.checkpointNow();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const cd = e.clipboardData;
    if (!cd) return;

    const imageItem = Array.from(cd.items || []).find((i) => i.type?.startsWith('image/'));
    if (imageItem) {
      const file = imageItem.getAsFile();
      if (file) insertFileAsMarkup(file);
      return;
    }

    const html = cd.getData('text/html');
    if (html) {
      insertContentHtml(cleanPastedHtml(html));
      return;
    }

    const text = cd.getData('text/plain');
    if (text) {
      insertContentHtml(plainTextToHtml(text));
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;
    placeCaretAtPoint(e.clientX, e.clientY);
    files.forEach((file) => insertFileAsMarkup(file));
  };

  const handleMouseDown = (e) => {
    const removeBtn = e.target.closest?.('.rte-media-remove-btn');
    if (removeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const targetBlock = removeBtn.closest('.rte-media-card, .rte-video-block, .rte-media-wrap, .rte-media-block, .rte-pdf-wrap, .rte-attachment-card, .media-pdf-card');
      if (targetBlock) {
        const src = targetBlock.dataset.src || targetBlock.querySelector('img, video, iframe, embed')?.getAttribute('src');
        if (src && src.startsWith('blob:')) {
          try { URL.revokeObjectURL(src); } catch {}
        }
        history.checkpointNow();
        targetBlock.remove();
        history.checkpointNow();
        flushOutwardNow();
      }
      return;
    }

    const pdfBtn = e.target.closest?.('.rte-pdf-view-trigger, .media-pdf-view-btn');
    if (pdfBtn) {
      e.preventDefault();
      e.stopPropagation();
      const pdfSrc = pdfBtn.dataset.pdfSrc || pdfBtn.closest('.rte-media-card, .rte-pdf-card, .rte-pdf-wrap')?.dataset.src;
      const pdfName = pdfBtn.dataset.pdfName || pdfBtn.closest('.rte-media-card, .rte-pdf-card, .rte-pdf-wrap')?.dataset.filename || 'Document.pdf';
      if (pdfSrc) {
        setActiveMediaModal({ isOpen: true, src: pdfSrc, fileName: pdfName, mediaType: 'pdf' });
      }
      return;
    }

    const wrapper = e.target.closest?.('.rte-media-wrap');
    const root = editableRef.current;
    if (!root) return;

    if (wrapper && root.contains(wrapper)) {
      if (selectedMediaRef.current !== wrapper) {
        clearResizeHandles(root);
        const mediaEl = wrapper.querySelector('img, video');
        if (mediaEl) {
          wrapper.classList.add('rte-selected');
          HANDLE_POSITIONS.forEach((pos) => {
            const handle = document.createElement('div');
            handle.className = `rte-resize-handle rte-resize-${pos}`;
            handle.setAttribute('contenteditable', 'false');
            handle.addEventListener('pointerdown', (ev) =>
              startResize(ev, pos, wrapper, mediaEl, root, () => {
                history.checkpointNow();
                flushOutwardNow();
              })
            );
            wrapper.appendChild(handle);
          });
          selectedMediaRef.current = wrapper;
        }
      }
      return;
    }

    if (selectedMediaRef.current) {
      clearResizeHandles(root);
      selectedMediaRef.current = null;
    }

    const checkbox = e.target.closest?.('.rte-checkbox');
    if (checkbox) {
      e.preventDefault();
      const li = checkbox.closest('li');
      if (li) {
        const checked = li.dataset.checked === 'true';
        li.dataset.checked = checked ? 'false' : 'true';
        history.checkpointNow();
        flushOutwardNow();
      }
      return;
    }

    const cell = e.target.closest?.('td, th');
    if (cell && root.contains(cell)) {
      const table = findAncestorTable(cell);
      tableSelectionRef.current = { table, anchor: cell, cells: new Set([cell]) };
      table.querySelectorAll('.rte-cell-selected').forEach((c) => c.classList.remove('rte-cell-selected'));
    }
  };

  const handleMouseOver = (e) => {
    if (e.buttons !== 1) return;
    const sel = tableSelectionRef.current;
    if (!sel?.table) return;
    const cell = e.target.closest?.('td, th');
    if (!cell || !sel.table.contains(cell)) return;

    const { grid, colCount } = buildGrid(sel.table);
    const anchorPos = findCellPosition(grid, colCount, sel.anchor);
    const currentPos = findCellPosition(grid, colCount, cell);
    if (!anchorPos || !currentPos) return;

    const minRow = Math.min(anchorPos.row, currentPos.row);
    const maxRow = Math.max(anchorPos.row, currentPos.row);
    const minCol = Math.min(anchorPos.col, currentPos.col);
    const maxCol = Math.max(anchorPos.col, currentPos.col);

    const nextSet = new Set();
    for (let r = minRow; r <= maxRow; r += 1) {
      for (let c = minCol; c <= maxCol; c += 1) {
        const entry = grid[r]?.[c];
        if (entry) nextSet.add(entry.cellEl);
      }
    }

    sel.table.querySelectorAll('.rte-cell-selected').forEach((el) => {
      if (!nextSet.has(el)) el.classList.remove('rte-cell-selected');
    });
    nextSet.forEach((el) => el.classList.add('rte-cell-selected'));
    sel.cells = nextSet;
  };

  return (
    <>
      <div
        ref={editableRef}
        className="rte-editable"
        contentEditable
        suppressContentEditableWarning
        tabIndex={0}
        role="textbox"
        aria-multiline="true"
        aria-label="Rich text content editor"
        data-placeholder={placeholder}
        onInput={handleInput}
        onBeforeInput={handleBeforeInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseDown={handleMouseDown}
        // Table cell drag-to-select is a mouse-only convenience — the same
        // cells remain reachable/selectable via Tab and the toolbar's table
        // menu, so no keyboard equivalent is required here.
        // eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
        onMouseOver={handleMouseOver}
      />
      <MediaViewerModal
        isOpen={activeMediaModal.isOpen}
        onClose={() => setActiveMediaModal((prev) => ({ ...prev, isOpen: false }))}
        src={activeMediaModal.src}
        fileName={activeMediaModal.fileName}
        mediaType={activeMediaModal.mediaType}
      />
    </>
  );
}

export default EditableArea;

