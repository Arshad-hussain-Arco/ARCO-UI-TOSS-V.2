import React, { useState, useEffect } from 'react';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { settingsService } from '@services/settingsService';
import { Loader2, LayoutGrid, Image as ImageIcon } from 'lucide-react';
import DOMPurify from 'dompurify';
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
      <div className="home-dashboard-header">
        <h1 className="home-dashboard-title">Welcome Back</h1>
        <p className="home-dashboard-subtitle">Here is your daily digest and important updates.</p>
      </div>

      {isLoading ? (
        <div className="home-loading-state">
          <Loader2 className="spin" size={32} />
          <p>Loading your dashboard...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="home-empty-state">
          <LayoutGrid size={48} className="empty-icon" />
          <h2>No updates right now</h2>
          <p>Check back later for news, announcements, and important information.</p>
        </div>
      ) : (
        <div className="home-cards-grid">
          {data.map((item) => (
            <div key={item.id} className="home-card">
              {item.photo ? (
                <div className="home-card-image-wrapper">
                  <img src={`data:image/jpeg;base64,${item.photo}`} alt="Announcement" className="home-card-image" />
                  <div className="home-card-image-overlay" />
                </div>
              ) : (
                <div className="home-card-placeholder">
                  <ImageIcon size={40} />
                </div>
              )}
              <div className="home-card-content">
                <div 
                  className="home-card-html-content"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.description) }} 
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default HomePage;
