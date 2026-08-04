import { Calendar } from 'lucide-react';

import { formatDateKey } from '../utils';

function OnLeaveTimeline({ timelineDates, filteredOnLeave, calendar, getLeaveTypeColor }) {
  return (
    <div className="attendance-timeline-wrapper">
      <div className="attendance-timeline">
        <div className="attendance-timeline-header">
          <div className="attendance-timeline-consultant-col">Consultant</div>
          <div className="attendance-timeline-dates">
            {timelineDates.map((date, idx) => (
              <div key={idx} className="attendance-timeline-date">
                <div className="attendance-timeline-date-day">{date.getDate()}</div>
                <div className="attendance-timeline-date-month">{date.toLocaleDateString('en-US', { month: 'short' })}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="attendance-timeline-body">
          {filteredOnLeave.map(leave => (
            <div key={leave.consultantId} className="attendance-timeline-row">
              <div className="attendance-timeline-consultant">
                <div className="attendance-timeline-consultant-name">{leave.consultantName}</div>
                <div className="attendance-timeline-consultant-team">{leave.team}</div>
              </div>
              <div className="attendance-timeline-bars">
                {timelineDates.map((date, idx) => {
                  const dateStr = formatDateKey(date);
                  const dayData = calendar?.find(d => d.date === dateStr);
                  const leaveDetail = dayData?.on_leave_details?.find(l => l.emp_id === leave.consultantId);
                  const inLeave = !!leaveDetail;
                  return (
                    <div
                      key={idx}
                      className={`attendance-timeline-cell${inLeave ? ' attendance-timeline-leave' : ''}`}
                      style={inLeave ? { backgroundColor: getLeaveTypeColor(leave.leaveType) } : {}}
                      title={inLeave ? `${leave.leaveType} – ${leave.days} days` : ''}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      {filteredOnLeave.length === 0 && (
        <div className="attendance-empty">
          <Calendar size={48} className="attendance-empty-icon" />
          <p className="attendance-empty-text">No consultants on leave</p>
        </div>
      )}
    </div>
  );
}

function OnLeaveList({ filteredOnLeave }) {
  return (
    <div className="attendance-list">
      {filteredOnLeave.map(leave => (
        <div key={leave.consultantId} className="attendance-leave-card">
          <div className="attendance-leave-main">
            <div className="attendance-consultant-avatar">
              {leave.consultantName.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="attendance-leave-info">
              <div className="attendance-consultant-name">{leave.consultantName}</div>
              <div className="attendance-consultant-team">{leave.team}</div>
            </div>
          </div>
          <div className="attendance-leave-details">
            <div className="attendance-leave-type">{leave.leaveType}</div>
            <div className="attendance-leave-dates">
              {new Date(leave.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
              {' – '}
              {new Date(leave.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
            </div>
            <div className="attendance-leave-days">{leave.days} days</div>
          </div>
        </div>
      ))}
      {filteredOnLeave.length === 0 && (
        <div className="attendance-empty">
          <Calendar size={48} className="attendance-empty-icon" />
          <p className="attendance-empty-text">No consultants on leave</p>
        </div>
      )}
    </div>
  );
}

export function OnLeave({ viewMode, timelineDates, filteredOnLeave, calendar, getLeaveTypeColor }) {
  if (viewMode === 'timeline') {
    return (
      <OnLeaveTimeline
        timelineDates={timelineDates}
        filteredOnLeave={filteredOnLeave}
        calendar={calendar}
        getLeaveTypeColor={getLeaveTypeColor}
      />
    );
  }
  return <OnLeaveList filteredOnLeave={filteredOnLeave} />;
}

export default OnLeave;
