import { AppProviders } from '@app/AppProviders';
import { ErrorBoundary } from '@components/common/ErrorBoundary/ErrorBoundary';
import { Toaster } from '@components/feedback/Toast/Toaster';
import { AppRouter } from '@routes/AppRouter';

/**
 * Application root: providers, a last-resort error boundary, the router and the
 * toast surface. All routing lives in @routes.
 */
export function App() {
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
