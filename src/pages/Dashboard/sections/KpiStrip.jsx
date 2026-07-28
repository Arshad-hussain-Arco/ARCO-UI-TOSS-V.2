import { memo } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';

import { DASHBOARD_ICONS } from '../dashboardIcons';

/**
 * Headline counters across the top of the dashboard.
 *
 * @param {Object} props
 * @param {{ id: string, iconKey: string, count: number, label: string, subtext: string,
 *          color: string, trend?: 'up'|'down' }[]} props.kpis
 */
function KpiStripComponent({ kpis }) {
  return (
    <section className="dc-kpi-row">
      {kpis.map((kpi) => {
        const Icon = DASHBOARD_ICONS[kpi.iconKey];
        const TrendIcon = kpi.trend === 'up' ? TrendingUp : TrendingDown;

        return (
          <div key={kpi.id} className={`dc-kpi-card dc-kpi-${kpi.color}`}>
            <div className="dc-kpi-icon">{Icon ? <Icon size={18} /> : null}</div>

            <div className="dc-kpi-body">
              <div className="dc-kpi-value-row">
                <span className="dc-kpi-num">{kpi.count}</span>
                {kpi.trend ? (
                  <span className={`dc-kpi-trend dc-trend-${kpi.trend}`}>
                    <TrendIcon size={13} />
                  </span>
                ) : null}
              </div>
              <div className="dc-kpi-label">{kpi.label}</div>
              <div className="dc-kpi-sub">{kpi.subtext}</div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export const KpiStrip = memo(KpiStripComponent);
export default KpiStrip;
