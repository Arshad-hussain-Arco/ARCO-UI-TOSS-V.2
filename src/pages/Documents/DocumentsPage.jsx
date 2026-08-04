import React, { useCallback, useState, useEffect } from 'react';
import {
  Upload,
  FolderPlus,
  Search,
  ChevronRight,
  X,
  Minimize2,
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Breadcrumb } from '@components/navigation/Breadcrumb/Breadcrumb';
import toast from 'react-hot-toast';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { documentService } from '@services/documentService';

import { FolderTree } from './components/FolderTree';
import { DocumentViewer } from './components/DocumentViewer';
import { AddFolderModal, UploadFileModal, EditDocumentModal } from './components/DocumentModals';

import './DocumentsPage.css';

/** Document library: folder tree, file table, inline viewer & CRUD management. */
export function DocumentsPage() {
  useDocumentTitle('Documents');

  const fetchDocuments = useCallback(() => documentService.getDocuments(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchDocuments);

  // Local React state for folders and files
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
    new Set(['root', 'project-docs', 'q1-releases'])
  );
  const [selectedFolder, setSelectedFolder] = useState('root');
  const [selectedFile, setSelectedFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pdfZoom, setPdfZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Modals visibility states
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [showUploadFileModal, setShowUploadFileModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Edit target state
  const [editTarget, setEditTarget] = useState(null);
  const [editTargetType, setEditTargetType] = useState('file');

  const toggleFolder = (folderId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleSelectFile = (file) => {
    setSelectedFile(file);
  };

  const handleEditDocument = (docItem, type) => {
    setEditTarget(docItem);
    setEditTargetType(type);
    setShowEditModal(true);
  };

  const handleDeleteDocument = async (id, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name || 'this item'}"?`)) {
      return;
    }

    try {
      await documentService.deleteDocument(id);
      toast.success('Document deleted successfully');
      if (selectedFile?.id === id) {
        setSelectedFile(null);
      }
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete document');
    }
  };

  const getBreadcrumbs = () => {
    const handleCloseFile = () => setSelectedFile(null);

    const crumbs = [
      {
        label: 'Documents',
        onClick: () => {
          setSelectedFolder('root');
          setSelectedFile(null);
        },
      },
    ];

    if (selectedFolder && selectedFolder !== 'root') {
      const findFolderChain = (folders, targetId, currentChain = []) => {
        for (const f of folders) {
          const newChain = [
            ...currentChain,
            {
              label: f.name,
              onClick: () => {
                setSelectedFolder(f.id);
                setSelectedFile(null);
              },
            },
          ];
          if (f.id === targetId) return newChain;
          if (f.children && f.children.length > 0) {
            const found = findFolderChain(f.children, targetId, newChain);
            if (found) return found;
          }
        }
        return null;
      };
      const chain = findFolderChain(folderTreeState, selectedFolder);
      if (chain) crumbs.push(...chain);
    }

    if (selectedFile) {
      crumbs.push({
        label: selectedFile.name,
        onClose: handleCloseFile,
      });
    }

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
    <div className={`doc-page ${isFullscreen ? 'doc-page-fullscreen' : ''}`}>
      {/* App-Wide Breadcrumb Header Bar */}
      {!isFullscreen && <Breadcrumb items={getBreadcrumbs()} />}

      {/* Main split container */}
      <div className="doc-workspace-container">
        {/* Left Column: Fluid Workspace & Preview Panel */}
        <div className={`doc-left-workspace ${isFullscreen ? 'doc-left-fullscreen' : ''}`}>
          {isFullscreen && (
            <div className="doc-workspace-top-bar" style={{ justifyContent: 'flex-end' }}>
              <button
                className="doc-preview-icon-btn fullscreen-close-btn"
                onClick={() => setIsFullscreen(false)}
                title="Exit Fullscreen"
              >
                <Minimize2 size={16} />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          )}
          {selectedFile ? (
            /* Integrated Document Viewer (Fetches live file content by ID) */
            <DocumentViewer selectedFile={selectedFile} pdfZoom={pdfZoom} />
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
                Explore folder paths, perform instant search, preview live SFTP file content, and manage document versions.
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
                onClick={() => setShowAddFolderModal(true)}
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

          {/* Reusable Folder & Files Tree Hierarchy */}
          <div className="doc-sidebar-section">
            <div className="doc-section-header">
              <span>Workspace Navigation</span>
            </div>
            <div className="doc-folder-tree-wrapper">
              <FolderTree
                folders={folderTreeState}
                filesState={filesState}
                expandedFolders={expandedFolders}
                toggleFolder={toggleFolder}
                selectedFolder={selectedFolder}
                setSelectedFolder={setSelectedFolder}
                selectedFile={selectedFile}
                onSelectFile={handleSelectFile}
                searchQuery={searchQuery}
                onEditDocument={handleEditDocument}
                onDeleteDocument={handleDeleteDocument}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddFolderModal
        isOpen={showAddFolderModal}
        onClose={() => setShowAddFolderModal(false)}
        selectedFolder={selectedFolder}
        onSuccess={refetch}
      />

      <UploadFileModal
        isOpen={showUploadFileModal}
        onClose={() => setShowUploadFileModal(false)}
        selectedFolder={selectedFolder}
        onSuccess={refetch}
      />

      <EditDocumentModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        targetDocument={editTarget}
        targetType={editTargetType}
        onSuccess={refetch}
      />
    </div>
  );
}

export default DocumentsPage;
