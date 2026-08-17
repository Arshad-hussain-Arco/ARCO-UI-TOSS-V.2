import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { X, ExternalLink, Download, FileText, Video, AlertCircle } from 'lucide-react';
import './media.css';

/**
 * Controlled React Portal Media Viewer Modal.
 * Displays video or PDF content in an isolated overlay (`z-index: 1100`).
 */
export function MediaViewerModal({
  isOpen,
  onClose,
  src,
  fileName = 'Media Document',
  mediaType = 'pdf', // 'pdf' | 'video'
}) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  const isPdf = mediaType === 'pdf';

  return ReactDOM.createPortal(
    <div className="media-viewer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="media-viewer-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="media-viewer-header">
          <div className="media-viewer-title-area">
            {isPdf ? <FileText size={18} /> : <Video size={18} />}
            <h4 className="media-viewer-title" title={fileName}>
              {fileName}
            </h4>
          </div>

          <div className="media-viewer-actions">
            {/* Open in New Tab */}
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="media-viewer-action-btn"
              title="Open in new tab"
            >
              <ExternalLink size={14} />
              <span>Open in New Tab</span>
            </a>

            {/* Download */}
            <a
              href={src}
              download={fileName}
              className="media-viewer-action-btn"
              title="Download file"
            >
              <Download size={14} />
              <span>Download</span>
            </a>

            {/* Close */}
            <button
              type="button"
              className="media-viewer-close-btn"
              onClick={onClose}
              title="Close (ESC)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="media-viewer-body">
          {isPdf ? (
            <iframe
              src={src}
              title={fileName}
              className="media-viewer-frame"
              loading="lazy"
            />
          ) : (
            <video
              controls
              autoPlay
              preload="metadata"
              playsInline
              src={src}
              className="media-viewer-video"
            >
              <div className="media-error-container">
                <AlertCircle size={32} className="media-error-icon" />
                <p>Your browser does not support HTML5 video playback.</p>
              </div>
            </video>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default MediaViewerModal;
