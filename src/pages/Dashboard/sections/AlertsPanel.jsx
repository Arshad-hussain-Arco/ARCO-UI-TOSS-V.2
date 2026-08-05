import { memo, useState, useEffect } from 'react';
import { Bell, X, CheckCircle2 } from 'lucide-react';

import { DASHBOARD_ICONS } from '../dashboardIcons';
import { dashboardService } from '@services/dashboardService';

/**
 * Right-hand alerts rail plus the mini summary beneath it.
 *
 * @param {Object} props
 * @param {{ id: string, text: string, severity: string, iconKey: string, timestamp?: string }[]} props.alerts
 * @param {{ id: string, label: string, value: string, tone: string }[]} props.quickStats
 */
function AlertsPanelComponent({ alerts: initialAlerts, quickStats }) {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    // Add mock timestamps if missing for UI demo
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
    <aside className="dc-alerts-panel" aria-label="Alerts and actions">
      <div className="dc-alerts-header">
        <div className="dc-alerts-header-left">
          <Bell size={14} className="dc-alerts-bell" />
          <span className="dc-alerts-title">Alerts &amp; Actions</span>
          {alerts.length > 0 && <span className="dc-alerts-count">{alerts.length}</span>}
        </div>
        {alerts.length > 0 && (
          <button className="dc-alerts-clear-btn" onClick={dismissAll}>Clear all</button>
        )}
      </div>

      <div className="dc-alerts-list">
        {alerts.length === 0 ? (
          <div className="dc-alerts-empty">
            <CheckCircle2 size={24} className="dc-empty-icon" />
            <span>You're all caught up!</span>
          </div>
        ) : (
          alerts.map((alert) => {
            const Icon = DASHBOARD_ICONS[alert.iconKey] || Bell;
            return (
              <div key={alert.id} className={`dc-alert dc-alert-${alert.severity} dc-alert-glass`}>
                <div className="dc-alert-icon-wrapper">
                  <Icon size={14} className="dc-alert-icon" />
                </div>
                <div className="dc-alert-content">
                  <span className="dc-alert-text">{alert.text}</span>
                  <span className="dc-alert-time">{alert.timestamp}</span>
                </div>
                <button 
                  className="dc-alert-dismiss" 
                  onClick={() => dismissAlert(alert.id)}
                  aria-label="Dismiss alert"
                  title="Dismiss"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {quickStats && quickStats.length > 0 && (
        <div className="dc-alerts-summary">
          {quickStats.map((stat) => (
            <div key={stat.id} className="dc-sum-row">
              <span className="dc-sum-lbl">{stat.label}</span>
              <span className={`dc-sum-val dc-sum-${stat.tone}`}>{stat.value}</span>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

export const AlertsPanel = memo(AlertsPanelComponent);
export default AlertsPanel;
