import React from 'react';
import { Worker, Viewer } from '@react-pdf-viewer/core';
import '@react-pdf-viewer/core/lib/styles/index.css';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { useTheme } from '@hooks/useTheme';

/** Dedicated PDF Viewer component using @react-pdf-viewer */
export function PDFViewer({ fileContent }) {
  const defaultLayoutPluginInstance = defaultLayoutPlugin();
  const wrapperRef = React.useRef(null);
  const currentScaleRef = React.useRef(1); // Default scale starts at 1 (100%)
  const { isDarkMode } = useTheme();

  const handleZoom = (e) => {
    currentScaleRef.current = e.scale;
  };

  React.useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    // Manually handle ctrl+wheel zoom to prevent native bug (jumps to 0%)
    const handleWheel = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const zoomStep = 0.1; // 10% jumps
        let newScale = currentScaleRef.current;

        if (e.deltaY < 0) {
          newScale += zoomStep; // Zoom in
        } else if (e.deltaY > 0) {
          newScale -= zoomStep; // Zoom out
        }

        // Constrain scale (e.g., 10% to 500%)
        newScale = Math.max(0.1, Math.min(newScale, 5.0));
        
        // Round to 1 decimal place to ensure exact steps like 1.1, 1.0, 0.9
        newScale = Math.round(newScale * 10) / 10;

        // Update ref synchronously so rapid scrolling doesn't use stale scale values
        currentScaleRef.current = newScale;

        defaultLayoutPluginInstance.toolbarPluginInstance.zoomPluginInstance.zoomTo(newScale);
      }
    };

    // Use capture: true so we intercept the event BEFORE react-pdf-viewer's internal listeners
    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', handleWheel, { capture: true });
  }, [defaultLayoutPluginInstance]);

  if (!fileContent) {
    return null;
  }

  return (
    <div ref={wrapperRef} className="pdf-viewer-wrapper" style={{ height: '100%', minHeight: '650px', width: '100%', overflow: 'hidden' }}>
      <Worker workerUrl="https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js">
        <Viewer 
          fileUrl={fileContent} 
          plugins={[defaultLayoutPluginInstance]} 
          onZoom={handleZoom} 
          theme={isDarkMode ? 'dark' : 'light'} 
        />
      </Worker>
    </div>
  );
}

export default PDFViewer;
