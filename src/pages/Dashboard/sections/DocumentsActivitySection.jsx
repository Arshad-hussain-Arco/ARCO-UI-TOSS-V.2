import React, { memo } from 'react';
import { ChevronRight, FileText, FileSpreadsheet, Image, File, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@constants/routes';

export function getFileIcon(type) {
  switch (type?.toLowerCase()) {
    case 'pdf':
    case 'doc':
    case 'docx':
      return FileText;
    case 'xls':
    case 'xlsx':
    case 'csv':
      return FileSpreadsheet;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
      return Image;
    default:
      return File;
  }
}

function DocumentsActivitySectionComponent({ documents }) {
  const navigate = useNavigate();

  if (!documents || !documents.files) return null;

  // Assume the last 5 files in the array or sorting by ID gives us the most recent
  const recentFiles = [...documents.files].reverse().slice(0, 5);

  return (
    <div 
      className="dc-card"
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        minHeight: '340px', 
        padding: '24px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Recently Uploaded
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '2px', display: 'block' }}>
            Your latest files across the repository
          </span>
        </div>
        <button 
          onClick={() => navigate(ROUTES.DOCUMENTS)}
          style={{ 
            background: 'none', border: 'none', color: 'var(--primary-color, #4f46e5)', fontSize: '13px', 
            fontWeight: 600, display: 'flex', alignItems: 'center', cursor: 'pointer', padding: 0 
          }}
        >
          View all
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {recentFiles.map((file) => {
           const FileIconCard = getFileIcon(file.type);
           const isPdf = file.type === 'pdf';
           const isExcel = ['xls', 'xlsx', 'csv'].includes(file.type);
           const isImage = ['png', 'jpg', 'jpeg', 'svg'].includes(file.type);
           
           let iconBg = 'var(--bg-tertiary)';
           let iconColor = 'var(--text-secondary)';
           
           if (isPdf) { iconBg = 'rgba(239, 68, 68, 0.15)'; iconColor = '#ef4444'; }
           else if (isExcel) { iconBg = 'rgba(16, 185, 129, 0.15)'; iconColor = '#10b981'; }
           else if (isImage) { iconBg = 'rgba(79, 70, 229, 0.15)'; iconColor = '#4f46e5'; }
           else if (['doc', 'docx'].includes(file.type)) { iconBg = 'rgba(59, 130, 246, 0.15)'; iconColor = '#3b82f6'; }

           const subtitle = file.raw?.created_at ? new Date(file.raw.created_at).toLocaleDateString() : `${(file.type || 'UNKNOWN').toUpperCase()} Document`;

           return (
            <div 
              key={file.id} 
              onClick={() => navigate(ROUTES.DOCUMENTS, { state: { selectedFileId: file.id } })}
              style={{ 
                display: 'flex', alignItems: 'center', padding: '10px 12px', 
                backgroundColor: 'transparent', borderRadius: '8px', cursor: 'pointer', 
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', backgroundColor: iconBg, color: iconColor, marginRight: '14px', flexShrink: 0 }}>
                <FileIconCard size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{subtitle}</div>
              </div>
              <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }} className="chevron-icon">
                 <ChevronRight size={14} />
              </div>
            </div>
           )
        })}
      </div>
    </div>
  );
}

export const DocumentsActivitySection = memo(DocumentsActivitySectionComponent);
export default DocumentsActivitySection;
