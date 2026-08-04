import { ChevronDown, ChevronRight } from 'lucide-react';

export function SummaryView({ groupedTeams, collapsedTeams, toggleTeamCollapse, getCardColorClass, onDrillDown }) {
  return (
    <div className="cp-table-card">
      <div className="cp-table-wrapper">
        <table className="cp-data-table">
          <thead>
            <tr>
              <th rowSpan={2}>Consultant</th>
              <th colSpan={2} className="text-center group-header">Next 7 Days</th>
              <th colSpan={2} className="text-center group-header">Next 30 Days</th>
              <th colSpan={2} className="text-center group-header">Next 90 Days</th>
            </tr>
            <tr>
              <th className="sub-header">Occupied</th>
              <th className="sub-header">Available</th>
              <th className="sub-header">Occupied</th>
              <th className="sub-header">Available</th>
              <th className="sub-header">Occupied</th>
              <th className="sub-header">Available</th>
            </tr>
          </thead>
          <tbody>
            {groupedTeams.flatMap(team => {
              const isCollapsed = collapsedTeams.has(team.name);
              const rows = [
                <tr
                  key={`team-${team.name}`}
                  className="cp-team-subheader-row"
                  onClick={() => toggleTeamCollapse(team.name)}
                >
                  <td colSpan={7} className="cp-team-subheader-cell">
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                    <span className="team-name-label">{team.name}</span>
                    <span className="team-size-badge">{team.consultants.length} members</span>
                  </td>
                </tr>
              ];

              if (!isCollapsed) {
                team.consultants.forEach((c) => {
                  rows.push(
                    <tr key={c.id} className="cp-member-row">
                      <td className="member-name-cell">{c.name}</td>
                      <td className="drilldown-cell occupied-cell" onClick={() => onDrillDown(c, 7)}>
                        {c.next7Days.occupied.toFixed(1)} MDs
                      </td>
                      <td className={`available-cell ${getCardColorClass(c.next7Days.available)}`}>
                        {c.next7Days.available.toFixed(1)} MDs
                      </td>
                      <td className="drilldown-cell occupied-cell" onClick={() => onDrillDown(c, 30)}>
                        {c.next30Days.occupied.toFixed(1)} MDs
                      </td>
                      <td className={`available-cell ${getCardColorClass(c.next30Days.available)}`}>
                        {c.next30Days.available.toFixed(1)} MDs
                      </td>
                      <td className="drilldown-cell occupied-cell" onClick={() => onDrillDown(c, 90)}>
                        {c.next90Days.occupied.toFixed(1)} MDs
                      </td>
                      <td className={`available-cell ${getCardColorClass(c.next90Days.available)}`}>
                        {c.next90Days.available.toFixed(1)} MDs
                      </td>
                    </tr>
                  );
                });
              }
              return rows;
            })}
            {groupedTeams.length === 0 && (
              <tr>
                <td colSpan={7} className="cp-empty-state">
                  No consultants found matching the criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SummaryView;
