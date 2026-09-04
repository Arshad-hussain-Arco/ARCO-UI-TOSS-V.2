import { memo, useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../SystemSettings/SystemSettingsPage.css';
import { Edit, LayoutGrid, Loader2, Plus, Trash, Upload, User, X, Code, FileText, Image as ImageIcon, AlertTriangle, Video, RefreshCw, Trash2, Film, ArrowUp, ArrowDown, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { ROUTES } from '@constants/routes';
import { useToast } from '@hooks/useToast';
import { settingsService } from '@services/settingsService';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { HomeCard } from '@components/home/HomeCard';
import { HomeCardLayoutSelector } from '@components/home/HomeCardLayoutSelector';
import { RichEditor } from '@components/home/RichEditor/RichEditor';
import { uploadMediaFile, toAbsoluteMediaUrl, attachHomeMediaToken, useHomeMediaToken, withFreshMediaToken } from '@components/home/RichEditor/mediaUtils';
import DOMPurify from 'dompurify';

// Content tab only accepts images ΓÇö video attaches through the Rich Text
// Editor tab instead (its own HomeMedia/SFTP upload pipeline).
const MAX_ARTICLE_IMAGE_SIZE_BYTES = 40 * 1024 * 1024; // 40 MB
const MAX_ARTICLE_VIDEO_SIZE_BYTES = 19 * 1024 * 1024; // 19 MB, matches VideoHandler's MAX_VIDEO_MB ΓÇö same upload endpoint enforces this server-side
const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];
// const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp'];

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Detects when editor-exported HTML contains HTML source code stored as text
 * (i.e. the user pasted raw HTML into the WYSIWYG editor, which escapes the tags
 * as &lt;table&gt; etc.). If found, decode the entities and sanitize so the
 * Live Preview can render actual HTML elements instead of showing raw source.
 * Falls back to the original HTML for normal rich-text content.
 */
function resolveHtmlForPreview(html) {
  if (!html) return html;
  // Quick check: does the content contain HTML-escaped angle brackets?
  if (!/&lt;\s*\/?(?:table|thead|tbody|tfoot|tr|td|th|div|p|h[1-6]|ul|ol|li|dl|dt|dd|span|a|img|section|article|header|footer|nav|main|aside|strong|em|b|i|u|br|hr|blockquote|pre|code|figure|figcaption|details|summary|caption|colgroup|col)\b/i.test(html)) {
    return html; // No escaped HTML tags found — return original content
  }
  // Decode: parse as HTML, extract the text content (which is the raw HTML source)
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const decoded = doc.body.textContent || '';
    // Verify the decoded text actually contains real HTML tags
    if (/<\s*(?:table|div|p|h[1-6]|ul|ol|li|section|article|header|footer|nav|main|blockquote|pre|figure|details|dl)\b[^>]*>/i.test(decoded)) {
      // Sanitize for safety (strips <script>, onclick, javascript: etc.)
      return DOMPurify.sanitize(decoded, {
        ADD_TAGS: ['style', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
          'colgroup', 'col', 'caption', 'figure', 'figcaption', 'details', 'summary'],
        ADD_ATTR: ['style', 'class', 'colspan', 'rowspan', 'border', 'cellpadding',
          'cellspacing', 'width', 'height', 'align', 'valign', 'scope', 'headers',
          'target', 'rel', 'href', 'src', 'alt', 'title'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur',
          'onsubmit', 'onchange', 'onkeydown', 'onkeyup', 'onkeypress'],
      });
    }
  } catch { /* parsing failed — fall through to original */ }
  return html;
}

/**
 * Home Management Panel - Split-Screen Preview Modal & Stable Event Handling
 */
function HomeManagementPanelComponent() {
  const toast = useToast();
  const mediaToken = useHomeMediaToken();
  const [cards, setCards] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Tab State ΓÇö 'text' tab now holds only the Article form (the separate
  // Content sub-tab was removed: one form is enough, and having a visible
  // sub-tab selector for it was just an extra click for no real choice).
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'html'

  // Article State ΓÇö every field here is optional. A card can be
  // text-only, media-only, or both; nothing is required to save.
  const [personName, setPersonName] = useState('');
  const [personDesignation, setPersonDesignation] = useState('');
  const [personBio, setPersonBio] = useState('');
  const [personFile, setPersonFile] = useState(null);
  const [personPreviewUrl, setPersonPreviewUrl] = useState(null);
  // Bare (untokenized) URL for an EXISTING server-side video when editing a
  // card ΓÇö kept separate from personPreviewUrl so the token can be attached
  // reactively at render time via `effectivePreviewUrl` below, rather than
  // baked in once at the moment the edit modal opens. mediaToken loads
  // async; baking it in early would permanently freeze a stale/missing
  // token into state if the fetch hadn't resolved yet by that point.
  const [personExistingVideoUrl, setPersonExistingVideoUrl] = useState(null);
  // True once the user explicitly removes a card's existing video via the
  // Remove button, with no new file chosen to replace it ΓÇö handleSaveCard
  // needs this to know to send video_media_id: '' (clear), since "no file
  // picked" is otherwise indistinguishable from "leave the video alone".
  const [personVideoRemoved, setPersonVideoRemoved] = useState(false);
  // Click-to-play gate for the video PREVIEW itself ΓÇö opening the edit
  // modal (or picking a video) must not fire a network request on its own;
  // this flag/URL defer that until the admin actually presses Play, same as
  // the published Homepage's card. Split in two: a local blob preview
  // (personFile set) needs no token and can play as soon as
  // personVideoPreviewPlaying flips true; an EXISTING server video needs a
  // confirmed (awaited, not just whatever's in state) token first ΓÇö see
  // handlePreviewPlayClick ΓÇö so personVideoConfirmedSrc holds that result.
  const [personVideoPreviewPlaying, setPersonVideoPreviewPlaying] = useState(false);
  const [personVideoConfirmedSrc, setPersonVideoConfirmedSrc] = useState(null);
  const [personMediaType, setPersonMediaType] = useState(null); // 'image' | 'video' | null
  const [personWidth, setPersonWidth] = useState('100%'); // '50%' | '100%'

  // Rich Text Tab State ΓÇö images/video/etc. are inserted from within the
  // editor itself, so there is no separate banner file/preview state here.
  const [htmlContent, setHtmlContent] = useState('');
  const [htmlWidth, setHtmlWidth] = useState('100%'); // '50%' | '100%'

  const [isUploading, setIsUploading] = useState(false);
  const [cardToDelete, setCardToDelete] = useState(null);

  // File input refs
  const personFileInputRef = useRef(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await settingsService.getHomeData(true); // admin screen also sees inactive cards
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

    setPersonName('');
    setPersonDesignation('');
    setPersonBio('');
    setPersonFile(null);
    if (personPreviewUrl && personPreviewUrl.startsWith('blob:')) {
      try { URL.revokeObjectURL(personPreviewUrl); } catch { }
    }
    setPersonPreviewUrl(null);
    setPersonExistingVideoUrl(null);
    setPersonVideoRemoved(false);
    setPersonVideoPreviewPlaying(false);
    setPersonVideoConfirmedSrc(null);
    setPersonMediaType(null);
    setPersonWidth('50%');

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
      try { URL.revokeObjectURL(personPreviewUrl); } catch { }
    }
    setPersonPreviewUrl(null);
    setPersonExistingVideoUrl(null);
    setPersonVideoRemoved(false);
    setPersonVideoPreviewPlaying(false);
    setPersonVideoConfirmedSrc(null);
    setPersonMediaType(null);
    setPersonWidth('50%');

    setHtmlContent('');
    setHtmlWidth('100%');

    // Content-tab video is a HomeMedia/SFTP reference (card.video_url), not
    // the base64 `photo` BLOB ΓÇö takes priority when present, same rule
    // HomeCard.jsx's render uses. Stored bare (untokenized) here ΓÇö
    // `effectivePreviewUrl` attaches the current mediaToken reactively at
    // render time instead of baking in a possibly-not-yet-loaded token now.
    const photoUrl = card.photo ? (card.photo.startsWith('data:') || card.photo.startsWith('http:') ? card.photo : `data:image/jpeg;base64,${card.photo}`) : null;
    const bareVideoUrl = card.video_url ? toAbsoluteMediaUrl(card.video_url) : null;
    const widthVal = card.display_width || '100%';

    if (card.card_type === 'html_code' || card.card_type === 'content_card') {
      setActiveTab('html');
      setHtmlContent(card.html_content || card.text_content || '');
      setHtmlWidth(widthVal);
    } else {
      // person_card maps directly.
      setActiveTab('text');
      setPersonName(card.person_name || '');
      setPersonDesignation(card.designation || '');
      setPersonBio(card.bio || card.text_content || '');
      setPersonWidth(widthVal);
      if (bareVideoUrl) {
        setPersonExistingVideoUrl(bareVideoUrl);
        setPersonMediaType('video');
      } else {
        setPersonPreviewUrl(photoUrl);
        setPersonMediaType(photoUrl ? 'image' : null);
      }
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

  const handleToggleActive = async (card) => {
    const nextActive = !(card.is_active !== false); // treat missing/undefined as active
    // Optimistic update so the toggle feels instant; reverted on failure.
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, is_active: nextActive } : c)));
    try {
      const payload = new FormData();
      payload.append('is_active', String(nextActive));
      await settingsService.updateHomeData(card.id, payload);
      toast.success(nextActive ? 'Card activated' : 'Card deactivated');
    } catch (error) {
      console.error('Failed to toggle card status:', error);
      toast.error('Failed to update card status');
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, is_active: card.is_active } : c)));
    }
  };

  const handleMoveCard = async (card, direction) => {
    const index = cards.findIndex((c) => c.id === card.id);
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= cards.length) return;

    const reordered = [...cards];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];
    setCards(reordered); // optimistic reorder

    // Legacy rows can share sort_order 0, so a plain value-swap between the
    // two moved cards wouldn't be enough to fix their relative order —
    // renumber every card to its new position instead.
    try {
      await Promise.all(
        reordered.map((c, i) => {
          const payload = new FormData();
          payload.append('sort_order', String(i));
          return settingsService.updateHomeData(c.id, payload);
        })
      );
      await fetchData();
    } catch (error) {
      console.error('Failed to reorder home cards:', error);
      toast.error('Failed to reorder cards');
      await fetchData();
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
    const isValidExt = ALLOWED_EXTENSIONS.includes(ext);

    const isImage = isImageMime || ['png', 'jpg', 'jpeg', 'webp'].includes(ext);

    // 1. Validate file format
    if (!isValidExt || !isImage) {
      toast.error('Unsupported file format ΓÇö Please upload PNG, JPG, JPEG, or WEBP.');
      // Do NOT clear existing valid media
      return;
    }

    // 2. Validate file size
    const maxBytes = MAX_ARTICLE_IMAGE_SIZE_BYTES;
    if (file.size > maxBytes) {
      const sizeMb = formatFileSize(file.size);
      toast.error(`Image too large ΓÇö ${sizeMb} selected. Maximum allowed size is ${maxBytes / (1024 * 1024)} MB.`);
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
    setPersonExistingVideoUrl(null); // a freshly picked local file supersedes any existing server video
    setPersonVideoRemoved(false);
    setPersonVideoPreviewPlaying(false);
    setPersonVideoConfirmedSrc(null);
    setPersonMediaType('image');
    setIsUploading(false);
    toast.success(`Image selected: ${file.name}`);
  };

  const handleSaveCard = async () => {
    // Validation ΓÇö Article fields are all optional (title/sub-head/
    // description/media can be any combination, including none at all
    // except needing *something* to actually show on the card). Rich Text
    // still requires actual content since an empty editor renders nothing.
    if (activeTab === 'text') {
      if (!(personName || '').trim() && !(personDesignation || '').trim() && !(personBio || '').trim() && !personFile && !personExistingVideoUrl) {
        toast.error('Add at least a title, description, or media to save this card.');
        return;
      }
    } else {
      if (!(htmlContent || '').trim()) {
        toast.error('HTML Code is required.');
        return;
      }
    }

    try {
      setIsUploading(true);
      const payload = new FormData();

      if (activeTab === 'text') {
        payload.append('card_type', 'person_card');
        payload.append('person_name', (personName || '').trim());
        payload.append('designation', (personDesignation || '').trim());
        payload.append('bio', (personBio || '').trim());
        payload.append('display_width', personWidth);
        if (personFile && personMediaType === 'video') {
          // Video bytes never touch the `photo` BLOB column ΓÇö upload to the
          // same HomeMedia/SFTP pipeline the Rich Text Editor uses, then
          // attach by reference. Clear any previous video/photo the other
          // media type may have left behind so display priority stays
          // unambiguous (HomeCard.jsx renders video over photo).
          const uploaded = await uploadMediaFile(personFile);
          payload.append('video_media_id', String(uploaded.id));
        } else if (personFile) {
          payload.append('photo', personFile);
          payload.append('video_media_id', '');
        } else if (personVideoRemoved) {
          // User pressed Remove on an existing video and picked no
          // replacement ΓÇö otherwise "no file sent" is indistinguishable
          // from "leave the video alone" (see HomeConfigUpdateView).
          payload.append('video_media_id', '');
        }
      } else {
        payload.append('card_type', 'html_code');
        payload.append('html_content', resolveHtmlForPreview((htmlContent || '').trim()));
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
      ? (!(personName || '').trim() && !(personDesignation || '').trim() && !(personBio || '').trim() && !personFile && !personExistingVideoUrl)
      : !(htmlContent || '').trim()
  );

  // Bare `personExistingVideoUrl` gets the current mediaToken attached here
  // (reactively, every render) rather than once when the edit modal opened
  // ΓÇö mediaToken loads async and may not have been ready yet at that point.
  const effectivePreviewUrl = personPreviewUrl || (
    personExistingVideoUrl ? attachHomeMediaToken(personExistingVideoUrl, mediaToken) : null
  );

  const renderArticleMediaZone = () => {
    return (
      <div className="ss-modal-form-group">
        <label className="ss-modal-label" style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Article Media</span>
          <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-tertiary)' }}>
            Upload an image to display with this article.
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
            border: effectivePreviewUrl ? '1px solid var(--border-primary)' : '2px dashed var(--border-primary)',
            borderRadius: '8px',
            padding: effectivePreviewUrl ? '0' : '24px 16px',
            textAlign: 'center',
            background: 'var(--bg-secondary)',
            cursor: isUploading ? 'wait' : (effectivePreviewUrl ? 'default' : 'pointer'),
            transition: 'all 0.15s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
          onClick={(e) => {
            if (!effectivePreviewUrl && !isUploading) {
              e.stopPropagation();
              personFileInputRef.current?.click();
            }
          }}
          onKeyDown={(e) => {
            if (!effectivePreviewUrl && (e.key === 'Enter' || e.key === ' ') && !isUploading) {
              e.preventDefault();
              e.stopPropagation();
              personFileInputRef.current?.click();
            }
          }}
        >
          <input
            type="file"
            ref={personFileInputRef}
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
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
          ) : effectivePreviewUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              {/* Media Preview Box */}
              <div style={{ background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '240px', overflow: 'hidden' }}>
                {personMediaType === 'video' || (effectivePreviewUrl && effectivePreviewUrl.startsWith('data:video/')) ? (
                  (personFile && personVideoPreviewPlaying) || personVideoConfirmedSrc ? (
                    <video
                      controls
                      autoPlay
                      preload="auto"
                      playsInline
                      src={personFile ? effectivePreviewUrl : personVideoConfirmedSrc}
                      style={{ width: '100%', maxHeight: '240px', objectFit: 'contain', display: 'block' }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (personFile) {
                          // Local blob preview ΓÇö no network request, no token needed.
                          setPersonVideoPreviewPlaying(true);
                        } else if (personExistingVideoUrl) {
                          // Await a CONFIRMED token before ever mounting the
                          // <video> element, rather than trusting whatever
                          // mediaToken happens to be at render time.
                          setPersonVideoConfirmedSrc(await withFreshMediaToken(personExistingVideoUrl));
                        }
                      }}
                      style={{
                        width: '100%', height: '180px', display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: '8px',
                        background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff',
                      }}
                      aria-label="Play video preview"
                    >
                      <span style={{
                        width: '48px', height: '48px', borderRadius: '50%',
                        background: 'rgba(255,255,255,0.16)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Film size={20} />
                      </span>
                      <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)' }}>Click to preview</span>
                    </button>
                  )
                ) : (
                  <img
                    src={effectivePreviewUrl}
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
                      {personMediaType === 'video' ? 'Video' : 'Image'} {personFile ? `ΓÇó ${formatFileSize(personFile.size)}` : ''}
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
                        try { URL.revokeObjectURL(personPreviewUrl); } catch { }
                      }
                      setPersonFile(null);
                      setPersonPreviewUrl(null);
                      if (personExistingVideoUrl) setPersonVideoRemoved(true);
                      setPersonExistingVideoUrl(null);
                      setPersonVideoPreviewPlaying(false);
                      setPersonVideoConfirmedSrc(null);
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
                Supports PNG, JPG, JPEG, WEBP
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
    <div className="ss-container">
      <div className="ss-main-content">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* 3. Top Header Bar & Action Alignment */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginBottom: '8px' }}>

            <Link
              to={ROUTES.ADMIN_HOME_MANAGEMENT_USER_GUIDE}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                height: '38px',
                padding: '0 16px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                background: 'var(--surface-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '6px',
                cursor: 'pointer',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <FileText size={14} />
              <span>User Guide</span>
              <ExternalLink size={14} />
            </Link>

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
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>No home cards found</h3>
              <p style={{ fontSize: '13px', margin: 0 }}>Click "Add Home Card" to create content widgets for the landing dashboard.</p>
            </div>
          ) : (
            <div className="hm-cards-grid">
              {cards.map((card, cardIndex) => {
                const width = card.display_width || '100%';
                const isFullWidth = width === '100%';
                const isActive = card.is_active !== false;

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
                      minHeight: '210px',
                      position: 'relative',
                      opacity: isActive ? 1 : 0.55,
                    }}
                  >
                    {isActive ? null : (
                      <span style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--c-danger, #dc2626)', color: '#fff', zIndex: 10 }}>
                        INACTIVE
                      </span>
                    )}

                    {/* Actions in top right ΓÇö grouped into a single pill so five
                    icons read as one toolbar instead of five loose circles. */}
                    <div
                      className="hm-card-actions"
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        padding: '4px',
                        borderRadius: '20px',
                        background: 'var(--surface-primary)',
                        border: '1px solid var(--border-primary)',
                        boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)',
                        zIndex: 10,
                      }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveCard(card, 'up');
                        }}
                        disabled={cardIndex === 0}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: 'none',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: cardIndex === 0 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                          cursor: cardIndex === 0 ? 'not-allowed' : 'pointer',
                          opacity: cardIndex === 0 ? 0.5 : 1,
                        }}
                        title="Move Up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveCard(card, 'down');
                        }}
                        disabled={cardIndex === cards.length - 1}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: 'none',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: cardIndex === cards.length - 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                          cursor: cardIndex === cards.length - 1 ? 'not-allowed' : 'pointer',
                          opacity: cardIndex === cards.length - 1 ? 0.5 : 1,
                        }}
                        title="Move Down"
                      >
                        <ArrowDown size={13} />
                      </button>

                      <span style={{ width: '1px', height: '16px', background: 'var(--border-primary)', margin: '0 2px' }} />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleActive(card);
                        }}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: 'none',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isActive ? 'var(--text-secondary)' : 'var(--c-warning, #d97706)',
                          cursor: 'pointer',
                        }}
                        title={isActive ? 'Deactivate Card' : 'Activate Card'}
                      >
                        {isActive ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      <button
                        type="button"
                        className="action-icon-btn edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditModal(card);
                        }}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: 'none',
                          background: 'transparent',
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
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          border: 'none',
                          background: 'transparent',
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

                    {/* Card Body — renders the SAME HomeCard component the
                    published Homepage uses, so the admin list is a true
                    thumbnail of what employees will actually see, not a
                    separately-maintained text summary. Clipped to a fixed
                    height (cards can be much taller than this tile) and
                    non-interactive (no video/PDF triggers inside a listing
                    tile — Edit opens the real editor for that). */}
                    <div
                      className="hm-card-body"
                      style={{
                        marginTop: '32px',
                        width: '100%',
                        // `.hm-card-body` (SystemSettingsPage.css) sets
                        // `flex: 1`, i.e. flex-basis: 0 — on the column-flex
                        // parent that makes the browser size this element by
                        // flex-grow, not by its `height`, so `flex` has to be
                        // overridden here too or the 220px clip is ignored.
                        flex: '0 0 220px',
                        height: '220px',
                        overflow: 'hidden',
                        borderRadius: '6px',
                        border: '1px solid var(--border-primary)',
                        background: 'var(--bg-secondary)',
                        pointerEvents: 'none',
                        position: 'relative',
                      }}
                    >
                      <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '117.6%' }}>
                        <HomeCard card={card} />
                      </div>
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '32px', background: 'linear-gradient(to bottom, transparent, var(--bg-secondary))' }} />
                    </div>

                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', alignSelf: 'flex-start', marginTop: '8px' }}>
                      {width} Width
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* ≡ƒû╝∩╕Å MODAL: Add / Edit Home Card (Split-Screen Preview) */}
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
                  background: 'var(--bg-overlay)',
                  backdropFilter: 'blur(4px)',
                  WebkitBackdropFilter: 'blur(4px)',
                  zIndex: 1000,
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
                    Content
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
                    padding: '16px 24px',
                    overflowY: 'auto',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '20px',
                    alignItems: 'start',
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  {/* Left Column: Form Inputs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
                    {activeTab === 'text' ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Card Display Width */}
                        {renderWidthSelector(personWidth, setPersonWidth)}

                        {/* Article Media Upload */}
                        {renderArticleMediaZone()}

                        <div className="ss-grid-2col" style={{ gap: '12px' }}>
                          {/* Title */}
                          <div className="ss-modal-form-group">
                          <label className="ss-modal-label">Title</label>
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
                          <label className="ss-modal-label">Sub Head</label>
                          <input
                            type="text"
                            className="ss-input"
                            value={personDesignation}
                            onChange={(e) => setPersonDesignation(e.target.value)}
                            placeholder="Enter Sub-head ..."
                          />
                          </div>
                        </div>

                        {/* Biography */}
                        <div className="ss-modal-form-group">
                          <label className="ss-modal-label">Description</label>
                          <textarea
                            rows={2}
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
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'sticky', top: 0, minWidth: 0 }}>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>
                      LIVE CARD PREVIEW
                    </h4>

                    {/* Rendered HTML Preview (always visible) */}
                    <div style={{
                      border: '1px dashed var(--border-primary)',
                      borderRadius: '10px',
                      padding: '16px',
                      background: 'var(--bg-secondary)',
                      minHeight: '280px',
                      overflowY: 'auto',
                      overflowX: 'auto',
                    }}>
                      {activeTab === 'html' && !(!htmlContent || (htmlContent || '').trim() === '' || (htmlContent || '').trim() === '<div><br></div>' || (htmlContent || '').trim() === '<br>' || (htmlContent || '').trim() === '<p><br></p>') ? (
                        <HomeCard
                          card={{
                            card_type: 'html_code',
                            display_width: htmlWidth,
                            html_content: resolveHtmlForPreview(htmlContent),
                          }}
                        />
                      ) : activeTab === 'text' && (personName || personBio || personPreviewUrl) ? (
                        <HomeCard
                          card={{
                            card_type: 'person_card',
                            display_width: personWidth,
                            photo: personMediaType !== 'video' ? personPreviewUrl : null,
                            video_url: personMediaType === 'video'
                              ? (personFile ? personPreviewUrl : personExistingVideoUrl)
                              : null,
                            person_name: personName,
                            designation: personDesignation,
                            bio: personBio,
                          }}
                        />
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', gap: '8px', color: 'var(--text-tertiary)' }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>
                          <span style={{ fontSize: '12px', fontWeight: 500 }}>Preview will appear here as you add content</span>
                        </div>
                      )}
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
                    color: '#ffffff',
                    background: 'var(--c-danger)',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onClick={confirmDeleteCard}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash size={14} style={{ marginRight: '6px' }} />
                    Delete
                  </div>
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
      </div>
    </div>
  );
}

export const HomeManagementPage = memo(HomeManagementPanelComponent);
export default HomeManagementPage;
