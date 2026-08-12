import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Image as ImageIcon } from 'lucide-react';
import './HomeCard.css';

/**
 * Enterprise Home Card Renderer
 * Strictly honors 50% Width (Vertical) vs 100% Width (Horizontal) layouts.
 */
export function HomeCard({ card, className = '', style = {} }) {
  const [imageError, setImageError] = useState(false);

  if (!card) return null;

  const isHalfWidth = card.display_width === '50%';
  const widthClass = isHalfWidth ? 'home-card-50' : 'home-card-100';

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
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(rawHtml || '') }}
        />
      );
    }

    if (rawText) {
      return <p className="home-card-text-content">{rawText}</p>;
    }

    return null;
  };

  return (
    <article className={`home-card ${widthClass} ${className}`} style={style}>
      {/* Media Section */}
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
