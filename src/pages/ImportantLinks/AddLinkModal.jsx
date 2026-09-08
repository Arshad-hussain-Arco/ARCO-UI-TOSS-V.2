import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight, FileText, Lock, Pin, Plus, RotateCcw, Upload, X, Link2, Pencil, Bold, Italic, List as ListIcon, Heading1, Underline, ListOrdered, Code, Table as TableIcon, Rows, Columns, Trash2, Maximize, Minimize } from 'lucide-react';
import { toast } from 'react-hot-toast';

import { Button } from '@components/ui/Button/Button';
import { dismissBackdrop } from '@utils/interactive';
import { createId } from '@utils/id';
import { useOnClickOutside } from '@hooks/useOnClickOutside';
import { useToast } from '@hooks/useToast';
import { insertTable, deleteTable, insertRowAfter, deleteRow, insertColumnAfter, deleteColumn, findAncestorTable, findAncestorCell, getRowIndex, getColIndex } from '@components/home/RichEditor/TableHandler';

import '@components/home/RichEditor/RichEditor.css';
import './ImportantLinksPage.css';

const ACCEPTED_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.txt';

/** Maps tag → CSS modifier class */
const TAG_CLASS_MAP = {
  internal: 'il-badge-internal',
  mandatory: 'il-badge-mandatory',
  critical: 'il-badge-critical',
  docs: 'il-badge-docs',
};

/**
 * In-modal custom group dropdown — matches the app's Select component appearance.
 */
function GroupDropdown({ groups, value, onSelect, onCreateNew, hasError, canCreateGroup = true }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  useOnClickOutside(wrapRef, () => setOpen(false), open);

  const selectedLabel =
    value === '__new__' ? '+ Create New Group' : (groups.find((g) => g === value) ?? '');

  return (
    <div className="il-modal-group-dropdown" ref={wrapRef}>
      <button
        type="button"
        className={`il-modal-group-trigger${hasError ? ' il-input-error' : ''}`}
        data-open={open}
        data-placeholder={!value}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {value ? selectedLabel : 'Select group'}
        </span>
        <ChevronDown size={13} strokeWidth={2} className="il-modal-group-trigger-chevron" style={{ pointerEvents: 'none' }} />
      </button>

      {open && (
        <div className="il-modal-group-panel" role="listbox" aria-label="Select group">
          <div className="il-modal-group-viewport">
            {groups.map((g) => (
              <button
                key={g}
                type="button"
                role="option"
                aria-selected={value === g}
                data-selected={value === g}
                className="il-modal-group-item"
                onClick={() => {
                  onSelect(g);
                  setOpen(false);
                }}
              >
                <span style={{ flex: 1 }}>{g}</span>
                {value === g && (
                  <Check size={11} strokeWidth={2.5} className="il-group-dropdown-item-check" />
                )}
              </button>
            ))}
          </div>

          {canCreateGroup && (
            <>
              <div className="il-modal-group-divider" style={{ margin: '0' }} />

              <div style={{ padding: '4px' }}>
                <button
                  type="button"
                  className="il-modal-group-action"
                  onClick={() => {
                    onCreateNew();
                    setOpen(false);
                  }}
                >
                  <Plus size={13} className="il-group-dropdown-action-icon" />
                  Create New Group
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SimpleRichTextEditor({ value, onChange, hasError }) {
  const editorRef = useRef(null);
  const popoverRef = useRef(null);
  const [showSource, setShowSource] = useState(false);
  const [openPopover, setOpenPopover] = useState(null); // 'table-insert' | 'table-ops' | null
  const [gridHover, setGridHover] = useState({ rows: 0, cols: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const toast = useToast();

  useOnClickOutside(popoverRef, () => setOpenPopover(null));

  useEffect(() => {
    if (!showSource && editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value, showSource]);

  const handleEditorMouseDown = (e) => {
    let copyBtn = e.target.closest('[data-copy-text], [data-copy], .il-dynamic-copy-btn, .copy-btn, [data-copy-btn]');
    if (!copyBtn) {
      let curr = e.target;
      while (curr && curr !== e.currentTarget) {
        if (curr.nodeType === Node.ELEMENT_NODE) {
          if (curr.matches('button, .btn, a, .arco-btn, [role="button"]') && curr.textContent.trim().toLowerCase().includes('copy')) {
            copyBtn = curr; break;
          }
          const exactText = curr.textContent.trim().toLowerCase();
          if (exactText === 'copy' || exactText === 'copy path') {
            copyBtn = curr; break;
          }
        }
        curr = curr.parentNode;
      }
    }
    if (copyBtn) {
      e.preventDefault();
    }
  };

  const handleEditorClick = (e) => {
    let copyBtn = e.target.closest('[data-copy-text], [data-copy], .il-dynamic-copy-btn, .copy-btn, [data-copy-btn]');
    if (!copyBtn) {
      let curr = e.target;
      while (curr && curr !== e.currentTarget) {
        if (curr.nodeType === Node.ELEMENT_NODE) {
          if (curr.matches('button, .btn, a, .arco-btn, [role="button"]') && curr.textContent.trim().toLowerCase().includes('copy')) {
            copyBtn = curr;
            break;
          }
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
        toast.success?.('Copied to clipboard!');
        showCopied();
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(textToCopy)
          .then(() => {
            toast.success?.('Copied to clipboard!');
            showCopied();
          })
          .catch(doFallbackCopy);
      } else {
        doFallbackCopy();
      }
      return;
    }
  };

  const exec = (command, val = null) => {
    if (showSource) return;
    if (command === 'createLink') {
      const url = prompt('Enter link URL:', 'https://');
      if (!url) return;
      val = url;
    }
    document.execCommand(command, false, val);
    if (editorRef.current) {
      editorRef.current.focus();
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleSourceChange = (e) => {
    onChange(e.target.value);
  };

  const handleInsertTable = (rows, cols) => {
    if (showSource) return;

    if (editorRef.current) {
      editorRef.current.focus();
    }

    const table = insertTable(rows, cols);
    const sel = window.getSelection();

    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(table);
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        table.parentNode.insertBefore(p, table.nextSibling);

        const newRange = document.createRange();
        newRange.setStart(p, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      } else {
        editorRef.current.appendChild(table);
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        editorRef.current.appendChild(p);
      }
      onChange(editorRef.current.innerHTML);
    }
    setOpenPopover(null);
  };

  const withTableAndCell = (action) => {
    if (showSource) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const cell = findAncestorCell(range.startContainer);

    if (!cell || !editorRef.current.contains(cell)) {
      toast?.error?.('Place the cursor inside a table first.');
      return;
    }
    const table = findAncestorTable(cell);
    action(table, cell);
    onChange(editorRef.current.innerHTML);
  };

  return (
    <div className={`il-rte-container ${hasError ? 'il-input-error' : ''}`} style={isFullScreen ? { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' } : { border: '1px solid var(--border-primary)', borderRadius: '6px', display: 'flex', flexDirection: 'column' }}>
      <div className="il-rte-toolbar" style={{ display: 'flex', gap: '4px', padding: '6px 8px', background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border-primary)', flexWrap: 'wrap', alignItems: 'center', borderTopLeftRadius: isFullScreen ? 0 : '5px', borderTopRightRadius: isFullScreen ? 0 : '5px' }}>
        <button type="button" onClick={() => exec('bold')} disabled={showSource} style={{ padding: '4px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: showSource ? 'not-allowed' : 'pointer', color: showSource ? 'var(--text-disabled)' : 'var(--text-primary)' }} title="Bold"><Bold size={14} /></button>
        <button type="button" onClick={() => exec('italic')} disabled={showSource} style={{ padding: '4px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: showSource ? 'not-allowed' : 'pointer', color: showSource ? 'var(--text-disabled)' : 'var(--text-primary)' }} title="Italic"><Italic size={14} /></button>
        <button type="button" onClick={() => exec('underline')} disabled={showSource} style={{ padding: '4px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: showSource ? 'not-allowed' : 'pointer', color: showSource ? 'var(--text-disabled)' : 'var(--text-primary)' }} title="Underline"><Underline size={14} /></button>
        <div style={{ width: '1px', height: '16px', background: 'var(--border-primary)', margin: '0 4px' }} />
        <button type="button" onClick={() => exec('formatBlock', 'H3')} disabled={showSource} style={{ padding: '4px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: showSource ? 'not-allowed' : 'pointer', color: showSource ? 'var(--text-disabled)' : 'var(--text-primary)' }} title="Heading"><Heading1 size={14} /></button>
        <div style={{ width: '1px', height: '16px', background: 'var(--border-primary)', margin: '0 4px' }} />
        <button type="button" onClick={() => exec('insertUnorderedList')} disabled={showSource} style={{ padding: '4px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: showSource ? 'not-allowed' : 'pointer', color: showSource ? 'var(--text-disabled)' : 'var(--text-primary)' }} title="Bullet List"><ListIcon size={14} /></button>
        <button type="button" onClick={() => exec('insertOrderedList')} disabled={showSource} style={{ padding: '4px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: showSource ? 'not-allowed' : 'pointer', color: showSource ? 'var(--text-disabled)' : 'var(--text-primary)' }} title="Numbered List"><ListOrdered size={14} /></button>
        <div style={{ width: '1px', height: '16px', background: 'var(--border-primary)', margin: '0 4px' }} />
        {/* Table Insert Popover */}
        <div className="rte-tb-popover-wrap" ref={openPopover === 'table-insert' ? popoverRef : null}>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpenPopover(p => p === 'table-insert' ? null : 'table-insert')} disabled={showSource} style={{ padding: '4px', borderRadius: '4px', background: openPopover === 'table-insert' ? 'var(--bg-hover)' : 'transparent', border: 'none', cursor: showSource ? 'not-allowed' : 'pointer', color: showSource ? 'var(--text-disabled)' : 'var(--text-primary)' }} title="Insert table"><TableIcon size={14} /></button>

          {openPopover === 'table-insert' && !showSource && (
            <div className="rte-popover rte-table-grid-popover rte-popover-right" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10 }}>
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
                        onMouseDown={(e) => e.preventDefault()}
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

        {/* Table Ops Popover */}
        <div className="rte-tb-popover-wrap" ref={openPopover === 'table-ops' ? popoverRef : null}>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setOpenPopover(p => p === 'table-ops' ? null : 'table-ops')} disabled={showSource} style={{ padding: '4px', borderRadius: '4px', background: openPopover === 'table-ops' ? 'var(--bg-hover)' : 'transparent', border: 'none', cursor: showSource ? 'not-allowed' : 'pointer', color: showSource ? 'var(--text-disabled)' : 'var(--text-primary)', display: 'flex', alignItems: 'center' }} title="Table operations"><ChevronDown size={14} /></button>

          {openPopover === 'table-ops' && !showSource && (
            <div className="rte-popover rte-table-ops-popover rte-popover-right" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10 }}>
              <button type="button" className="rte-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={() => { withTableAndCell((t, c) => insertRowAfter(t, getRowIndex(t, c))); setOpenPopover(null); }}>
                <Rows size={14} /> Add row below
              </button>
              <button type="button" className="rte-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={() => { withTableAndCell((t, c) => deleteRow(t, getRowIndex(t, c))); setOpenPopover(null); }}>
                <Rows size={14} /> Delete row
              </button>
              <button type="button" className="rte-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={() => { withTableAndCell((t, c) => insertColumnAfter(t, getColIndex(t, c))); setOpenPopover(null); }}>
                <Columns size={14} /> Add column right
              </button>
              <button type="button" className="rte-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={() => { withTableAndCell((t, c) => deleteColumn(t, getColIndex(t, c))); setOpenPopover(null); }}>
                <Columns size={14} /> Delete column
              </button>
              <button type="button" className="rte-menu-item rte-menu-item-danger" onMouseDown={(e) => e.preventDefault()} onClick={() => { withTableAndCell((t) => deleteTable(t)); setOpenPopover(null); }}>
                <Trash2 size={14} /> Delete table
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />
        <button type="button" onClick={() => setIsFullScreen(!isFullScreen)} style={{ padding: '4px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', marginRight: '4px' }} title={isFullScreen ? "Exit Full Screen" : "Full Screen"}>
          {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--surface-primary)', padding: '2px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
          <button type="button" onClick={() => setShowSource(true)} style={{ padding: '4px 10px', borderRadius: '4px', background: showSource ? '#006633' : 'transparent', border: 'none', cursor: 'pointer', color: showSource ? '#ffffff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: showSource ? 600 : 500 }} title="Source Code">
            <Code size={14} /> Source
          </button>
          <button type="button" onClick={() => setShowSource(false)} style={{ padding: '4px 10px', borderRadius: '4px', background: !showSource ? '#006633' : 'transparent', border: 'none', cursor: 'pointer', color: !showSource ? '#ffffff' : 'var(--text-secondary)', fontSize: '11px', fontWeight: !showSource ? 600 : 500 }} title="Preview">
            Preview
          </button>
        </div>
      </div>

      {showSource ? (
        <textarea
          value={value}
          onChange={handleSourceChange}
          className="il-rte-content"
          style={{ flex: 1, width: '100%', minHeight: '120px', padding: '12px', outline: 'none', fontSize: '13px', lineHeight: '1.5', background: 'var(--bg-primary)', border: 'none', resize: isFullScreen ? 'none' : 'vertical', fontFamily: 'monospace', borderBottomLeftRadius: isFullScreen ? 0 : '5px', borderBottomRightRadius: isFullScreen ? 0 : '5px' }}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onClick={handleEditorClick}
          onMouseDown={handleEditorMouseDown}
          style={{ flex: 1, minHeight: '120px', padding: '12px', outline: 'none', fontSize: '13px', lineHeight: '1.5', background: 'var(--bg-primary)', overflowY: 'auto', borderBottomLeftRadius: isFullScreen ? 0 : '5px', borderBottomRightRadius: isFullScreen ? 0 : '5px' }}
          className="il-rte-content"
        />
      )}
    </div>
  );
}

// Removed AccordionSection in favor of segmented controls

/**
 * Add / Edit Link Modal — matches the application's existing modal design language.
 *
 * @param {Object} props
 * @param {string[]} props.existingGroups   List of existing group titles.
 * @param {Object|null} [props.editLink]    When set, modal is in edit mode with prefilled data.
 * @param {(payload: Object) => void} props.onAdd
 * @param {(payload: Object) => void} props.onUpdate
 * @param {() => void} props.onClose
 */
function AddLinkModalComponent({ existingGroups = [], editLink = null, onAdd, onUpdate, onClose, isSaving = false, canCreateGroup = true }) {
  const isEditMode = !!editLink;

  const getInitialState = useCallback(() => {
    if (editLink) {
      return {
        groupMode: 'existing',
        selectedGroup: editLink.group || '',
        newGroupName: '',
        linkName: editLink.label || '',
        url: editLink.url || '',
        sharedFolder: editLink.sharedFolder || '',
        comments: editLink.comments || '',
        pinToHeader: editLink.pinToHeader || false,
        files: editLink.files || [],
      };
    }
    return {
      groupMode: 'existing',
      selectedGroup: existingGroups[0] || '',
      newGroupName: '',
      linkName: '',
      url: '',
      sharedFolder: '',
      comments: '',
      pinToHeader: false,
      files: [],
    };
  }, [editLink, existingGroups]);

  const getInitialLinkType = useCallback(() => {
    if (!editLink) return 'url';
    if (editLink.url) return 'url';
    if (editLink.sharedFolder) return 'folder';
    if (editLink.files && editLink.files.length > 0) return 'file';
    if (editLink.comments) return 'content';
    return 'url';
  }, [editLink]);

  const [state, setState] = useState(getInitialState);
  const [errors, setErrors] = useState({});
  const [linkType, setLinkType] = useState(getInitialLinkType);
  const fileInputRef = useRef(null);

  // Sync state when editLink changes
  useEffect(() => {
    setState(getInitialState());
    setErrors({});
    setLinkType(getInitialLinkType());
  }, [editLink, getInitialState, getInitialLinkType]);

  const set = (key, val) => setState((prev) => ({ ...prev, [key]: val }));

  const handleReset = useCallback(() => {
    setState(getInitialState());
    setErrors({});
    setLinkType(getInitialLinkType());
  }, [getInitialState, getInitialLinkType]);

  function validate() {
    const errs = {};

    if (!state.linkName.trim()) {
      errs.linkName = 'Link name is required.';
    }

    if (linkType === 'url') {
      if (!state.url.trim()) {
        errs.url = 'Please enter a URL.';
      } else {
        try {
          new URL(state.url.startsWith('http') ? state.url : `https://${state.url}`);
        } catch {
          errs.url = 'Please enter a valid URL.';
        }
      }
    } else if (linkType === 'folder') {
      if (!state.sharedFolder.trim()) {
        errs.folder = 'Please enter a shared folder path.';
      }
    } else if (linkType === 'file') {
      if (state.files.length === 0) {
        errs.file = 'Please upload a file.';
      }
    } else if (linkType === 'content') {
      if (!state.comments.trim()) {
        errs.content = 'Please enter text content.';
      }
    }

    if (state.groupMode === 'existing' && !state.selectedGroup?.trim()) {
      errs.group = 'Please select a group.';
    }
    if (state.groupMode === 'new' && !state.newGroupName.trim()) {
      errs.group = 'Group name is required.';
    }

    return errs;
  }

  function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    const finalGroup =
      state.groupMode === 'new' ? state.newGroupName.trim() : state.selectedGroup?.trim() || '';
    let finalUrl = '';
    if (linkType === 'url') {
      finalUrl = state.url.trim();
      if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }
    }

    const payload = {
      id: editLink?.id ?? createId('link'),
      label: state.linkName.trim(),
      url: finalUrl,
      sharedFolder: linkType === 'folder' ? state.sharedFolder.trim() : '',
      comments: linkType === 'content' ? state.comments.trim() : '',
      pinToHeader: state.pinToHeader,
      files: linkType === 'file' ? state.files : [],
    };

    if (finalGroup) {
      payload.group = finalGroup;
      payload.isNewGroup = state.groupMode === 'new';
    }

    if (isEditMode) {
      onUpdate(payload);
    } else {
      onAdd(payload);
    }
  }

  function handleFileChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      set('files', [e.target.files[0]]);
      e.target.value = '';
    }
  }

  function removeFile(idx) {
    set(
      'files',
      state.files.filter((_, i) => i !== idx),
    );
  }

  return (
    <div className="il-overlay" {...dismissBackdrop(onClose)}>
      <div className="il-modal" role="dialog" aria-modal="true" aria-labelledby="il-modal-title">
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="il-modal-header">
          <h2 className="il-modal-title" id="il-modal-title">
            {isEditMode ? 'Edit Link' : 'Add Link'}
          </h2>
          <button
            type="button"
            className="il-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={15} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────── */}
        <div className="il-modal-body">

          {/* Group */}
          <div className="il-form-group">
            <span className="il-label il-label-required">
              Group
            </span>

            <GroupDropdown
              groups={existingGroups}
              value={state.groupMode === 'new' ? '__new__' : state.selectedGroup}
              hasError={!!errors.group}
              canCreateGroup={canCreateGroup}
              onSelect={(g) => {
                set('selectedGroup', g);
                set('groupMode', 'existing');
                setErrors((prev) => ({ ...prev, group: undefined }));
              }}
              onCreateNew={() => {
                set('groupMode', 'new');
                set('selectedGroup', '');
                setErrors((prev) => ({ ...prev, group: undefined }));
              }}
            />
            {errors.group && <span className="il-error-msg">{errors.group}</span>}
          </div>

          {/* New Group Name */}
          {state.groupMode === 'new' && (
            <div className="il-new-group-row">
              <span className="il-label il-label-required">
                New Group Name
              </span>
              <input
                type="text"
                className={`il-input${errors.group ? ' il-input-error' : ''}`}
                placeholder="e.g. Analytics & Reporting"
                value={state.newGroupName}
                onChange={(e) => {
                  set('newGroupName', e.target.value);
                  setErrors((prev) => ({ ...prev, group: undefined }));
                }}
              />
            </div>
          )}

          {/* Link Name */}
          <div className="il-form-group">
            <span className="il-label il-label-required">Link Name</span>
            <input
              type="text"
              className={`il-input${errors.linkName ? ' il-input-error' : ''}`}

              value={state.linkName}
              onChange={(e) => {
                set('linkName', e.target.value);
                setErrors((prev) => ({ ...prev, linkName: undefined }));
              }}
            />
            {errors.linkName && <span className="il-error-msg">{errors.linkName}</span>}
          </div>

          {/* Link Type Segmented Control */}
          <div className="il-form-group" style={{ marginBottom: '4px' }}>
            <span className="il-label il-label-required">Link Type</span>
            <div className="il-segmented-control">
              <button
                type="button"
                className={`il-segmented-btn ${errors.url ? 'il-segmented-btn-error' : ''}`}
                data-active={linkType === 'url'}
                onClick={() => {
                  setLinkType('url');
                  setErrors((prev) => ({ ...prev, url: undefined }));
                }}
              >
                <Link2 size={15} /> URL
              </button>
              <button
                type="button"
                className={`il-segmented-btn ${errors.file ? 'il-segmented-btn-error' : ''}`}
                data-active={linkType === 'file'}
                onClick={() => {
                  setLinkType('file');
                  setErrors((prev) => ({ ...prev, file: undefined }));
                }}
              >
                <FileText size={15} /> Upload File
              </button>
              <button
                type="button"
                className={`il-segmented-btn ${errors.content ? 'il-segmented-btn-error' : ''}`}
                data-active={linkType === 'content'}
                onClick={() => {
                  setLinkType('content');
                  setErrors((prev) => ({ ...prev, content: undefined }));
                }}
              >
                <Pencil size={15} /> Content
              </button>
            </div>
          </div>

          {/* Active Content Container */}
          <div className="il-active-content-container">
            {linkType === 'url' && (
              <div className="il-form-group">
                <span className="il-label il-label-required">URL</span>
                <input
                  type="url"
                  className={`il-input${errors.url ? ' il-input-error' : ''}`}
                  placeholder="https://"
                  value={state.url}
                  autoFocus
                  onChange={(e) => {
                    set('url', e.target.value);
                    setErrors((prev) => ({ ...prev, url: undefined }));
                  }}
                />
                {errors.url && <span className="il-error-msg">{errors.url}</span>}
              </div>
            )}

            {linkType === 'file' && (
              <div className="il-form-group">
                <span className="il-label il-label-required">Upload File</span>
                {state.files.length > 0 ? (
                  <div className="il-upload-file-list" style={{ marginTop: 0 }}>
                    {state.files.map((f, i) => (
                      <div key={i} className="il-upload-file-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', border: '1px solid var(--border-primary)', borderRadius: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', overflow: 'hidden' }}>
                          <FileText className="il-upload-file-icon" aria-hidden="true" style={{ marginTop: '2px' }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="il-upload-file-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
                              {f.size && <span className="il-upload-file-size" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{(f.size / 1024).toFixed(0)} KB</span>}
                            </div>
                            <span className="il-upload-zone-hint" style={{ margin: 0, textAlign: 'left', fontSize: '11px', lineHeight: '1.2' }}>PDF, Word, Excel, Images, ZIP — max 10 MB</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              fileInputRef.current?.click();
                            }}
                            style={{ padding: '4px 8px', fontSize: '12px', height: 'auto' }}
                          >
                            Replace
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(i)}
                            style={{ padding: '4px 8px', fontSize: '12px', height: 'auto', color: 'var(--c-danger)' }}
                            leadingIcon={Trash2}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    className="il-upload-zone"
                    role="button"
                    tabIndex={0}
                    aria-label="Choose files to upload"
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        set('files', [e.dataTransfer.files[0]]);
                        setErrors((prev) => ({ ...prev, file: undefined }));
                      }
                    }}
                  >
                    <Upload className="il-upload-zone-icon" aria-hidden="true" />
                    <div className="il-upload-zone-text-wrap">
                      <p className="il-upload-zone-text">
                        <strong>Click to upload</strong> or drag &amp; drop
                      </p>
                      <p className="il-upload-zone-hint">PDF, Word, Excel, Images, ZIP — max 10 MB</p>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    handleFileChange(e);
                    setErrors((prev) => ({ ...prev, file: undefined }));
                  }}
                />
                {errors.file && <span className="il-error-msg">{errors.file}</span>}
              </div>
            )}

            {linkType === 'content' && (
              <div className="il-form-group">
                <span className="il-label il-label-required"> Content</span>
                <SimpleRichTextEditor
                  value={state.comments}
                  onChange={(val) => {
                    set('comments', val);
                    setErrors((prev) => ({ ...prev, content: undefined }));
                  }}
                  hasError={!!errors.content}
                />
                {errors.content && <span className="il-error-msg">{errors.content}</span>}
              </div>
            )}
          </div>

        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="il-modal-footer">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" leadingIcon={RotateCcw} onClick={handleReset} disabled={isSaving}>
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSubmit}
            isLoading={isSaving}
          >
            {isEditMode ? 'Save Changes' : 'Create'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { AddLinkModalComponent as AddLinkModal };
export default AddLinkModalComponent;

