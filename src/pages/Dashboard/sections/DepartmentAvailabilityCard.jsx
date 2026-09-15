import React, { memo } from 'react';

function DepartmentAvailabilityCardComponent({ departmentStats = [] }) {
  // Map live API data if available, otherwise fall back to mock data
  const availabilityData = departmentStats.length > 0
    ? departmentStats.map(dept => {
      const total = dept.total_employees || 0;
      const active = dept.active_employees || 0;
      const onLeave = Math.max(0, total - active);
      const percentage = total > 0 ? Math.round((active / total) * 100) : 100;
      return {
        name: dept.department_name || dept.department_code,
        onLeave,
        percentage
      };
    })
    : [
      { name: 'Development', onLeave: 3, percentage: 85 },
      { name: 'Quality Assurance', onLeave: 1, percentage: 92 },
      { name: 'DevOps', onLeave: 0, percentage: 100 },
      { name: 'UI/UX Design', onLeave: 2, percentage: 75 },
      { name: 'Business Analysis', onLeave: 1, percentage: 90 }
    ];

  // Helper for progress bar color
  const getProgressColor = (pct) => {
    if (pct >= 90) return 'var(--c-success)'; // Green
    if (pct >= 70) return 'var(--c-warning)'; // Amber
    return 'var(--c-danger)'; // Red
  };

  return (
    <div className="dc-card" style={{ display: 'flex', flexDirection: 'column', minHeight: '340px', padding: '20px' }}>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Department Availability
        </h3>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Workforce presence & leave count</span>
      </div>

      {/* Table Container */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        {/* Table Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1.5fr',
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--text-tertiary)',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--border-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.3px'
        }}>
          <span>Department</span>
          <span style={{ textAlign: 'center' }}>On Leave</span>
          <span style={{ textAlign: 'right' }}>Availability</span>
        </div>

        {/* Table Rows */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {availabilityData.map((dept, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.5fr 1fr 1.5fr',
                alignItems: 'center',
                fontSize: '12px',
                padding: '10px 0',
                borderBottom: index === availabilityData.length - 1 ? 'none' : '1px solid var(--border-primary)'
              }}
            >
              {/* Department Name */}
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{dept.name}</span>

              {/* On Leave Count */}
              <span style={{ textAlign: 'center', fontWeight: 500, color: dept.onLeave > 0 ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
                {dept.onLeave}
              </span>

              {/* Availability & Progress Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'end', gap: '8px', width: '100%', maxWidth: '120px' }}>
                <span style={{ fontWeight: 700, color: getProgressColor(dept.percentage), minWidth: '32px', textAlign: 'right' }}>
                  {dept.percentage}%
                </span>
                <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden', position: 'relative' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${dept.percentage}%`,
                      background: getProgressColor(dept.percentage),
                      borderRadius: '3px',
                      transition: 'width 0.5s ease-out'
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const DepartmentAvailabilityCard = memo(DepartmentAvailabilityCardComponent);
export default DepartmentAvailabilityCard;
