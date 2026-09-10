import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { AlertCircle, Download, FileText } from 'lucide-react';
import { useToast } from '@hooks/useToast';

import { DocumentSkeleton } from './LinkContentPage';
import { PDFViewer } from '@pages/Documents/components/PDFViewer';
import { linkService } from '@services/linkService';

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
const TEXT_EXTS = ['txt', 'csv', 'json', 'log', 'md', 'xml'];
const SPREADSHEET_EXTS = ['xlsx', 'xls', 'csv'];

function extOf(fileName) {
  return (fileName?.split('.').pop() || '').toLowerCase();
}

/** Renders parsed spreadsheet rows (xlsx/xls/csv) as a plain HTML table. */
function SpreadsheetTable({ rows }) {
  if (!rows || rows.length === 0) {
    return <p className="il-content-empty">This spreadsheet has no data.</p>;
  }
  return (
    <div className="il-content-table-wrap">
      <table className="il-content-table">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell != null ? String(cell) : ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * In-page preview for a link's content — used when the link's "content
 * type" isn't a URL (AddLinkModal enforces exactly one of URL / Shared
 * Folder+File / Comments), so there's nothing to open in a new tab:
 *   - Comments / Shared Folder path: shown as plain text, no fetch needed.
 *   - Uploaded file: fetched from the server and previewed inline —
 *     PDF via the same viewer Documents uses, images inline, CSV/plain
 *     text as a table/pre block, Excel via SheetJS, Word (.docx) via
 *     mammoth. Legacy .doc and other binary formats fall back to a
 *     download prompt, same as the Documents module does today.
 */
export function LinkContentViewer({ link }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null); // { kind, ...data }

  const toast = useToast();
  const file = link?.files?.[0];

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setError(null);

    if (!file) return;

    const ext = extOf(file.name);
    setIsLoading(true);

    linkService.getLinkContent(link.id)
      .then(async (blob) => {
        if (cancelled) return;

        if (ext === 'pdf') {
          setPreview({ kind: 'pdf', url: URL.createObjectURL(blob) });
          return;
        }
        if (IMAGE_EXTS.includes(ext)) {
          setPreview({ kind: 'image', url: URL.createObjectURL(blob) });
          return;
        }
        if (ext === 'csv') {
          const text = await blob.text();
          const rows = text.split(/\r?\n/).filter((line) => line.length > 0).map((line) => line.split(','));
          setPreview({ kind: 'table', rows });
          return;
        }
        if (['xlsx', 'xls'].includes(ext)) {
          const buffer = await blob.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          setPreview({ kind: 'table', rows });
          return;
        }
        if (ext === 'docx') {
          const buffer = await blob.arrayBuffer();
          const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
          setPreview({ kind: 'html', html });
          return;
        }
        if (TEXT_EXTS.includes(ext)) {
          const text = await blob.text();
          setPreview({ kind: 'text', text });
          return;
        }

        // .doc (legacy binary) and any other unsupported format
        setPreview({ kind: 'unsupported', url: URL.createObjectURL(blob) });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('Failed to load link content:', err);
        setError(err.response?.data?.message || err.message || 'Failed to fetch file content');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link?.id, file?.name]);

  const handleDownload = () => {
    if (!preview?.url) return;
    const a = document.createElement('a');
    a.href = preview.url;
    a.download = file?.name || 'file';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleContentClick = (e) => {
    // Unified indestructible copy button handler
    let copyBtn = e.target.closest('[data-copy-text], [data-copy], .il-dynamic-copy-btn, .copy-btn, [data-copy-btn]');
    if (!copyBtn) {
      let curr = e.target;
      while (curr && curr !== e.currentTarget) {
        if (curr.nodeType === Node.ELEMENT_NODE) {
          // Match standard buttons
          if (curr.matches('button, .btn, a, .arco-btn, [role="button"]') && curr.textContent.trim().toLowerCase().includes('copy')) {
            copyBtn = curr;
            break;
          }
          // Match ANY element (like span, div, td) if its EXACT text is just "Copy" or "Copy Path"
          const exactText = curr.textContent.trim().toLowerCase();
          if (exactText === 'copy' || exactText === 'copy path') {
            copyBtn = curr;
            break;
          }
        }
        curr = curr.parentNode;
      }
    }

    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      
      let textToCopy = copyBtn.getAttribute('data-copy-text') || copyBtn.getAttribute('data-copy') || '';

      if (!textToCopy) {
        const td = copyBtn.closest('td, th');
        if (td) {
          const clone = td.cloneNode(true);
          const btns = clone.querySelectorAll('button, .btn, .copy-btn, .il-dynamic-copy-btn, [data-copy-btn], a');
          btns.forEach(b => b.remove());
          textToCopy = clone.textContent.replace(/\u200B/g, '').trim();
        }

        if (!textToCopy) {
          let curr = copyBtn;
          while (curr && curr !== e.currentTarget && !textToCopy) {
            let prev = curr.previousSibling; 
            while (prev && !textToCopy) {
              if (prev.nodeType === Node.TEXT_NODE) {
                textToCopy = prev.textContent.replace(/\u200B/g, '').trim();
              } else if (prev.nodeType === Node.ELEMENT_NODE) {
                const prevClone = prev.cloneNode(true);
                const btns = prevClone.querySelectorAll('button, .btn, .copy-btn, .il-dynamic-copy-btn, [data-copy-btn], a');
                btns.forEach(b => b.remove());
                textToCopy = prevClone.textContent.replace(/\u200B/g, '').trim();
              }
              prev = prev.previousSibling;
            }
            curr = curr.parentNode;
          }
        }
      }

      const originalHTML = copyBtn.innerHTML;
      
      if (!textToCopy) {
        copyBtn.textContent = 'No text!';
        setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 1500);
        return;
      }

      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('rte-copy-btn-copied');
      
      const showCopied = () => {
        setTimeout(() => {
          copyBtn.innerHTML = originalHTML;
          copyBtn.classList.remove('rte-copy-btn-copied');
        }, 1500);
      };

      const doFallbackCopy = () => {
        const tempInput = document.createElement('textarea');
        tempInput.value = textToCopy;
        document.body.appendChild(tempInput);
        tempInput.select();
        try {
          document.execCommand('copy');
        } catch (err) {}
        document.body.removeChild(tempInput);
        toast.success('Copied to clipboard!');
        showCopied();
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(textToCopy)
          .then(() => {
            toast.success('Copied to clipboard!');
            showCopied();
          })
          .catch(doFallbackCopy);
      } else {
        doFallbackCopy();
      }
      return;
    }
  };

  return (
    <div className="il-content-viewer">
      {/* Rich Text Comments / Description */}
      {link?.description && (
        <div className="il-content-text-block" onClick={handleContentClick}>
          <div className="il-rte-viewer" dangerouslySetInnerHTML={{ __html: link.description }} />
        </div>
      )}

      {file && (
        <div className="il-content-file-block">
          {isLoading ? (
            <DocumentSkeleton />
          ) : error ? (
            <div className="il-content-error">
              <AlertCircle size={32} aria-hidden="true" />
              <p>{error}</p>
            </div>
          ) : preview?.kind === 'pdf' ? (
            <PDFViewer fileContent={preview.url} />
          ) : preview?.kind === 'image' ? (
            <img src={preview.url} alt={file.name} className="il-content-image" />
          ) : preview?.kind === 'table' ? (
            <SpreadsheetTable rows={preview.rows} />
          ) : preview?.kind === 'html' ? (
            <div className="il-content-docx" dangerouslySetInnerHTML={{ __html: preview.html }} />
          ) : preview?.kind === 'text' ? (
            <pre className="il-content-pre">{preview.text}</pre>
          ) : preview?.kind === 'unsupported' ? (
            <div className="il-content-error">
              <FileText size={32} aria-hidden="true" />
              <p>{file.name}</p>
              <p className="il-content-empty">Preview isn't available for this file type.</p>
              <button type="button" className="il-content-download-btn" onClick={handleDownload}>
                <Download size={14} /> Download
              </button>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default LinkContentViewer;
