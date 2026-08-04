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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Loader2 className="spinner" size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 3. Top Header Bar & Action Alignment */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LayoutGrid size={22} style={{ color: '#006838' }} />
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Home Management
          </h2>
        </div>

        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            height: '38px',
            padding: '0 20px',
            fontSize: '13px',
            fontWeight: 600,
            color: '#ffffff',
            background: '#006838',
            border: 'none',
            borderRadius: '6px',
            boxShadow: '0 2px 4px rgba(0, 104, 56, 0.2)',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onClick={handleOpenAddModal}
        >
          <Plus size={16} />
          Add Home Card
        </button>
      </div>

      {/* 2. Responsive Card Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px',
        }}
      >
        {cards.map((card) => {
          const plainText = stripHtml(card.description);
          const displayPhotoUrl = card.photo ? `data:image/jpeg;base64,${card.photo}` : null;

          return (
            <div
              key={card.id}
              style={{
                background: 'var(--surface-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'box-shadow 0.2s ease, transform 0.2s ease',
              }}
            >
              {/* Header/Media: Top Image Banner or Centered Placeholder */}
              <div
                style={{
                  height: '160px',
                  width: '100%',
                  background: 'var(--bg-secondary)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {displayPhotoUrl ? (
                  <img
                    src={displayPhotoUrl}
                    alt="Card media"
                    style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)' }}>
                    <User size={40} />
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>No Image Banner</span>
                  </div>
                )}
              </div>

              {/* Content Preview */}
              <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <p
                  style={{
                    fontSize: '13px',
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    margin: 0,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {plainText}
                </p>
              </div>

              {/* Card Actions Footer Bar */}
              <div
                style={{
                  padding: '10px 16px',
                  borderTop: '1px solid var(--border-primary)',
                  background: 'var(--bg-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '8px',
                }}
              >
                <button
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: '#006838',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#ecfdf5')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => handleOpenEditModal(card)}
                  title="Edit Home Card"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  type="button"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'transparent',
                    color: '#dc2626',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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

      {/* 🖼️ MODAL: Add / Edit Home Card (Split-Screen Preview) */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close backdrop"
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              border: 'none',
              padding: 0,
              margin: 0,
              cursor: 'default',
              width: '100%',
              height: '100%',
            }}
            onClick={() => setIsModalOpen(false)}
          />

          {/* Dialog Container */}
          <div
            role="dialog"
            aria-modal="true"
            style={{
              position: 'relative',
              zIndex: 1001,
              background: 'var(--surface-primary)',
              borderRadius: '10px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              width: '100%',
              maxWidth: '920px',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--border-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--bg-secondary)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <LayoutGrid size={20} style={{ color: '#006838' }} />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {editId ? 'Edit Home Card' : 'Add Home Card'}
                </h3>
              </div>
              <button
                type="button"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  padding: '4px',
                  borderRadius: '4px',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(false);
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Split-Screen Side-by-Side 2-Column Layout */}
            <div
              style={{
                padding: '24px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '28px',
                alignItems: 'start',
              }}
            >
              {/* Left Column: Form Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                  Card Details
                </h4>

                {/* File Upload / Drag & Drop Zone */}
                <div className="ss-modal-form-group">
                  <span className="ss-modal-label">Card Banner Image</span>
                  <div
                    role="button"
                    tabIndex={0}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    style={{
                      border: '2px dashed var(--border-primary)',
                      borderRadius: '8px',
                      padding: '24px 16px',
                      textAlign: 'center',
                      background: 'var(--bg-secondary)',
                      cursor: isUploading ? 'wait' : 'pointer',
                      transition: 'all 0.15s ease',
                      position: 'relative',
                    }}
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
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '12px 0' }}>
                        <Loader2 size={28} className="animate-spin" style={{ color: '#006838' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Processing image...
                        </span>
                      </div>
                    ) : previewUrl ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                        <img
                          src={previewUrl}
                          alt="Thumbnail preview"
                          style={{ height: '100px', maxWidth: '100%', objectFit: 'cover', borderRadius: '6px' }}
                        />
                        <span style={{ fontSize: '12px', color: '#006838', fontWeight: 600 }}>
                          Click or drag to change image {selectedFile ? `(${selectedFile.name})` : ''}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Upload size={28} style={{ color: 'var(--text-tertiary)' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          Drag & drop image here, or <span style={{ color: '#006838' }}>browse</span>
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                          Supports PNG, JPG, WebP (Max 5MB)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content Input Textarea */}
                <div className="ss-modal-form-group">
                  <label className="ss-modal-label" htmlFor="card-content-input">
                    Content Description
                  </label>
                  <textarea
                    id="card-content-input"
                    rows={5}
                    className="ss-input"
                    style={{ height: 'auto', padding: '12px', fontSize: '13px', resize: 'vertical' }}
                    placeholder="Enter description text for this home card..."
                    value={contentInput}
                    onChange={(e) => setContentInput(e.target.value)}
                  />
                </div>
              </div>

              {/* Right Column: Live Card Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                  Live Card Preview
                </h4>

                <div
                  style={{
                    background: 'var(--surface-primary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  {/* Banner Image Preview */}
                  <div
                    style={{
                      height: '160px',
                      width: '100%',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}
                  >
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Live preview"
                        style={{ width: '100%', height: '160px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)' }}>
                        <User size={40} />
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>No Image Banner</span>
                      </div>
                    )}
                  </div>

                  {/* Instant Content Preview */}
                  <div style={{ padding: '16px 20px', minHeight: '90px', display: 'flex', alignItems: 'center' }}>
                    <p
                      style={{
                        fontSize: '13px',
                        lineHeight: 1.6,
                        color: 'var(--text-primary)',
                        margin: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {contentInput.trim() ? (
                        stripHtml(contentInput)
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                          Card description text will preview here instantly as you type...
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Card Footer Preview */}
                  <div
                    style={{
                      padding: '10px 16px',
                      borderTop: '1px solid var(--border-primary)',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic', marginRight: 'auto' }}>
                      Card Footer Preview
                    </div>
                    <button type="button" disabled style={{ opacity: 0.5, border: 'none', background: 'transparent', color: '#006838' }}>
                      <Edit2 size={15} />
                    </button>
                    <button type="button" disabled style={{ opacity: 0.5, border: 'none', background: 'transparent', color: '#dc2626' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer */}
            <div
              style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-primary)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                background: 'var(--bg-secondary)',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                style={{
                  height: '36px',
                  padding: '0 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  background: 'transparent',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(false);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isSaveDisabled}
                style={{
                  height: '36px',
                  padding: '0 20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#ffffff',
                  background: isSaveDisabled ? 'var(--border-primary)' : '#006838',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: isSaveDisabled ? 'none' : '0 2px 4px rgba(0, 104, 56, 0.2)',
                  cursor: isSaveDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
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
