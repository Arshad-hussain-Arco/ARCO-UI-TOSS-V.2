import React, { memo, useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  AlertTriangle 
} from 'lucide-react';
import { dashboardService } from '@services/dashboardService';

/**
 * Key Updates Center - Sidebar Section 1 (Announcements & Alerts) and Section 2 (Insights feed)
 */
function AlertsPanelComponent({ alerts: initialAlerts = [] }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const formatted = initialAlerts.map(a => ({
      ...a,
      timestamp: a.timestamp || 'Just now',
    }));
    setAlerts(formatted);
  }, [initialAlerts]);

  const dismissAlert = async (id) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
    if (String(id).startsWith('a-')) {
      try {
        const backendId = String(id).replace('a-', '');
        await dashboardService.dismissAnnouncement(backendId);
      } catch (err) {
        console.error('Failed to dismiss announcement', err);
      }
    }
  };

  const dismissAll = async () => {
    const alertsToDismiss = [...alerts];
    setAlerts([]);
    for (const alert of alertsToDismiss) {
      if (String(alert.id).startsWith('a-')) {
        try {
          const backendId = String(alert.id).replace('a-', '');
          await dashboardService.dismissAnnouncement(backendId);
        } catch (err) {
          console.error('Failed to dismiss announcement', err);
        }
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      
      {/* SECTION 1: Key Alerts (Announcements) */}
      {alerts.length > 0 && (
        <section style={{ padding: '14px 14px 4px 14px', borderBottom: '1px solid var(--border-primary)' }} aria-label="Key Alerts">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
              <Bell size={13} style={{ color: 'var(--c-primary)' }} />
              <h2 style={{ fontSize: '11px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Notifications
              </h2>
            </div>
            <button 
              onClick={dismissAll} 
              style={{ background: 'none', border: 'none', color: 'var(--c-primary)', fontSize: '10px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
            >
              Clear all
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '8px' }}>
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '8px', 
                  padding: '8px 10px', 
                  background: 'var(--surface-primary)', 
                  border: '1px solid var(--border-primary)',
                  borderRadius: '6px',
                  fontSize: '11px',
                  position: 'relative',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: alert.severity === 'warning' ? 'var(--c-warning)' : 'var(--c-danger)', flexShrink: 0, marginTop: '2px' }}>
                  <AlertTriangle size={12} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1px', paddingRight: '14px', minWidth: 0 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.3 }}>{alert.text}</span>
                  <span style={{ fontSize: '9px', color: 'var(--text-tertiary)' }}>{alert.timestamp}</span>
                </div>
                <button 
                  onClick={() => dismissAlert(alert.id)}
                  style={{ position: 'absolute', top: '8px', right: '6px', background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px' }}
                  aria-label="Dismiss notification"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}

export const AlertsPanel = memo(AlertsPanelComponent);
export default AlertsPanel;
