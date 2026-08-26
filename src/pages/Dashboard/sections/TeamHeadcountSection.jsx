import { memo } from 'react';

/**
 * Per-team headcount cards showing Active / On Leave / Remote (any
 * counts_as_present leave type, e.g. WFH, Offshore Work) / Total.
 *
 * @param {Object} props
 * @param {{ team_id: number, team_name: string, active: number, on_leave: number, wfh: number, present_other?: number, total: number }[]} props.teams
 */
function TeamHeadcountSectionComponent({ teams }) {
  // Filter out teams with 0 total employees
  const activeTeams = teams.filter((t) => t.total > 0);

  return (
    <section className="dc-section">
      <h2 className="dc-section-title">Team Headcount — Today</h2>

      <div className="thc-grid">
        {activeTeams.map((team) => {
          const activePercent = team.total > 0 ? Math.round((team.active / team.total) * 100) : 0;

          return (
            <div key={team.team_id} className="thc-card">
              <div className="thc-card-header">
                <span className="thc-team-name">{team.team_name}</span>
                <span className="thc-total-badge">{team.total} total</span>
              </div>

              {/* Progress bar showing active % */}
              <div className="thc-bar-track" title={`${activePercent}% at work`}>
                <div
                  className="thc-bar-fill"
                  style={{ width: `${activePercent}%` }}
                />
              </div>

              <div className="thc-stats">
                <div className="thc-stat thc-stat--active">
                  <span className="thc-stat-value">{team.active}</span>
                  <span className="thc-stat-label">ACTIVE</span>
                </div>
                <div className="thc-stat thc-stat--leave">
                  <span className="thc-stat-value">{team.on_leave}</span>
                  <span className="thc-stat-label">ON LEAVE</span>
                </div>
                <div className="thc-stat thc-stat--wfh">
                  <span className="thc-stat-value">{team.present_other ?? team.wfh}</span>
                  <span className="thc-stat-label">REMOTE</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const TeamHeadcountSection = memo(TeamHeadcountSectionComponent);
export default TeamHeadcountSection;
