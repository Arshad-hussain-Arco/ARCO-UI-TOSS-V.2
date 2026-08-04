import { FileText, Upload, X } from 'lucide-react';

export function UploadFileModal({
  isOpen,
  onClose,
  fileName,
  setFileName,
  description,
  setDescription,
  uploadedFileObject,
  setUploadedFileObject,
  onSubmit,
}) {
  if (!isOpen) return null;

  const handleFileSelected = (fileObj) => {
    setUploadedFileObject(fileObj);
    setFileName(fileObj.name);
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
        <form onSubmit={onSubmit}>
          <div className="doc-modal-body">
            <div className="doc-form-group">
              <label htmlFor="file-upload-input" className="doc-form-label required">Select or Drag File</label>
              <div
                className="doc-upload-dropzone"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelected(e.dataTransfer.files[0]);
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
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
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
              <label htmlFor="file-name-input" className="doc-form-label">Display File Name</label>
              <input
                id="file-name-input"
                type="text"
                className="doc-form-input"
                placeholder="e.g. Architecture_Diagram.png"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </div>

            <div className="doc-form-group">
              <label htmlFor="file-desc-input" className="doc-form-label">Description</label>
              <textarea
                id="file-desc-input"
                rows={3}
                className="doc-form-textarea"
                placeholder="File description or comments..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <div className="doc-modal-footer">
            <button type="button" className="doc-modal-btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="doc-modal-btn primary">
              Upload File
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UploadFileModal;
