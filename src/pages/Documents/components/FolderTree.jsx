import React from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  File,
  Image,
  FileSpreadsheet,
  ChevronRight,
  ChevronDown,
  Edit2,
  Trash2,
} from 'lucide-react';

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

/** Reusable Folder Tree component for hierarchy rendering and actions */
export function FolderTree({
  folders,
  filesState,
  expandedFolders,
  toggleFolder,
  selectedFolder,
  setSelectedFolder,
  selectedFile,
  onSelectFile,
  searchQuery,
  onEditDocument,
  onDeleteDocument,
  level = 0,
}) {
  const renderFolderFiles = (folderId, currentLevel) => {
    const folderFiles = filesState.filter((f) =>
      f.folderId === folderId &&
      (searchQuery ? f.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
    );

    return folderFiles.map((file) => {
      const FileIconCard = getFileIcon(file.type);
      const isSelected = selectedFile?.id === file.id;

      return (
        <div
          key={file.id}
          className={`doc-file-row-item ${isSelected ? 'active' : ''}`}
          style={{ paddingLeft: `${(currentLevel + 1) * 16 + 8}px` }}
          onClick={() => onSelectFile(file)}
        >
          <FileIconCard size={14} className={`doc-file-row-icon ${file.type}`} />
          <span className="doc-file-row-name" title={file.name}>
            {file.name}
          </span>
          <div className="doc-file-actions-group">
            <button
              className="action-icon-btn edit"
              onClick={(e) => {
                e.stopPropagation();
                onEditDocument(file, 'file');
              }}
              title="Edit / Update File"
            >
              <Edit2 size={13} />
            </button>
            <button
              className="action-icon-btn delete"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteDocument(file.id, file.name);
              }}
              title="Delete File"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <>
      {folders.map((folder) => {
        const isExpanded = expandedFolders.has(folder.id);
        const isSelected = selectedFolder === folder.id;
        const hasChildren = folder.children && folder.children.length > 0;

        const folderFiles = filesState.filter((f) =>
          f.folderId === folder.id &&
          (searchQuery ? f.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
        );
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
                {folderFiles.length +
                  (folder.children
                    ? folder.children.reduce((acc, c) => acc + (c.fileCount || 0), 0)
                    : 0)}
              </span>
              {folder.id !== 'root' && (
                <div className="doc-folder-actions">
                  <button
                    className="action-icon-btn edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditDocument(folder, 'folder');
                    }}
                    title="Edit / Update Folder"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    className="action-icon-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDocument(folder.id, folder.name);
                    }}
                    title="Delete Folder"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>

            {isExpanded && (
              <div className="doc-folder-children">
                {hasChildren && (
                  <FolderTree
                    folders={folder.children}
                    filesState={filesState}
                    expandedFolders={expandedFolders}
                    toggleFolder={toggleFolder}
                    selectedFolder={selectedFolder}
                    setSelectedFolder={setSelectedFolder}
                    selectedFile={selectedFile}
                    onSelectFile={onSelectFile}
                    searchQuery={searchQuery}
                    onEditDocument={onEditDocument}
                    onDeleteDocument={onDeleteDocument}
                    level={level + 1}
                  />
                )}
                {renderFolderFiles(folder.id, level)}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

export default FolderTree;
