import { useCallback, useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  File,
  Image,
  FileSpreadsheet,
  Upload,
  FolderPlus,
  Search,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  Download,
  Trash2,
  Edit,
  Move,
  Star,
  Clock,
  Users,
  Eye,
  ZoomIn,
  ZoomOut,
  X,
  Tag,
  MessageSquare,
  History,
  ChevronLeft,
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { documentService } from '@services/documentService';

import './DocumentsPage.css';
import { activatable, dismissOverlay } from '@utils/interactive';

/** Document library: folder tree, file table and inline preview. */
export function DocumentsPage() {
  useDocumentTitle('Documents');

  const fetchDocuments = useCallback(() => documentService.getDocuments(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchDocuments);

  const folderTree = data?.folderTree ?? [];
  const allFiles = data?.files ?? [];

  const [expandedFolders, setExpandedFolders] = useState(
    new Set(['root', 'project-docs', 'q1-releases']),
  );
  const [selectedFolder, setSelectedFolder] = useState('q1-releases');
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showContextMenu, setShowContextMenu] = useState(null);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(100);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const files = allFiles.filter((f) => f.folderId === selectedFolder);
  const toggleFolder = (folderId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };
  const handleFileClick = (file) => {
    setSelectedFile(file);
    setPreviewPanelOpen(true);
  };
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  const sortedFiles = [...files].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (sortField === 'lastModified') {
      aVal = new Date(a.lastModified).getTime();
      bVal = new Date(b.lastModified).getTime();
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  const getFileIcon = (type) => {
    switch (type) {
      case 'pdf':
        return FileText;
      case 'docx':
        return FileText;
      case 'xlsx':
        return FileSpreadsheet;
      case 'png':
        return Image;
      default:
        return File;
    }
  };
  const renderFolderTree = (folders, level = 0) => {
    return folders.map((folder) => {
      const isExpanded = expandedFolders.has(folder.id);
      const isSelected = selectedFolder === folder.id;
      const hasChildren = folder.children && folder.children.length > 0;
      return (
        <div key={folder.id} className="doc-folder-item">
          <div
            className={`doc-folder-row ${isSelected ? 'doc-folder-selected' : ''}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            {...activatable(
              () => {
                setSelectedFolder(folder.id);
                if (hasChildren) toggleFolder(folder.id);
              },
              { isExpanded: hasChildren ? isExpanded : undefined },
            )}
          >
            {hasChildren ? (
              <button
                className="doc-folder-toggle"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolder(folder.id);
                }}
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
            ) : (
              <span className="doc-folder-toggle-spacer" />
            )}
            {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
            <span className="doc-folder-name">{folder.name}</span>
            <span className="doc-folder-count">{folder.fileCount}</span>
          </div>
          {isExpanded && hasChildren && (
            <div className="doc-folder-children">
              {renderFolderTree(folder.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };
  const getBreadcrumbs = () => {
    const crumbs = ['Documents'];
    if (selectedFolder === 'project-docs') crumbs.push('Project Docs');
    if (selectedFolder === 'q1-releases') crumbs.push('Project Docs', 'Q1 Releases');
    if (selectedFolder === 'architecture') crumbs.push('Project Docs', 'Architecture');
    if (selectedFolder === 'compliance') crumbs.push('Compliance');
    if (selectedFolder === 'hr-policies') crumbs.push('HR Policies');
    if (selectedFolder === 'invoices') crumbs.push('Invoices');
    return crumbs;
  };

  if (error) {
    return (
      <ErrorState
        title="Documents could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !data) {
    return <Loader message="Loading documents…" />;
  }

  return (
    <div className="doc-page">
      {/* Header */}
      <div className="doc-header">
        <div className="doc-header-left">
          <h1 className="doc-page-title">Documents</h1>
          <div className="doc-breadcrumb">
            {getBreadcrumbs().map((crumb, idx) => (
              <span key={idx} className="doc-breadcrumb-item">
                {idx > 0 && <ChevronRight size={12} className="doc-breadcrumb-separator" />}
                {crumb}
              </span>
            ))}
          </div>
        </div>
        <div className="doc-header-right">
          <div className="doc-search-wrapper">
            <Search size={14} className="doc-search-icon" />
            <input
              type="text"
              placeholder="Search documents..."
              className="doc-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="doc-action-btn doc-action-btn-secondary">
            <FolderPlus size={16} />
            New Folder
          </button>
          <button className="doc-action-btn doc-action-btn-primary">
            <Upload size={16} />
            Upload
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="doc-main-content">
        {/* Left Sidebar - Folder Tree */}
        <div className="doc-sidebar">
          <div className="doc-sidebar-header">
            <span className="doc-sidebar-title">Folders</span>
          </div>
          <div className="doc-folder-tree">{renderFolderTree(folderTree)}</div>
        </div>

        {/* Center Panel - File List */}
        <div className="doc-file-list-container">
          <div className="doc-file-list-header">
            <span className="doc-file-count">{sortedFiles.length} files</span>
            <span className="doc-last-updated">Last updated: 2 Feb 2026, 14:23</span>
          </div>

          <div className="doc-table-wrapper">
            <table className="doc-table">
              <thead className="doc-table-head">
                <tr>
                  <th className="doc-table-th" onClick={() => handleSort('name')}>
                    <div className="doc-table-th-content">
                      File Name
                      <span className="doc-sort-indicator">
                        {sortField === 'name' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                      </span>
                    </div>
                  </th>
                  <th
                    className="doc-table-th doc-table-th-narrow"
                    onClick={() => handleSort('type')}
                  >
                    <div className="doc-table-th-content">
                      Type
                      <span className="doc-sort-indicator">
                        {sortField === 'type' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                      </span>
                    </div>
                  </th>
                  <th
                    className="doc-table-th doc-table-th-narrow"
                    onClick={() => handleSort('size')}
                  >
                    <div className="doc-table-th-content">
                      Size
                      <span className="doc-sort-indicator">
                        {sortField === 'size' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                      </span>
                    </div>
                  </th>
                  <th className="doc-table-th" onClick={() => handleSort('owner')}>
                    <div className="doc-table-th-content">
                      Owner
                      <span className="doc-sort-indicator">
                        {sortField === 'owner' && (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                      </span>
                    </div>
                  </th>
                  <th className="doc-table-th" onClick={() => handleSort('lastModified')}>
                    <div className="doc-table-th-content">
                      Last Modified
                      <span className="doc-sort-indicator">
                        {sortField === 'lastModified' &&
                          (sortDirection === 'asc' ? '\u2191' : '\u2193')}
                      </span>
                    </div>
                  </th>
                  <th className="doc-table-th doc-table-th-narrow">Actions</th>
                </tr>
              </thead>
              <tbody className="doc-table-body">
                {sortedFiles.map((file) => {
                  const FileIcon2 = getFileIcon(file.type);
                  return (
                    <tr
                      key={file.id}
                      className={`doc-table-row ${selectedFile?.id === file.id ? 'doc-table-row-selected' : ''}`}
                      onClick={() => handleFileClick(file)}
                      onDoubleClick={() => handleFileClick(file)}
                    >
                      <td className="doc-table-cell doc-table-cell-name">
                        <div className="doc-file-name-wrapper">
                          <FileIcon2 size={16} className="doc-file-icon" />
                          <span className="doc-file-name">{file.name}</span>
                          {file.favorite && (
                            <Star size={12} className="doc-file-favorite" fill="currentColor" />
                          )}
                          {file.tags && file.tags.length > 0 && (
                            <div className="doc-file-tags">
                              {file.tags.map((tag) => (
                                <span key={tag} className="doc-file-tag">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="doc-table-cell doc-table-cell-type">
                        {file.type.toUpperCase()}
                      </td>
                      <td className="doc-table-cell doc-table-cell-size">{file.size}</td>
                      <td className="doc-table-cell doc-table-cell-owner">
                        <div className="doc-owner-wrapper">
                          <Users size={12} className="doc-owner-icon" />
                          {file.owner}
                        </div>
                      </td>
                      <td className="doc-table-cell doc-table-cell-modified">
                        <div className="doc-modified-wrapper">
                          <Clock size={12} className="doc-modified-icon" />
                          {file.lastModified}
                        </div>
                      </td>
                      <td className="doc-table-cell doc-table-cell-actions">
                        <div className="doc-actions-wrapper">
                          {file.permission && (
                            <span
                              className="doc-permission-badge"
                              data-permission={file.permission}
                            >
                              {file.permission === 'edit' ? <Edit size={10} /> : <Eye size={10} />}
                            </span>
                          )}
                          <button
                            className="doc-action-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowContextMenu({ x: e.clientX, y: e.clientY, fileId: file.id });
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Panel - Document Preview */}
        {previewPanelOpen && selectedFile && (
          <div className="doc-preview-panel">
            <div className="doc-preview-header">
              <div className="doc-preview-title-wrapper">
                <FileText size={16} />
                <span className="doc-preview-title">{selectedFile.name}</span>
              </div>
              <div className="doc-preview-actions">
                <button
                  className="doc-preview-icon-btn"
                  onClick={() => setShowVersionHistory(!showVersionHistory)}
                  title="Version History"
                >
                  <History size={16} />
                </button>
                <button className="doc-preview-icon-btn" title="Download">
                  <Download size={16} />
                </button>
                <button
                  className="doc-preview-icon-btn"
                  onClick={() => setPreviewPanelOpen(false)}
                  title="Close"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Version History Sidebar */}
            {showVersionHistory && (
              <div className="doc-version-history">
                <div className="doc-version-header">Version History</div>
                <div className="doc-version-list">
                  {[
                    {
                      version: 'v3.0',
                      date: '2026-02-02 14:23',
                      author: 'Rajesh Kumar',
                      current: true,
                    },
                    {
                      version: 'v2.1',
                      date: '2026-01-28 10:15',
                      author: 'Priya Sharma',
                      current: false,
                    },
                    {
                      version: 'v2.0',
                      date: '2026-01-20 16:30',
                      author: 'Amit Patel',
                      current: false,
                    },
                  ].map((v) => (
                    <div
                      key={v.version}
                      className={`doc-version-item ${v.current ? 'doc-version-current' : ''}`}
                    >
                      <div className="doc-version-badge">{v.version}</div>
                      <div className="doc-version-details">
                        <div className="doc-version-author">{v.author}</div>
                        <div className="doc-version-date">{v.date}</div>
                      </div>
                      {v.current && <span className="doc-version-label">Current</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preview Content */}
            <div className="doc-preview-content">
              {selectedFile.type === 'pdf' && (
                <>
                  <div className="doc-preview-toolbar">
                    <div className="doc-preview-zoom">
                      <button
                        className="doc-zoom-btn"
                        onClick={() => setPdfZoom(Math.max(50, pdfZoom - 10))}
                      >
                        <ZoomOut size={14} />
                      </button>
                      <span className="doc-zoom-level">{pdfZoom}%</span>
                      <button
                        className="doc-zoom-btn"
                        onClick={() => setPdfZoom(Math.min(200, pdfZoom + 10))}
                      >
                        <ZoomIn size={14} />
                      </button>
                    </div>
                    <div className="doc-preview-page-nav">
                      <button className="doc-page-nav-btn">
                        <ChevronLeft size={14} />
                      </button>
                      <span className="doc-page-info">Page 1 of 12</span>
                      <button className="doc-page-nav-btn">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="doc-pdf-viewer" style={{ fontSize: `${pdfZoom}%` }}>
                    <div className="doc-pdf-page">
                      <div className="doc-pdf-content">
                        <h2 className="doc-pdf-doc-title">Capacity Planning – FY 2026</h2>
                        <div className="doc-pdf-section">
                          <h3>Executive Summary</h3>
                          <p>
                            This document outlines the comprehensive capacity planning strategy for
                            fiscal year 2026, covering infrastructure, human resources, and
                            technology investments required to support projected business growth.
                          </p>
                        </div>
                        <div className="doc-pdf-section">
                          <h3>Current State Analysis</h3>
                          <p>
                            Our current infrastructure supports approximately 2,500 concurrent users
                            with an average response time of 250ms. Database utilization stands at
                            68% with storage consumption at 12TB.
                          </p>
                          <p>
                            The engineering team comprises 45 full-time employees distributed across
                            6 cross-functional squads, with an additional 12 contractors supporting
                            specialized workstreams.
                          </p>
                        </div>
                        <div className="doc-pdf-section">
                          <h3>Growth Projections</h3>
                          <p>
                            Based on Q4 2025 performance metrics and market analysis, we anticipate
                            a 40% increase in user base, translating to approximately 3,500
                            concurrent users by Q3 2026.
                          </p>
                          <ul>
                            <li>Infrastructure scaling: Additional 8 compute nodes required</li>
                            <li>Storage expansion: Estimated 18TB additional capacity</li>
                            <li>
                              Team expansion: 12 new engineering hires across backend, frontend, and
                              DevOps
                            </li>
                          </ul>
                        </div>
                        <div className="doc-pdf-section">
                          <h3>Investment Requirements</h3>
                          <p>
                            Total estimated budget for capacity expansion: ₹4.2 Cr, distributed
                            across infrastructure (45%), personnel (40%), and tooling/software
                            licenses (15%).
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {selectedFile.type !== 'pdf' && (
                <div className="doc-preview-placeholder">
                  <FileIcon size={48} className="doc-preview-placeholder-icon" />
                  <p className="doc-preview-placeholder-text">
                    Preview not available for this file type
                  </p>
                  <div className="doc-metadata">
                    <div className="doc-metadata-item">
                      <span className="doc-metadata-label">File Type:</span>
                      <span className="doc-metadata-value">{selectedFile.type.toUpperCase()}</span>
                    </div>
                    <div className="doc-metadata-item">
                      <span className="doc-metadata-label">Size:</span>
                      <span className="doc-metadata-value">{selectedFile.size}</span>
                    </div>
                    <div className="doc-metadata-item">
                      <span className="doc-metadata-label">Owner:</span>
                      <span className="doc-metadata-value">{selectedFile.owner}</span>
                    </div>
                    <div className="doc-metadata-item">
                      <span className="doc-metadata-label">Last Modified:</span>
                      <span className="doc-metadata-value">{selectedFile.lastModified}</span>
                    </div>
                  </div>
                  <button className="doc-download-btn">
                    <Download size={16} />
                    Download File
                  </button>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <div className="doc-comments-section">
              <div className="doc-comments-header">
                <MessageSquare size={14} />
                <span>Comments</span>
                <span className="doc-comments-count">3</span>
              </div>
              <div className="doc-comments-list">
                <div className="doc-comment">
                  <div className="doc-comment-author">Priya Sharma</div>
                  <div className="doc-comment-text">
                    The growth projections look conservative. Should we factor in the new product
                    launch?
                  </div>
                  <div className="doc-comment-date">2 hours ago</div>
                </div>
                <div className="doc-comment">
                  <div className="doc-comment-author">Amit Patel</div>
                  <div className="doc-comment-text">
                    Approved. Please share with finance team for budget allocation.
                  </div>
                  <div className="doc-comment-date">1 day ago</div>
                </div>
              </div>
              <div className="doc-comment-input-wrapper">
                <input type="text" placeholder="Add a comment..." className="doc-comment-input" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <>
          <div
            className="doc-context-overlay"
            {...dismissOverlay(() => setShowContextMenu(null))}
          />
          <div
            className="doc-context-menu"
            style={{ top: showContextMenu.y, left: showContextMenu.x }}
          >
            <button className="doc-context-item">
              <Download size={14} />
              Download
            </button>
            <button className="doc-context-item">
              <Edit size={14} />
              Rename
            </button>
            <button className="doc-context-item">
              <Move size={14} />
              Move
            </button>
            <button className="doc-context-item">
              <Star size={14} />
              Add to Favorites
            </button>
            <button className="doc-context-item">
              <Tag size={14} />
              Add Tags
            </button>
            <div className="doc-context-divider" />
            <button className="doc-context-item doc-context-item-danger">
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
const FileIcon = File;
export default DocumentsPage;
