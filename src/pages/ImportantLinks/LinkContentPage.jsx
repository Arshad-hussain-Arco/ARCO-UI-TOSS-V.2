import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Loader } from '@components/feedback/Loader/Loader';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { linkService } from '@services/linkService';
import { ROUTES } from '@constants/routes';

import { LinkContentViewer } from './LinkContentViewer';
import './ImportantLinksPage.css';

/**
 * Full page (not an overlay) for a link whose content type isn't a URL —
 * Shared Folder / Upload File / Comments. Reached by clicking such a link
 * from the Important Links page or the header's pinned-links widget alike;
 * both navigate here in-app instead of opening a modal, so the file or
 * text renders directly in the page-content area like any other page.
 */
export function LinkContentPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [link, setLink] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useDocumentTitle(link?.link || 'Important Links');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    linkService.getLinkDetail(id)
      .then((data) => {
        if (!cancelled) setLink(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || err.message || 'Failed to load link.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  // Map the raw backend Link shape to what LinkContentViewer expects.
  const viewerLink = link && {
    id: link.id,
    description: link.content || '',
    files: link.file_name ? [{ name: link.file_name }] : [],
  };

  return (
    <div className="il-content-page">
      <button type="button" className="il-content-back-btn" onClick={() => navigate(ROUTES.IMPORTANT_LINKS)}>
        <ArrowLeft size={14} /> Back to Important Links
      </button>

      {isLoading ? (
        <Loader message="Loading…" />
      ) : error ? (
        <ErrorState title="Could not load link" description={error} />
      ) : (
        <>
          <h1 className="il-content-page-title">{link.link}</h1>
          <LinkContentViewer link={viewerLink} />
        </>
      )}
    </div>
  );
}

export default LinkContentPage;
