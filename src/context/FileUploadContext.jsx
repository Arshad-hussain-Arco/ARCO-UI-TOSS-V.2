import { createContext, useCallback, useMemo, useState } from 'react';

import { TOAST_VARIANTS } from '@constants/ui';
import { useToast } from '@hooks/useToast';
import { settingsService } from '@services/settingsService';

/**
 * App-wide tracker for the WO/CR/Runtime-Trends file uploads on the Import
 * File Config settings tab.
 *
 * The tab's panel is conditionally unmounted whenever the user switches to
 * another settings tab (see SystemSettingsPage), and unmounts entirely when
 * they navigate away from Admin Settings altogether. The upload's network
 * request keeps running regardless (unmounting a component doesn't cancel
 * an in-flight axios call), but any state owned by the panel itself -
 * the "uploading…" spinner, the eventual success/error outcome - was being
 * lost the moment the component went away.
 *
 * Keeping that state here instead, above the router/tabs, means:
 *  - the spinner reappears correctly if the user switches back to the
 *    Import Config tab before the upload finishes
 *  - the success/failure toast fires from a stable, always-mounted call
 *    site rather than a closure whose owning component may be gone
 */
export const FileUploadContext = createContext(null);

export function FileUploadProvider({ children }) {
  const toast = useToast();
  const [uploads, setUploads] = useState({});

  const startUpload = useCallback(
    (field, fileKey, file) => {
      setUploads((prev) => ({
        ...prev,
        [field]: { status: 'uploading', fileName: file.name },
      }));

      // duration: 0 disables the auto-dismiss timer in ToastContext.show -
      // this toast stays up (even across a page/tab switch, since it's
      // owned by this app-root provider) until the upload settles and is
      // swapped for a success/error toast below, or the user clicks its
      // own close button.
      const pendingToastId = toast.show({
        title: `Uploading ${file.name}…`,
        variant: TOAST_VARIANTS.LOADING,
        duration: 0,
      });

      const payload = new FormData();
      payload.append('file', file);
      payload.append('fileKey', fileKey);

      return settingsService
        .uploadFile(payload)
        .then((res) => {
          setUploads((prev) => ({
            ...prev,
            [field]: { status: 'success', fileName: file.name, result: res },
          }));
          toast.dismiss(pendingToastId);
          toast.success(`File uploaded successfully: ${file.name}`);
          return res;
        })
        .catch((error) => {
          const backendMessage = error?.response?.data?.message;
          setUploads((prev) => ({
            ...prev,
            [field]: { status: 'error', fileName: file.name, error },
          }));
          toast.dismiss(pendingToastId);
          toast.error(backendMessage || `Failed to upload ${file.name}`);
          throw error;
        });
    },
    [toast],
  );

  const clearUpload = useCallback((field) => {
    setUploads((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ uploads, startUpload, clearUpload }),
    [uploads, startUpload, clearUpload],
  );

  return <FileUploadContext.Provider value={value}>{children}</FileUploadContext.Provider>;
}
