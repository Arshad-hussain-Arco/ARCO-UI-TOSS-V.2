import { Download, Maximize2, Minimize2, Printer, X, ZoomIn, ZoomOut } from 'lucide-react';

import { FilePreview } from './FilePreview';

function EmptyStatePanel() {
  return (
    <div className="doc-empty-state-panel">
      <div className="doc-empty-state-graphic">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="20" width="70" height="80" rx="8" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="2" />
          <rect x="35" y="35" width="50" height="6" rx="3" fill="#E5E7EB" />
          <rect x="35" y="50" width="50" height="6" rx="3" fill="#E5E7EB" />
          <rect x="35" y="65" width="35" height="6" rx="3" fill="#E5E7EB" />
          <circle cx="85" cy="85" r="20" fill="#E6F4ED" stroke="#115E59" strokeWidth="2" />
          <path d="M80 80L90 90" stroke="#115E59" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M85 75V95" stroke="#115E59" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M75 85H95" stroke="#115E59" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="doc-empty-state-title">Select a file from the sidebar to view details</h2>
      <p className="doc-empty-state-text">
        Explore folder paths, perform instant search, and preview PDF, DOCX, XLSX, and Image contents in real-time.
      </p>
    </div>
  );
}

export function DocumentViewer({
  selectedFile,
  getFileIcon,
  pdfZoom,
  setPdfZoom,
  isFullscreen,
  setIsFullscreen,
  onPrint,
  onDeselect,
}) {
  if (!selectedFile) return <EmptyStatePanel />;

  const FileIcon2 = getFileIcon(selectedFile.type);

  return (
    <div className="doc-viewer-panel">
      <div className="doc-viewer-header">
        <div className="doc-viewer-title-area">
          <FileIcon2 size={20} className="doc-viewer-file-icon" />
          <div className="doc-viewer-title-wrapper">
            <span className="doc-viewer-title">{selectedFile.name}</span>
          </div>
        </div>

        <div className="doc-viewer-controls">
          <div className="doc-viewer-zoom-group">
            <button className="doc-viewer-ctrl-btn" onClick={() => setPdfZoom(Math.max(50, pdfZoom - 10))} title="Zoom Out">
              <ZoomOut size={16} />
            </button>
            <span className="doc-zoom-text">{pdfZoom}%</span>
            <button className="doc-viewer-ctrl-btn" onClick={() => setPdfZoom(Math.min(200, pdfZoom + 10))} title="Zoom In">
              <ZoomIn size={16} />
            </button>
          </div>

          <div className="doc-viewer-action-group">
            <button className="doc-viewer-ctrl-btn" title="Print Document" onClick={onPrint}>
              <Printer size={16} />
            </button>
            <button className="doc-viewer-ctrl-btn" title="Download File">
              <Download size={16} />
            </button>
            <button
              className="doc-viewer-ctrl-btn fullscreen-btn"
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button className="doc-viewer-ctrl-btn close-btn" onClick={onDeselect} title="Deselect">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="doc-viewer-body" style={{ fontSize: `${pdfZoom}%` }}>
        <FilePreview file={selectedFile} />
      </div>
    </div>
  );
}

export default DocumentViewer;
