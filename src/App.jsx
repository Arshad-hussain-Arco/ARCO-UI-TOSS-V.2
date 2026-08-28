import { useEffect } from 'react';
import { AppProviders } from '@app/AppProviders';
import { ErrorBoundary } from '@components/common/ErrorBoundary/ErrorBoundary';
import { Toaster } from '@components/feedback/Toast/Toaster';
import { AppRouter } from '@routes/AppRouter';

/**
 * Application root: providers, a last-resort error boundary, the router and the
 * toast surface. All routing lives in @routes.
 */
export function App() {
  useEffect(() => {
    const handleGlobalClick = (e) => {
      const target = e.target;
      let icon = null;
      
      if (target.closest('.lucide-refresh-cw, .lucide-rotate-ccw')) {
        icon = target.closest('.lucide-refresh-cw, .lucide-rotate-ccw');
      } else if (target.closest('button')) {
        icon = target.closest('button').querySelector('.lucide-refresh-cw, .lucide-rotate-ccw');
      }

      if (icon) {
        icon.classList.add('click-spin');
        setTimeout(() => icon.classList.remove('click-spin'), 1000);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  return (
    <ErrorBoundary
      title="The application could not start"
      description="An unexpected error occurred before the interface could be rendered. Reload the page to try again."
    >
      <AppProviders>
        <AppRouter />
        <Toaster />
      </AppProviders>
    </ErrorBoundary>
  );
}

export default App;
