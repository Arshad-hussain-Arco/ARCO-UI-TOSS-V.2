import React, { useState, useEffect } from 'react';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { settingsService } from '@services/settingsService';
import { LayoutGrid } from 'lucide-react';
import { HomeCard } from '@components/home/HomeCard';
import { Skeleton } from '@components/feedback/Skeleton/Skeleton';
import './HomePage.css';

/**
 * Landing page.
 * Fetches and displays home data (dashboard cards).
 */
/* ── Dynamic Skeleton Layout ────────────────────────────────────────────── */
function HomeSkeleton() {
  return (
    <div className="home-page-container" style={{ padding: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px', gridAutoRows: '200px' }}>
        <Skeleton height="100%" width="100%" style={{ gridColumn: 'span 8', borderRadius: '12px' }} />
        <Skeleton height="100%" width="100%" style={{ gridColumn: 'span 4', borderRadius: '12px' }} />
        <Skeleton height="100%" width="100%" style={{ gridColumn: 'span 4', borderRadius: '12px' }} />
        <Skeleton height="100%" width="100%" style={{ gridColumn: 'span 8', borderRadius: '12px' }} />
        <Skeleton height="100%" width="100%" style={{ gridColumn: 'span 6', borderRadius: '12px' }} />
        <Skeleton height="100%" width="100%" style={{ gridColumn: 'span 6', borderRadius: '12px' }} />
      </div>
    </div>
  );
}

export function HomePage() {
  useDocumentTitle('Home');
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchHomeData = async () => {
      try {
        setIsLoading(true);
        const res = await settingsService.getHomeData();
        if (active) {
          setData(Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : []);
        }
      } catch (err) {
        console.error('Failed to fetch home data', err);
      } finally {
        if (active) setIsLoading(false);
      }
    };
    fetchHomeData();
    return () => { active = false; };
  }, []);

  return (
    <div className="home-dashboard-container">

      {isLoading ? (
        <HomeSkeleton />
      ) : data.length === 0 ? (
        <div className="home-empty-state">
          <LayoutGrid size={48} className="empty-icon" />
          <h2>No updates right now</h2>
          <p>Check back later for news, announcements, and important information.</p>
        </div>
      ) : (
        <div className="home-cards-grid">
          {data.map((item) => {
            const width = item.display_width || '100%';
            const cardStyle = width === '50%' ? { gridColumn: 'span 1' } : { gridColumn: '1 / -1' };

            return (
              <div key={item.id} className="home-card-grid-item" style={cardStyle}>
                <HomeCard card={item} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HomePage;

