import { memo } from 'react';

/**
 * Department Stats Section
 * Matches the layout of TeamHeadcountSection but for departments.
 *
 * @param {Object} props
 * @param {{ department_id: number, department_code: string, department_name: string, active_employees: number, total_employees: number }[]} props.departmentStats
 */
function DepartmentStatsSectionComponent({ departmentStats }) {
  if (!departmentStats || departmentStats.length === 0) return null;

  return (
    <section className="dc-section">
      <h2 className="dc-section-title">Department Breakdown</h2>

      <div className="thc-grid">
        {departmentStats.map((dept) => {
          const activePercent = dept.total_employees > 0 
            ? Math.round((dept.active_employees / dept.total_employees) * 100) 
            : 0;

          return (
            <div key={dept.department_id || dept.department_code} className="thc-card">
              <div className="thc-card-header">
                <span className="thc-team-name">{dept.department_name} ({dept.department_code})</span>
                <span className="thc-total-badge">{dept.total_employees} total</span>
              </div>

              {/* Progress bar showing active % */}
              <div className="thc-bar-track" title={`${activePercent}% active`}>
                <div
                  className="thc-bar-fill"
                  style={{ width: `${activePercent}%`, background: 'var(--c-info)' }}
                />
              </div>

              <div className="thc-stats" style={{ gridTemplateColumns: '1fr' }}>
                <div className="thc-stat thc-stat--active">
                  <span className="thc-stat-value">{dept.active_employees}</span>
                  <span className="thc-stat-label">ACTIVE CONSULTANTS</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const DepartmentStatsSection = memo(DepartmentStatsSectionComponent);
export default DepartmentStatsSection;
