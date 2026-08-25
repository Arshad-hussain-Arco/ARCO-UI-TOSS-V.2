import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Check, ChevronDown, ChevronRight, FileText, Lock, Pin, Plus, RotateCcw, Upload, X, Link2, Folder, Pencil } from 'lucide-react';

import { Button } from '@components/ui/Button/Button';
import { dismissBackdrop } from '@utils/interactive';
import { createId } from '@utils/id';
import { useOnClickOutside } from '@hooks/useOnClickOutside';

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
                className={`il-segmented-btn ${errors.folder ? 'il-segmented-btn-error' : ''}`}
                data-active={linkType === 'folder'}
                onClick={() => {
                  setLinkType('folder');
                  setErrors((prev) => ({ ...prev, folder: undefined }));
                }}
              >
                <Folder size={15} /> Shared Folder
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
                <Pencil size={15} /> Text Content
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

            {linkType === 'folder' && (
              <div className="il-form-group">
                <span className="il-label il-label-required">Shared Folder</span>
                <input
                  type="text"
                  className={`il-input${errors.folder ? ' il-input-error' : ''}`}
                  placeholder="e.g. \\server\share\folder"
                  value={state.sharedFolder}
                  autoFocus
                  onChange={(e) => {
                    set('sharedFolder', e.target.value);
                    setErrors((prev) => ({ ...prev, folder: undefined }));
                  }}
                />
                {errors.folder && <span className="il-error-msg">{errors.folder}</span>}
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
                <span className="il-label il-label-required">Text Content</span>
                <textarea
                  className={`il-textarea${errors.content ? ' il-input-error' : ''}`}
                  placeholder="Enter your content here..."
                  value={state.comments}
                  autoFocus
                  onChange={(e) => {
                    set('comments', e.target.value);
                    setErrors((prev) => ({ ...prev, content: undefined }));
                  }}
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

