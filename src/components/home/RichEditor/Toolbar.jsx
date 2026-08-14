import { useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Superscript, Subscript, Eraser,
  Type, Highlighter, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks, Indent, Outdent, Quote, Minus, Link2, ExternalLink,
  Image as ImageIcon, Film, FileText, Paperclip, Table as TableIcon, Undo2, Redo2,
  Maximize2, Minimize2, ChevronDown, Columns, Rows, Combine, Split, Droplet, Grid3x3,
} from 'lucide-react';
import { useOnClickOutside } from '@hooks/useOnClickOutside';
import { useRichEditorContext } from './RichEditorContext';
import { restoreSelection, getSavedSelection } from './SelectionManager';
import {
  execInline, formatBlock, setAlignment, applyFontSize,
  applyFontColor, applyHighlight, toggleList, toggleChecklist, indent, outdent,
  toggleBlockquote, insertHorizontalRule, applyLink, removeLink, getActiveLink,
} from './commands';
import * as ImageHandler from './ImageHandler';
import * as VideoHandler from './VideoHandler';
import * as PdfHandler from './PdfHandler';
import * as AttachmentHandler from './AttachmentHandler';
import {
  insertTable, deleteTable, insertRowAfter, deleteRow, insertColumnAfter,
  deleteColumn, mergeCells, splitCell, setCellBackground, setCellBorder,
  findAncestorTable, findAncestorCell, getRowIndex, getColIndex,
} from './TableHandler';

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];

// Quick paragraph-style buttons (replacing a dropdown per feedback — one
// click beats "open menu, find option, click option" for the styles used
// most often).
const HEADING_QUICK_ACTIONS = [
  { label: 'P', tag: 'p', title: 'Paragraph' },
  { label: 'H1', tag: 'h1', title: 'Heading 1' },
  { label: 'H2', tag: 'h2', title: 'Heading 2' },
  { label: 'H3', tag: 'h3', title: 'Heading 3' },
  { label: 'H4', tag: 'h4', title: 'Heading 4' },
];

function ToolbarButton({ icon: Icon, label, onAction, active = false, className = '' }) {
  const { saveSelection } = useRichEditorContext();
  return (
    <button
      type="button"
      className={`rte-tb-btn ${active ? 'rte-tb-btn-active' : ''} ${className}`}
      title={label}
      aria-label={label}
      // Save the current editing selection before the button can steal
      // focus. Buttons that apply their command immediately (Bold, Align,
      // ...) don't strictly need this since preventDefault keeps the live
      // selection intact — but buttons that open a popover for a SECOND,
      // later click (Insert Table's grid picker, Table operations menu)
      // do: by the time that second click fires, the live selection may
      // already be gone, so runCommand/withTableAndCell fall back to
      // whatever was captured here.
      onMouseDown={(e) => {
        e.preventDefault();
        saveSelection();
      }}
      onClick={onAction}
    >
      <Icon size={15} />
    </button>
  );
}

/** Same selection-preserving button behavior as ToolbarButton, but with a
 * short text label (H1/H2/.../P) instead of an icon — used for the quick
 * paragraph-style actions. */
function TextToolbarButton({ text, label, onAction, active = false }) {
  const { saveSelection } = useRichEditorContext();
  return (
    <button
      type="button"
      className={`rte-tb-btn rte-tb-btn-text ${active ? 'rte-tb-btn-active' : ''}`}
      title={label}
      aria-label={label}
      onMouseDown={(e) => {
        e.preventDefault();
        saveSelection();
      }}
      onClick={onAction}
    >
      {text}
    </button>
  );
}

function ToolbarDivider() {
  return <span className="rte-tb-divider" aria-hidden="true" />;
}

export function Toolbar() {
  const {
    runCommand, insertMediaHtml, saveSelection, toast,
    tableSelectionRef, isFullscreen, toggleFullscreen, history, flushOutwardNow, editableRef,
    pendingStyleSpanRef, selectedMediaRef,
  } = useRichEditorContext();

  const [openPopover, setOpenPopover] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkNewTab, setLinkNewTab] = useState(false);
  const [gridHover, setGridHover] = useState({ rows: 0, cols: 0 });

  const popoverRef = useRef(null);
  useOnClickOutside(popoverRef, () => setOpenPopover(null), !!openPopover);

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const pdfInputRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const fontColorInputRef = useRef(null);
  const highlightColorInputRef = useRef(null);
  const cellBgInputRef = useRef(null);

  const openLinkPopover = () => {
    saveSelection();
    const sel = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const activeLink = getActiveLink(range);
    setLinkUrl(activeLink?.getAttribute('href') || '');
    setLinkNewTab(activeLink?.getAttribute('target') === '_blank');
    setOpenPopover('link');
  };

  const submitLink = () => {
    if (!linkUrl.trim()) {
      toast?.error?.('Enter a URL first.');
      return;
    }
    runCommand((range) => applyLink(range, { href: linkUrl.trim(), openInNewTab: linkNewTab }));
    setOpenPopover(null);
  };

  const handleRemoveLink = () => {
    runCommand((range) => removeLink(range));
    setOpenPopover(null);
  };

  const handleFileSelected = async (e, handler, buildMarkup) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const ingested = await handler.ingestFile(file);
      insertMediaHtml(buildMarkup(ingested, file));
    } catch (err) {
      toast?.error?.(err.message || 'Failed to insert file.');
    }
  };

  const withTableAndCell = (action) => {
    const el = editableRef.current;
    if (el && document.activeElement !== el) {
      restoreSelection(el, getSavedSelection());
    }
    const sel = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const cell = findAncestorCell(range?.startContainer);
    if (!cell) {
      toast?.error?.('Place the cursor inside a table first.');
      return;
    }
    const table = findAncestorTable(cell);
    history.checkpointNow();
    action(table, cell);
    history.checkpointNow();
    flushOutwardNow();
  };

  const handleInsertTable = (rows, cols) => {
    runCommand((range) => {
      const table = insertTable(rows, cols);
      range.deleteContents();
      range.insertNode(table);
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      table.parentNode.insertBefore(p, table.nextSibling);
      const newRange = document.createRange();
      newRange.setStart(p, 0);
      newRange.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(newRange);
    });
    setOpenPopover(null);
  };

  const handleMergeCells = () => {
    const { table, cells } = tableSelectionRef.current;
    if (!table || cells.size < 2) {
      toast?.error?.('Select two or more adjacent cells to merge.');
      return;
    }
    history.checkpointNow();
    const result = mergeCells(table, [...cells]);
    history.checkpointNow();
    if (!result.success) {
      toast?.error?.(result.reason);
    }
    flushOutwardNow();
  };

  /** Aligns the currently-selected image/video (see EditableArea's
   * click-to-select handling, which keeps selectedMediaRef in sync). */
  const handleAlignImage = (align) => {
    const wrapper = selectedMediaRef.current;
    if (!wrapper) {
      toast?.error?.('Select an image or video first.');
      return;
    }
    history.checkpointNow();
    wrapper.classList.remove('rte-align-left', 'rte-align-center', 'rte-align-right');
    wrapper.classList.add(`rte-align-${align}`);
    history.checkpointNow();
    flushOutwardNow();
  };

  return (
    <div className="rte-toolbar" role="toolbar" aria-label="Rich text formatting toolbar">
      {/* Undo / Redo */}
      <ToolbarButton icon={Undo2} label="Undo (Ctrl+Z)" onAction={() => { history.undo(); flushOutwardNow(); }} />
      <ToolbarButton icon={Redo2} label="Redo (Ctrl+Y)" onAction={() => { history.redo(); flushOutwardNow(); }} />
      <ToolbarDivider />

      {/* Paragraph / Headings — quick buttons, one click each */}
      {HEADING_QUICK_ACTIONS.map((opt) => (
        <TextToolbarButton
          key={opt.tag}
          text={opt.label}
          label={opt.title}
          onAction={() => runCommand((range, el) => formatBlock(range, el, opt.tag))}
        />
      ))}
      <ToolbarDivider />

      {/* Font size */}
      <select
        className="rte-tb-select rte-tb-select-sm"
        title="Font size"
        onMouseDown={saveSelection}
        onChange={(e) => {
          runCommand((range, el) => applyFontSize(range, el, e.target.value, pendingStyleSpanRef));
        }}
        defaultValue=""
      >
        <option value="" disabled>Size</option>
        {FONT_SIZES.map((s) => (
          <option key={s} value={s}>{s.replace('px', '')}</option>
        ))}
      </select>
      <ToolbarDivider />

      {/* Inline formatting */}
      <ToolbarButton icon={Bold} label="Bold (Ctrl+B)" onAction={() => runCommand(() => execInline('bold'))} />
      <ToolbarButton icon={Italic} label="Italic (Ctrl+I)" onAction={() => runCommand(() => execInline('italic'))} />
      <ToolbarButton icon={Underline} label="Underline (Ctrl+U)" onAction={() => runCommand(() => execInline('underline'))} />
      <ToolbarButton icon={Strikethrough} label="Strikethrough" onAction={() => runCommand(() => execInline('strikeThrough'))} />
      <ToolbarButton icon={Superscript} label="Superscript" onAction={() => runCommand(() => execInline('superscript'))} />
      <ToolbarButton icon={Subscript} label="Subscript" onAction={() => runCommand(() => execInline('subscript'))} />
      <ToolbarButton icon={Eraser} label="Remove formatting" onAction={() => runCommand(() => execInline('removeFormat'))} />
      <ToolbarDivider />

      {/* Font color / highlight */}
      <button type="button" className="rte-tb-btn" title="Font color" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => fontColorInputRef.current?.click()}>
        <Type size={15} />
        <input
          ref={fontColorInputRef}
          type="color"
          className="rte-tb-color-input"
          onChange={(e) => runCommand((range, el) => applyFontColor(range, el, e.target.value, pendingStyleSpanRef))}
        />
      </button>
      <button type="button" className="rte-tb-btn" title="Highlight color" onMouseDown={(e) => { e.preventDefault(); saveSelection(); }} onClick={() => highlightColorInputRef.current?.click()}>
        <Highlighter size={15} />
        <input
          ref={highlightColorInputRef}
          type="color"
          className="rte-tb-color-input"
          onChange={(e) => runCommand((range, el) => applyHighlight(range, el, e.target.value, pendingStyleSpanRef))}
        />
      </button>
      <ToolbarDivider />

      {/* Alignment */}
      <ToolbarButton icon={AlignLeft} label="Align left" onAction={() => runCommand((range, el) => setAlignment(range, el, 'left'))} />
      <ToolbarButton icon={AlignCenter} label="Align center" onAction={() => runCommand((range, el) => setAlignment(range, el, 'center'))} />
      <ToolbarButton icon={AlignRight} label="Align right" onAction={() => runCommand((range, el) => setAlignment(range, el, 'right'))} />
      <ToolbarButton icon={AlignJustify} label="Justify" onAction={() => runCommand((range, el) => setAlignment(range, el, 'justify'))} />
      <ToolbarDivider />

      {/* Lists / indent */}
      <ToolbarButton icon={List} label="Bullet list" onAction={() => runCommand((range, el) => toggleList(range, el, 'ul'))} />
      <ToolbarButton icon={ListOrdered} label="Numbered list" onAction={() => runCommand((range, el) => toggleList(range, el, 'ol'))} />
      <ToolbarButton icon={ListChecks} label="Checklist" onAction={() => runCommand((range, el) => toggleChecklist(range, el))} />
      <ToolbarButton icon={Outdent} label="Decrease indent" onAction={() => runCommand((range, el) => outdent(range, el))} />
      <ToolbarButton icon={Indent} label="Increase indent" onAction={() => runCommand((range, el) => indent(range, el))} />
      <ToolbarDivider />

      {/* Quote / HR */}
      <ToolbarButton icon={Quote} label="Block quote" onAction={() => runCommand((range, el) => toggleBlockquote(range, el))} />
      <ToolbarButton icon={Minus} label="Horizontal line" onAction={() => runCommand((range) => insertHorizontalRule(range))} />
      <ToolbarDivider />

      {/* Link */}
      <div className="rte-tb-popover-wrap" ref={openPopover === 'link' ? popoverRef : null}>
        <ToolbarButton icon={Link2} label="Insert / edit link" onAction={openLinkPopover} />
        {openPopover === 'link' && (
          <div className="rte-popover">
            <input
              type="text"
              className="rte-popover-input"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              autoFocus
            />
            <label className="rte-popover-checkbox">
              <input type="checkbox" checked={linkNewTab} onChange={(e) => setLinkNewTab(e.target.checked)} />
              <ExternalLink size={13} /> Open in new tab
            </label>
            <div className="rte-popover-actions">
              <button type="button" className="rte-popover-btn rte-popover-btn-primary" onClick={submitLink}>Apply</button>
              <button type="button" className="rte-popover-btn" onClick={handleRemoveLink}>Remove link</button>
            </div>
          </div>
        )}
      </div>
      <ToolbarDivider />

      {/* Media */}
      <ToolbarButton icon={ImageIcon} label="Insert image" onAction={() => imageInputRef.current?.click()} />
      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFileSelected(e, ImageHandler, (ing, file) => ImageHandler.buildImageMarkup({ url: ing.url, alt: file.name }))} />

      <ToolbarButton icon={Film} label="Insert video (mp4/webm)" onAction={() => videoInputRef.current?.click()} />
      <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" style={{ display: 'none' }} onChange={(e) => handleFileSelected(e, VideoHandler, (ing) => VideoHandler.buildVideoMarkup({ url: ing.url, mime: ing.mime }))} />

      <ToolbarButton icon={FileText} label="Insert PDF" onAction={() => pdfInputRef.current?.click()} />
      <input ref={pdfInputRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => handleFileSelected(e, PdfHandler, (ing) => PdfHandler.buildPdfMarkup(ing))} />

      <ToolbarButton icon={Paperclip} label="Insert attachment (doc/xls/ppt/zip)" onAction={() => attachmentInputRef.current?.click()} />
      <input ref={attachmentInputRef} type="file" accept=".doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" style={{ display: 'none' }} onChange={(e) => handleFileSelected(e, AttachmentHandler, (ing) => AttachmentHandler.buildAttachmentMarkup(ing))} />

      {/* Image alignment — acts on whichever image/video is currently
          selected in the editor (click one to select it; resize handles
          appear the same way). */}
      <ToolbarButton icon={AlignLeft} label="Align image left" onAction={() => handleAlignImage('left')} />
      <ToolbarButton icon={AlignCenter} label="Align image center" onAction={() => handleAlignImage('center')} />
      <ToolbarButton icon={AlignRight} label="Align image right" onAction={() => handleAlignImage('right')} />
      <ToolbarDivider />

      {/* Table */}
      <div className="rte-tb-popover-wrap" ref={openPopover === 'table-insert' ? popoverRef : null}>
        <ToolbarButton icon={TableIcon} label="Insert table" onAction={() => setOpenPopover((p) => (p === 'table-insert' ? null : 'table-insert'))} />
        {openPopover === 'table-insert' && (
          <div className="rte-popover rte-table-grid-popover">
            <div className="rte-table-grid" onMouseLeave={() => setGridHover({ rows: 0, cols: 0 })}>
              {Array.from({ length: 8 }).map((_, r) => (
                <div key={r} className="rte-table-grid-row">
                  {Array.from({ length: 8 }).map((__, c) => (
                    <button
                      key={c}
                      type="button"
                      className={`rte-table-grid-cell ${r < gridHover.rows && c < gridHover.cols ? 'rte-table-grid-cell-active' : ''}`}
                      aria-label={`Insert ${r + 1} by ${c + 1} table`}
                      onMouseEnter={() => setGridHover({ rows: r + 1, cols: c + 1 })}
                      onClick={() => handleInsertTable(r + 1, c + 1)}
                    />
                  ))}
                </div>
              ))}
            </div>
            <div className="rte-table-grid-label">
              {gridHover.rows > 0 ? `${gridHover.rows} x ${gridHover.cols}` : 'Insert table'}
            </div>
          </div>
        )}
      </div>

      <div className="rte-tb-popover-wrap" ref={openPopover === 'table-ops' ? popoverRef : null}>
        <ToolbarButton icon={ChevronDown} label="Table operations" onAction={() => setOpenPopover((p) => (p === 'table-ops' ? null : 'table-ops'))} />
        {openPopover === 'table-ops' && (
          <div className="rte-popover rte-table-ops-popover">
            <button type="button" className="rte-menu-item" onClick={() => { withTableAndCell((t, c) => insertRowAfter(t, getRowIndex(t, c))); setOpenPopover(null); }}>
              <Rows size={14} /> Add row below
            </button>
            <button type="button" className="rte-menu-item" onClick={() => { withTableAndCell((t, c) => deleteRow(t, getRowIndex(t, c))); setOpenPopover(null); }}>
              <Rows size={14} /> Delete row
            </button>
            <button type="button" className="rte-menu-item" onClick={() => { withTableAndCell((t, c) => insertColumnAfter(t, getColIndex(t, c))); setOpenPopover(null); }}>
              <Columns size={14} /> Add column right
            </button>
            <button type="button" className="rte-menu-item" onClick={() => { withTableAndCell((t, c) => deleteColumn(t, getColIndex(t, c))); setOpenPopover(null); }}>
              <Columns size={14} /> Delete column
            </button>
            <button type="button" className="rte-menu-item" onClick={() => { handleMergeCells(); setOpenPopover(null); }}>
              <Combine size={14} /> Merge selected cells
            </button>
            <button type="button" className="rte-menu-item" onClick={() => { withTableAndCell((t, c) => splitCell(t, c)); setOpenPopover(null); }}>
              <Split size={14} /> Split cell
            </button>
            <button type="button" className="rte-menu-item" onClick={() => { cellBgInputRef.current?.click(); }}>
              <Droplet size={14} /> Cell background
            </button>
            <input
              ref={cellBgInputRef}
              type="color"
              style={{ display: 'none' }}
              onChange={(e) => { withTableAndCell((t, c) => setCellBackground(c, e.target.value)); }}
            />
            <button type="button" className="rte-menu-item" onClick={() => { withTableAndCell((t) => setCellBorder(t)); setOpenPopover(null); }}>
              <Grid3x3 size={14} /> Add borders
            </button>
            <button type="button" className="rte-menu-item rte-menu-item-danger" onClick={() => { withTableAndCell((t) => deleteTable(t)); setOpenPopover(null); }}>
              <TableIcon size={14} /> Delete table
            </button>
          </div>
        )}
      </div>
      <ToolbarDivider />

      {/* Fullscreen — visually highlighted since it's a distinct, less
          reversible-feeling action (takes over the whole viewport) that
          should stand out from the plain formatting buttons around it. */}
      <ToolbarButton
        icon={isFullscreen ? Minimize2 : Maximize2}
        label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        onAction={toggleFullscreen}
        className="rte-tb-btn-highlight"
      />
    </div>
  );
}

export default Toolbar;
