import { ChevronDown, ChevronRight, MapPin, Phone, Mail, User } from 'lucide-react';

export function OnDutyToday({ groupedOnDuty, expandedTeams, toggleTeam, getStatusBadgeClass, isEmpty }) {
  return (
    <div className="attendance-list">
      {Object.entries(groupedOnDuty).map(([team, consultants]) => (
        <div key={team} className="attendance-team-group">
          <button className="attendance-team-header" onClick={() => toggleTeam(team)}>
            {expandedTeams.has(team) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="attendance-team-name">{team.charAt(0).toUpperCase() + team.slice(1)}</span>
            <span className="attendance-team-badge">{consultants.length}</span>
          </button>
          {expandedTeams.has(team) && (
            <div className="attendance-team-content">
              {consultants.map(c => (
                <div key={c.id} className="attendance-consultant-row">
                  <div className="attendance-consultant-main">
                    <div className="attendance-consultant-avatar">{c.avatar}</div>
                    <div className="attendance-consultant-info">
                      <div className="attendance-consultant-name">{c.name}</div>
                      <div className="attendance-consultant-manager">Manager: {c.manager}</div>
                    </div>
                  </div>
                  <div className="attendance-consultant-details">
                    <div className="attendance-detail-item"><MapPin size={12} className="attendance-detail-icon" /><span>{c.location}</span></div>
                    <div className="attendance-detail-item"><Phone size={12} className="attendance-detail-icon" /><span>{c.phone}</span></div>
                    <div className="attendance-detail-item"><Mail size={12} className="attendance-detail-icon" /><span>{c.email}</span></div>
                  </div>
                  <div className={`attendance-status-badge ${getStatusBadgeClass(c.status)}`}>
                    {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {isEmpty && (
        <div className="attendance-empty">
          <User size={48} className="attendance-empty-icon" />
          <p className="attendance-empty-text">No consultants on duty</p>
        </div>
      )}
    </div>
  );
}

export default OnDutyToday;
