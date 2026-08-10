import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, FolderPlus, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { documentService } from '@services/documentService';

/** Modal for Creating a New Folder */
export function AddFolderModal({ isOpen, onClose, selectedFolder, onSuccess }) {
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) {
      toast.error('Folder name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await documentService.createFolder({
        name: newFolderName.trim(),
        description: newFolderDescription.trim(),
        parentId: selectedFolder,
      });
      toast.success('Folder created successfully');
      setNewFolderName('');
      setNewFolderDescription('');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create folder');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="doc-modal-overlay">
      <div className="doc-modal-container">
        <div className="doc-modal-header">
          <h3>Create New Folder</h3>
          <button className="doc-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleCreateFolder}>
          <div className="doc-modal-body">
            <div className="doc-form-group">
              <label htmlFor="folder-name" className="doc-form-label required">
                Folder Name
              </label>
              <input
                id="folder-name"
                type="text"
                required
                className="doc-form-input"
                placeholder="e.g. Project Specs"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="doc-form-group">
              <label htmlFor="folder-desc" className="doc-form-label">
                Description (Optional)
              </label>
              <textarea
                id="folder-desc"
                rows={3}
                className="doc-form-textarea"
                placeholder="Describe the folder contents..."
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="doc-modal-footer">
            <button type="button" className="doc-modal-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="doc-modal-btn primary" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Modal for Uploading a New File */
export function UploadFileModal({ isOpen, onClose, selectedFolder, onSuccess }) {
  const [newFileName, setNewFileName] = useState('');
  const [newFileDescription, setNewFileDescription] = useState('');
  const [uploadedFileObject, setUploadedFileObject] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleUploadFile = async (e) => {
    e.preventDefault();
    if (!uploadedFileObject) {
      toast.error('Please select a file to upload');
      return;
    }

    setIsSubmitting(true);
    try {
      await documentService.uploadFile({
        file: uploadedFileObject,
        title: newFileName.trim() || uploadedFileObject.name,
        description: newFileDescription.trim(),
        folderId: selectedFolder,
      });
      toast.success('File uploaded successfully');
      setNewFileName('');
      setNewFileDescription('');
      setUploadedFileObject(null);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="doc-modal-overlay">
      <div className="doc-modal-container">
        <div className="doc-modal-header">
          <h3>Upload Document File</h3>
          <button className="doc-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleUploadFile}>
          <div className="doc-modal-body">
            <div className="doc-form-group">
              <label htmlFor="file-upload-input" className="doc-form-label required">
                Select or Drag File
              </label>
              <div
                className="doc-upload-dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const fileObj = e.dataTransfer.files[0];
                    setUploadedFileObject(fileObj);
                    setNewFileName(fileObj.name);
                  }
                }}
              >
                <Upload size={32} className="doc-dropzone-icon" />
                <p className="doc-dropzone-text">
                  Drag & drop your file here, or <span className="doc-drop-link">browse</span>
                </p>
                <input
                  id="file-upload-input"
                  type="file"
                  className="doc-hidden-file-input"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      const fileObj = e.target.files[0];
                      setUploadedFileObject(fileObj);
                      setNewFileName(fileObj.name);
                    }
                  }}
                />
                {uploadedFileObject && (
                  <div className="doc-uploaded-status-badge">
                    <FileText size={14} />
                    <span>{uploadedFileObject.name}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="doc-form-group">
              <label htmlFor="file-name-input" className="doc-form-label">
                Display Title
              </label>
              <input
                id="file-name-input"
                type="text"
                className="doc-form-input"
                placeholder="e.g. Architecture_Diagram.png"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
              />
            </div>

            <div className="doc-form-group">
              <label htmlFor="file-desc-input" className="doc-form-label">
                Description
              </label>
              <textarea
                id="file-desc-input"
                rows={3}
                className="doc-form-textarea"
                placeholder="File description or comments..."
                value={newFileDescription}
                onChange={(e) => setNewFileDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="doc-modal-footer">
            <button type="button" className="doc-modal-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="doc-modal-btn primary" disabled={isSubmitting}>
              {isSubmitting ? 'Uploading...' : 'Upload File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Modal for Editing / Updating an Existing Document or Folder */
export function EditDocumentModal({ isOpen, onClose, targetDocument, targetType, onSuccess }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [replacementFile, setReplacementFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (targetDocument) {
      setTitle(targetDocument.title || targetDocument.name || '');
      setDescription(targetDocument.description || '');
      setReplacementFile(null);
    }
  }, [targetDocument]);

  if (!isOpen || !targetDocument) return null;

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await documentService.updateDocument(targetDocument.id, {
        title: title.trim(),
        description: description.trim(),
        file: replacementFile,
        folderId: targetDocument.folderId || targetDocument.parentId || 'root',
      });

      toast.success(`${targetType === 'folder' ? 'Folder' : 'File'} updated successfully`);
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update document');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="doc-modal-overlay">
      <div className="doc-modal-container">
        <div className="doc-modal-header">
          <h3>Update {targetType === 'folder' ? 'Folder' : 'File'}</h3>
          <button className="doc-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleUpdate}>
          <div className="doc-modal-body">
            <div className="doc-form-group">
              <label htmlFor="edit-title" className="doc-form-label required">
                Title / Name
              </label>
              <input
                id="edit-title"
                type="text"
                required
                className="doc-form-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="doc-form-group">
              <label htmlFor="edit-description" className="doc-form-label">
                Description
              </label>
              <textarea
                id="edit-description"
                rows={3}
                className="doc-form-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {targetType === 'file' && (
              <div className="doc-form-group">
                <label htmlFor="replace-file" className="doc-form-label">
                  Replace File (Optional)
                </label>
                <input
                  id="replace-file"
                  type="file"
                  className="doc-form-input"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setReplacementFile(e.target.files[0]);
                    }
                  }}
                />
                {replacementFile && (
                  <span style={{ fontSize: '12px', color: 'var(--c-success)', marginTop: '4px', display: 'block' }}>
                    New file selected: {replacementFile.name}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="doc-modal-footer">
            <button type="button" className="doc-modal-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="doc-modal-btn primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Modal for Confirming Deletion */
export function DeleteConfirmationModal({ isOpen, onClose, targetName, onConfirm, isDeleting }) {
  if (!isOpen) return null;

  return (
    <div className="doc-modal-overlay">
      <div className="doc-modal-container">
        <div className="doc-modal-header">
          <h3>Confirm Deletion</h3>
          <button className="doc-modal-close-btn" onClick={onClose} disabled={isDeleting}>
            <X size={18} />
          </button>
        </div>
        <div className="doc-modal-body">
          <p style={{ margin: 0, fontSize: '14px', }}>
            Are you sure you want to delete <strong>{targetName || 'this item'}</strong>? This action cannot be undone.
          </p>
        </div>
        <div className="doc-modal-footer">
          <button type="button" className="doc-modal-btn ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button
            type="button"
            className="doc-modal-btn primary"
            style={{ backgroundColor: 'var(--c-danger)', borderColor: 'var(--c-danger)', color: 'var(--surface-primary)' }}
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
