import { memo } from 'react';
import { AlertCircle, AlertTriangle, Target } from 'lucide-react';

/** Project status → human label. */
const STATUS_LABELS = {
  'on-track': 'On Track',
  'at-risk': 'At Risk',
  breached: 'Breached',
};

/**
 * Delivery risk counters and the project status list.
 *
 * @param {Object} props
 * @param {{ active: number, atRisk: number, breached: number }} props.projectRisk
 * @param {{ id: string, name: string, status: string }[]} props.projectsByStatus
 */
function ProjectRiskSectionComponent({ projectRisk, projectsByStatus }) {
  const riskCards = [
    { label: 'Active Projects', value: projectRisk.active, icon: Target, className: 'risk-blue' },
    { label: 'At Risk', value: projectRisk.atRisk, icon: AlertTriangle, className: 'risk-amber' },
    {
      label: 'Breached SLA',
      value: projectRisk.breached,
      icon: AlertCircle,
      className: 'risk-red',
    },
  ];

  return (
    <section className="dc-project-section">
      <div className="dc-risk-cards">
        {riskCards.map(({ label, value, icon: Icon, className }) => (
          <div key={label} className={`dc-risk-card ${className}`}>
            <div className="dc-risk-icon-box">
              <Icon size={18} />
            </div>
            <div>
              <div className="dc-risk-val">{value}</div>
              <div className="dc-risk-lbl">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dc-card dc-projects-card">
        <h2 className="dc-section-title">Projects by Status</h2>

        <div className="dc-project-list">
          {projectsByStatus.map((project) => (
            <div key={project.id} className="dc-project-row">
              <span className={`dc-proj-dot proj-${project.status}`} />
              <span className="dc-proj-name">{project.name}</span>
              <span className={`dc-badge dc-proj-badge proj-badge-${project.status}`}>
                {STATUS_LABELS[project.status] ?? project.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const ProjectRiskSection = memo(ProjectRiskSectionComponent);
export default ProjectRiskSection;
