import { memo } from 'react';
import { User } from 'lucide-react';

/**
 * Displays the Top 5 available employees over the next 7 days.
 *
 * @param {Object} props
 * @param {{ id: string, name: string, photo: string, teamName: string, next7Days: { occupied: number } }[]} props.consultants
 */
function EmployeeCapacitySectionComponent({ consultants }) {
  if (!consultants || consultants.length === 0) return null;

  return (
    <div className="dc-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px', padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Top 5 Available Consultants
        </h3>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Next 7 days</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {consultants.map((c, index) => {
          // Use precise values without rounding
          const occupied = c.next7Days?.occupied || 0;
          const available = c.availableMDs || 0;
          const capacity = occupied + available || 5; 
          const utilization = Math.min(100, Math.round((occupied / capacity) * 100));

          let color = 'var(--status-success)';
          if (utilization >= 90) color = 'var(--status-critical)';
          else if (utilization >= 80) color = 'var(--status-warning)';

          return (
            <div
              key={c.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: index === consultants.length - 1 ? 'none' : '1px solid var(--border-primary)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {c.photo ? (
                  <img
                    src={c.photo}
                    alt={c.name}
                    style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border-primary)'
                    }}
                  >
                    <User size={18} strokeWidth={1.5} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {c.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {c.teamName || 'Unassigned'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                <div style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  background: 'var(--bg-tertiary)', 
                  padding: '4px 8px', 
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--status-success)' }}>
                    {available.toFixed(1)} <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>MDs</span>
                  </span>
                </div>
                <div style={{ width: '80px', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${utilization}%`, height: '100%', background: color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const EmployeeCapacitySection = memo(EmployeeCapacitySectionComponent);
export default EmployeeCapacitySection;
