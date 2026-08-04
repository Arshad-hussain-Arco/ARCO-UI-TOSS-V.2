import { useCallback, useState, useEffect } from 'react';
import {
  FileText,
  File,
  Image,
  FileSpreadsheet,
  ChevronRight,
  Minimize2,
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { DetailSkeleton } from '@components/feedback/Skeleton';
import toast from 'react-hot-toast';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { documentService } from '@services/documentService';

import { FolderSidebar } from './components/FolderSidebar';
import { DocumentViewer } from './components/DocumentViewer';
import { AddFolderModal } from './components/AddFolderModal';
import { UploadFileModal } from './components/UploadFileModal';

import './DocumentsPage.css';

function getFileIcon(type) {
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
}

/** Document library: folder tree, file table and inline preview. */
export function DocumentsPage() {
  useDocumentTitle('Documents');

  const fetchDocuments = useCallback(() => documentService.getDocuments(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchDocuments);

  // Local React state for data to make additions/uploads/deletes interactive
  const [folderTreeState, setFolderTreeState] = useState([]);
  const [filesState, setFilesState] = useState([]);

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

  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [showUploadFileModal, setShowUploadFileModal] = useState(false);

  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');

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

  const handlePrint = () => {
    if (selectedFile) {
      window.print();
    }
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
    return <ErrorState title="Documents could not be loaded" description={error.message} onRetry={refetch} />;
  }

  if (isLoading || !data) {
    return (
      <div className="doc-page">
        <div className="doc-workspace-container" style={{ padding: 20 }}>
          <DetailSkeleton sidebarRows={8} />
        </div>
      </div>
    );
  }

  return (
    <div className={`doc-page ${isFullscreen ? 'doc-page-fullscreen' : ''}`}>
      <div className="doc-workspace-container">
        <div className={`doc-left-workspace ${isFullscreen ? 'doc-left-fullscreen' : ''}`}>
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

          <DocumentViewer
            selectedFile={selectedFile}
            getFileIcon={getFileIcon}
            pdfZoom={pdfZoom}
            setPdfZoom={setPdfZoom}
            isFullscreen={isFullscreen}
            setIsFullscreen={setIsFullscreen}
            onPrint={handlePrint}
            onDeselect={() => setSelectedFile(null)}
          />
        </div>

        <FolderSidebar
          folderTreeState={folderTreeState}
          filesState={filesState}
          expandedFolders={expandedFolders}
          selectedFolder={selectedFolder}
          selectedFile={selectedFile}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFileClick={setSelectedFile}
          onDeleteFile={handleDeleteFile}
          getFileIcon={getFileIcon}
          onSelectFolder={setSelectedFolder}
          onToggleFolder={toggleFolder}
          onAddFolder={() => setShowAddFolderModal(true)}
          onUploadFile={() => setShowUploadFileModal(true)}
        />
      </div>

      <AddFolderModal
        isOpen={showAddFolderModal}
        onClose={() => setShowAddFolderModal(false)}
        name={newFolderName}
        setName={setNewFolderName}
        description={newFolderDescription}
        setDescription={setNewFolderDescription}
        onSubmit={handleCreateFolder}
      />

      <UploadFileModal
        isOpen={showUploadFileModal}
        onClose={() => setShowUploadFileModal(false)}
        fileName={newFileName}
        setFileName={setNewFileName}
        description={newFileDescription}
        setDescription={setNewFileDescription}
        uploadedFileObject={uploadedFileObject}
        setUploadedFileObject={setUploadedFileObject}
        onSubmit={handleUploadFile}
      />
    </div>
  );
}

export default DocumentsPage;
