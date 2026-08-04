import { memo, useRef, useState, useEffect } from 'react';
import { Edit2, LayoutGrid, Loader2, Plus, Trash2, Upload, User, X } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { settingsService } from '@services/settingsService';

/**
 * Helper to strip HTML tags for clean plain text display in cards.
 */
function stripHtml(htmlStr) {
  if (!htmlStr) return '';
  try {
    const doc = new DOMParser().parseFromString(htmlStr, 'text/html');
    return doc.body.textContent || '';
  } catch {
    return htmlStr.replace(/<[^>]*>?/gm, '');
  }
}

/**
 * Home Management Panel - Split-Screen Preview Modal & Stable Event Handling
 */
function HomeManagementPanelComponent() {
  const toast = useToast();
  const [cards, setCards] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getHomeData();
      setCards(res || []);
    } catch (error) {
      console.error('Failed to fetch home data:', error);
      toast.error('Failed to load home cards');
    } finally {
      setLoading(false);
    }
  };

  // Form states
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [contentInput, setContentInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleOpenAddModal = () => {
    setEditId(null);
    setSelectedFile(null);
    setPreviewUrl(null);
    setContentInput('');
    setIsUploading(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (card) => {
    setEditId(card.id);
    setSelectedFile(null);
    setPreviewUrl(card.photo ? `data:image/jpeg;base64,${card.photo}` : null);
    setContentInput(stripHtml(card.description));
    setIsUploading(false);
    setIsModalOpen(true);
  };

  const handleDeleteCard = async (id) => {
    try {
      await settingsService.deleteHomeData(id);
      setCards((prev) => prev.filter((c) => c.id !== id));
      toast.success('Home card deleted successfully');
    } catch (error) {
      console.error('Failed to delete home card:', error);
      toast.error('Failed to delete home card');
    }
  };

  const processFileSelection = (file) => {
    if (!file) return;
    setIsUploading(true);
    setSelectedFile(file);

    // Just set preview url synchronously for the UI
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setIsUploading(false);
    toast.success(`Image selected: ${file.name}`);
  };

  const handleFileChange = (e) => {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (file) {
      processFileSelection(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processFileSelection(file);
    }
  };

  const handleSaveCard = async () => {
    if (!contentInput.trim() && !selectedFile && !previewUrl) {
      toast.error('Please enter content or upload a photo');
      return;
    }

    try {
      setIsUploading(true);
      const payload = new FormData();
      if (contentInput.trim()) payload.append('description', contentInput.trim());
      if (selectedFile) payload.append('photo', selectedFile);

      if (editId) {
        await settingsService.updateHomeData(editId, payload);
        toast.success('Home card updated');
      } else {
        await settingsService.createHomeData(payload);
        toast.success('Home card added successfully');
      }

      await fetchData();
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to save home card:', error);
      toast.error('Failed to save home card');
    } finally {
      setIsUploading(false);
    }
  };

  const isSaveDisabled = isUploading || (!contentInput.trim() && !selectedFile && !previewUrl);

  if (loading && cards.length === 0) {
    return (
      <div className="hm-loading">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="hm-header">
        <div className="hm-header-title">
          <LayoutGrid size={22} className="hm-header-icon" />
          <h2>Home Management</h2>
        </div>

        <button type="button" className="ss-btn-update" onClick={handleOpenAddModal}>
          <Plus size={16} />
          Add Home Card
        </button>
      </div>

      <div className="hm-grid">
        {cards.map((card) => {
          const plainText = stripHtml(card.description);
          const displayPhotoUrl = card.photo ? `data:image/jpeg;base64,${card.photo}` : null;

          return (
            <div key={card.id} className="hm-card">
              <div className="hm-card-media">
                {displayPhotoUrl ? (
                  <img src={displayPhotoUrl} alt="Card media" />
                ) : (
                  <div className="hm-card-media-placeholder">
                    <User size={40} />
                    <span>No Image Banner</span>
                  </div>
                )}
              </div>

              <div className="hm-card-body">
                <p>{plainText}</p>
              </div>

              <div className="hm-card-footer">
                <button
                  type="button"
                  className="hm-icon-btn edit"
                  onClick={() => handleOpenEditModal(card)}
                  title="Edit Home Card"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  type="button"
                  className="hm-icon-btn delete"
                  onClick={() => handleDeleteCard(card.id)}
                  title="Delete Home Card"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Add / Edit Home Card (Split-Screen Preview) */}
      {isModalOpen && (
        <div className="hm-modal-overlay">
          <button
            type="button"
            aria-label="Close backdrop"
            className="hm-modal-backdrop"
            onClick={() => setIsModalOpen(false)}
          />

          <div role="dialog" aria-modal="true" className="hm-modal-dialog">
            <div className="hm-modal-header">
              <div className="hm-modal-header-title">
                <LayoutGrid size={20} className="hm-header-icon" />
                <h3>{editId ? 'Edit Home Card' : 'Add Home Card'}</h3>
              </div>
              <button
                type="button"
                className="hm-modal-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(false);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div className="hm-modal-body">
              <div className="hm-modal-col">
                <h4 className="hm-modal-col-heading">Card Details</h4>

                <div className="ss-modal-form-group">
                  <span className="ss-modal-label">Card Banner Image</span>
                  <div
                    role="button"
                    tabIndex={0}
                    aria-busy={isUploading}
                    className="hm-dropzone"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isUploading) fileInputRef.current?.click();
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
                        e.preventDefault();
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }
                    }}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFileChange}
                    />

                    {isUploading ? (
                      <div className="hm-dropzone-state">
                        <Loader2 size={28} className="animate-spin hm-header-icon" />
                        <span>Processing image...</span>
                      </div>
                    ) : previewUrl ? (
                      <div className="hm-dropzone-state">
                        <img src={previewUrl} alt="Thumbnail preview" className="hm-dropzone-preview" />
                        <span className="hm-header-icon">
                          Click or drag to change image {selectedFile ? `(${selectedFile.name})` : ''}
                        </span>
                      </div>
                    ) : (
                      <div className="hm-dropzone-state">
                        <Upload size={28} />
                        <span>
                          Drag &amp; drop image here, or <span className="hm-header-icon">browse</span>
                        </span>
                        <span className="hm-dropzone-hint">Supports PNG, JPG, WebP (Max 5MB)</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="ss-modal-form-group">
                  <label className="ss-modal-label" htmlFor="card-content-input">
                    Content Description
                  </label>
                  <textarea
                    id="card-content-input"
                    rows={5}
                    className="ss-input"
                    style={{ height: 'auto', padding: '12px', resize: 'vertical' }}
                    placeholder="Enter description text for this home card..."
                    value={contentInput}
                    onChange={(e) => setContentInput(e.target.value)}
                  />
                </div>
              </div>

              <div className="hm-modal-col">
                <h4 className="hm-modal-col-heading">Live Card Preview</h4>

                <div className="hm-preview-card">
                  <div className="hm-card-media">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Live preview" />
                    ) : (
                      <div className="hm-card-media-placeholder">
                        <User size={40} />
                        <span>No Image Banner</span>
                      </div>
                    )}
                  </div>

                  <div className="hm-card-body" style={{ minHeight: '90px', display: 'flex', alignItems: 'center' }}>
                    <p>
                      {contentInput.trim() ? (
                        stripHtml(contentInput)
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                          Card description text will preview here instantly as you type...
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="hm-card-footer">
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginRight: 'auto' }}>
                      Card Footer Preview
                    </div>
                    <button type="button" disabled className="hm-icon-btn edit">
                      <Edit2 size={15} />
                    </button>
                    <button type="button" disabled className="hm-icon-btn delete">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="hm-modal-footer">
              <button
                type="button"
                className="ss-btn-update"
                style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(false);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="ss-btn-update"
                disabled={isSaveDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveCard();
                }}
              >
                {isUploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Save Card'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const HomeManagementPanel = memo(HomeManagementPanelComponent);
export default HomeManagementPanel;
