import { X } from 'lucide-react';

export function AddFolderModal({ isOpen, onClose, name, setName, description, setDescription, onSubmit }) {
  if (!isOpen) return null;

  return (
    <div className="doc-modal-overlay">
      <div className="doc-modal-container">
        <div className="doc-modal-header">
          <h3>Create New Folder</h3>
          <button className="doc-modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="doc-modal-body">
            <div className="doc-form-group">
              <label htmlFor="folder-name" className="doc-form-label required">Folder Name</label>
              <input
                id="folder-name"
                type="text"
                required
                className="doc-form-input"
                placeholder="e.g. Q2 Plans"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="doc-form-group">
              <label htmlFor="folder-desc" className="doc-form-label">Description (Optional)</label>
              <textarea
                id="folder-desc"
                rows={3}
                className="doc-form-textarea"
                placeholder="Describe the folder contents..."
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
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddFolderModal;
