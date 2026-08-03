import { memo } from 'react';
import { Server } from 'lucide-react';

/**
 * Environment Status Strip (EOD Jobs Active)
 *
 * @param {Object} props
 * @param {{ id: number, environment: string, server_ip: string, port_no: number, status_file_name: string, is_active: string|boolean }[]} props.eodRecords
 */
function EnvironmentStatusStripComponent({ eodRecords }) {
  if (!eodRecords || eodRecords.length === 0) return null;

  return (
    <section className="dc-env-strip">
      {eodRecords.map((env) => {
        const isActive = env.is_active === 'Yes' || env.is_active === 1 || env.is_active === true;

        return (
          <div key={env.id || env.environment} className="dc-env-card">
            <div className="dc-env-header">
              <span className="dc-env-name">
                <Server size={14} className="dc-env-icon" />
                {String(env.environment || 'ENV').toUpperCase()}
              </span>
              <span className={`dc-env-status ${isActive ? 'status-ok' : 'status-down'}`}>
                <span className={`dc-status-dot ${isActive ? 'dot-green' : 'dot-red'}`} />
                {isActive ? 'ACTIVE' : 'OFFLINE'}
              </span>
            </div>

            <div className="dc-env-details">
              <div className="dc-env-ip">
                <span>IP: </span>
                <strong>{env.server_ip || 'N/A'}</strong> 
                <span className="dc-env-port">:{env.port_no || 22}</span>
              </div>
              <div className="dc-env-log">
                Log: {env.status_file_name || 'status.log'}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export const EnvironmentStatusStrip = memo(EnvironmentStatusStripComponent);
export default EnvironmentStatusStrip;
