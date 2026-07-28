import { Users, UserCheck, Network, BadgeCheck } from 'lucide-react';
import './ConsultantsStats.css';

function ConsultantsStats({ total = 0, active = 0, teams = 0, designations = 0 }) {
  const statsConfig = [
    {
      id: 'total',
      title: 'Total Consultants',
      value: total,
      helper: 'All consultants',
      Icon: Users,
      variant: 'blue',
    },
    {
      id: 'active',
      title: 'Active Consultants',
      value: active,
      helper: 'Currently active',
      Icon: UserCheck,
      variant: 'green',
    },
    {
      id: 'teams',
      title: 'Teams',
      value: teams,
      helper: 'Total teams',
      Icon: Network,
      variant: 'violet',
    },
    {
      id: 'designations',
      title: 'Designations',
      value: designations,
      helper: 'Total designations',
      Icon: BadgeCheck,
      variant: 'amber',
    },
  ];

  return (
    <div className="consultants-stats">
      {statsConfig.map((stat, idx) => {
        const { Icon } = stat;
        return (
          <div key={stat.id} className="consultants-stat-card" data-variant={stat.variant}>
            <div className="consultants-stat-icon">
              <Icon size={16} />
            </div>
            <div className="consultants-stat-body">
              <span className="consultants-stat-title">{stat.title}</span>
              <span className="consultants-stat-value">{stat.value}</span>
              <span className="consultants-stat-helper">{stat.helper}</span>
            </div>
            {idx < statsConfig.length - 1 && (
              <span className="consultants-stat-divider" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}

export { ConsultantsStats };
export default ConsultantsStats;
