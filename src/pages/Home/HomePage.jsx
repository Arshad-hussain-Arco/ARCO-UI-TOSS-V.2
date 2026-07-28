import { useDocumentTitle } from '@hooks/useDocumentTitle';

/**
 * Landing page.
 *
 * Intentionally blank — the original design specified an empty Home screen, and
 * that is preserved here. Content belongs in this component when the design for
 * it exists.
 */
export function HomePage() {
  useDocumentTitle('Home');

  return <div className="p-6" />;
}

export default HomePage;
