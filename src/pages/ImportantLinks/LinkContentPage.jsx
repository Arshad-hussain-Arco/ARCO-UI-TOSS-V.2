import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { Skeleton } from '@components/feedback/Skeleton/Skeleton';
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
/* ── Dynamic Skeleton Layout ────────────────────────────────────────────── */
export function DocumentSkeleton() {
  return (
    <div className="il-content-page-card">
      <div className="il-content-page-header">
        <div className="il-content-page-title">
          <Skeleton height={28} width="40%" style={{ borderRadius: '4px' }} />
        </div>
        <div className="il-content-page-meta" style={{ marginTop: '8px' }}>
          <Skeleton height={14} width="200px" style={{ borderRadius: '4px' }} />
        </div>
      </div>
      <div className="il-content-page-body" style={{ padding: '24px' }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
           <Skeleton height={16} width="100%" style={{ borderRadius: '4px' }} />
           <Skeleton height={16} width="100%" style={{ borderRadius: '4px' }} />
           <Skeleton height={16} width="90%" style={{ borderRadius: '4px' }} />
           <Skeleton height={16} width="95%" style={{ borderRadius: '4px' }} />
           <Skeleton height={16} width="85%" style={{ borderRadius: '4px' }} />
           <Skeleton height={16} width="100%" style={{ borderRadius: '4px' }} />
           <Skeleton height={16} width="80%" style={{ borderRadius: '4px' }} />
         </div>
      </div>
    </div>
  );
}

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
        <DocumentSkeleton />
      ) : error ? (
        <ErrorState title="Could not load link" description={error} />
      ) : (
        <div className="il-content-page-card">
          <div className="il-content-page-header">
            <h1 className="il-content-page-title">{link.link}</h1>
            <span className="il-content-page-meta">Important Links • Document Viewer</span>
          </div>
          <div className="il-content-page-body">
            <LinkContentViewer link={viewerLink} />
          </div>
        </div>
      )}
    </div>
  );
}

export default LinkContentPage;
