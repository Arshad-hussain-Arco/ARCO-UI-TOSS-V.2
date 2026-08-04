import { Home } from 'lucide-react';

import { ListSkeleton } from '@components/feedback/Skeleton';

export function OnWfhToday({ isWfhLoading, wfhData }) {
  return (
    <div className="attendance-list">
      {isWfhLoading ? (
        <ListSkeleton rows={5} />
      ) : wfhData?.on_wfh_details?.length > 0 ? (
        <div className="attendance-team-content" style={{ marginTop: '20px' }}>
          {wfhData.team_members
            .filter(c => wfhData.on_wfh_details.some(d => d.emp_id === c.emp_id))
            .map(c => (
              <div key={c.emp_id} className="attendance-consultant-row">
                <div className="attendance-consultant-main">
                  <div className="attendance-consultant-avatar">
                    {c.emp_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div className="attendance-consultant-info">
                    <div className="attendance-consultant-name">{c.emp_name}</div>
                    <div className="attendance-consultant-manager">{c.designation || 'Consultant'}</div>
                  </div>
                </div>
                <div className="attendance-consultant-details">
                  <div className="attendance-detail-item">
                    <span>{c.team_name}</span>
                  </div>
                </div>
                <div className="attendance-status-badge att-status-remote">
                  Working From Home
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="attendance-empty">
          <Home size={48} className="attendance-empty-icon" />
          <p className="attendance-empty-text">No consultants on WFH today</p>
        </div>
      )}
    </div>
  );
}

export default OnWfhToday;
