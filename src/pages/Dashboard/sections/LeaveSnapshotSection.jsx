import { memo, useMemo } from 'react';

import { getInitials } from '@utils/format';

/** Donut geometry, matching the original SVG exactly. */
const DONUT_RADIUS = 35;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/** Leave type → badge class. */
const LEAVE_BADGE_CLASSES = {
  Planned: 'badge-planned',
  Sick: 'badge-sick',
  'Comp Off': 'badge-comp',
};

/** Attendance label → progress bar colour class. */
const ATTENDANCE_BAR_CLASSES = {
  Present: 'att-green',
  'Work From Home': 'att-blue',
  'On Leave': 'att-amber',
};

/**
 * Three-column people snapshot: leave distribution donut, upcoming leaves and
 * attendance breakdown.
 *
 * @param {Object} props
 * @param {{ type: string, count: number, color: string }[]} props.leaveDistribution
 * @param {{ id: string, name: string, date: string, type: string }[]} props.upcomingLeaves
 * @param {{ label: string, percentage: number, count: number }[]} props.attendanceStatus
 */
function LeaveSnapshotSectionComponent({ leaveDistribution, upcomingLeaves, attendanceStatus }) {
  const totalOnLeave = useMemo(
    () => leaveDistribution.reduce((sum, item) => sum + item.count, 0),
    [leaveDistribution],
  );

  /** Each arc starts where the previous one ended. */
  const arcs = useMemo(() => {
    let startAngle = 0;

    return leaveDistribution.map((item) => {
      const sweep = (item.count / totalOnLeave) * 360;
      const arc = { ...item, sweep, startAngle };
      startAngle += sweep;
      return arc;
    });
  }, [leaveDistribution, totalOnLeave]);

  return (
    <section className="dc-two-col">

      <div className="dc-card">
        <h2 className="dc-section-title">Upcoming Leaves (7 Days)</h2>

        <div className="dc-leave-list">
          {upcomingLeaves.map((leave) => (
            <div key={leave.id} className="dc-leave-item">
              <div className="dc-avatar" aria-hidden="true" style={{ overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getInitials(leave.name)}
                </div>
                {leave.photo_url_base64 && (
                  <img
                    src={leave.photo_url_base64}
                    alt={leave.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit', position: 'absolute', zIndex: 1 }}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
              <div className="dc-leave-info">
                <span className="dc-leave-name">{leave.name}</span>
                <span className="dc-leave-date">{leave.date}</span>
              </div>
              <span className={`dc-badge ${LEAVE_BADGE_CLASSES[leave.type] ?? 'badge-planned'}`}>
                {leave.type}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="dc-card">
        <h2 className="dc-section-title">Attendance Status</h2>

        <div className="dc-att-bars">
          {attendanceStatus.map(({ label, percentage, count }) => (
            <div key={label} className="dc-att-item">
              <div className="dc-att-header">
                <span className="dc-att-label">{label}</span>
                <span className="dc-att-pct">{percentage}%</span>
              </div>
              <div className="dc-att-track">
                <div
                  className={`dc-att-fill ${ATTENDANCE_BAR_CLASSES[label] ?? 'att-green'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="dc-att-count">{count} consultants</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export const LeaveSnapshotSection = memo(LeaveSnapshotSectionComponent);
export default LeaveSnapshotSection;
