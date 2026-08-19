import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

/**
 * Builds a hierarchical folder tree and a flat files array from the flat list of Documents.
 */
function parseDocuments(data) {
  const foldersMap = new Map(); // pid -> folder node
  const folderTree = [];
  const files = [];

  // First pass: identify and create folder objects
  data.forEach((doc) => {
    // If file_name is empty/null, it's a folder
    if (!doc.file_name) {
      const folderNode = {
        id: String(doc.id),
        name: doc.document_title,
        fileCount: 0,
        parentId: doc.pid ? String(doc.pid) : 'root',
        children: [],
        description: doc.document_description,
        raw: doc,
      };
      foldersMap.set(folderNode.id, folderNode);
    }
  });

  // Second pass: attach folders to parents and process files
  data.forEach((doc) => {
    if (!doc.file_name) {
      // It's a folder. If it has a parent, attach it.
      if (doc.pid) {
        const parentId = String(doc.pid);
        const parentFolder = foldersMap.get(parentId);
        if (parentFolder) {
          parentFolder.children.push(foldersMap.get(String(doc.id)));
        } else {
          // If parent not found, attach to root for fallback
          folderTree.push(foldersMap.get(String(doc.id)));
        }
      } else {
        folderTree.push(foldersMap.get(String(doc.id)));
      }
    } else {
      // It's a file
      const parentId = doc.pid ? String(doc.pid) : 'root';
      const fileExt = doc.file_name.split('.').pop().toLowerCase();
      files.push({
        id: String(doc.id),
        name: doc.document_title || doc.file_name,
        title: doc.document_title || doc.file_name,
        fileName: doc.file_name,
        type: fileExt,
        size: 'Unknown', // Not provided by DB, UI can mock or ignore
        owner: 'System', // Not provided by DB
        lastModified: new Date().toLocaleString(), // Not provided by DB
        tags: [],
        permission: 'edit',
        favorite: false,
        folderId: parentId,
        description: doc.document_description,
        raw: doc,
      });

      // Increment parent's file count
      if (foldersMap.has(parentId)) {
        foldersMap.get(parentId).fileCount += 1;
      }
    }
  });

  const rootNode = {
    id: 'root',
    name: 'Root Folder',
    fileCount: files.filter((f) => f.folderId === 'root').length,
    children: folderTree,
  };

  return {
    folderTree: [rootNode],
    files,
  };
}

export const documentService = {
  getDocuments: async () => {
    const response = await httpClient.get(endpoints.documents.list);
    const data = Array.isArray(response.data) ? response.data : response.data.results || [];
    return parseDocuments(data);
  },

  getDocumentContent: async (id) => {
    const response = await httpClient.get(endpoints.documents.getDocument(id), {
      responseType: 'blob',
    });
    return response.data;
  },

  createFolder: async ({ name, description, parentId }) => {
    const formData = new FormData();
    formData.append('document_title', name);
    formData.append('document_description', description || '');
    const parsed = parseInt(parentId, 10);
    const pid = (parentId && parentId !== 'root' && !isNaN(parsed)) ? parsed : 0;
    formData.append('pid', pid);
    
    const response = await httpClient.post(endpoints.documents.create, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  uploadFile: async ({ file, title, description, folderId }) => {
    const formData = new FormData();
    formData.append('document_title', title || (file ? file.name : ''));
    formData.append('document_description', description || '');
    if (file) {
      formData.append('file_name', file);
    } else {
      formData.append('file_name', '');
    }
    const parsed = parseInt(folderId, 10);
    const pid = (folderId && folderId !== 'root' && !isNaN(parsed)) ? parsed : 0;
    formData.append('pid', pid);

    const response = await httpClient.post(endpoints.documents.create, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateDocument: async (id, { title, description, file, folderId }) => {
    const formData = new FormData();
    formData.append('document_title', title);
    formData.append('document_description', description || '');
    if (file) {
      formData.append('file_name', file);
    }
    const parsed = parseInt(folderId, 10);
    const pid = (folderId && folderId !== 'root' && !isNaN(parsed)) ? parsed : 0;
    formData.append('pid', pid);

    const response = await httpClient.put(endpoints.documents.update(id), formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteDocument: async (id) => {
    const response = await httpClient.delete(endpoints.documents.delete(id));
    return response.data;
  },
};

export default documentService;
