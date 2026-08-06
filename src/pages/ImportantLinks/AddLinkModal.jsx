import { useState, useRef, useCallback, useEffect } from 'react';
import { Check, ChevronDown, FileText, Pin, Plus, RotateCcw, Upload, X } from 'lucide-react';

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
function GroupDropdown({ groups, value, onSelect, onCreateNew, hasError }) {
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
          {value ? selectedLabel : 'Select group (Optional)'}
        </span>
        <ChevronDown size={13} strokeWidth={2} className="il-modal-group-trigger-chevron" />
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

            <div className="il-modal-group-divider" />

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
        </div>
      )}
    </div>
  );
}

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
function AddLinkModalComponent({ existingGroups = [], editLink = null, onAdd, onUpdate, onClose, isSaving = false }) {
  const isEditMode = !!editLink;

  const getInitialState = useCallback(() => {
    if (editLink) {
      return {
        groupMode: 'existing',
        selectedGroup: '',
        newGroupName: '',
        linkName: editLink.label || '',
        url: editLink.url || '',
        sharedFolder: editLink.sharedFolder || '',
        comments: editLink.comments || '',
        pinToHeader: editLink.pinToHeader || false,
        files: [],
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

  const [state, setState] = useState(getInitialState);
  const [errors, setErrors] = useState({});
  const fileInputRef = useRef(null);

  // Sync state when editLink changes
  useEffect(() => {
    setState(getInitialState());
    setErrors({});
  }, [editLink, getInitialState]);

  const set = (key, val) => setState((prev) => ({ ...prev, [key]: val }));

  const handleReset = useCallback(() => {
    setState(getInitialState());
    setErrors({});
  }, [getInitialState]);

  function validate() {
    const errs = {};

    if (!state.linkName.trim()) {
      errs.linkName = 'Link name is required.';
    }

    if (!state.url.trim()) {
      errs.url = 'URL is required.';
    } else {
      try {
        new URL(state.url.startsWith('http') ? state.url : `https://${state.url}`);
      } catch {
        errs.url = 'Please enter a valid URL.';
      }
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
    let finalUrl = state.url.trim();
    if (finalUrl && !/^https?:\/\//i.test(finalUrl)) {
      finalUrl = `https://${finalUrl}`;
    }

    const payload = {
      id: editLink?.id ?? createId('link'),
      label: state.linkName.trim(),
      url: finalUrl,
      sharedFolder: state.sharedFolder.trim() || '',
      comments: state.comments.trim() || '',
      pinToHeader: state.pinToHeader,
      files: state.files,
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
    if (e.target.files) {
      set('files', [...state.files, ...Array.from(e.target.files)]);
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

          {/* Link Name */}
          <div className="il-form-group">
            <span className="il-label il-label-required">Link Name</span>
            <input
              type="text"
              className={`il-input${errors.linkName ? ' il-input-error' : ''}`}
              placeholder="e.g. Grafana Dashboards"
              value={state.linkName}
              onChange={(e) => {
                set('linkName', e.target.value);
                setErrors((prev) => ({ ...prev, linkName: undefined }));
              }}
            />
            {errors.linkName && <span className="il-error-msg">{errors.linkName}</span>}
          </div>

          {/* URL */}
          <div className="il-form-group">
            <span className="il-label il-label-required">URL</span>
            <input
              type="url"
              className={`il-input${errors.url ? ' il-input-error' : ''}`}
              placeholder="https://"
              value={state.url}
              onChange={(e) => {
                set('url', e.target.value);
                setErrors((prev) => ({ ...prev, url: undefined }));
              }}
            />
            {errors.url && <span className="il-error-msg">{errors.url}</span>}
          </div>

          {/* Shared Folder */}
          <div className="il-form-group">
            <span className="il-label">
              Shared Folder
              <span className="il-label-optional">(optional)</span>
            </span>
            <input
              type="text"
              className="il-input"
              placeholder="e.g. \\server\shared\folder or Google Drive link"
              value={state.sharedFolder}
              onChange={(e) => set('sharedFolder', e.target.value)}
            />
          </div>

          {/* Group */}
          <div className="il-form-group">
            <span className="il-label">
              Group
              <span className="il-label-optional">(optional)</span>
            </span>

            <GroupDropdown
              groups={existingGroups}
              value={state.groupMode === 'new' ? '__new__' : state.selectedGroup}
              hasError={false}
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
          </div>

          {/* New Group Name */}
          {state.groupMode === 'new' && (
            <div className="il-new-group-row">
              <span className="il-label">
                New Group Name
                <span className="il-label-optional">(optional)</span>
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

          {/* Upload File */}
          <div className="il-form-group">
            <span className="il-label">
              Upload File
              <span className="il-label-optional">(optional)</span>
            </span>

            <div
              className="il-upload-zone"
              role="button"
              tabIndex={0}
              aria-label="Choose files to upload"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                set('files', [...state.files, ...Array.from(e.dataTransfer.files)]);
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

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPTED_TYPES}
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {state.files.length > 0 && (
              <div className="il-upload-file-list">
                {state.files.map((f, i) => (
                  <div key={i} className="il-upload-file-row">
                    <FileText className="il-upload-file-icon" aria-hidden="true" />
                    <span className="il-upload-file-name">{f.name}</span>
                    <span className="il-upload-file-size">{(f.size / 1024).toFixed(0)} KB</span>
                    <button
                      type="button"
                      className="il-upload-file-remove"
                      aria-label={`Remove ${f.name}`}
                      onClick={() => removeFile(i)}
                    >
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="il-form-group">
            <span className="il-label">
              Comments
              <span className="il-label-optional">(optional)</span>
            </span>
            <textarea
              className="il-textarea"
              placeholder="Add any notes or context about this link…"
              value={state.comments}
              onChange={(e) => set('comments', e.target.value)}
            />
          </div>

          {/* Pin to Header */}
          <div className="il-pin-row">
            <div className="il-pin-row-info">
              <div className="il-pin-row-title">
                <Pin size={13} className="il-pin-row-icon" aria-hidden="true" />
                Pin to Header
              </div>
              <p className="il-pin-row-desc">
                Quickly access this resource directly from the application header.
              </p>
            </div>

            <label className="il-toggle" aria-label="Pin to header">
              <input
                type="checkbox"
                checked={state.pinToHeader}
                onChange={(e) => set('pinToHeader', e.target.checked)}
              />
              <span className="il-toggle-track" />
              <span className="il-toggle-thumb" />
            </label>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <div className="il-modal-footer">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" leadingIcon={RotateCcw} onClick={handleReset} disabled={isSaving}>
            Reset
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={isEditMode ? Check : Plus}
            onClick={handleSubmit}
            isLoading={isSaving}
          >
            {isEditMode ? (isSaving ? 'Updating...' : 'Update Link') : (isSaving ? 'Adding...' : 'Add Link')}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { AddLinkModalComponent as AddLinkModal };
export default AddLinkModalComponent;
