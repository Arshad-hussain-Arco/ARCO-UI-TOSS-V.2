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
    <section className="dc-three-col">
      <div className="dc-card">
        <h2 className="dc-section-title">Leave Distribution</h2>

        <div className="dc-donut-wrap">
          <svg
            viewBox="0 0 100 100"
            className="dc-donut-svg"
            role="img"
            aria-label="Leave distribution"
          >
            {arcs.map((arc) => (
              <circle
                key={arc.type}
                cx="50"
                cy="50"
                r={DONUT_RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth="11"
                strokeDasharray={`${(arc.sweep / 360) * DONUT_CIRCUMFERENCE} ${DONUT_CIRCUMFERENCE}`}
                transform={`rotate(${arc.startAngle - 90} 50 50)`}
              />
            ))}
            <text x="50" y="48" textAnchor="middle" className="dc-donut-num">
              {totalOnLeave}
            </text>
            <text x="50" y="58" textAnchor="middle" className="dc-donut-sub-text">
              on leave
            </text>
          </svg>
        </div>

        <div className="dc-legend">
          {leaveDistribution.map((item) => (
            <div key={item.type} className="dc-legend-row">
              <span className="dc-legend-dot" style={{ background: item.color }} />
              <span className="dc-legend-label">{item.type}</span>
              <span className="dc-legend-val">{item.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dc-card">
        <h2 className="dc-section-title">Upcoming Leaves (7 Days)</h2>

        <div className="dc-leave-list">
          {upcomingLeaves.map((leave) => (
            <div key={leave.id} className="dc-leave-item">
              <div className="dc-avatar" aria-hidden="true">
                {getInitials(leave.name)}
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
