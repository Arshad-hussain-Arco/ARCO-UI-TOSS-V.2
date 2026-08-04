import { Users } from 'lucide-react';

export function TeamView({ allTeams, activeTeamTab, setActiveTeamTab, activeSubtabConsultants, getCardColorClass, onDrillDown }) {
  return (
    <div className="cp-team-layout">
      <div className="cp-team-tabs">
        {allTeams.map(tName => (
          <button
            key={tName}
            className={`team-tab-btn ${activeTeamTab === tName ? 'active' : ''}`}
            onClick={() => setActiveTeamTab(tName)}
          >
            <Users size={14} className="tab-icon" />
            <span>{tName}</span>
          </button>
        ))}
      </div>

      <div className="cp-team-panel">
        {activeSubtabConsultants.map(c => (
          <div key={c.id} className="consultant-card">
            <div className="consultant-info-header">
              <div className="consultant-avatar" style={{ overflow: 'hidden', flexShrink: 0 }}>
                {c.photo ? (
                  <img
                    src={c.photo}
                    alt={c.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <span
                  style={{
                    display: c.photo ? 'none' : 'flex',
                    width: '100%',
                    height: '100%',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: 'inherit',
                  }}
                >
                  {c.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="consultant-name">{c.name}</h3>
                <p className="consultant-role">{c.role}</p>
              </div>
            </div>

            <div className="consultant-kpi-grid">
              <div className="kpi-card info-kpi" onClick={() => onDrillDown(c, 7)}>
                <div className="kpi-card-header">Next 7 Days</div>
                <div className="kpi-vals">
                  <div>
                    <span className="lbl">Occupied</span>
                    <span className="val">{c.next7Days.occupied.toFixed(1)} MDs</span>
                  </div>
                  <div>
                    <span className="lbl">Available</span>
                    <span className={`val ${getCardColorClass(c.next7Days.available)}`}>
                      {c.next7Days.available.toFixed(1)} MDs
                    </span>
                  </div>
                </div>
              </div>

              <div className="kpi-card warning-kpi" onClick={() => onDrillDown(c, 30)}>
                <div className="kpi-card-header">Next 30 Days</div>
                <div className="kpi-vals">
                  <div>
                    <span className="lbl">Occupied</span>
                    <span className="val">{c.next30Days.occupied.toFixed(1)} MDs</span>
                  </div>
                  <div>
                    <span className="lbl">Available</span>
                    <span className={`val ${getCardColorClass(c.next30Days.available)}`}>
                      {c.next30Days.available.toFixed(1)} MDs
                    </span>
                  </div>
                </div>
              </div>

              <div className="kpi-card primary-kpi" onClick={() => onDrillDown(c, 90)}>
                <div className="kpi-card-header">Next 90 Days</div>
                <div className="kpi-vals">
                  <div>
                    <span className="lbl">Occupied</span>
                    <span className="val">{c.next90Days.occupied.toFixed(1)} MDs</span>
                  </div>
                  <div>
                    <span className="lbl">Available</span>
                    <span className={`val ${getCardColorClass(c.next90Days.available)}`}>
                      {c.next90Days.available.toFixed(1)} MDs
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {activeSubtabConsultants.length === 0 && (
          <div className="cp-empty-state">
            No consultants found for this team tab
          </div>
        )}
      </div>
    </div>
  );
}

export default TeamView;
