import { memo } from 'react';
import { Bell } from 'lucide-react';

import { DASHBOARD_ICONS } from '../dashboardIcons';

/**
 * Right-hand alerts rail plus the mini summary beneath it.
 *
 * @param {Object} props
 * @param {{ id: string, text: string, severity: string, iconKey: string }[]} props.alerts
 * @param {{ id: string, label: string, value: string, tone: string }[]} props.quickStats
 */
function AlertsPanelComponent({ alerts, quickStats }) {
  return (
    <aside className="dc-alerts-panel" aria-label="Alerts and actions">
      <div className="dc-alerts-header">
        <Bell size={14} />
        <span className="dc-alerts-title">Alerts &amp; Actions</span>
        <span className="dc-alerts-count">{alerts.length}</span>
      </div>

      <div className="dc-alerts-list">
        {alerts.map((alert) => {
          const Icon = DASHBOARD_ICONS[alert.iconKey];

          return (
            <div key={alert.id} className={`dc-alert dc-alert-${alert.severity}`}>
              {Icon ? <Icon size={14} className="dc-alert-icon" /> : null}
              <span className="dc-alert-text">{alert.text}</span>
            </div>
          );
        })}
      </div>

      <div className="dc-alerts-summary">
        {quickStats.map((stat) => (
          <div key={stat.id} className="dc-sum-row">
            <span className="dc-sum-lbl">{stat.label}</span>
            <span className={`dc-sum-val dc-sum-${stat.tone}`}>{stat.value}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export const AlertsPanel = memo(AlertsPanelComponent);
export default AlertsPanel;
