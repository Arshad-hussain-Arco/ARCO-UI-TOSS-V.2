import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Image as ImageIcon } from 'lucide-react';
import './HomeCard.css';

/**
 * DOMPurify's default profile strips <embed> outright and strips the
 * `href` off any `data:`-URI <a> (its DEFAULT_DATA_URI_TAGS allowlist for
 * data: URIs only covers audio/video/img/source/image/track) — verified
 * against the installed dompurify build. Since the RichEditor embeds PDFs
 * via <embed src="data:application/pdf;...">  and both PDF and attachment
 * download links use <a href="data:...;base64,..." download>, the default
 * config would silently render those as dead, href-less links here. This
 * extends (not replaces) the default allowlist just enough to keep that
 * content functional without loosening anything else.
 */
const HOME_CARD_SANITIZE_CONFIG = {
  ADD_TAGS: ['embed'],
  ADD_ATTR: ['controls', 'type'],
  ADD_DATA_URI_TAGS: ['embed', 'a'],
};

/**
 * Enterprise Home Card Renderer
 * Strictly honors 50% Width (Vertical) vs 100% Width (Horizontal) layouts.
 */
export function HomeCard({ card, className = '', style = {} }) {
  const [imageError, setImageError] = useState(false);

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

  const renderContent = () => {
    if (card.card_type === 'html_code' || rawHtml) {
      return (
        <div
          className="home-card-html-content"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml || '', HOME_CARD_SANITIZE_CONFIG) }}
        />
      );
    }

    if (rawText) {
      return <p className="home-card-text-content">{rawText}</p>;
    }

    return null;
  };

  return (
    <article className={`home-card ${widthClass} ${isHtmlCard ? 'home-card-html-only' : ''} ${className}`} style={style}>
      {/* Media Section — omitted entirely for Rich Text cards */}
      {!isHtmlCard && (
        <div className="home-card-media-wrapper">
          {photoUrl && !imageError ? (
            <img
              src={photoUrl}
              alt={heading || 'Card image'}
              className="home-card-image"
              onError={() => setImageError(true)}
            />
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
  );
}

export default HomeCard;
