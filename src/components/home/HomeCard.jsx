import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Image as ImageIcon, Play } from 'lucide-react';
import { MediaViewerModal } from '@components/media/MediaViewerModal';
import { stripEditorControls, rebuildPublicMediaActions, deferPublicVideoLoad, attachHomeMediaToken, useHomeMediaToken, getHomeMediaToken, withFreshMediaToken, toAbsoluteMediaUrl } from './RichEditor/mediaUtils';
import './HomeCard.css';

/**
 * DOMPurify configuration extending default allowlist for media cards.
 */
const HOME_CARD_SANITIZE_CONFIG = {
  // svg/path/rect/circle (fileTypeIcons.js's inline file-type icons) are
  // already in DOMPurify's default allowlist, but listed explicitly here
  // too so this stays correct if that default ever changes.
  ADD_TAGS: ['embed', 'video', 'source', 'button', 'svg', 'path', 'rect', 'circle'],
  ADD_ATTR: [
    'controls', 'type', 'preload', 'playsinline', 'poster', 'download',
    'data-media-type', 'data-src', 'data-filename', 'data-filesize',
    'data-mime', 'data-pdf-src', 'data-pdf-name',
    'data-office-src', 'data-office-name', 'data-video-src', 'aria-label',
    'viewBox', 'aria-hidden', 'focusable', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
  ],
  ADD_DATA_URI_TAGS: ['embed', 'a', 'video', 'source'],
};

/**
 * Enterprise Home Card Renderer
 * Strictly honors 50% Width (Vertical) vs 100% Width (Horizontal) layouts.
 */
export function HomeCard({ card, className = '', style = {} }) {
  const [imageError, setImageError] = useState(false);
  // Set only once the media token is CONFIRMED (awaited, not just read from
  // the mediaToken state below) — mounting <video src> speculatively while
  // the token fetch is still in flight caused a real race: the element
  // would fire its first probe request(s) with no token (401) before a
  // later re-render fixed the src, instead of never requesting until ready.
  const [confirmedVideoSrc, setConfirmedVideoSrc] = useState(null);
  const [activeMediaModal, setActiveMediaModal] = useState({ isOpen: false, src: '', fileName: '', mediaType: 'pdf' });
  const mediaToken = useHomeMediaToken();

  if (!card) return null;

  const handlePlayVideo = async () => {
    const token = await getHomeMediaToken();
    setConfirmedVideoSrc(attachHomeMediaToken(toAbsoluteMediaUrl(card.video_url), token));
  };

  const isHalfWidth = card.display_width === '50%';
  const widthClass = isHalfWidth ? 'home-card-50' : 'home-card-100';

  // Rich Text (html_code) cards have no separate banner-photo upload —
  // every image/video lives inline inside html_content, composed directly
  // in the editor. Showing an empty photo-placeholder box next to that
  // content would misrepresent the editor's own layout, so this card type
  // always renders full-width, text/media-wrapper-column-free.
  const isHtmlCard = card.card_type === 'html_code';

  // Content-tab video (uploaded to SFTP via HomeMedia, referenced by id —
  // never stored as DB bytes). Takes priority over `photo`: a card can't be
  // both a photo and a video, and `photo` here is a legacy/base64 BLOB path
  // that only ever made sense for images. Whether a video EXISTS doesn't
  // depend on the token (isVideo just gates showing the click-to-play
  // placeholder) — only the actual <video src> waits on a confirmed token.
  const hasVideo = Boolean(card.video_url);

  // Format photo URL safely
  let photoUrl = null;
  if (!hasVideo && card.photo) {
    if (
      card.photo.startsWith('data:') ||
      card.photo.startsWith('http:') ||
      card.photo.startsWith('https:') ||
      card.photo.startsWith('blob:')
    ) {
      photoUrl = card.photo;
    } else {
      photoUrl = `data:image/jpeg;base64,${card.photo}`;
    }
  }

  // Content extraction
  const heading = card.person_name || card.heading || card.title || null;
  const subheading = card.designation || card.subheading || card.subtitle || null;

  const rawHtml = card.html_content || null;
  const rawText = card.bio || card.text_content || null;

  const handleContentClick = (e) => {
    const playBtn = e.target.closest('.rte-video-play-trigger');
    if (playBtn) {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = playBtn.closest('.rte-video-lazy-wrap');
      const video = wrapper?.querySelector('video');
      if (video) {
        // Await a CONFIRMED token rather than trusting whatever this
        // element's data-video-src already carries — it was tokenized at
        // render time against whatever mediaToken happened to be then,
        // which can be stale or (on a fast click right after mount) still
        // completely missing.
        Promise.all(
          Array.from(video.querySelectorAll('source[data-video-src]')).map(async (source) => {
            source.src = await withFreshMediaToken(source.getAttribute('data-video-src'));
            source.removeAttribute('data-video-src');
          })
        ).then(async () => {
          const videoSrc = video.getAttribute('data-video-src');
          if (videoSrc) {
            video.src = await withFreshMediaToken(videoSrc);
            video.removeAttribute('data-video-src');
          }
          video.setAttribute('preload', 'auto');
          video.load();
          video.play().catch(() => {});
        });
      }
      playBtn.remove();
      wrapper?.classList.add('rte-video-playing');
      return;
    }

    const pdfBtn = e.target.closest('.rte-pdf-view-trigger, .media-pdf-view-btn');
    if (pdfBtn) {
      e.preventDefault();
      e.stopPropagation();
      const pdfSrc = pdfBtn.dataset.pdfSrc || pdfBtn.closest('.rte-media-card, .rte-pdf-card, .media-pdf-card, .rte-pdf-wrap')?.dataset.src;
      const pdfName = pdfBtn.dataset.pdfName || pdfBtn.closest('.rte-media-card, .rte-pdf-card, .media-pdf-card, .rte-pdf-wrap')?.dataset.filename || 'Document.pdf';
      if (pdfSrc) {
        setActiveMediaModal({ isOpen: true, src: pdfSrc, fileName: pdfName, mediaType: 'pdf' });
      }
      return;
    }

    const officeBtn = e.target.closest('.rte-office-view-trigger');
    if (officeBtn) {
      e.preventDefault();
      e.stopPropagation();
      const officeSrc = officeBtn.dataset.officeSrc || officeBtn.closest('.rte-media-card, .rte-attachment-card')?.dataset.src;
      const officeName = officeBtn.dataset.officeName || officeBtn.closest('.rte-media-card, .rte-attachment-card')?.dataset.filename || 'Document';
      if (officeSrc) {
        setActiveMediaModal({ isOpen: true, src: officeSrc, fileName: officeName, mediaType: 'office' });
      }
    }
  };

  const renderContent = () => {
    if (card.card_type === 'html_code' || rawHtml) {
      return (
        <div
          className="home-card-html-content"
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: attachHomeMediaToken(DOMPurify.sanitize(deferPublicVideoLoad(rebuildPublicMediaActions(stripEditorControls(rawHtml || ''))), HOME_CARD_SANITIZE_CONFIG), mediaToken) }}
        />
      );
    }

    if (rawText) {
      return <p className="home-card-text-content">{rawText}</p>;
    }

    return null;
  };

  const noMediaClass = (!hasVideo && !photoUrl) ? 'home-card-no-media' : '';

  return (
    <>
      <article className={`home-card ${widthClass} ${isHtmlCard ? 'home-card-html-only' : ''} ${noMediaClass} ${className}`} style={style}>
        {/* Media Section — omitted entirely for Rich Text cards, and for
            Article/Content cards that never had an image or video uploaded
            (a text-only card shouldn't show an empty placeholder box; the
            placeholder only makes sense as a broken-image fallback for a
            photoUrl that failed to load, not as "no media was provided"). */}
        {!isHtmlCard && (hasVideo || photoUrl) && (
          <div className="home-card-media-wrapper">
            {!imageError ? (
              hasVideo ? (
                confirmedVideoSrc ? (
                  <video
                    src={confirmedVideoSrc}
                    controls
                    autoPlay
                    preload="auto"
                    playsInline
                    className="home-card-video"
                    style={{ width: '100%', height: '100%', maxHeight: '450px', objectFit: 'contain', borderRadius: '6px' }}
                  />
                ) : (
                  <button
                    type="button"
                    className="home-card-video-placeholder"
                    onClick={handlePlayVideo}
                    aria-label="Play video"
                  >
                    <span className="home-card-video-play-icon">
                      <Play size={22} fill="currentColor" />
                    </span>
                    <span className="home-card-video-placeholder-label">Click to play</span>
                  </button>
                )
              ) : (
                <img
                  src={photoUrl}
                  alt={heading || 'Card image'}
                  className="home-card-image"
                  onError={() => setImageError(true)}
                />
              )
            ) : (
              <div className="home-card-placeholder">
                <ImageIcon size={36} className="placeholder-icon" />
              </div>
            )}
          </div>
        )}

        {/* Content Section */}
        <div className="home-card-content-wrapper">
          {heading && <h3 className="home-card-heading">{heading}</h3>}
          {subheading && <div className="home-card-subheading">{subheading}</div>}

          {(heading || subheading) && (rawHtml || rawText) && (
            <div className="home-card-divider" />
          )}

          <div className="home-card-body-text">{renderContent()}</div>
        </div>
      </article>

      <MediaViewerModal
        isOpen={activeMediaModal.isOpen}
        onClose={() => setActiveMediaModal((prev) => ({ ...prev, isOpen: false }))}
        src={activeMediaModal.src}
        fileName={activeMediaModal.fileName}
        mediaType={activeMediaModal.mediaType}
      />
    </>
  );
}

export default HomeCard;

