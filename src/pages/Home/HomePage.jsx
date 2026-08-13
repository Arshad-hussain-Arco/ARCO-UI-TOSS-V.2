import React, { useState, useEffect } from 'react';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { settingsService } from '@services/settingsService';
import { LayoutGrid } from 'lucide-react';
import { HomeCard } from '@components/home/HomeCard';
import { Loader } from '@components/feedback/Loader/Loader';
import './HomePage.css';

/**
 * Landing page.
 * Fetches and displays home data (dashboard cards).
 */
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
          setData(res || []);
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
        <Loader message="Loading homepage..." />
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

