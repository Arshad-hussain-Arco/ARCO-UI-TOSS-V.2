import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import DOMPurify from 'dompurify';
import { X, ExternalLink, Download, FileText, Video, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { renderOfficeFileToHtml } from './officeViewer';
import './media.css';

const OFFICE_SANITIZE_CONFIG = {
  ADD_ATTR: ['colspan', 'rowspan'],
};

/**
 * Controlled React Portal Media Viewer Modal.
 * Displays video, PDF, or (for 'office') a locally-rendered preview of an
 * xlsx/xls/docx/pptx file — parsed entirely client-side from the file's own
 * bytes, no third-party viewer service involved.
 */
export function MediaViewerModal({
  isOpen,
  onClose,
  src,
  fileName = 'Media Document',
  mediaType = 'pdf', // 'pdf' | 'video' | 'office'
}) {
  const [officeState, setOfficeState] = useState({ status: 'idle', html: '', error: '' });

  useEffect(() => {
    if (!isOpen || mediaType !== 'office' || !src) return undefined;

    let cancelled = false;
    setOfficeState({ status: 'loading', html: '', error: '' });

    (async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`Failed to fetch file (${response.status}).`);
        const arrayBuffer = await response.arrayBuffer();
        const html = await renderOfficeFileToHtml(arrayBuffer, fileName);
        if (!cancelled) setOfficeState({ status: 'ready', html, error: '' });
      } catch (err) {
        if (!cancelled) setOfficeState({ status: 'error', html: '', error: err.message || 'Failed to preview this file.' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, mediaType, src, fileName]);

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
  const isOffice = mediaType === 'office';

  return ReactDOM.createPortal(
    <div className="media-viewer-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className={`media-viewer-modal ${isOffice ? 'media-viewer-modal-office' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="media-viewer-header">
          <div className="media-viewer-title-area">
            {isPdf ? <FileText size={18} /> : isOffice ? <FileSpreadsheet size={18} /> : <Video size={18} />}
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
        <div className={`media-viewer-body ${isOffice ? 'media-viewer-body-office' : ''}`}>
          {isPdf ? (
            <iframe
              src={src}
              title={fileName}
              className="media-viewer-frame"
              loading="lazy"
            />
          ) : isOffice ? (
            <div className="media-office-panel">
              {officeState.status === 'loading' && (
                <div className="media-error-container">
                  <div className="media-office-spinner" aria-hidden="true" />
                  <p>Rendering preview…</p>
                </div>
              )}
              {officeState.status === 'error' && (
                <div className="media-error-container">
                  <AlertCircle size={32} className="media-error-icon" />
                  <p>{officeState.error}</p>
                </div>
              )}
              {officeState.status === 'ready' && (
                <div
                  className="media-office-content"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(officeState.html, OFFICE_SANITIZE_CONFIG) }}
                />
              )}
            </div>
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
