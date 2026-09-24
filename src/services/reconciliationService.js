import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const reconciliationService = {
  preprocessFile: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await httpClient.post(endpoints.reconciliation.preprocess, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const payload = response?.data || {};
    const ext = file?.name?.split('.').pop()?.toLowerCase() || '';

    return {
      name: file?.name || 'Uploaded file',
      ext,
      size: file?.size || 0,
      records: payload.rowCount ?? 0,
      columns: Array.isArray(payload.columns) ? payload.columns : [],
      rows: Array.isArray(payload.sampleRows) ? payload.sampleRows : [],
      fileId: payload.fileId ?? null,
      columnMeta: payload.columnMeta ?? null,
      columnPathMap: payload.columnPathMap ?? null,
      rowCount: payload.rowCount ?? 0,
      fileObject: file,
    };
  },

  reconcileFiles: async ({
    sourceFile,
    destinationFile,
    sourceFileId,
    destinationFileId,
    sourceKeyColumn,
    destinationKeyColumn,
    sourceCompositeColumns,
    destinationCompositeColumns,
    columnMappings,
    columnMeta,
    columnPathMap1,
    columnPathMap2,
    page,
    pageSize,
    exportAll,
  }) => {
    const formData = new FormData();

    if (sourceFileId) {
      formData.append('sourceFileId', sourceFileId);
    } else if (sourceFile) {
      formData.append('source', sourceFile);
    }

    if (destinationFileId) {
      formData.append('destinationFileId', destinationFileId);
    } else if (destinationFile) {
      formData.append('destination', destinationFile);
    }

    if (sourceKeyColumn) formData.append('sourceKeyColumn', sourceKeyColumn);
    if (destinationKeyColumn) formData.append('destinationKeyColumn', destinationKeyColumn);

    if (Array.isArray(sourceCompositeColumns) && sourceCompositeColumns.length > 0) {
      formData.append('sourceCompositeColumns', JSON.stringify(sourceCompositeColumns));
    }
    if (Array.isArray(destinationCompositeColumns) && destinationCompositeColumns.length > 0) {
      formData.append('destinationCompositeColumns', JSON.stringify(destinationCompositeColumns));
    }

    if (columnMappings) {
      formData.append('columnMappings', JSON.stringify(columnMappings));
    }
    if (columnMeta) {
      formData.append('columnMeta', JSON.stringify(columnMeta));
    }
    if (columnPathMap1) {
      formData.append('columnPathMap1', JSON.stringify(columnPathMap1));
    }
    if (columnPathMap2) {
      formData.append('columnPathMap2', JSON.stringify(columnPathMap2));
    }
    if (page) formData.append('page', page);
    if (pageSize) formData.append('pageSize', pageSize);
    if (exportAll) formData.append('exportAll', 'true');

    const response = await httpClient.post(endpoints.reconciliation.reconcile, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      // Use responseType 'text' + manual JSON.parse to completely bypass the
      // Chrome DevTools inspector cache buffer. Large JSON responses (>32MB)
      // get evicted from the DevTools network inspector cache, which can trigger
      // a parsing error. Receiving as plain text avoids that DevTools buffer entirely.
      responseType: 'text',
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      // Reconciliation can be slow for large files — 5-minute timeout
      timeout: 5 * 60 * 1000,
    });

    // Safely parse the text response — handles both string and pre-parsed object
    // (axios may still auto-parse depending on version/interceptors)
    const raw = response?.data;
    if (!raw) return {};
    try {
      return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      return {};
    }
  },
};

export default reconciliationService;
