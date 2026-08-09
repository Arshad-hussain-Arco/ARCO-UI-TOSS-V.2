import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import ProjectSummary from './ProjectSummary';
import LifecycleProgress from './LifecycleProgress';

/** Renders a dash when the value is missing/unassigned */
function val(v) {
  if (!v || v === 'unassigned') return '—';
  return v;
}

export function ProjectRow({ project, isExpanded, onToggleExpand, mode = 'business' }) {
  const chart = project.chartData || { planning: 0, development: 0, testing: 0, delivered: 0 };
  const maxBar = 80;

  return (
    <>
      <tr
        className={`pm-project-row ${isExpanded ? 'expanded-row' : ''} mode-${mode}`}
        onClick={onToggleExpand}
        style={{ cursor: 'pointer' }}
      >
        {/* Sticky Column 1: Expand Icon + Project Code */}
        <td className="pm-col-code pm-sticky-col pm-sticky-col-1">
          <div className="pm-code-cell">
            <span className="pm-expand-icon">
              {isExpanded ? (
                <ChevronDown size={13} color="var(--text-secondary)" />
              ) : (
                <ChevronRight size={13} color="var(--text-secondary)" />
              )}
            </span>
            <span className="pm-project-code">{project.code || project.id}</span>
          </div>
        </td>

        {/* Sticky Column 2: Summary / Description */}
        <td className="pm-col-summary pm-sticky-col pm-sticky-col-2">
          <ProjectSummary summary={project.summary} />
        </td>

        {/* Sticky Column 3: IT Delivery Lead */}
        <td className="pm-col-owner pm-sticky-col pm-sticky-col-3">
          <span className="pm-owner-text">{val(project.itdl)}</span>
        </td>

        {/* Column 4: Scrollable Lifecycle Progress */}
        <td className="pm-col-lifecycle">
          <LifecycleProgress status={project.stage} mode={mode} />
        </td>
      </tr>

      {/* Expanded Detail Panel Row — identical layout in both SDLC and Tech view */}
      {isExpanded && (
        <tr className="pm-detail-row">
          <td colSpan={4}>
            {/*
              pm-expanded-detail-container is sticky-pinned to left:0, width:100%
              so it never scrolls horizontally regardless of the lifecycle column width.
              Only the lifecycle chips (Column 4) scroll.
            */}
            <div className="pm-expanded-detail-container">

              {/* Key-Value Grid — 2 columns, all from API */}
              <div className="pm-kv-grid">
                <div className="pm-kv-col">
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Project Summary:</span>
                    <span className="pm-kv-val">{val(project.summary)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">IPM Number:</span>
                    <span className="pm-kv-val">{val(project.ipmNumber || project.code)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">IT Delivery Lead:</span>
                    <span className="pm-kv-val">{val(project.itdl)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Product Owner:</span>
                    <span className="pm-kv-val">{val(project.po)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Owned By:</span>
                    <span className="pm-kv-val">{val(project.ownedBy)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Clarity Planned Finish Date:</span>
                    <span className="pm-kv-val">{val(project.clarityFinishDate)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Start Date:</span>
                    <span className="pm-kv-val">{val(project.startDate)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Depends On:</span>
                    <span className="pm-kv-val">{val(project.dependsOn)}</span>
                  </div>
                </div>

                <div className="pm-kv-col">
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Work Order Type:</span>
                    <span className="pm-kv-val">{val(project.workOrderType)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Priority:</span>
                    <span className="pm-kv-val">{val(project.priority)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Backup IT Delivery Lead:</span>
                    <span className="pm-kv-val">{val(project.backupItdl)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">PMO Project Manager:</span>
                    <span className="pm-kv-val">{val(project.pmo)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Last Comment:</span>
                    <span className="pm-kv-val pm-kv-comment">{val(project.lastComment)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Requestor Name:</span>
                    <span className="pm-kv-val">{val(project.requestorName)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">Planned Dev Completion Date:</span>
                    <span className="pm-kv-val">{val(project.plannedDevDate)}</span>
                  </div>
                  <div className="pm-kv-item">
                    <span className="pm-kv-label">End Date:</span>
                    <span className="pm-kv-val">{val(project.endDate)}</span>
                  </div>
                </div>
              </div>

              {/* Full description from API */}
              <div className="pm-desc-block">
                <span className="pm-kv-label">Project Description:</span>
                <span className="pm-desc-text">{val(project.fullDesc)}</span>
              </div>

              {/* Phase Allocation Chart + Status Overview — side by side */}
              <div className="pm-detail-bottom-row">
                <div className="pm-detail-card pm-detail-card--chart">
                  <div className="pm-detail-card-header">
                    <h4 className="pm-detail-card-title">Phase Allocation</h4>
                  </div>
                  <div className="pm-chart-legend">
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#60a5fa' }} /> Planning</span>
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: 'var(--c-danger)' }} /> Development</span>
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#ec4899' }} /> Testing</span>
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: 'var(--c-success)' }} /> Delivered</span>
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
                            <div className="pm-histo-bar" style={{ height: `${(chart.planning / maxBar) * 100}%`, background: '#60a5fa' }} title={`Planning: ${chart.planning}`} />
                          </div>
                          <span className="pm-histo-label">Planning</span>
                        </div>
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div className="pm-histo-bar" style={{ height: `${(chart.development / maxBar) * 100}%`, background: 'var(--c-danger)' }} title={`Development: ${chart.development}`} />
                          </div>
                          <span className="pm-histo-label">Development</span>
                        </div>
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div className="pm-histo-bar" style={{ height: `${(chart.testing / maxBar) * 100}%`, background: '#ec4899' }} title={`Testing: ${chart.testing}`} />
                          </div>
                          <span className="pm-histo-label">Testing</span>
                        </div>
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div className="pm-histo-bar" style={{ height: `${(chart.delivered / maxBar) * 100}%`, background: 'var(--c-success)' }} title={`Delivered: ${chart.delivered}`} />
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
                      Status: <strong>{project.stage ? project.stage.toUpperCase() : '—'}</strong>
                      {project.overdueDays > 0 && ` (Overdue for ${project.overdueDays} Days)`}
                    </div>

                    {/* Additional key project status fields */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                      {project.dependsOn && (
                        <div className="pm-kv-item" style={{ borderBottom: '1px dashed var(--border-secondary)', padding: '4px 0' }}>
                          <span className="pm-kv-label">Category:</span>
                          <span className="pm-kv-val" style={{ background: 'var(--c-primary)', color: 'var(--surface-primary)', padding: '1px 8px', borderRadius: 10, fontSize: 10 }}>{project.dependsOn}</span>
                        </div>
                      )}
                      {project.priority && (
                        <div className="pm-kv-item" style={{ borderBottom: '1px dashed var(--border-secondary)', padding: '4px 0' }}>
                          <span className="pm-kv-label">Priority:</span>
                          <span className="pm-kv-val">{project.priority}</span>
                        </div>
                      )}
                      {project.workOrderType && (
                        <div className="pm-kv-item" style={{ borderBottom: '1px dashed var(--border-secondary)', padding: '4px 0' }}>
                          <span className="pm-kv-label">Work Order Type:</span>
                          <span className="pm-kv-val">{project.workOrderType}</span>
                        </div>
                      )}
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
