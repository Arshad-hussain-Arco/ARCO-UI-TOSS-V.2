import { BarChart3 } from 'lucide-react';

import { JobCard } from './JobCard';

export function RuntimeTrendsTab({ scripts, onOpenDetail }) {
  return (
    <div className="murex-runtime-tab">
      <div className="murex-job-cards-list">
        {(scripts.length > 5 ? scripts.slice(0, 3) : scripts).map((script) => (
          <JobCard key={script.id} script={script} onOpenDetail={onOpenDetail} />
        ))}
        {scripts.length === 0 && (
          <div className="murex-empty-state" style={{ padding: '40px 0' }}>
            <BarChart3 size={28} style={{ opacity: 0.3 }} />
            <p>No runtime data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default RuntimeTrendsTab;
