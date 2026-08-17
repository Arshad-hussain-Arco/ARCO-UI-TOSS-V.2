import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Image as ImageIcon } from 'lucide-react';
import { MediaViewerModal } from '@components/media/MediaViewerModal';
import './HomeCard.css';

/**
 * DOMPurify configuration extending default allowlist for media cards.
 */
const HOME_CARD_SANITIZE_CONFIG = {
  ADD_TAGS: ['embed', 'video', 'source', 'button'],
  ADD_ATTR: [
    'controls', 'type', 'preload', 'playsinline', 'poster', 'download',
    'data-media-type', 'data-src', 'data-filename', 'data-filesize',
    'data-mime', 'data-pdf-src', 'data-pdf-name',
  ],
  ADD_DATA_URI_TAGS: ['embed', 'a', 'video', 'source'],
};

/**
 * Enterprise Home Card Renderer
 * Strictly honors 50% Width (Vertical) vs 100% Width (Horizontal) layouts.
 */
export function HomeCard({ card, className = '', style = {} }) {
  const [imageError, setImageError] = useState(false);
  const [activeMediaModal, setActiveMediaModal] = useState({ isOpen: false, src: '', fileName: '', mediaType: 'pdf' });

  if (!card) return null;

  const isHalfWidth = card.display_width === '50%';
  const widthClass = isHalfWidth ? 'home-card-50' : 'home-card-100';

  // Rich Text (html_code) cards have no separate banner-photo upload —
  // every image/video lives inline inside html_content, composed directly
  // in the editor. Showing an empty photo-placeholder box next to that
  // content would misrepresent the editor's own layout, so this card type
  // always renders full-width, text/media-wrapper-column-free.
  const isHtmlCard = card.card_type === 'html_code';

  // Format photo URL safely
  let photoUrl = null;
  if (card.photo) {
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
    const pdfBtn = e.target.closest('.rte-pdf-view-trigger, .media-pdf-view-btn');
    if (pdfBtn) {
      e.preventDefault();
      e.stopPropagation();
      const pdfSrc = pdfBtn.dataset.pdfSrc || pdfBtn.closest('.rte-media-card, .rte-pdf-card, .media-pdf-card, .rte-pdf-wrap')?.dataset.src;
      const pdfName = pdfBtn.dataset.pdfName || pdfBtn.closest('.rte-media-card, .rte-pdf-card, .media-pdf-card, .rte-pdf-wrap')?.dataset.filename || 'Document.pdf';
      if (pdfSrc) {
        setActiveMediaModal({ isOpen: true, src: pdfSrc, fileName: pdfName, mediaType: 'pdf' });
      }
    }
  };

  const renderContent = () => {
    if (card.card_type === 'html_code' || rawHtml) {
      return (
        <div
          className="home-card-html-content"
          onClick={handleContentClick}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml || '', HOME_CARD_SANITIZE_CONFIG) }}
        />
      );
    }

    if (rawText) {
      return <p className="home-card-text-content">{rawText}</p>;
    }

    return null;
  };

  const isVideo = card.media_type === 'video' ||
    (photoUrl && (
      photoUrl.startsWith('data:video/') ||
      photoUrl.includes('.mp4') ||
      photoUrl.includes('.webm') ||
      (card.photo_type && card.photo_type.startsWith('video/'))
    ));

  return (
    <>
      <article className={`home-card ${widthClass} ${isHtmlCard ? 'home-card-html-only' : ''} ${className}`} style={style}>
        {/* Media Section — omitted entirely for Rich Text cards */}
        {!isHtmlCard && (
          <div className="home-card-media-wrapper">
            {photoUrl && !imageError ? (
              isVideo ? (
                <video
                  src={photoUrl}
                  controls
                  preload="metadata"
                  playsInline
                  className="home-card-video"
                  style={{ width: '100%', height: '100%', maxHeight: '450px', objectFit: 'contain', borderRadius: '6px' }}
                />
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

