import React, { useState, useEffect } from 'react';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { settingsService } from '@services/settingsService';
import { Loader2, LayoutGrid, Image as ImageIcon, User } from 'lucide-react';
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
          {data.map((item) => {
            const width = item.display_width || '100%';
            const cardStyle = width === '50%' ? {} : { gridColumn: '1 / -1' };

            return (
              <div key={item.id} className="home-card" style={cardStyle}>
                {item.card_type === 'person_card' ? (
                  /* Person Card Layout */
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', textAlign: 'center', gap: '12px' }}>
                    {item.photo ? (
                      <div style={{ width: '90px', height: '90px', borderRadius: '6px', overflow: 'hidden', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', border: '1px solid var(--border-primary)' }}>
                        <img
                          src={`data:image/jpeg;base64,${item.photo}`}
                          alt={item.person_name}
                          style={{ width: '100%', height: '100%', borderRadius: '6px', objectFit: 'contain' }}
                        />
                      </div>
                    ) : (
                      <div style={{ width: '90px', height: '90px', borderRadius: '6px', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', border: '1px solid var(--border-primary)' }}>
                        <User size={36} />
                      </div>
                    )}
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.person_name}</h3>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary-color)' }}>{item.designation}</div>
                    <div style={{ width: '30px', height: '2px', background: 'var(--border-primary)' }} />
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.4, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{item.bio}</p>
                  </div>
                ) : item.card_type === 'content_card' ? (
                  /* Content Card Layout */
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {item.photo ? (
                      <div className="home-card-image-wrapper" style={{ height: '180px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: '6px' }}>
                        <img src={`data:image/jpeg;base64,${item.photo}`} alt="Banner" className="home-card-image" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }} />
                      </div>
                    ) : (
                      <div className="home-card-placeholder" style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', color: 'var(--text-tertiary)' }}>
                        <ImageIcon size={40} />
                      </div>
                    )}
                    <div className="home-card-content" style={{ padding: '16px' }}>
                      <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                        {item.text_content}
                      </p>
                    </div>
                  </div>
                ) : (
                  /* HTML Card Layout (default fallback to html_code) */
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {item.photo ? (
                      <div className="home-card-image-wrapper" style={{ height: '180px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)', padding: '6px' }}>
                        <img src={`data:image/jpeg;base64,${item.photo}`} alt="Banner" className="home-card-image" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '6px' }} />
                      </div>
                    ) : null}
                    <div className="home-card-content" style={{ padding: '16px' }}>
                      <div
                        className="home-card-html-content"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.html_content || '') }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default HomePage;
