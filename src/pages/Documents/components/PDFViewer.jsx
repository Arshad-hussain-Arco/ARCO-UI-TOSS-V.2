import React from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';

/** Dedicated PDF Viewer component using @react-pdf-viewer */
export function PDFViewer({ fileContent }) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();

  if (!fileContent) {
    return null;
  }

  return (
    <div className="pdf-viewer-wrapper" style={{ height: '100%', minHeight: '650px', width: '100%', overflow: 'hidden' }}>
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer fileUrl={fileContent} plugins={[defaultLayoutPluginInstance]} />
      </Worker>
    </div>
  );
}

export default PDFViewer;
