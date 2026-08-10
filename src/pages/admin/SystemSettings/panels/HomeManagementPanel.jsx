import { memo, useRef, useState, useEffect } from 'react';
import { Edit2, LayoutGrid, Loader2, Plus, Trash2, Upload, User, X, Code, FileText, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { settingsService } from '@services/settingsService';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import DOMPurify from 'dompurify';

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

  // Tab State
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'html'
  const [activeSubtab, setActiveSubtab] = useState('article'); // 'article' | 'content'

  // Person Subtab State
  const [personName, setPersonName] = useState('');
  const [personDesignation, setPersonDesignation] = useState('');
  const [personBio, setPersonBio] = useState('');
  const [personFile, setPersonFile] = useState(null);
  const [personPreviewUrl, setPersonPreviewUrl] = useState(null);
  const [personWidth, setPersonWidth] = useState('100%'); // '50%' | '100%'

  // Content Subtab State
  const [contentFile, setContentFile] = useState(null);
  const [contentPreviewUrl, setContentPreviewUrl] = useState(null);
  const [contentText, setContentText] = useState('');
  const [contentWidth, setContentWidth] = useState('100%'); // '50%' | '100%'

  // HTML Tab State
  const [htmlFile, setHtmlFile] = useState(null);
  const [htmlPreviewUrl, setHtmlPreviewUrl] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [htmlWidth, setHtmlWidth] = useState('100%'); // '50%' | '100%'

  const [isUploading, setIsUploading] = useState(false);
  const [cardToDelete, setCardToDelete] = useState(null);

  // File input refs
  const personFileInputRef = useRef(null);
  const contentFileInputRef = useRef(null);
  const htmlFileInputRef = useRef(null);

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

  const handleOpenAddModal = () => {
    setEditId(null);
    setIsUploading(false);
    setActiveTab('text');
    setActiveSubtab('article');

    setPersonName('');
    setPersonDesignation('');
    setPersonBio('');
    setPersonFile(null);
    setPersonPreviewUrl(null);
    setPersonWidth('50%'); // Default is 50% for Person Card

    setContentFile(null);
    setContentPreviewUrl(null);
    setContentText('');
    setContentWidth('100%'); // Default is 100% for Content Card

    setHtmlFile(null);
    setHtmlPreviewUrl(null);
    setHtmlContent('');
    setHtmlWidth('100%');

    setIsModalOpen(true);
  };

  const handleOpenEditModal = (card) => {
    setEditId(card.id);
    setIsUploading(false);

    setPersonName('');
    setPersonDesignation('');
    setPersonBio('');
    setPersonFile(null);
    setPersonPreviewUrl(null);
    setPersonWidth('50%');

    setContentFile(null);
    setContentPreviewUrl(null);
    setContentText('');
    setContentWidth('100%');

    setHtmlFile(null);
    setHtmlPreviewUrl(null);
    setHtmlContent('');
    setHtmlWidth('100%');

    const photoUrl = card.photo ? `data:image/jpeg;base64,${card.photo}` : null;
    const widthVal = card.display_width || '100%';

    if (card.card_type === 'person_card') {
      setActiveTab('text');
      setActiveSubtab('article');
      setPersonName(card.person_name || '');
      setPersonDesignation(card.designation || '');
      setPersonBio(card.bio || '');
      setPersonWidth(widthVal);
      setPersonPreviewUrl(photoUrl);
    } else if (card.card_type === 'content_card') {
      setActiveTab('text');
      setActiveSubtab('content');
      setContentText(card.text_content || '');
      setContentWidth(widthVal);
      setContentPreviewUrl(photoUrl);
    } else {
      setActiveTab('html');
      setHtmlContent(card.html_content || '');
      setHtmlWidth(widthVal);
      setHtmlPreviewUrl(photoUrl);
    }

    setIsModalOpen(true);
  };

  const handleDeleteCard = (card) => {
    setCardToDelete(card);
  };

  const confirmDeleteCard = async () => {
    if (!cardToDelete) return;
    try {
      await settingsService.deleteHomeData(cardToDelete.id);
      setCards((prev) => prev.filter((c) => c.id !== cardToDelete.id));
      toast.success('Home card deleted successfully');
    } catch (error) {
      console.error('Failed to delete home card:', error);
      toast.error('Failed to delete home card');
    } finally {
      setCardToDelete(null);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const processPersonFile = (file) => {
    if (!file) return;
    setIsUploading(true);
    setPersonFile(file);
    const url = URL.createObjectURL(file);
    setPersonPreviewUrl(url);
    setIsUploading(false);
    toast.success(`Image selected: ${file.name}`);
  };

  const processContentFile = (file) => {
    if (!file) return;
    setIsUploading(true);
    setContentFile(file);
    const url = URL.createObjectURL(file);
    setContentPreviewUrl(url);
    setIsUploading(false);
    toast.success(`Image selected: ${file.name}`);
  };

  const processHtmlFile = (file) => {
    if (!file) return;
    setIsUploading(true);
    setHtmlFile(file);
    const url = URL.createObjectURL(file);
    setHtmlPreviewUrl(url);
    setIsUploading(false);
    toast.success(`Image selected: ${file.name}`);
  };

  const handleSaveCard = async () => {
    // Validation
    if (activeTab === 'text') {
      if (activeSubtab === 'article') {
        if (!personName.trim() || !personDesignation.trim() || !personBio.trim()) {
          toast.error('Title, Sub Head, and Description are required.');
          return;
        }
      } else {
        if (!contentText.trim()) {
          toast.error('Text Content is required.');
          return;
        }
      }
    } else {
      if (!htmlContent.trim()) {
        toast.error('HTML Code is required.');
        return;
      }
    }

    try {
      setIsUploading(true);
      const payload = new FormData();

      if (activeTab === 'text') {
        if (activeSubtab === 'article') {
          payload.append('card_type', 'person_card');
          payload.append('person_name', personName.trim());
          payload.append('designation', personDesignation.trim());
          payload.append('bio', personBio.trim());
          payload.append('display_width', personWidth);
          if (personFile) payload.append('photo', personFile);
        } else {
          payload.append('card_type', 'content_card');
          payload.append('text_content', contentText.trim());
          payload.append('display_width', contentWidth);
          if (contentFile) payload.append('photo', contentFile);
        }
      } else {
        payload.append('card_type', 'html_code');
        payload.append('html_content', htmlContent.trim());
        payload.append('display_width', htmlWidth);
        if (htmlFile) payload.append('photo', htmlFile);
      }

      if (editId) {
        await settingsService.updateHomeData(editId, payload);
        toast.success('Home card updated successfully');
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

  const isSaveDisabled = isUploading || (
    activeTab === 'text'
      ? (activeSubtab === 'article'
        ? (!personName.trim() || !personDesignation.trim() || !personBio.trim())
        : !contentText.trim()
      )
      : !htmlContent.trim()
  );

  const renderUploadZone = (inputRef, file, previewUrl, onSelect, label, helperText) => {
    return (
      <div className="ss-modal-form-group">
        <span className="ss-modal-label">{label}</span>
        <div
          role="button"
          tabIndex={0}
          onDragOver={handleDragOver}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile && droppedFile.type.startsWith('image/')) {
              onSelect(droppedFile);
            }
          }}
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
            if (!isUploading) inputRef.current?.click();
          }}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !isUploading) {
              e.preventDefault();
              e.stopPropagation();
              inputRef.current?.click();
            }
          }}
        >
          <input
            type="file"
            ref={inputRef}
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) onSelect(selected);
            }}
          />

          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '12px 0' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--c-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Uploading image...
              </span>
            </div>
          ) : previewUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <img
                src={previewUrl}
                alt="Thumbnail preview"
                style={{ height: '100px', maxWidth: '100%', objectFit: 'cover', borderRadius: '6px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--c-primary)', fontWeight: 600 }}>
                Click or drag to change image {file ? `(${file.name})` : ''}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Upload size={28} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Drag & drop image here, or <span style={{ color: 'var(--c-primary)' }}>browse</span>
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                {helperText}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderWidthSelector = (currentWidth, setWidth) => {
    return (
      <div className="ss-modal-form-group">
        <label className="ss-modal-label">Card Display Width</label>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setWidth('50%')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              border: currentWidth === '50%' ? '2px solid var(--c-primary)' : '1px solid var(--border-primary)',
              borderRadius: '8px',
              background: currentWidth === '50%' ? 'var(--c-primary-light)' : 'var(--surface-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: currentWidth === '50%' ? 'var(--c-primary)' : 'var(--text-primary)' }}>50% Width</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Half row layout</span>
          </button>
          <button
            type="button"
            onClick={() => setWidth('100%')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px',
              border: currentWidth === '100%' ? '2px solid var(--c-primary)' : '1px solid var(--border-primary)',
              borderRadius: '8px',
              background: currentWidth === '100%' ? 'var(--c-primary-light)' : 'var(--surface-primary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, color: currentWidth === '100%' ? 'var(--c-primary)' : 'var(--text-primary)' }}>100% Width</span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Full row banner</span>
          </button>
        </div>
      </div>
    );
  };

  const renderSkeletons = () => {
    return (
      <div className="hm-cards-grid">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="hm-card-item" style={{ minHeight: '180px', opacity: 0.6, background: '#fcfcfc', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'var(--bg-secondary)', animation: 'pulse 1.5s infinite ease-in-out' }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ height: '14px', width: '60%', background: 'var(--bg-secondary)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
                <div style={{ height: '10px', width: '40%', background: 'var(--bg-secondary)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <div style={{ height: '12px', width: '100%', background: 'var(--bg-secondary)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
              <div style={{ height: '12px', width: '90%', background: 'var(--bg-secondary)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
              <div style={{ height: '12px', width: '75%', background: 'var(--bg-secondary)', borderRadius: '4px', animation: 'pulse 1.5s infinite ease-in-out' }} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 3. Top Header Bar & Action Alignment */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <LayoutGrid size={22} style={{ color: 'var(--c-primary)' }} />
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
            color: 'var(--surface-primary)',
            background: 'var(--c-primary)',
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
      {loading && cards.length === 0 ? (
        renderSkeletons()
      ) : cards.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface-primary)', border: '1px dashed var(--border-primary)', borderRadius: '12px', color: 'var(--text-tertiary)' }}>
          <LayoutGrid size={48} style={{ margin: '0 auto 16px auto', display: 'block' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>No home cards found</h3>
          <p style={{ fontSize: '13px', margin: 0 }}>Click "Add Home Card" to create content widgets for the landing dashboard.</p>
        </div>
      ) : (
        <div className="hm-cards-grid">
          {cards.map((card) => {
            const displayPhotoUrl = card.photo ? `data:image/jpeg;base64,${card.photo}` : null;
            const width = card.display_width || '100%';
            const isFullWidth = width === '100%';

            return (
              <div
                key={card.id}
                className="hm-card-item"
                style={{
                  gridColumn: isFullWidth ? 'span 2' : 'span 1',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: 'var(--surface-primary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-primary)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
                  padding: '12px',
                  boxSizing: 'border-box',
                  minHeight: '180px',
                  position: 'relative',
                }}
              >
                {/* Actions in top right */}
                <div className="hm-card-actions" style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', zIndex: 10 }}>
                  <button
                    type="button"
                    className="hm-action-btn edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEditModal(card);
                    }}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      border: '1px solid var(--border-primary)',
                      background: 'var(--surface-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    title="Edit Card"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    className="hm-action-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCard(card);
                    }}
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      border: '1px solid var(--border-primary)',
                      background: 'var(--surface-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--c-danger)',
                      cursor: 'pointer',
                    }}
                    title="Delete Card"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Card Body with Dynamic Preview Render */}
                <div className="hm-card-body" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px', width: '100%' }}>
                  {displayPhotoUrl && (
                    <div className="hm-image-container" style={{ width: '100%', height: '80px', borderRadius: '6px', overflow: 'hidden', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                      <img src={displayPhotoUrl} alt="Card preview" className="hm-image-fit" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, paddingRight: '56px' }}>
                    {card.card_type === 'person_card' ? (
                      <>
                        <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{card.person_name}</h4>
                        <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)' }}>{card.designation}</div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '11px', lineHeight: 1.3, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.bio}</p>
                      </>
                    ) : card.card_type === 'content_card' ? (
                      <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.3, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{card.text_content}</p>
                    ) : (
                      <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.3, color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: 'monospace' }}>{stripHtml(card.html_content)}</p>
                    )}
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', alignSelf: 'flex-start', marginTop: '4px' }}>
                    {width} Width
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
              maxWidth: '980px',
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
                <LayoutGrid size={20} style={{ color: 'var(--c-primary)' }} />
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

            {/* Primary Enterprise-Style Tabs */}
            <div style={{
              display: 'flex',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border-primary)',
              flexShrink: 0,
            }}>
              <button
                type="button"
                onClick={() => setActiveTab('text')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: activeTab === 'text' ? 'var(--c-primary)' : 'var(--text-secondary)',
                  background: activeTab === 'text' ? 'var(--surface-primary)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'text' ? '3px solid var(--c-primary)' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                <FileText size={16} />
                Text Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('html')}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: activeTab === 'html' ? 'var(--c-primary)' : 'var(--text-secondary)',
                  background: activeTab === 'html' ? 'var(--surface-primary)' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === 'html' ? '3px solid var(--c-primary)' : '3px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                <Code size={16} />
                HTML Code
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
                flex: 1,
              }}
            >
              {/* Left Column: Form Inputs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {activeTab === 'text' ? (
                  <>
                    {/* Compact Segmented Subtabs */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                      <div style={{
                        display: 'inline-flex',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '6px',
                        padding: '2px',
                        gap: '2px',
                      }}>
                        <button
                          type="button"
                          onClick={() => setActiveSubtab('article')}
                          style={{
                            padding: '5px 16px',
                            border: 'none',
                            background: activeSubtab === 'article' ? 'var(--surface-primary)' : 'transparent',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: activeSubtab === 'article' ? 600 : 500,
                            color: activeSubtab === 'article' ? 'var(--c-primary)' : 'var(--text-secondary)',
                            boxShadow: activeSubtab === 'article' ? 'var(--shadow-sm)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          Article
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveSubtab('content')}
                          style={{
                            padding: '5px 16px',
                            border: 'none',
                            background: activeSubtab === 'content' ? 'var(--surface-primary)' : 'transparent',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: activeSubtab === 'content' ? 600 : 500,
                            color: activeSubtab === 'content' ? 'var(--c-primary)' : 'var(--text-secondary)',
                            boxShadow: activeSubtab === 'content' ? 'var(--shadow-sm)' : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          Content
                        </button>
                      </div>
                    </div>

                    {activeSubtab === 'article' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Card Display Width */}
                        {renderWidthSelector(personWidth, setPersonWidth)}

                        {/* Upload Person Image */}
                        {renderUploadZone(
                          personFileInputRef,
                          personFile,
                          personPreviewUrl,
                          processPersonFile,
                          "Upload Article Image",
                          "Supports PNG, JPG, JPEG, WEBP"
                        )}

                        {/* Person Name */}
                        <div className="ss-modal-form-group">
                          <label className="ss-modal-label">Title <span style={{ color: 'var(--c-danger)' }}>*</span></label>
                          <input
                            type="text"
                            className="ss-input"
                            value={personName}
                            onChange={(e) => setPersonName(e.target.value)}
                            placeholder="Enter Title..."
                          />
                        </div>

                        {/* Designation */}
                        <div className="ss-modal-form-group">
                          <label className="ss-modal-label">Sub Head <span style={{ color: 'var(--c-danger)' }}>*</span></label>
                          <input
                            type="text"
                            className="ss-input"
                            value={personDesignation}
                            onChange={(e) => setPersonDesignation(e.target.value)}
                            placeholder="Enter Sub-head ..."
                          />
                        </div>

                        {/* Biography */}
                        <div className="ss-modal-form-group">
                          <label className="ss-modal-label">Description <span style={{ color: 'var(--c-danger)' }}>*</span></label>
                          <textarea
                            rows={4}
                            className="ss-input"
                            style={{ height: 'auto', padding: '10px 12px', fontSize: '13px', resize: 'vertical' }}
                            value={personBio}
                            onChange={(e) => setPersonBio(e.target.value)}
                            placeholder="Enter Description..."
                          />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Card Display Width */}
                        {renderWidthSelector(contentWidth, setContentWidth)}

                        {/* Upload Banner/Image */}
                        {renderUploadZone(
                          contentFileInputRef,
                          contentFile,
                          contentPreviewUrl,
                          processContentFile,
                          "Upload Banner/Image",
                          "Supports PNG, JPG, JPEG, WEBP"
                        )}

                        {/* Text Content */}
                        <div className="ss-modal-form-group">
                          <label className="ss-modal-label">Text Content <span style={{ color: 'var(--c-danger)' }}>*</span></label>
                          <textarea
                            rows={6}
                            className="ss-input"
                            style={{ height: 'auto', padding: '10px 12px', fontSize: '13px', resize: 'vertical' }}
                            value={contentText}
                            onChange={(e) => setContentText(e.target.value)}
                            placeholder="Enter content description text..."
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {/* Card Display Width */}
                    {renderWidthSelector(htmlWidth, setHtmlWidth)}

                    {/* Upload Image */}
                    {renderUploadZone(
                      htmlFileInputRef,
                      htmlFile,
                      htmlPreviewUrl,
                      processHtmlFile,
                      "Upload Image (Optional Banner)",
                      "Supports PNG, JPG, JPEG, WEBP"
                    )}

                    {/* HTML Content */}
                    <div className="ss-modal-form-group">
                      <label className="ss-modal-label">HTML Code <span style={{ color: 'var(--c-danger)' }}>*</span></label>
                      <textarea
                        rows={10}
                        className="ss-input"
                        style={{
                          fontFamily: 'monospace, "Courier New", Courier',
                          fontSize: '12px',
                          lineHeight: '1.5',
                          padding: '12px',
                          height: '220px',
                          resize: 'vertical',
                          whiteSpace: 'pre',
                          overflow: 'auto',
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: '6px',
                          color: 'var(--text-primary)',
                        }}
                        value={htmlContent}
                        onChange={(e) => setHtmlContent(e.target.value)}
                        placeholder="<!-- Enter custom HTML elements directly -->&#10;<div style='padding: 10px;'>...</div>"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Live Card Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                  LIVE CARD PREVIEW
                </h4>

                {/* Preview Wrapper showing layout width */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  background: 'var(--bg-secondary)',
                  border: '1px dashed var(--border-primary)',
                  borderRadius: '12px',
                  padding: '24px',
                  minHeight: '340px',
                }}>
                  <div
                    style={{
                      background: 'var(--surface-primary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '12px',
                      overflow: 'hidden',
                      boxShadow: 'var(--shadow-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      width: (activeTab === 'text' ? (activeSubtab === 'article' ? personWidth : contentWidth) : htmlWidth) === '50%' ? '50%' : '100%',
                      minWidth: '240px',
                      transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      alignSelf: 'start',
                    }}
                  >
                    {activeTab === 'text' ? (
                      activeSubtab === 'article' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', textAlign: 'center' }}>
                          {/* Person Image */}
                          {personPreviewUrl ? (
                            <img
                              src={personPreviewUrl}
                              alt={personName || "Article image"}
                              style={{
                                width: '90px',
                                height: '90px',
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: '3px solid var(--surface-primary)',
                                boxShadow: 'var(--shadow-md)',
                                marginBottom: '16px',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '90px',
                                height: '90px',
                                borderRadius: '50%',
                                background: 'var(--bg-secondary)',
                                border: '2px dashed var(--border-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-tertiary)',
                                marginBottom: '16px',
                              }}
                            >
                              <User size={36} />
                            </div>
                          )}

                          {/* Person Name */}
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {personName || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Title</span>}
                          </h4>

                          {/* Designation */}
                          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--c-primary)', marginBottom: '16px' }}>
                            {personDesignation || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Sub Head</span>}
                          </div>

                          {/* Separator */}
                          <div style={{ width: '40px', height: '2px', background: 'var(--border-primary)', marginBottom: '16px' }} />

                          {/* Details */}
                          <p style={{
                            margin: 0,
                            fontSize: '13px',
                            lineHeight: 1.5,
                            color: 'var(--text-secondary)',
                            wordBreak: 'break-word',
                            whiteSpace: 'pre-wrap',
                          }}>
                            {personBio || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Description details will appear here...</span>}
                          </p>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {/* Banner Image */}
                          <div style={{ height: '140px', width: '100%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {contentPreviewUrl ? (
                              <img src={contentPreviewUrl} alt="Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--text-tertiary)' }}>
                                <ImageIcon size={32} />
                                <span style={{ fontSize: '11px', fontWeight: 500 }}>No banner uploaded</span>
                              </div>
                            )}
                          </div>

                          {/* Content Details */}
                          <div style={{ padding: '16px 20px' }}>
                            <p style={{
                              margin: 0,
                              fontSize: '13px',
                              lineHeight: 1.6,
                              color: 'var(--text-primary)',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}>
                              {contentText ? contentText : (
                                <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                                  Content text will preview here instantly as you type...
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Footer Placeholder */}
                          <div style={{
                            padding: '10px 16px',
                            borderTop: '1px solid var(--border-primary)',
                            background: 'var(--bg-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Card Footer Preview</span>
                            <div style={{ display: 'flex', gap: '8px', opacity: 0.3 }}>
                              <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'var(--text-tertiary)' }} />
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {/* Optional Banner Image */}
                        {htmlPreviewUrl && (
                          <div style={{ height: '140px', width: '100%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            <img src={htmlPreviewUrl} alt="HTML Banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                        )}

                        {/* HTML Container */}
                        <div style={{ padding: '16px 20px', minHeight: '120px' }}>
                          {htmlContent.trim() ? (
                            <div
                              className="home-card-html-content"
                              dangerouslySetInnerHTML={{ __html: htmlContent }}
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100px', color: 'var(--text-tertiary)', fontStyle: 'italic', fontSize: '13px' }}>
                              HTML Preview will appear here...
                            </div>
                          )}
                        </div>

                        {/* Footer Placeholder */}
                        <div style={{
                          padding: '10px 16px',
                          borderTop: '1px solid var(--border-primary)',
                          background: 'var(--bg-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Card Footer Preview</span>
                          <div style={{ display: 'flex', gap: '8px', opacity: 0.3 }}>
                            <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'var(--text-tertiary)' }} />
                          </div>
                        </div>
                      </div>
                    )}
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
                  color: 'var(--surface-primary)',
                  background: isSaveDisabled ? 'var(--border-primary)' : 'var(--c-primary)',
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

      {/* Delete Confirmation Modal */}
      <AdminModal
        isOpen={!!cardToDelete}
        onClose={() => setCardToDelete(null)}
        title="Delete Home Card"
        size="sm"
        footer={
          <div className="hm-confirm-buttons">
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
              onClick={() => setCardToDelete(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              style={{
                height: '36px',
                padding: '0 20px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--surface-primary)',
                background: 'var(--c-danger)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={confirmDeleteCard}
            >
              Delete
            </button>
          </div>
        }
      >
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <div style={{ width: '50px', height: '50px', borderRadius: '50%', border: '2px solid var(--c-warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: 'var(--c-warning)' }}>
            <AlertTriangle size={24} />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Confirm Deletion</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 4px 0' }}>
            Are you sure you want to delete this card?
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', margin: 0 }}>
            This action cannot be undone.
          </p>
        </div>
      </AdminModal>
    </div>
  );
}

export const HomeManagementPanel = memo(HomeManagementPanelComponent);
export default HomeManagementPanel;
