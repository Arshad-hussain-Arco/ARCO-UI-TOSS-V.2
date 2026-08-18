import React, { useState } from 'react';
import { FileText, Eye, Download } from 'lucide-react';
import { MediaViewerModal } from './MediaViewerModal';
import './media.css';

/**
 * Lightweight native PDF document card component.
 * Avoids heavy PDF.js rendering in the main editor DOM tree.
 */
export function PdfViewer({ src, fileName = 'Document.pdf', fileSize = '' }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!src) return null;

  return (
    <div className="media-pdf-card">
      <div className="media-pdf-meta">
        <div className="media-pdf-icon">
          <FileText size={20} />
        </div>
        <div className="media-pdf-info">
          <span className="media-pdf-filename" title={fileName}>{fileName}</span>
          {fileSize && <span className="media-pdf-filesize">{fileSize}</span>}
        </div>
      </div>

      <div className="media-pdf-actions">
        {/* View PDF Button */}
        <button
          type="button"
          className="media-pdf-view-btn"
          onClick={() => setIsModalOpen(true)}
        >
          <Eye size={14} />
          <span>View PDF</span>
        </button>

        {/* Direct Download Link */}
        <a
          href={src}
          download={fileName}
          className="media-expand-btn"
          style={{ background: 'var(--bg-tertiary, #eef2f6)', color: 'var(--text-primary, #0f172a)', borderColor: 'var(--border-primary, #e2e8f0)' }}
          title="Download PDF"
        >
          <Download size={13} />
        </a>
      </div>

      {/* Dedicated PDF Viewer Modal */}
      <MediaViewerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        src={src}
        fileName={fileName}
        mediaType="pdf"
      />
    </div>
  );
}

export default PdfViewer;
