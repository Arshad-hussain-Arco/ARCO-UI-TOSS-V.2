import { memo } from 'react';

/** Utilisation thresholds and the token each maps to. */
const CAPACITY_BANDS = [
  { min: 90, color: 'var(--status-critical)' },
  { min: 80, color: 'var(--status-warning)' },
  { min: 0, color: 'var(--status-success)' },
];

const capacityColor = (utilization) => CAPACITY_BANDS.find((band) => utilization >= band.min).color;

/**
 * Per-team capacity utilisation bars.
 *
 * @param {Object} props
 * @param {{ team: string, utilization: number }[]} props.capacityByTeam
 */
function CapacitySectionComponent({ capacityByTeam }) {
  return (
    <section className="dc-section">
      <h2 className="dc-section-title">Capacity Utilization by Team</h2>

      <div className="dc-cap-grid">
        {capacityByTeam.map((team) => {
          const color = capacityColor(team.utilization);

          return (
            <div key={team.team} className="dc-cap-row">
              <span className="dc-cap-team">{team.team}</span>
              <div className="dc-cap-track">
                <div
                  className="dc-cap-bar"
                  style={{ width: `${team.utilization}%`, background: color }}
                />
              </div>
              <span className="dc-cap-pct" style={{ color }}>
                {team.utilization}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="dc-cap-legend">
        <span className="dc-cap-legend-item">
          <span className="dc-cap-dot" style={{ background: 'var(--status-success)' }} />
          &lt;80% Healthy
        </span>
        <span className="dc-cap-legend-item">
          <span className="dc-cap-dot" style={{ background: 'var(--status-warning)' }} />
          80–90% Warning
        </span>
        <span className="dc-cap-legend-item">
          <span className="dc-cap-dot" style={{ background: 'var(--status-critical)' }} />
          90%+ Critical
        </span>
      </div>
    </section>
  );
}

export const CapacitySection = memo(CapacitySectionComponent);
export default CapacitySection;
