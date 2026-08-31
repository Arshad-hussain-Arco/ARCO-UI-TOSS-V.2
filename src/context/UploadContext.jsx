import React, { createContext, useContext, useState, useCallback } from 'react';
import { useToast } from '@hooks/useToast';
import { settingsService } from '@services/settingsService';

const UploadContext = createContext(null);

export const UploadProvider = ({ children }) => {
  const [uploads, setUploads] = useState({});
  const toast = useToast();

  const uploadFile = useCallback(async (field, fileKey, file, onSuccess, onError) => {
    const uploadId = `${field}-${Date.now()}`;
    setUploads((prev) => ({ ...prev, [uploadId]: { field, file, status: 'uploading' } }));
    
    try {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('fileKey', fileKey);

      const res = await settingsService.uploadFile(payload);

      toast.success(`File uploaded successfully: ${file.name}`);
      
      setUploads((prev) => ({ ...prev, [uploadId]: { field, file, status: 'success' } }));
      
      if (onSuccess) {
        onSuccess(res, field);
      }
      
      // Clean up from global state after a short delay
      setTimeout(() => {
        setUploads((prev) => {
          const next = { ...prev };
          delete next[uploadId];
          return next;
        });
      }, 5000);
      
    } catch (error) {
      console.error('File upload failed:', error);
      toast.error(`Failed to upload ${file.name}`);
      setUploads((prev) => ({ ...prev, [uploadId]: { field, file, status: 'error', error } }));
      
      if (onError) {
        onError(error, field);
      }
    }
  }, [toast]);

  return (
    <UploadContext.Provider value={{ uploads, uploadFile }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUploads = () => useContext(UploadContext);
