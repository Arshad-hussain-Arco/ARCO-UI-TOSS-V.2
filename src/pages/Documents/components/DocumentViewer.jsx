import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import {
  Download,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { getFileIcon } from './FolderTree';
import { PDFViewer } from './PDFViewer';
import { documentService } from '@services/documentService';
import { Loader } from '@components/feedback/Loader/Loader';
import toast from 'react-hot-toast';

export function DocumentViewer({ selectedFile, pdfZoom = 100 }) {
  const [contentBlob, setContentBlob] = useState(null);
  const [objectUrl, setObjectUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);
  const [tableRows, setTableRows] = useState(null);
  const [docxHtml, setDocxHtml] = useState(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Fetch file content via API get-document by ID
  useEffect(() => {
    let currentObjectUrl = null;

    if (!selectedFile?.id) {
      setContentBlob(null);
      setObjectUrl(null);
      setTextContent(null);
      setFetchError(null);
      return;
    }

    const loadContent = async () => {
      setIsLoadingContent(true);
      setFetchError(null);
      setTextContent(null);
      setTableRows(null);
      setDocxHtml(null);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }

      try {
        const blob = await documentService.getDocumentContent(selectedFile.id);
        setContentBlob(blob);
        currentObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(currentObjectUrl);

        const ext = selectedFile.type?.toLowerCase();

        if (ext === 'csv') {
          const text = await blob.text();
          setTableRows(text.split(/\r?\n/).filter((line) => line.length > 0).map((line) => line.split(',')));
        } else if (['xlsx', 'xls'].includes(ext)) {
          const buffer = await blob.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          setTableRows(XLSX.utils.sheet_to_json(sheet, { header: 1 }));
        } else if (ext === 'docx') {
          const buffer = await blob.arrayBuffer();
          const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
          setDocxHtml(html);
        } else if (['txt', 'json', 'log', 'md', 'xml'].includes(ext)) {
          // Plain text/JSON/log/xml files — read the text content for pretty display
          const text = await blob.text();
          setTextContent(text);
        }
      } catch (err) {
        console.error('Failed to load document content:', err);
        if (err.response?.status === 403) {
          setFetchError({ isPermissionDenied: true });
        } else {
          const errMsg = err.response?.data?.message || err.message || 'Failed to fetch file content';
          setFetchError({ message: errMsg });
        }
      } finally {
        setIsLoadingContent(false);
      }
    };

    loadContent();

    return () => {
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [selectedFile?.id]);

  const handleDownload = () => {
    if (!objectUrl && !contentBlob) {
      toast.error('File content not available for download');
      return;
    }
    const downloadName = selectedFile?.fileName || selectedFile?.name || 'document';
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloading ${downloadName}`);
  };

  const handlePrint = () => {
    if (selectedFile) {
      window.print();
    }
  };

  const FileIconCard = getFileIcon(selectedFile?.type);
  const ext = selectedFile?.type?.toLowerCase();

  const renderContentBody = () => {
    if (isLoadingContent) {
      return (
        <div className="doc-preview-loading">
          <Loader message="Fetching document from SFTP server…" />
        </div>
      );
    }

    if (fetchError) {
      if (fetchError.isPermissionDenied) {
        return (
          <div className="doc-preview-error">
            <AlertCircle size={40} className="doc-error-icon" />
            <h3>You don't have permission to view this file</h3>
            <p>Viewing/downloading file content requires the Download permission for Documents.</p>
          </div>
        );
      }
      return (
        <div className="doc-preview-error">
          <AlertCircle size={40} className="doc-error-icon" />
          <h3>Could not load document preview</h3>
          <p>{fetchError.message}</p>
          <button
            className="doc-modal-btn primary"
            onClick={() => {
              // Retry reload
              setFetchError(null);
              setIsLoadingContent(true);
              documentService
                .getDocumentContent(selectedFile.id)
                .then((blob) => {
                  setContentBlob(blob);
                  const url = URL.createObjectURL(blob);
                  setObjectUrl(url);
                })
                .catch((e) => {
                  if (e.response?.status === 403) {
                    setFetchError({ isPermissionDenied: true });
                  } else {
                    setFetchError({ message: e.message });
                  }
                })
                .finally(() => setIsLoadingContent(false));
            }}
          >
            <RefreshCw size={14} style={{ marginRight: '6px' }} />
            Retry Fetch
          </button>
        </div>
      );
    }

    if (objectUrl) {
      if (ext === 'pdf') {
        return <PDFViewer fileContent={objectUrl} />;
      }

      if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
        return (
          <div className="doc-png-viewer">
            <div className="doc-png-canvas">
              <img
                src={objectUrl}
                alt={selectedFile.name}
                style={{ maxWidth: '100%', maxHeight: '550px', borderRadius: '8px', objectFit: 'contain' }}
              />
            </div>
          </div>
        );
      }

      if (tableRows !== null) {
        return (
          <div className="doc-table-viewer">
            {tableRows.length === 0 ? (
              <p className="doc-preview-placeholder-text">This spreadsheet has no data.</p>
            ) : (
              <table className="doc-table">
                <tbody>
                  {tableRows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell != null ? String(cell) : ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      }

      if (docxHtml !== null) {
        return (
          <div className="doc-docx-viewer">
            <div className="doc-docx-page" dangerouslySetInnerHTML={{ __html: docxHtml }} />
          </div>
        );
      }

      if (textContent !== null) {
        return (
          <div className="doc-docx-viewer">
            <div className="doc-docx-page">
              <pre style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {textContent}
              </pre>
            </div>
          </div>
        );
      }
    }

    // Fallback for unsupported binary formats (legacy .doc, etc.)
    return (
      <div className="doc-preview-placeholder">
        <FileIconCard size={54} className="doc-preview-placeholder-icon" />
        <h3>{selectedFile.name}</h3>
        <p className="doc-preview-placeholder-text">
          {selectedFile.description || 'Binary document loaded from server. Download to open in native desktop viewer.'}
        </p>
        <button className="doc-modal-btn primary" onClick={handleDownload} style={{ marginTop: '12px' }}>
          <Download size={15} style={{ marginRight: '6px' }} />
          Download Document
        </button>
      </div>
    );
  };

  return (
    <div className="doc-viewer-panel">
      {/* Viewer Body Preview Content */}
      <div className="doc-viewer-body" style={ext === 'pdf' ? { padding: 0, overflow: 'hidden' } : { fontSize: `${pdfZoom}%` }}>
        {renderContentBody()}
      </div>
    </div>
  );
}

export default DocumentViewer;
