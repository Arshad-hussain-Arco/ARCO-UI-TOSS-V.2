import { memo } from 'react';
import { Eye, FileText, Upload } from 'lucide-react';

import { ACTIVITY_ICONS } from '../dashboardIcons';

/**
 * Document counters and the recent activity feed.
 *
 * @param {Object} props
 * @param {{ total: number, uploadedThisWeek: number, mostViewed: string[] }} props.documents
 * @param {{ id: string, action: string, time: string, type: string }[]} props.recentActivity
 */
function DocumentsActivitySectionComponent({ documents, recentActivity }) {
  return (
    <section className="dc-two-col">
      <div className="dc-card">
        <h2 className="dc-section-title">Documents Overview</h2>

        <div className="dc-doc-stats">
          <div className="dc-doc-stat">
            <FileText size={18} className="dc-doc-icon" />
            <div>
              <div className="dc-doc-val">{documents.total}</div>
              <div className="dc-doc-lbl">Total Files</div>
            </div>
          </div>
          <div className="dc-doc-stat">
            <Upload size={18} className="dc-doc-icon dc-doc-icon-green" />
            <div>
              <div className="dc-doc-val">{documents.uploadedThisWeek}</div>
              <div className="dc-doc-lbl">This Week</div>
            </div>
          </div>
        </div>

        <div className="dc-most-viewed">
          <div className="dc-mv-header">
            <Eye size={12} />
            <span>Most Viewed</span>
          </div>
          {documents.mostViewed.map((fileName) => (
            <div key={fileName} className="dc-mv-item">
              {fileName}
            </div>
          ))}
        </div>
      </div>

      <div className="dc-card">
        <h2 className="dc-section-title">Recent Activity</h2>

        <div className="dc-activity-list">
          {recentActivity.map((entry) => {
            const Icon = ACTIVITY_ICONS[entry.type];

            return (
              <div key={entry.id} className="dc-activity-item">
                <div className="dc-activity-icon">{Icon ? <Icon size={12} /> : null}</div>
                <div className="dc-activity-body">
                  <span className="dc-activity-text">{entry.action}</span>
                  <span className="dc-activity-time">{entry.time}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export const DocumentsActivitySection = memo(DocumentsActivitySectionComponent);
export default DocumentsActivitySection;
