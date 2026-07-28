import { useCallback } from 'react';
import { BookOpen, Code, MessageCircle, Server, Shield } from 'lucide-react';

import { EmptyState } from '@components/feedback/EmptyState/EmptyState';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { linkService } from '@services/linkService';

import { LinkCategory } from './LinkCategory';
import './ImportantLinksPage.css';

/** Category `iconKey` → icon component. */
const CATEGORY_ICONS = {
  server: Server,
  code: Code,
  shield: Shield,
  chat: MessageCircle,
  book: BookOpen,
};

/** Directory of internal systems, tools and documentation. */
export function ImportantLinksPage() {
  useDocumentTitle('Important Links');

  const fetchCategories = useCallback(() => linkService.getLinkCategories(), []);
  const { data: categories, isLoading, error, refetch } = useAsync(fetchCategories);

  return (
    <div className="links-page">
      <div className="links-header">
        <h1 className="links-title">Important Links</h1>
        <p className="links-subtitle">
          Quick access to essential banking systems, tools, and documentation.
        </p>
      </div>

      {error ? (
        <ErrorState
          title="Links could not be loaded"
          description={error.message}
          onRetry={refetch}
        />
      ) : isLoading || !categories ? (
        <Loader message="Loading links…" />
      ) : categories.length === 0 ? (
        <EmptyState
          title="No links yet"
          description="Once links are published they will appear here, grouped by category."
        />
      ) : (
        <div className="links-grid">
          {categories.map((category) => (
            <LinkCategory
              key={category.id}
              title={category.title}
              icon={CATEGORY_ICONS[category.iconKey]}
              links={category.links}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default ImportantLinksPage;
