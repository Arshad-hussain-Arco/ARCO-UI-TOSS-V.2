import { AuthProvider } from '@context/AuthContext';
import { PinnedLinksProvider } from '@context/PinnedLinksContext';
import { SidebarProvider } from '@context/SidebarContext';
import { ThemeProvider } from '@context/ThemeContext';
import { ToastProvider } from '@context/ToastContext';
import { UploadProvider } from '@context/UploadContext';

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
        <UploadProvider>
          <AuthProvider>
            <SidebarProvider>
              <PinnedLinksProvider>{children}</PinnedLinksProvider>
            </SidebarProvider>
          </AuthProvider>
        </UploadProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default AppProviders;
