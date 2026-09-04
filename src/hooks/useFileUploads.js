import { useContext } from 'react';

import { FileUploadContext } from '@context/FileUploadContext';

export function useFileUploads() {
  const context = useContext(FileUploadContext);

  if (!context) {
    throw new Error('useFileUploads must be used inside a <FileUploadProvider>.');
  }

  return context;
}

export default useFileUploads;
