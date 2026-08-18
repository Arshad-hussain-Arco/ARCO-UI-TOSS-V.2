import React, { useState } from 'react';
import { Maximize2, AlertCircle } from 'lucide-react';
import { MediaViewerModal } from './MediaViewerModal';
import './media.css';

/**
 * Lightweight, production native video player component.
 * Strictly avoids continuous autoplay or heavy video frameworks.
 */
export function VideoViewer({ src, fileName = 'Video file', mimeType = 'video/mp4' }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!src) return null;

  return (
    <div className="media-video-container">
      {hasError ? (
        <div className="media-error-container">
          <AlertCircle size={28} className="media-error-icon" />
          <p style={{ margin: 0, fontSize: '13px' }}>Unable to preview this video.</p>
          <a href={src} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--c-primary, #006838)' }}>
            Try opening file separately
          </a>
        </div>
      ) : (
        <>
          <video
            controls
            preload="metadata"
            playsInline
            src={src}
            className="media-video-player"
            onError={() => setHasError(true)}
          >
            <source src={src} type={mimeType} />
          </video>

          <div className="media-video-toolbar">
            <span className="media-video-title">{fileName}</span>
            <button
              type="button"
              className="media-expand-btn"
              onClick={() => setIsModalOpen(true)}
              title="Expand video"
            >
              <Maximize2 size={12} />
              <span>Expand</span>
            </button>
          </div>
        </>
      )}

      {/* Controlled Fullscreen Viewer */}
      <MediaViewerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        src={src}
        fileName={fileName}
        mediaType="video"
      />
    </div>
  );
}

export default VideoViewer;
