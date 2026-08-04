import { useState } from 'react';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

import { Button } from '@components/ui/Button/Button';

/** Hover-triggered Export dropdown offering PDF/Excel — the one shared implementation. */
export function ExportDropdown({ onExportPdf, onExportExcel }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setIsOpen(false)}>
      <Button variant="outline" size="sm" leadingIcon={Download} onMouseEnter={() => setIsOpen(true)}>
        Export
      </Button>

      {isOpen && (
        <div
          style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '4px',
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 50, minWidth: '120px', overflow: 'hidden',
          }}
        >
          <div
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: '#334155' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={() => {
              onExportPdf();
              setIsOpen(false);
            }}
          >
            <FileText size={14} /> PDF
          </div>
          <div
            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #e2e8f0', color: '#334155' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={() => {
              onExportExcel();
              setIsOpen(false);
            }}
          >
            <FileSpreadsheet size={14} /> Excel
          </div>
        </div>
      )}
    </div>
  );
}

export default ExportDropdown;
