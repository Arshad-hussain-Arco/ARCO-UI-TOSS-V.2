import React from 'react';
import { VideoViewer } from './VideoViewer';
import { PdfViewer } from './PdfViewer';
import './media.css';

/**
 * Reusable Media Block component.
 * Inspects media type and renders the appropriate lightweight component.
 */
export function MediaBlock({ type, src, fileName, fileSize, mimeType }) {
  if (!src) return null;

  if (type === 'video' || (mimeType && mimeType.startsWith('video/'))) {
    return (
      <div className="media-block">
        <VideoViewer src={src} fileName={fileName} mimeType={mimeType} />
      </div>
    );
  }

  if (type === 'pdf' || mimeType === 'application/pdf' || fileName?.toLowerCase().endsWith('.pdf')) {
    return (
      <div className="media-block">
        <PdfViewer src={src} fileName={fileName} fileSize={fileSize} />
      </div>
    );
  }

  return null;
}

export default MediaBlock;
