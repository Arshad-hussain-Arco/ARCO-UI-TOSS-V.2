import { useMemo } from 'react';
import { Activity, AlertTriangle, Calendar, Clock, Eye, TrendingDown, TrendingUp } from 'lucide-react';

import { buildJobStackedBarSpec } from '../utils';
import { PlotlyChart } from './PlotlyChart';

export function JobCard({ script, onOpenDetail }) {
  const barSpec = useMemo(() => buildJobStackedBarSpec(script), [script]);

  const avgRuntimeFmt = script.avgRuntime || '—';
  const minRtFmt = script.minRuntime != null ? `${script.minRuntime}m` : '—';
  const maxRtFmt = script.maxRuntime != null ? `${script.maxRuntime}m` : '—';
  const lastRunFmt = script.lastRun || '—';
  const outlierCount = (script.history || []).filter(h => h.status === 'error').length;
  const freqFmt = script.frequency != null ? `${script.frequency}/day` : '—';
  const trendPct = script.successRate != null ? `${script.successRate}%` : '—';
  const trendPositive = (script.successRate || 0) >= 80;
  const minMaxRatio =
    script.maxRuntime > 0 ? Math.min((script.minRuntime / script.maxRuntime) * 100, 100) : 0;

  const healthColor =
    script.health === 'Healthy' ? '#10b981' :
      script.health === 'Warning' ? '#f59e0b' : '#ef4444';

  return (
    <div className="murex-job-card">
      <div className="murex-job-card-header">
        <div className="murex-job-card-title-group">
          <Activity size={14} className="murex-job-card-icon" />
          <span className="murex-job-card-name">{script.name}</span>
        </div>
        <div className="murex-job-card-header-right">
          <span className="murex-job-cat-tag">{script.category}</span>
          <span className="murex-job-health-badge" style={{ background: healthColor }}>
            {(script.health || 'Unknown').toUpperCase()}
          </span>
          <button
            className="murex-icon-btn"
            title="View Execution History"
            onClick={() => onOpenDetail && onOpenDetail(script)}
          >
            <Eye size={12} />
          </button>
        </div>
      </div>

      <div className="murex-kpi-row murex-job-kpi-row">
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Min Runtime</div>
          <div className="murex-kpi-value">{minRtFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Max Runtime</div>
          <div className="murex-kpi-value">{maxRtFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Avg Runtime</div>
          <div className="murex-kpi-value">{avgRuntimeFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Latest Run</div>
          <div className="murex-kpi-value">{lastRunFmt}</div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Trend</div>
          <div className={`murex-kpi-value ${trendPositive ? 'trend-up' : 'trend-down'}`}>
            {trendPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trendPct}
          </div>
        </div>
        <div className="murex-kpi-divider" />
        <div className="murex-kpi-item">
          <div className="murex-kpi-label">Outliers</div>
          <div className={`murex-kpi-value ${outlierCount > 0 ? 'outlier' : ''}`}>
            {outlierCount}
          </div>
        </div>
      </div>

      <div className="murex-job-card-body">
        <div className="murex-job-chart-area">
          <PlotlyChart data={barSpec.data} layout={barSpec.layout} style={{ minHeight: 200 }} />
        </div>

        <div className="murex-job-details-panel">
          <div className="murex-job-metric-grid">
            <div className="murex-job-metric-card">
              <div className="murex-job-metric-icon blue">
                <Clock size={13} />
              </div>
              <div className="murex-job-metric-info">
                <span className="murex-job-metric-label">Avg Runtime</span>
                <span className="murex-job-metric-value blue">{avgRuntimeFmt}</span>
              </div>
            </div>

            <div className="murex-job-metric-card">
              <div className={`murex-job-metric-icon ${trendPositive ? 'green' : 'red'}`}>
                {trendPositive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              </div>
              <div className="murex-job-metric-info">
                <span className="murex-job-metric-label">Success Rate</span>
                <span className={`murex-job-metric-value ${trendPositive ? 'green' : 'red'}`}>{trendPct}</span>
              </div>
            </div>

            <div className="murex-job-metric-card">
              <div className="murex-job-metric-icon purple">
                <Calendar size={13} />
              </div>
              <div className="murex-job-metric-info">
                <span className="murex-job-metric-label">Frequency</span>
                <span className="murex-job-metric-value purple">{freqFmt}</span>
              </div>
            </div>

            <div className="murex-job-metric-card">
              <div className={`murex-job-metric-icon ${outlierCount > 0 ? 'red' : 'green'}`}>
                <AlertTriangle size={13} />
              </div>
              <div className="murex-job-metric-info">
                <span className="murex-job-metric-label">Outliers</span>
                <span className={`murex-job-metric-value ${outlierCount > 0 ? 'red' : 'green'}`}>
                  {outlierCount > 0 ? `⚠️ ${outlierCount}` : '0'}
                </span>
              </div>
            </div>
          </div>

          <div className="murex-job-last-run">
            <Clock size={11} className="murex-job-last-run-icon" />
            <span className="murex-job-last-run-label">Last Run</span>
            <span className="murex-job-last-run-val">{lastRunFmt}</span>
          </div>

          <div className="murex-job-minmax-wrap">
            <div className="murex-job-minmax-header">
              <span className="murex-job-minmax-label">Min vs Max Runtime</span>
            </div>
            <div className="murex-job-minmax-bar">
              <div className="murex-job-minmax-fill" style={{ width: `${minMaxRatio}%` }} />
            </div>
            <div className="murex-job-minmax-values">
              <span className="murex-job-minmax-min">⬇ {minRtFmt}</span>
              <span className="murex-job-minmax-max">⬆ {maxRtFmt}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default JobCard;
