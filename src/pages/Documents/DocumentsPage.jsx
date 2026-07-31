import { useCallback, useState, useEffect } from 'react';
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
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  X,
  Maximize2,
  Minimize2,
  Printer
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import toast from 'react-hot-toast';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { documentService } from '@services/documentService';

import './DocumentsPage.css';
import { activatable } from '@utils/interactive';

/** Document library: folder tree, file table and inline preview. */
export function DocumentsPage() {
  useDocumentTitle('Documents');

  const fetchDocuments = useCallback(() => documentService.getDocuments(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchDocuments);

  // Local React state for data to make additions/uploads/deletes interactive
  const [folderTreeState, setFolderTreeState] = useState([]);
  const [filesState, setFilesState] = useState([]);

  // Load initial data
  useEffect(() => {
    if (data) {
      setFolderTreeState(data.folderTree ?? []);
      setFilesState(data.files ?? []);
    }
  }, [data]);

  const [expandedFolders, setExpandedFolders] = useState(
    new Set(['root', 'project-docs', 'q1-releases']),
  );
  const [selectedFolder, setSelectedFolder] = useState('root');
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pdfZoom, setPdfZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modals visibility states
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [showUploadFileModal, setShowUploadFileModal] = useState(false);

  // New Folder Form States
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');

  // New File Form States
  const [newFileName, setNewFileName] = useState('');
  const [newFileDescription, setNewFileDescription] = useState('');
  const [uploadedFileObject, setUploadedFileObject] = useState(null);

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
  };

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

  // Helper function to add a folder to the parent node inside folderTreeState
  const addFolderToTree = (nodes, parentId, newFolder) => {
    return nodes.map(node => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...(node.children || []), newFolder]
        };
      }
      if (node.children) {
        return {
          ...node,
          children: addFolderToTree(node.children, parentId, newFolder)
        };
      }
      return node;
    });
  };

  // Form Submits: Add Folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      await documentService.createFolder({
        name: newFolderName.trim(),
        description: newFolderDescription.trim(),
        parentId: selectedFolder,
      });
      toast.success('Folder created successfully');
      setExpandedFolders(prev => new Set([...prev, selectedFolder]));
      setShowAddFolderModal(false);
      setNewFolderName('');
      setNewFolderDescription('');
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create folder');
    }
  };

  // Form Submits: Upload File
  const handleUploadFile = async (e) => {
    e.preventDefault();
    if (!uploadedFileObject) {
      toast.error('Please select a file to upload');
      return;
    }

    try {
      await documentService.uploadFile({
        file: uploadedFileObject,
        title: newFileName.trim(),
        description: newFileDescription.trim(),
        folderId: selectedFolder,
      });
      toast.success('File uploaded successfully');
      setShowUploadFileModal(false);
      setNewFileName('');
      setNewFileDescription('');
      setUploadedFileObject(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to upload file');
    }
  };

  // Actions: Delete File
  const handleDeleteFile = async (fileId) => {
    try {
      await documentService.deleteDocument(fileId);
      toast.success('Document deleted successfully');
      if (selectedFile?.id === fileId) {
        setSelectedFile(null);
      }
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete document');
    }
  };

  // Actions: Print Document
  const handlePrint = () => {
    if (selectedFile) {
      window.print();
    }
  };

  const openAddFolderModal = () => {
    setShowAddFolderModal(true);
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

  // Render file row inline under expanded folder node
  const renderFolderFiles = (folderId, level) => {
    const folderFiles = filesState.filter(f => f.folderId === folderId && (
      searchQuery ? f.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
    ));

    return folderFiles.map(file => {
      const FileIconCard = getFileIcon(file.type);
      const isSelected = selectedFile?.id === file.id;
      return (
        <div
          key={file.id}
          className={`doc-file-row-item ${isSelected ? 'active' : ''}`}
          style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
          onClick={() => handleFileClick(file)}
        >
          <FileIconCard size={14} className={`doc-file-row-icon ${file.type}`} />
          <span className="doc-file-row-name" title={file.name}>{file.name}</span>
          <button
            className="doc-file-row-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteFile(file.id);
            }}
            title="Delete File"
          >
            <Trash2 size={13} />
          </button>
        </div>
      );
    });
  };

  // Render collapsible folder tree list
  const renderFolderTree = (folders, level = 0) => {
    return folders.map((folder) => {
      const isExpanded = expandedFolders.has(folder.id);
      const isSelected = selectedFolder === folder.id;
      const hasChildren = folder.children && folder.children.length > 0;
      
      const folderFiles = filesState.filter(f => f.folderId === folder.id && (
        searchQuery ? f.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
      ));
      const hasFiles = folderFiles.length > 0;
      const showExpandableIndicator = hasChildren || hasFiles;

      return (
        <div key={folder.id} className="doc-folder-item">
          <div
            className={`doc-folder-row ${isSelected ? 'doc-folder-selected' : ''}`}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              setSelectedFolder(folder.id);
              if (showExpandableIndicator) toggleFolder(folder.id);
            }}
          >
            {showExpandableIndicator ? (
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
            <span className="doc-folder-count">
              {folderFiles.length + (folder.children ? folder.children.reduce((acc, c) => acc + c.fileCount, 0) : 0)}
            </span>
          </div>
          {isExpanded && (
            <div className="doc-folder-children">
              {/* Sub-folders first */}
              {hasChildren && renderFolderTree(folder.children, level + 1)}
              {/* Folder inline files next */}
              {renderFolderFiles(folder.id, level)}
            </div>
          )}
        </div>
      );
    });
  };

  const renderFilePreview = (file) => {
    switch (file.type) {
      case 'pdf':
        return (
          <div className="doc-pdf-viewer">
            <div className="doc-pdf-page">
              <div className="doc-pdf-content">
                <h2 className="doc-pdf-doc-title">{file.name.replace('.pdf', '')}</h2>
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
        );
      case 'docx':
        return (
          <div className="doc-docx-viewer">
            <div className="doc-docx-page">
              <div className="doc-docx-content">
                <h1 className="doc-docx-title">{file.name.replace('.docx', '')}</h1>
                <p className="doc-docx-meta">Owner: {file.owner} | Last Modified: {file.lastModified}</p>
                
                <h3>1. Project Scope & Purpose</h3>
                <p>
                  This project document serves as the master blueprint for the Q1 releases lifecycle. The primary objectives are to optimize platform execution speeds, standardize client dashboard pages, and deploy automated reconciliation flows.
                </p>

                <h3>2. Key Delivery Milestones</h3>
                <ul>
                  <li><strong>Milestone A:</strong> Complete refactoring of client role authentication checks (Target: Jan 20).</li>
                  <li><strong>Milestone B:</strong> Implement leaves balance settings UI overrides with complete mobile scrolling grids (Target: Feb 2).</li>
                  <li><strong>Milestone C:</strong> Staging verification and consultant analytics dashboard launch (Target: Feb 18).</li>
                </ul>

                <h3>3. Operations & Team Alignment</h3>
                <p>
                  Squad leaders are requested to sync daily on pending pull requests. Design frameworks must adhere closely to established CSS tokens to maintain layout integrity. Please report index compilation issues to DB Admins immediately.
                </p>
              </div>
            </div>
          </div>
        );
      case 'xlsx':
        return (
          <div className="doc-xlsx-viewer">
            <div className="doc-xlsx-grid-wrapper">
              <div className="doc-xlsx-sheet-header">
                <span className="doc-xlsx-sheet-title">Sheet1</span>
                <span className="doc-xlsx-sheet-plus">+</span>
              </div>
              <table className="doc-xlsx-table">
                <thead>
                  <tr>
                    <th className="row-number-th"></th>
                    <th>A</th>
                    <th>B</th>
                    <th>C</th>
                    <th>D</th>
                    <th>E</th>
                    <th>F</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="row-number-td">1</td>
                    <td className="doc-xlsx-cell header-cell" colSpan={6} style={{ textAlign: 'center', fontWeight: 'bold', backgroundColor: '#e2e8f0' }}>Budget & Resource Scaling Forecast</td>
                  </tr>
                  <tr>
                    <td className="row-number-td">2</td>
                    <td className="doc-xlsx-cell label-cell"><strong>Item Description</strong></td>
                    <td className="doc-xlsx-cell label-cell"><strong>Category</strong></td>
                    <td className="doc-xlsx-cell number-cell"><strong>Q1</strong></td>
                    <td className="doc-xlsx-cell number-cell"><strong>Q2</strong></td>
                    <td className="doc-xlsx-cell number-cell"><strong>Q3</strong></td>
                    <td className="doc-xlsx-cell number-cell"><strong>Total</strong></td>
                  </tr>
                  <tr>
                    <td className="row-number-td">3</td>
                    <td className="doc-xlsx-cell">Compute Cloud Nodes</td>
                    <td className="doc-xlsx-cell">Infrastructure</td>
                    <td className="doc-xlsx-cell number-cell">₹1.2 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹1.2 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹0.8 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹3.2 Cr</td>
                  </tr>
                  <tr>
                    <td className="row-number-td">4</td>
                    <td className="doc-xlsx-cell">Database Storage Cluster</td>
                    <td className="doc-xlsx-cell">Infrastructure</td>
                    <td className="doc-xlsx-cell number-cell">₹0.6 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹0.6 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹0.4 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹1.6 Cr</td>
                  </tr>
                  <tr>
                    <td className="row-number-td">5</td>
                    <td className="doc-xlsx-cell">Engineering Personnel</td>
                    <td className="doc-xlsx-cell">Staffing</td>
                    <td className="doc-xlsx-cell number-cell">₹1.8 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹1.8 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹1.8 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹5.4 Cr</td>
                  </tr>
                  <tr>
                    <td className="row-number-td">6</td>
                    <td className="doc-xlsx-cell">Software Licensing & Dev Tools</td>
                    <td className="doc-xlsx-cell">Licenses</td>
                    <td className="doc-xlsx-cell number-cell">₹0.4 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹0.2 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹0.2 Cr</td>
                    <td className="doc-xlsx-cell number-cell">₹0.8 Cr</td>
                  </tr>
                  <tr className="total-row">
                    <td className="row-number-td">7</td>
                    <td className="doc-xlsx-cell"><strong>Total Estimated Budget</strong></td>
                    <td className="doc-xlsx-cell"><strong>All Categories</strong></td>
                    <td className="doc-xlsx-cell number-cell"><strong>₹4.0 Cr</strong></td>
                    <td className="doc-xlsx-cell number-cell"><strong>₹3.8 Cr</strong></td>
                    <td className="doc-xlsx-cell number-cell"><strong>₹3.2 Cr</strong></td>
                    <td className="doc-xlsx-cell number-cell"><strong>₹11.0 Cr</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'png':
        return (
          <div className="doc-png-viewer">
            <div className="doc-png-canvas">
              <span className="doc-png-canvas-title">System Architecture Blueprint</span>
              <svg width="100%" height="260" viewBox="0 0 600 260" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Client Layer */}
                <rect x="30" y="90" width="100" height="50" rx="6" fill="#F8FAFC" stroke="#0f766e" strokeWidth="2"/>
                <text x="80" y="120" textAnchor="middle" fill="#0f766e" fontSize="12" fontWeight="600">Client Apps</text>
                
                {/* Flow Arrow */}
                <path d="M130 115H170" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/>
                <polygon points="170,111 178,115 170,119" fill="#94A3B8" />

                {/* Gateway Layer */}
                <rect x="180" y="90" width="100" height="50" rx="6" fill="#E6F4ED" stroke="#115E59" strokeWidth="2"/>
                <text x="230" y="120" textAnchor="middle" fill="#115E59" fontSize="12" fontWeight="600">API Gateway</text>
                
                {/* Flow Arrow */}
                <path d="M280 115H320" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/>
                <polygon points="320,111 328,115 320,119" fill="#94A3B8"/>

                {/* Microservice Layer */}
                <rect x="330" y="90" width="100" height="50" rx="6" fill="#F8FAFC" stroke="#0f766e" strokeWidth="2"/>
                <text x="380" y="120" textAnchor="middle" fill="#0f766e" fontSize="12" fontWeight="600">Services Layer</text>

                {/* Flow Arrow */}
                <path d="M430 115H470" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round"/>
                <polygon points="470,111 478,115 470,119" fill="#94A3B8"/>

                {/* DB Layer */}
                <rect x="480" y="70" width="90" height="90" rx="6" fill="#F0FDF4" stroke="#15803D" strokeWidth="2"/>
                <text x="525" y="110" textAnchor="middle" fill="#15803D" fontSize="12" fontWeight="600">Database</text>
                <text x="525" y="130" textAnchor="middle" fill="#6B7280" fontSize="10">Cluster (Postgres)</text>
              </svg>
              <div className="doc-png-legend">
                <span className="legend-item"><span className="legend-dot green"></span>Secure Gateway</span>
                <span className="legend-item"><span className="legend-dot teal"></span>Auth & Route APIs</span>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="doc-preview-placeholder">
            <FileIcon size={48} className="doc-preview-placeholder-icon" />
            <p className="doc-preview-placeholder-text">Preview not available for this file type</p>
          </div>
        );
    }
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
    <div className={`doc-page ${isFullscreen ? 'doc-page-fullscreen' : ''}`}>
      {/* Main split container */}
      <div className="doc-workspace-container">
        {/* Left Column: Fluid Workspace & Preview Panel */}
        <div className={`doc-left-workspace ${isFullscreen ? 'doc-left-fullscreen' : ''}`}>
          {/* Breadcrumbs Top Bar */}
          <div className="doc-workspace-top-bar">
            <div className="doc-breadcrumb">
              {getBreadcrumbs().map((crumb, idx) => (
                <span key={idx} className="doc-breadcrumb-item">
                  {idx > 0 && <ChevronRight size={12} className="doc-breadcrumb-separator" />}
                  {crumb}
                </span>
              ))}
            </div>
            {isFullscreen && (
              <button
                className="doc-preview-icon-btn fullscreen-close-btn"
                onClick={() => setIsFullscreen(false)}
                title="Exit Fullscreen"
              >
                <Minimize2 size={16} />
                <span>Exit Fullscreen</span>
              </button>
            )}
          </div>

          {selectedFile ? (
            /* Document Preview Content */
            <div className="doc-viewer-panel">
              {/* Document Header Controls */}
              <div className="doc-viewer-header">
                <div className="doc-viewer-title-area">
                  {(() => {
                    const FileIcon2 = getFileIcon(selectedFile.type);
                    return <FileIcon2 size={20} className="doc-viewer-file-icon" />;
                  })()}
                  <div className="doc-viewer-title-wrapper">
                    <span className="doc-viewer-title">{selectedFile.name}</span>
                  </div>
                </div>

                <div className="doc-viewer-controls">
                  {/* Zoom controls */}
                  <div className="doc-viewer-zoom-group">
                    <button
                      className="doc-viewer-ctrl-btn"
                      onClick={() => setPdfZoom(Math.max(50, pdfZoom - 10))}
                      title="Zoom Out"
                    >
                      <ZoomOut size={16} />
                    </button>
                    <span className="doc-zoom-text">{pdfZoom}%</span>
                    <button
                      className="doc-viewer-ctrl-btn"
                      onClick={() => setPdfZoom(Math.min(200, pdfZoom + 10))}
                      title="Zoom In"
                    >
                      <ZoomIn size={16} />
                    </button>
                  </div>

                  <div className="doc-viewer-action-group">
                    <button className="doc-viewer-ctrl-btn" title="Print Document" onClick={handlePrint}>
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
                    <button
                      className="doc-viewer-ctrl-btn close-btn"
                      onClick={() => setSelectedFile(null)}
                      title="Deselect"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Viewer Body Preview Content */}
              <div className="doc-viewer-body" style={{ fontSize: `${pdfZoom}%` }}>
                {renderFilePreview(selectedFile)}
              </div>
            </div>
          ) : (
            /* Empty State Panel */
            <div className="doc-empty-state-panel">
              <div className="doc-empty-state-graphic">
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="25" y="20" width="70" height="80" rx="8" fill="#F3F4F6" stroke="#D1D5DB" strokeWidth="2"/>
                  <rect x="35" y="35" width="50" height="6" rx="3" fill="#E5E7EB"/>
                  <rect x="35" y="50" width="50" height="6" rx="3" fill="#E5E7EB"/>
                  <rect x="35" y="65" width="35" height="6" rx="3" fill="#E5E7EB"/>
                  <circle cx="85" cy="85" r="20" fill="#E6F4ED" stroke="#115E59" strokeWidth="2"/>
                  <path d="M80 80L90 90" stroke="#115E59" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M85 75V95" stroke="#115E59" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M75 85H95" stroke="#115E59" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h2 className="doc-empty-state-title">Select a file from the sidebar to view details</h2>
              <p className="doc-empty-state-text">
                Explore folder paths, perform instant search, and preview PDF, DOCX, XLSX, and Image contents in real-time.
              </p>
            </div>
          )}
        </div>

        {/* Right Fixed Column Sidebar: Control & Workspace Navigation */}
        <div className="doc-right-sidebar">
          {/* Sticky Actions & Search Block */}
          <div className="doc-sidebar-sticky-header">
            <div className="doc-sidebar-actions-row">
              <button
                className="doc-sidebar-btn primary"
                onClick={openAddFolderModal}
                title="Create a new folder node"
              >
                <FolderPlus size={15} />
                <span>+ Folder</span>
              </button>
              <button
                className="doc-sidebar-btn secondary"
                onClick={() => setShowUploadFileModal(true)}
                title="Upload document file"
              >
                <Upload size={15} />
                <span>Upload File</span>
              </button>
            </div>
            <div className="doc-sidebar-search-row">
              <Search size={14} className="doc-search-icon-sidebar" />
              <input
                type="text"
                placeholder="Search folders & files..."
                className="doc-sidebar-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="doc-search-clear-btn" onClick={() => setSearchQuery('')}>
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Folder & Files Tree Hierarchy */}
          <div className="doc-sidebar-section">
            <div className="doc-section-header">
              <span>Workspace Navigation</span>
            </div>
            <div className="doc-folder-tree-wrapper">
              {renderFolderTree(folderTreeState)}
            </div>
          </div>
        </div>
      </div>

      {/* Add New Folder Modal */}
      {showAddFolderModal && (
        <div className="doc-modal-overlay">
          <div className="doc-modal-container">
            <div className="doc-modal-header">
              <h3>Create New Folder</h3>
              <button className="doc-modal-close-btn" onClick={() => setShowAddFolderModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateFolder}>
              <div className="doc-modal-body">
                <div className="doc-form-group">
                  <label htmlFor="folder-name" className="doc-form-label required">Folder Name</label>
                  <input
                    id="folder-name"
                    type="text"
                    required
                    className="doc-form-input"
                    placeholder="e.g. Q2 Plans"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="doc-form-group">
                  <label htmlFor="folder-desc" className="doc-form-label">Description (Optional)</label>
                  <textarea
                    id="folder-desc"
                    rows={3}
                    className="doc-form-textarea"
                    placeholder="Describe the folder contents..."
                    value={newFolderDescription}
                    onChange={(e) => setNewFolderDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="doc-modal-footer">
                <button type="button" className="doc-modal-btn ghost" onClick={() => setShowAddFolderModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="doc-modal-btn primary">
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadFileModal && (
        <div className="doc-modal-overlay">
          <div className="doc-modal-container">
            <div className="doc-modal-header">
              <h3>Upload Document File</h3>
              <button className="doc-modal-close-btn" onClick={() => setShowUploadFileModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadFile}>
              <div className="doc-modal-body">
                <div className="doc-form-group">
                  <label htmlFor="file-upload-input" className="doc-form-label required">Select or Drag File</label>
                  <div
                    className="doc-upload-dropzone"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        const fileObj = e.dataTransfer.files[0];
                        setUploadedFileObject(fileObj);
                        setNewFileName(fileObj.name);
                      }
                    }}
                  >
                    <Upload size={32} className="doc-dropzone-icon" />
                    <p className="doc-dropzone-text">
                      Drag & drop your file here, or <span className="doc-drop-link">browse</span>
                    </p>
                    <input
                      id="file-upload-input"
                      type="file"
                      className="doc-hidden-file-input"
                      onChange={e => {
                        if (e.target.files && e.target.files[0]) {
                          const fileObj = e.target.files[0];
                          setUploadedFileObject(fileObj);
                          setNewFileName(fileObj.name);
                        }
                      }}
                    />
                    {uploadedFileObject && (
                      <div className="doc-uploaded-status-badge">
                        <FileText size={14} />
                        <span>{uploadedFileObject.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="doc-form-group">
                  <label htmlFor="file-name-input" className="doc-form-label">Display File Name</label>
                  <input
                    id="file-name-input"
                    type="text"
                    className="doc-form-input"
                    placeholder="e.g. Architecture_Diagram.png"
                    value={newFileName}
                    onChange={(e) => setNewFileName(e.target.value)}
                  />
                </div>

                <div className="doc-form-group">
                  <label htmlFor="file-desc-input" className="doc-form-label">Description</label>
                  <textarea
                    id="file-desc-input"
                    rows={3}
                    className="doc-form-textarea"
                    placeholder="File description or comments..."
                    value={newFileDescription}
                    onChange={(e) => setNewFileDescription(e.target.value)}
                  />
                </div>
              </div>
              <div className="doc-modal-footer">
                <button type="button" className="doc-modal-btn ghost" onClick={() => setShowUploadFileModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="doc-modal-btn primary">
                  Upload File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
const FileIcon = File;
export default DocumentsPage;
