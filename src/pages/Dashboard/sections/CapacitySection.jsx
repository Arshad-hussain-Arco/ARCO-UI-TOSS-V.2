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
    <div className="dc-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px', padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Capacity Utilization by Team
        </h3>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Allocated work vs available bandwidth</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {capacityByTeam.map((team, index) => {
          const color = capacityColor(team.utilization);

          return (
            <div 
              key={team.team} 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                padding: '10px 0',
                borderBottom: index === capacityByTeam.length - 1 ? 'none' : '1px solid var(--border-primary)',
                gap: '12px'
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', width: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {team.team}
              </span>
              
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{ 
                      width: `${team.utilization}%`, 
                      height: '100%', 
                      background: color,
                      borderRadius: '3px',
                      transition: 'width 0.5s ease-out'
                    }}
                  />
                </div>
                <span style={{ fontWeight: 700, color, minWidth: '36px', textAlign: 'right' }}>
                  {team.utilization}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px', 
        marginTop: '16px', 
        fontSize: '10px', 
        color: 'var(--text-secondary)' 
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-success)' }} />
          &lt;80% Healthy
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-warning)' }} />
          80–90% Warning
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--status-critical)' }} />
          90%+ Critical
        </span>
      </div>
    </div>
  );
}

export const CapacitySection = memo(CapacitySectionComponent);
export default CapacitySection;
