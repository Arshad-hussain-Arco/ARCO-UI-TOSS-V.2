import { memo, useRef, useState, useEffect } from 'react';
import { Edit, LayoutGrid, Loader2, Plus, Trash, Upload, User, X, Code, FileText, Image as ImageIcon, AlertTriangle, Video, RefreshCw, Trash2, Film } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { settingsService } from '@services/settingsService';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { HomeCard } from '@components/home/HomeCard';
import { HomeCardLayoutSelector } from '@components/home/HomeCardLayoutSelector';
import { RichEditor } from '@components/home/RichEditor/RichEditor';
import DOMPurify from 'dompurify';

const MAX_ARTICLE_MEDIA_SIZE_BYTES = 40 * 1024 * 1024; // 40 MB
const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const ALLOWED_VIDEO_MIME = ['video/mp4', 'video/webm'];
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'mp4', 'webm'];

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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
  const [personMediaType, setPersonMediaType] = useState(null); // 'image' | 'video' | null
  const [personWidth, setPersonWidth] = useState('100%'); // '50%' | '100%'

  // Content Subtab State
  const [contentFile, setContentFile] = useState(null);
  const [contentPreviewUrl, setContentPreviewUrl] = useState(null);
  const [contentText, setContentText] = useState('');
  const [contentWidth, setContentWidth] = useState('100%'); // '50%' | '100%'

  // Rich Text Tab State — images/video/etc. are inserted from within the
  // editor itself, so there is no separate banner file/preview state here.
  const [htmlContent, setHtmlContent] = useState('');
  const [htmlWidth, setHtmlWidth] = useState('100%'); // '50%' | '100%'

  const [isUploading, setIsUploading] = useState(false);
  const [cardToDelete, setCardToDelete] = useState(null);

  // File input refs
  const personFileInputRef = useRef(null);
  const contentFileInputRef = useRef(null);

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
    if (personPreviewUrl && personPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(personPreviewUrl); } catch {}
    }
    setPersonPreviewUrl(null);
    setPersonMediaType(null);
    setPersonWidth('50%'); // Default is 50% for Person Card

    setContentFile(null);
    setContentPreviewUrl(null);
    setContentText('');
    setContentWidth('100%'); // Default is 100% for Content Card

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
    if (personPreviewUrl && personPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(personPreviewUrl); } catch {}
    }
    setPersonPreviewUrl(null);
    setPersonMediaType(null);
    setPersonWidth('50%');

    setContentFile(null);
    setContentPreviewUrl(null);
    setContentText('');
    setContentWidth('100%');

    setHtmlContent('');
    setHtmlWidth('100%');

    const photoUrl = card.photo ? (card.photo.startsWith('data:') || card.photo.startsWith('http:') ? card.photo : `data:image/jpeg;base64,${card.photo}`) : null;
    const widthVal = card.display_width || '100%';

    if (card.card_type === 'person_card') {
      setActiveTab('text');
      setActiveSubtab('article');
      setPersonName(card.person_name || '');
      setPersonDesignation(card.designation || '');
      setPersonBio(card.bio || '');
      setPersonWidth(widthVal);
      setPersonPreviewUrl(photoUrl);
      const isVideo = card.media_type === 'video' || (photoUrl && photoUrl.startsWith('data:video/'));
      setPersonMediaType(isVideo ? 'video' : 'image');
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

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isImageMime = ALLOWED_IMAGE_MIME.includes(file.type);
    const isVideoMime = ALLOWED_VIDEO_MIME.includes(file.type);
    const isValidExt = ALLOWED_EXTENSIONS.includes(ext);

    const isVideo = isVideoMime || ext === 'mp4' || ext === 'webm';
    const isImage = isImageMime || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

    // 1. Validate file format
    if (!isValidExt || (!isImage && !isVideo)) {
      toast.error('Unsupported file format — Please upload PNG, JPG, JPEG, WEBP, MP4, or WEBM.');
      // Do NOT clear existing valid media
      return;
    }

    // 2. Validate file size (40 MB limit)
    if (file.size > MAX_ARTICLE_MEDIA_SIZE_BYTES) {
      const sizeMb = formatFileSize(file.size);
      const mediaLabel = isVideo ? 'Video' : 'Image';
      toast.error(`${mediaLabel} too large — ${sizeMb} selected. Maximum allowed size is 40 MB.`);
      // Do NOT clear existing valid media
      return;
    }

    // 3. Valid file: revoke previous object URL if any
    if (personPreviewUrl && personPreviewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(personPreviewUrl);
      } catch {
        /* ignore */
      }
    }

    setIsUploading(true);
    setPersonFile(file);
    const url = URL.createObjectURL(file);
    setPersonPreviewUrl(url);
    setPersonMediaType(isVideo ? 'video' : 'image');
    setIsUploading(false);
    toast.success(`${isVideo ? 'Video' : 'Image'} selected: ${file.name}`);
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
          if (personFile) {
            payload.append('photo', personFile);
            if (personMediaType) payload.append('media_type', personMediaType);
          }
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

  const renderArticleMediaZone = () => {
    return (
      <div className="ss-modal-form-group">
        <label className="ss-modal-label" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Article Media</span>
          <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-tertiary)' }}>
            Upload an image or video to display with this article.
          </span>
        </label>

        <div
          role="button"
          tabIndex={0}
          onDragOver={handleDragOver}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile) {
              processPersonFile(droppedFile);
            }
          }}
          style={{
            border: personPreviewUrl ? '1px solid var(--border-primary)' : '2px dashed var(--border-primary)',
            borderRadius: '8px',
            padding: personPreviewUrl ? '0' : '24px 16px',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            cursor: isUploading ? 'wait' : (personPreviewUrl ? 'default' : 'pointer'),
            transition: 'all 0.15s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
          onClick={(e) => {
            if (!personPreviewUrl && !isUploading) {
              e.stopPropagation();
              personFileInputRef.current?.click();
            }
          }}
          onKeyDown={(e) => {
            if (!personPreviewUrl && (e.key === 'Enter' || e.key === ' ') && !isUploading) {
              e.preventDefault();
              e.stopPropagation();
              personFileInputRef.current?.click();
            }
          }}
        >
          <input
            type="file"
            ref={personFileInputRef}
            accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,.png,.jpg,.jpeg,.webp,.mp4,.webm"
            style={{ display: 'none' }}
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) processPersonFile(selected);
              e.target.value = '';
            }}
          />

          {isUploading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '24px 0' }}>
              <Loader2 size={28} className="animate-spin" style={{ color: 'var(--c-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Processing media...
              </span>
            </div>
          ) : personPreviewUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              {/* Media Preview Box */}
              <div style={{ background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '240px', overflow: 'hidden' }}>
                {personMediaType === 'video' || (personPreviewUrl && personPreviewUrl.startsWith('data:video/')) ? (
                  <video
                    controls
                    preload="metadata"
                    playsInline
                    src={personPreviewUrl}
                    style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', display: 'block' }}
                  />
                ) : (
                  <img
                    src={personPreviewUrl}
                    alt="Article media preview"
                    style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', display: 'block' }}
                  />
                )}
              </div>

              {/* Metadata & Actions Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'var(--surface-primary)',
                borderTop: '1px solid var(--border-primary)',
                gap: '12px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                  {personMediaType === 'video' ? (
                    <Video size={16} style={{ color: 'var(--c-primary)', flexShrink: 0 }} />
                  ) : (
                    <ImageIcon size={16} style={{ color: 'var(--c-primary)', flexShrink: 0 }} />
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, textAlign: 'left' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {personFile ? personFile.name : 'Article Media'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      {personMediaType === 'video' ? 'Video' : 'Image'} {personFile ? `• ${formatFileSize(personFile.size)}` : ''}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      personFileInputRef.current?.click();
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Replace</span>
                  </button>

                  <button
                    type="button"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--c-danger, #dc2626)',
                      background: 'rgba(220, 38, 38, 0.08)',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (personPreviewUrl && personPreviewUrl.startsWith('blob:')) {
                        try { URL.revokeObjectURL(personPreviewUrl); } catch {}
                      }
                      setPersonFile(null);
                      setPersonPreviewUrl(null);
                      setPersonMediaType(null);
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <Upload size={28} style={{ color: 'var(--text-tertiary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Drag & drop media here, or <span style={{ color: 'var(--c-primary)' }}>browse</span>
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Supports PNG, JPG, JPEG, WEBP, MP4, WEBM
              </span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Maximum file size: 40 MB
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

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
      <HomeCardLayoutSelector
        value={currentWidth}
        onChange={setWidth}
      />
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
            color: '#ffffff',
            background: '#006633',
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
                    className="action-icon-btn edit"
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
                    <Edit size={13} />
                  </button>
                  <button
                    type="button"
                    className="action-icon-btn delete"
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
                    <Trash size={13} />
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
                Rich Text Editor
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

                        {/* Article Media Upload */}
                        {renderArticleMediaZone()}

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

                    {/* Rich Text Content — images/video/etc. are inserted
                        from within the editor itself; there is no separate
                        banner upload for this card type. */}
                    <div className="ss-modal-form-group">
                      <label className="ss-modal-label">Rich Text Editor <span style={{ color: 'var(--c-danger)' }}>*</span></label>
                      <RichEditor
                        key={editId ?? 'new'}
                        value={htmlContent}
                        onChange={setHtmlContent}
                        placeholder="Start writing your homepage card content..."
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
                  alignItems: 'start',
                  overflowX: 'auto',
                }}>
                  <div
                    style={{
                      width: (activeTab === 'text' ? (activeSubtab === 'article' ? personWidth : contentWidth) : htmlWidth) === '50%' ? '50%' : '100%',
                      minWidth: '280px',
                      transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <HomeCard
                      card={{
                        card_type: activeTab === 'text' ? (activeSubtab === 'article' ? 'person_card' : 'content_card') : 'html_code',
                        display_width: activeTab === 'text' ? (activeSubtab === 'article' ? personWidth : contentWidth) : htmlWidth,
                        photo: activeTab === 'text' ? (activeSubtab === 'article' ? personPreviewUrl : contentPreviewUrl) : null,
                        person_name: personName,
                        designation: personDesignation,
                        bio: personBio,
                        text_content: contentText,
                        html_content: htmlContent,
                      }}
                    />
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
                  color: ' #ffffff',
                  background: isSaveDisabled ? '#6db693ff' : '#006633',
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
