import React, { memo, useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  BarChart3, 
  TrendingUp, 
  ShieldAlert, 
  ArrowUpRight 
} from 'lucide-react';
import { dashboardService } from '@services/dashboardService';

/**
 * Key Updates Center - Sidebar Section 1 (Announcements & Alerts) and Section 2 (Insights feed)
 */
function AlertsPanelComponent({ alerts: initialAlerts = [] }) {
  const [alerts, setAlerts] = useState([]);
  const [showAllInsights, setShowAllInsights] = useState(false);

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

  // Workforce Insights mock data (supports future API easily by replacing this array with a state variable)
  const insights = [
    { id: 'in1', text: 'Team availability falls below 70% on Friday.', severity: 'warning', icon: AlertTriangle, color: 'var(--c-warning)', badge: 'Warning' },
    { id: 'in2', text: 'Three employees from the Development team are on leave next Monday.', severity: 'warning', icon: AlertTriangle, color: 'var(--c-warning)', badge: 'Warning' },
    { id: 'in3', text: 'Five team members are scheduled to be on leave this week.', severity: 'info', icon: Calendar, color: 'var(--c-info)', badge: 'Info' },
    { id: 'in4', text: 'Two leave requests have been pending approval for more than two days.', severity: 'critical', icon: ShieldAlert, color: 'var(--c-danger)', badge: 'Critical' },
    { id: 'in5', text: 'Development department currently has the lowest availability.', severity: 'info', icon: BarChart3, color: 'var(--c-info)', badge: 'Info' },
    { id: 'in6', text: 'Overall team availability this week is 92%.', severity: 'success', icon: CheckCircle2, color: 'var(--c-success)', badge: 'Good' },
    { id: 'in7', text: 'No overlapping leaves in the QA team this week.', severity: 'success', icon: CheckCircle2, color: 'var(--c-success)', badge: 'Good' }
  ];

  const visibleInsights = showAllInsights ? insights : insights.slice(0, 4);

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

      {/* SECTION 2: Key Insights (Insights feed) */}
      <section style={{ padding: '14px 14px 4px 14px', borderBottom: '1px solid var(--border-primary)' }} aria-label="Key Insights">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', marginBottom: '12px' }}>
          <TrendingUp size={13} style={{ color: 'var(--c-primary)' }} />
          <h2 style={{ fontSize: '11px', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Key Insights
          </h2>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
          {visibleInsights.map((insight) => {
            const Icon = insight.icon;
            
            // Map colors based on severity
            let statusColor = 'var(--c-info)'; // Blue for Info
            let badgeBg = '#eff6ff';
            let badgeColor = '#1e40af';
            if (insight.severity === 'warning') {
              statusColor = 'var(--c-warning)';
              badgeBg = '#fef3c7';
              badgeColor = '#92400e';
            } else if (insight.severity === 'critical') {
              statusColor = 'var(--c-danger)';
              badgeBg = 'var(--c-danger-light)';
              badgeColor = 'var(--c-danger)';
            } else if (insight.severity === 'success') {
              statusColor = 'var(--c-success)';
              badgeBg = '#d1fae5';
              badgeColor = '#065f46';
            }

            return (
              <div 
                key={insight.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  background: 'var(--bg-secondary, #F8FAFC)',
                  border: '1px solid var(--border-primary)',
                  borderLeft: `3px solid ${statusColor}`,
                  borderRadius: '6px',
                  fontSize: '11px',
                  minHeight: '48px',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease',
                  cursor: 'default',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
                className="dc-insight-row-hover"
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: statusColor, flexShrink: 0 }}>
                  <Icon size={13} />
                </div>
                <span 
                  style={{ 
                    flex: 1, 
                    color: 'var(--text-primary)', 
                    fontWeight: 500, 
                    lineHeight: 1.35,
                    whiteSpace: 'normal',
                    wordBreak: 'break-word'
                  }}
                  title={insight.text}
                >
                  {insight.text}
                </span>
                <span className={`dc-alert-badge dc-alert-badge-${insight.severity}`}>
                  {insight.badge}
                </span>
              </div>
            );
          })}
        </div>

        {/* View All Insights toggle */}
        <div style={{ marginTop: '8px', textAlign: 'center' }}>
          <button
            onClick={() => setShowAllInsights(!showAllInsights)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--c-primary)',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '2px 8px 10px 8px'
            }}
          >
            {showAllInsights ? 'View Fewer' : 'View All Insights'}
          </button>
        </div>
      </section>

    </div>
  );
}

export const AlertsPanel = memo(AlertsPanelComponent);
export default AlertsPanel;
