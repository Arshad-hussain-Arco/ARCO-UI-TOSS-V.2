import { AuthProvider } from '@context/AuthContext';
import { FileUploadProvider } from '@context/FileUploadContext';
import { PinnedLinksProvider } from '@context/PinnedLinksContext';
import { SidebarProvider } from '@context/SidebarContext';
import { ThemeProvider } from '@context/ThemeContext';
import { ToastProvider } from '@context/ToastContext';

/**
 * Composes every application-wide provider in one place.
 *
 * Order is deliberate: theme has no dependencies, toasts are needed by auth
 * consumers, auth is needed by the router guards, and sidebar state is innermost
 * because only the shell reads it.
 */
export function AppProviders({ children }) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <FileUploadProvider>
          <AuthProvider>
            <SidebarProvider>
              <PinnedLinksProvider>{children}</PinnedLinksProvider>
            </SidebarProvider>
          </AuthProvider>
        </FileUploadProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default AppProviders;
