import { memo, useMemo } from 'react';
import { Activity, AlertCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

/** Y-axis gridline labels, in minutes. */
const Y_AXIS_TICKS = [120, 90, 60, 30, 0];

/**
 * System health cards alongside the seven-day runtime bar chart.
 *
 * @param {Object} props
 * @param {{ murexJobs: { total: number, failed: number },
 *          eodStatus: { completed: number, total: number, running: number },
 *          avgRuntime: { time: string, change: string } }} props.systemHealth
 * @param {{ day: string, runtime: number, failed: number }[]} props.runtimeTrend
 * @param {{ longest: { script: string, duration: string }, mostFailed: string,
 *          slaThreshold: number }} props.insights
 */
function SystemHealthSectionComponent({ systemHealth, runtimeTrend, insights }) {
  const { slaThreshold } = insights;

  // The tallest bar defines the chart's scale, so a single slow day rescales all.
  const maxRuntime = useMemo(
    () => Math.max(...runtimeTrend.map((entry) => entry.runtime)),
    [runtimeTrend],
  );

  return (
    <section className="dc-section dc-health-section">
      <div className="dc-health-left">
        <h2 className="dc-section-title">System Health</h2>

        <div className="dc-health-cards">
          <div className="dc-health-card">
            <div className="dc-health-card-top">
              <Activity size={14} className="dc-health-icon" />
              <span className="dc-health-card-label">Murex Jobs Today</span>
              <span
                className={`dc-status-dot ${systemHealth.murexJobs.failed > 0 ? 'dot-amber' : 'dot-green'}`}
              />
            </div>
            <div className="dc-health-stats">
              <div className="dc-health-stat">
                <span className="dc-stat-num">{systemHealth.murexJobs.total}</span>
                <span className="dc-stat-lbl">Total</span>
              </div>
              <div className="dc-health-stat dc-stat-error">
                <span className="dc-stat-num">{systemHealth.murexJobs.failed}</span>
                <span className="dc-stat-lbl">Failed</span>
              </div>
            </div>
          </div>

          <div className="dc-health-card">
            <div className="dc-health-card-top">
              <CheckCircle size={14} className="dc-health-icon" />
              <span className="dc-health-card-label">EOD Status</span>
              <span className="dc-status-dot dot-green" />
            </div>
            <div className="dc-health-stats">
              <div className="dc-health-stat">
                <span className="dc-stat-num">
                  {systemHealth.eodStatus.completed}/{systemHealth.eodStatus.total}
                </span>
                <span className="dc-stat-lbl">Completed</span>
              </div>
              <div className="dc-health-stat dc-stat-info">
                <span className="dc-stat-num">{systemHealth.eodStatus.running}</span>
                <span className="dc-stat-lbl">Running</span>
              </div>
            </div>
          </div>

          <div className="dc-health-card">
            <div className="dc-health-card-top">
              <Clock size={14} className="dc-health-icon" />
              <span className="dc-health-card-label">Avg Runtime (24h)</span>
            </div>
            <div className="dc-avg-runtime">
              <span className="dc-runtime-val">{systemHealth.avgRuntime.time}</span>
              <span className="dc-runtime-change dc-change-neg">
                {systemHealth.avgRuntime.change} vs yesterday
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="dc-health-right">
        <h2 className="dc-section-title">Runtime Trend – Last 7 Days</h2>

        <div className="dc-chart-wrap">
          <div className="dc-y-axis" aria-hidden="true">
            {Y_AXIS_TICKS.map((tick) => (
              <span key={tick} className="dc-y-lbl">
                {tick}m
              </span>
            ))}
          </div>

          <div className="dc-chart-area">
            <div
              className="dc-sla-line"
              style={{ bottom: `${(slaThreshold / maxRuntime) * 100}%` }}
            >
              <span className="dc-sla-lbl">SLA</span>
            </div>

            <div className="dc-bars">
              {runtimeTrend.map((entry) => (
                <div key={entry.day} className="dc-bar-col">
                  <div
                    className={`dc-bar ${entry.runtime > slaThreshold ? 'dc-bar-breach' : 'dc-bar-ok'}`}
                    style={{ height: `${(entry.runtime / maxRuntime) * 100}%` }}
                    title={`${entry.day}: ${entry.runtime}m, ${entry.failed} failed`}
                  >
                    {entry.failed > 0 ? <span className="dc-bar-badge">{entry.failed}</span> : null}
                  </div>
                  <span className="dc-x-lbl">{entry.day}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dc-chart-insights">
          <div className="dc-insight dc-insight-warn">
            <AlertTriangle size={11} />
            Longest: {insights.longest.script} – {insights.longest.duration}
          </div>
          <div className="dc-insight dc-insight-err">
            <AlertCircle size={11} />
            Most Failed: {insights.mostFailed}
          </div>
        </div>
      </div>
    </section>
  );
}

export const SystemHealthSection = memo(SystemHealthSectionComponent);
export default SystemHealthSection;
