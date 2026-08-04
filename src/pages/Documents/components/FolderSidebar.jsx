import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, Search, Trash2, Upload, X } from 'lucide-react';

function FolderFiles({ folderId, level, filesState, searchQuery, selectedFile, onFileClick, onDeleteFile, getFileIcon }) {
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
        onClick={() => onFileClick(file)}
      >
        <FileIconCard size={14} className={`doc-file-row-icon ${file.type}`} />
        <span className="doc-file-row-name" title={file.name}>{file.name}</span>
        <button
          className="doc-file-row-delete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteFile(file.id);
          }}
          title="Delete File"
        >
          <Trash2 size={13} />
        </button>
      </div>
    );
  });
}

function FolderTree({ folders, level = 0, expandedFolders, selectedFolder, filesState, searchQuery, selectedFile, onFileClick, onDeleteFile, getFileIcon, onSelectFolder, onToggleFolder }) {
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
            onSelectFolder(folder.id);
            if (showExpandableIndicator) onToggleFolder(folder.id);
          }}
        >
          {showExpandableIndicator ? (
            <button
              className="doc-folder-toggle"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFolder(folder.id);
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
            {hasChildren && (
              <FolderTree
                folders={folder.children}
                level={level + 1}
                expandedFolders={expandedFolders}
                selectedFolder={selectedFolder}
                filesState={filesState}
                searchQuery={searchQuery}
                selectedFile={selectedFile}
                onFileClick={onFileClick}
                onDeleteFile={onDeleteFile}
                getFileIcon={getFileIcon}
                onSelectFolder={onSelectFolder}
                onToggleFolder={onToggleFolder}
              />
            )}
            <FolderFiles
              folderId={folder.id}
              level={level}
              filesState={filesState}
              searchQuery={searchQuery}
              selectedFile={selectedFile}
              onFileClick={onFileClick}
              onDeleteFile={onDeleteFile}
              getFileIcon={getFileIcon}
            />
          </div>
        )}
      </div>
    );
  });
}

export function FolderSidebar({
  folderTreeState,
  filesState,
  expandedFolders,
  selectedFolder,
  selectedFile,
  searchQuery,
  onSearchChange,
  onFileClick,
  onDeleteFile,
  getFileIcon,
  onSelectFolder,
  onToggleFolder,
  onAddFolder,
  onUploadFile,
}) {
  return (
    <div className="doc-right-sidebar">
      <div className="doc-sidebar-sticky-header">
        <div className="doc-sidebar-actions-row">
          <button className="doc-sidebar-btn primary" onClick={onAddFolder} title="Create a new folder node">
            <FolderPlus size={15} />
            <span>+ Folder</span>
          </button>
          <button className="doc-sidebar-btn secondary" onClick={onUploadFile} title="Upload document file">
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
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button className="doc-search-clear-btn" onClick={() => onSearchChange('')}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="doc-sidebar-section">
        <div className="doc-section-header">
          <span>Workspace Navigation</span>
        </div>
        <div className="doc-folder-tree-wrapper">
          <FolderTree
            folders={folderTreeState}
            expandedFolders={expandedFolders}
            selectedFolder={selectedFolder}
            filesState={filesState}
            searchQuery={searchQuery}
            selectedFile={selectedFile}
            onFileClick={onFileClick}
            onDeleteFile={onDeleteFile}
            getFileIcon={getFileIcon}
            onSelectFolder={onSelectFolder}
            onToggleFolder={onToggleFolder}
          />
        </div>
      </div>
    </div>
  );
}

export default FolderSidebar;
