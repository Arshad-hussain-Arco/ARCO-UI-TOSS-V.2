import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import ProjectSummary from './ProjectSummary';
import LifecycleProgress from './LifecycleProgress';

export function ProjectRow({ project, isExpanded, onToggleExpand, mode = 'business' }) {
  const chart = project.chartData || { planning: 78, development: 75, testing: 7, delivered: 72 };

  return (
    <>
      <tr
        className={`pm-project-row ${isExpanded ? 'expanded-row' : ''} mode-${mode}`}
        onClick={onToggleExpand}
        style={{ cursor: 'pointer' }}
      >
        {/* Column 1: Project ID / Code */}
        <td className="pm-col-code">
          <div className="pm-code-cell">
            <span className="pm-expand-icon">
              {isExpanded ? (
                <ChevronDown size={14} color="#64748b" />
              ) : (
                <ChevronRight size={14} color="#64748b" />
              )}
            </span>
            <span className="pm-project-code">{project.code || project.id}</span>
          </div>
        </td>

        {/* Column 2: Summary / Description */}
        <td className="pm-col-summary">
          <ProjectSummary
            projectId={project.id}
            code={project.code}
            summary={project.summary}
            mode={mode}
          />
        </td>

        {/* Column 3: Owner / IT Delivery Lead */}
        <td className="pm-col-owner">
          <span className="pm-owner-text">{project.itdl || 'unassigned'}</span>
        </td>

        {/* Column 4: Lifecycle Progress (Enterprise Connected Stepper) */}
        <td className="pm-col-lifecycle">
          <LifecycleProgress status={project.stage} mode={mode} />
        </td>
      </tr>

      {/* Expanded Detail Panel Row */}
      {isExpanded && (
        <tr className="pm-detail-row">
          <td colSpan={4}>
            <div className="pm-expanded-detail-container">
              {/* 2-Column Key-Value Info Grid */}
              <div className="pm-kv-grid">
                {/* Column 1 */}
                <div className="pm-kv-col">
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Project Summary:</span>
                    <span className="pm-kv-val">
                      {project.code}- {project.summary}
                    </span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">IPM Number:</span>
                    <span className="pm-kv-val">{project.ipmNumber || project.code}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">IT Delivery Lead:</span>
                    <span className="pm-kv-val">{project.itdl}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Product Owner:</span>
                    <span className="pm-kv-val">{project.po}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Owned By:</span>
                    <span className="pm-kv-val">{project.ownedBy || project.po}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Clarity Planned Finish Date:</span>
                    <span className="pm-kv-val">{project.clarityFinishDate || 'Feb 28, 2025'}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Start Date:</span>
                    <span className="pm-kv-val">{project.startDate}</span>
                  </div>
                </div>

                {/* Column 2 */}
                <div className="pm-kv-col">
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Work Order Type:</span>
                    <span className="pm-kv-val">{project.workOrderType || 'Project'}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Priority:</span>
                    <span className="pm-kv-val">{project.priority || 'Medium'}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Backup IT Delivery Lead:</span>
                    <span className="pm-kv-val">{project.backupItdl}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">PMO Project Manager:</span>
                    <span className="pm-kv-val">{project.pmo}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Last Comment:</span>
                    <span className="pm-kv-val pm-kv-comment">{project.lastComment}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Requestor Name:</span>
                    <span className="pm-kv-val">{project.requestorName || 'Marwan'}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Planned Dev Completion Date:</span>
                    <span className="pm-kv-val">{project.plannedDevDate || 'Apr 9, 2025'}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">End Date:</span>
                    <span className="pm-kv-val">{project.endDate || 'Jul 31, 2025'}</span>
                  </div>
                </div>
              </div>

              {/* Description Block */}
              <div className="pm-desc-block">
                <span className="pm-kv-label">Project Description:</span>
                <span className="pm-desc-text">{project.fullDesc}</span>
              </div>

              {/* Bottom Visual Cards */}
              <div className="pm-detail-bottom-row">
                <div className="pm-detail-card pm-detail-card--chart">
                  <div className="pm-detail-card-header">
                    <h4 className="pm-detail-card-title">Phase Allocation</h4>
                  </div>
                  <div className="pm-chart-legend">
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#60a5fa' }} /> Planning</span>
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#ef4444' }} /> Development</span>
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#ec4899' }} /> Testing</span>
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#10b981' }} /> Delivered</span>
                  </div>
                  <div className="pm-histogram-container">
                    <div className="pm-histogram-yaxis">
                      {[80, 70, 60, 50, 40, 30, 20, 10, 0].map((y) => (
                        <span key={y} className="pm-yaxis-label">{y}</span>
                      ))}
                    </div>
                    <div className="pm-histogram-canvas">
                      <div className="pm-grid-lines">
                        {[80, 70, 60, 50, 40, 30, 20, 10, 0].map((y) => (
                          <div key={y} className="pm-grid-line" />
                        ))}
                      </div>
                      <div className="pm-histogram-bars">
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div className="pm-histo-bar" style={{ height: `${(chart.planning / 80) * 100}%`, background: '#60a5fa' }} title={`Planning: ${chart.planning}`} />
                          </div>
                          <span className="pm-histo-label">Planning</span>
                        </div>
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div className="pm-histo-bar" style={{ height: `${(chart.development / 80) * 100}%`, background: '#ef4444' }} title={`Development: ${chart.development}`} />
                          </div>
                          <span className="pm-histo-label">Development</span>
                        </div>
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div className="pm-histo-bar" style={{ height: `${(chart.testing / 80) * 100}%`, background: '#ec4899' }} title={`Testing: ${chart.testing}`} />
                          </div>
                          <span className="pm-histo-label">Testing</span>
                        </div>
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div className="pm-histo-bar" style={{ height: `${(chart.delivered / 80) * 100}%`, background: '#10b981' }} title={`Delivered: ${chart.delivered}`} />
                          </div>
                          <span className="pm-histo-label">Delivered</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pm-detail-card pm-detail-card--timeline">
                  <div className="pm-detail-card-header">
                    <h4 className="pm-detail-card-title">Project Status Overview</h4>
                  </div>
                  <div className="pm-donut-body">
                    <div className="pm-timeline-status-alert">
                      Status: <strong>{project.stage ? project.stage.toUpperCase() : 'PLANNING'}</strong> (Overdue for {project.overdueDays || 0} Days)
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default ProjectRow;
