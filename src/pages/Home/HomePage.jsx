import React, { useState, useEffect } from 'react';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { settingsService } from '@services/settingsService';
import { LayoutGrid } from 'lucide-react';
import { HomeCard, HomeCardSkeleton } from '@components/home/HomeCard';
import { Skeleton } from '@components/feedback/Skeleton/Skeleton';
import './HomePage.css';

/**
 * Landing page.
 * Fetches and displays home data (dashboard cards).
 */
/* ── Dynamic Skeleton Layout ────────────────────────────────────────────── */
function HomeSkeleton({ cachedLayout }) {
  // If we have a cached layout from a previous visit, use it to perfectly match the upcoming cards
  if (cachedLayout && cachedLayout.length > 0) {
    return (
      <div className="home-cards-grid">
        {cachedLayout.map((width, index) => {
          const cardStyle = width === '50%' ? { gridColumn: 'span 1' } : { gridColumn: '1 / -1' };
          return (
            <div key={index} className="home-card-grid-item" style={cardStyle}>
              <HomeCardSkeleton isHalfWidth={width === '50%'} />
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback generic skeleton if no cache exists
  return (
    <div className="home-cards-grid">
      <div className="home-card-grid-item" style={{ gridColumn: '1 / -1' }}>
        <HomeCardSkeleton isHalfWidth={false} />
      </div>
      <div className="home-card-grid-item" style={{ gridColumn: 'span 1' }}>
        <HomeCardSkeleton isHalfWidth={true} />
      </div>
      <div className="home-card-grid-item" style={{ gridColumn: 'span 1' }}>
        <HomeCardSkeleton isHalfWidth={true} />
      </div>
    </div>
  );
}

export function HomePage() {
  useDocumentTitle('Home');
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cachedLayout, setCachedLayout] = useState(() => {
    try {
      const cached = localStorage.getItem('home_cards_layout');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let active = true;
    const fetchHomeData = async () => {
      try {
        setIsLoading(true);
        const res = await settingsService.getHomeData();
        if (active) {
          const fetchedData = Array.isArray(res) ? res : Array.isArray(res?.results) ? res.results : [];
          setData(fetchedData);
          if (fetchedData.length > 0) {
            const layout = fetchedData.map((item) => item.display_width || '100%');
            setCachedLayout(layout);
            try {
              localStorage.setItem('home_cards_layout', JSON.stringify(layout));
            } catch (e) {
              console.error('Failed to cache home layout', e);
            }
          }
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
        <HomeSkeleton cachedLayout={cachedLayout} />
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

