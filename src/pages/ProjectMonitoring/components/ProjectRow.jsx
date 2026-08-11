import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import ProjectSummary from './ProjectSummary';
import LifecycleProgress from './LifecycleProgress';

/** Renders a dash when the value is missing/unassigned */
function val(v) {
  if (!v || v === 'unassigned') return '—';
  return v;
}

export function ProjectRow({ project, changeRequests = [], isExpanded, onToggleExpand, mode = 'business' }) {
  // ── 1. CHART COMPONENT (Phase Life Cycle Duration in Calendar Days) ─────────
  const findMinMaxCRDates = (crList = []) => {
    if (!crList || crList.length === 0) return null;
    let minStart = null;
    let maxEnd = null;
    crList.forEach((cr) => {
      if (cr.startDate) {
        const s = new Date(cr.startDate);
        if (!isNaN(s.getTime()) && (!minStart || s < minStart)) minStart = s;
      }
      if (cr.endDate || cr.dueDate) {
        const e = new Date(cr.endDate || cr.dueDate);
        if (!isNaN(e.getTime()) && (!maxEnd || e > maxEnd)) maxEnd = e;
      }
    });
    if (!minStart && !maxEnd) return null;
    return { minStart, maxEnd };
  };

  const matchingCRs = changeRequests.filter(
    (cr) => (cr.woId && cr.woId === project.id) || (cr.code && cr.code === project.code)
  );
  const crMinMax = findMinMaxCRDates(matchingCRs);

  const woStartDate = project.startDate ? new Date(project.startDate) : null;
  const woEndDate = project.endDate || project.dueDate ? new Date(project.endDate || project.dueDate) : null;

  // Phase Bar 1: Planning
  let planningDays = 0;
  if (crMinMax?.minStart && woStartDate && !isNaN(woStartDate.getTime())) {
    planningDays = (crMinMax.minStart.getTime() - woStartDate.getTime()) / (1000 * 60 * 60 * 24);
  } else if (project.plannedDevDate && woStartDate && !isNaN(woStartDate.getTime())) {
    const pDev = new Date(project.plannedDevDate);
    if (!isNaN(pDev.getTime())) {
      planningDays = (pDev.getTime() - woStartDate.getTime()) / (1000 * 60 * 60 * 24);
    }
  } else {
    planningDays = project.chartData?.planning || 0;
  }

  // Phase Bar 2: Development
  let devDays = 0;
  if (crMinMax?.maxEnd && crMinMax?.minStart) {
    devDays = (crMinMax.maxEnd.getTime() - crMinMax.minStart.getTime()) / (1000 * 60 * 60 * 24);
  } else if (project.plannedDevDate && woStartDate && !isNaN(woStartDate.getTime())) {
    const pDev = new Date(project.plannedDevDate);
    if (!isNaN(pDev.getTime())) {
      devDays = (pDev.getTime() - woStartDate.getTime()) / (1000 * 60 * 60 * 24);
    }
  } else {
    devDays = project.chartData?.development || 0;
  }

  // Phase Bar 3: Testing
  let testingDays = 0;
  const sitDate = project.sitReceivedDate || project.sitDate ? new Date(project.sitReceivedDate || project.sitDate) : null;
  const uatEndDate = project.uatEndDate || project.endDate ? new Date(project.uatEndDate || project.endDate) : null;
  if (sitDate && uatEndDate && !isNaN(sitDate.getTime()) && !isNaN(uatEndDate.getTime())) {
    testingDays = (uatEndDate.getTime() - sitDate.getTime()) / (1000 * 60 * 60 * 24);
  } else {
    testingDays = project.chartData?.testing || 0;
  }

  // Phase Bar 4: Delivered
  let deliveredDays = 0;
  if (woStartDate && woEndDate && !isNaN(woStartDate.getTime()) && !isNaN(woEndDate.getTime())) {
    deliveredDays = (woEndDate.getTime() - woStartDate.getTime()) / (1000 * 60 * 60 * 24);
  } else {
    deliveredDays = project.chartData?.delivered || 0;
  }

  planningDays = Math.max(0, Math.round(planningDays));
  devDays = Math.max(0, Math.round(devDays));
  testingDays = Math.max(0, Math.round(testingDays));
  deliveredDays = Math.max(0, Math.round(deliveredDays));

  const maxBarDays = Math.max(planningDays, devDays, testingDays, deliveredDays, 10);

  // ── 2. PROJECT TIMELINE COMPONENT (SVG Status Ring) ──────────────────────────
  const currentDate = new Date();
  let projectStatusText = project.stage || 'Planning';
  let projectStatusPercentage = 0;
  let progressBarColorCode = '#2F9599'; // Teal

  if (woStartDate && woEndDate && !isNaN(woStartDate.getTime()) && !isNaN(woEndDate.getTime())) {
    const totalExpectedDuration = (woEndDate.getTime() - woStartDate.getTime()) / (1000 * 60 * 60 * 24);
    const totalCompletedDays = (currentDate.getTime() - woStartDate.getTime()) / (1000 * 60 * 60 * 24);

    if (totalExpectedDuration > 0) {
      const statusPercentage = Math.round((totalCompletedDays * 100) / totalExpectedDuration);
      const stageLower = (project.stage || '').toLowerCase();

      if (stageLower === 'completed' || stageLower === 'deployed') {
        projectStatusText = 'Completed';
        projectStatusPercentage = 100;
        progressBarColorCode = '#83AF9B'; // Sage green
      } else if (statusPercentage > 100) {
        const overdueDays = Math.round(totalCompletedDays - totalExpectedDuration);
        projectStatusText = `${project.stage || 'In Progress'} ( Over Due for - ${overdueDays} Days)`;
        projectStatusPercentage = '-';
        progressBarColorCode = '#E8175D'; // Crimson red
      } else {
        projectStatusText = project.stage || 'In Progress';
        projectStatusPercentage = Math.max(0, statusPercentage);
        progressBarColorCode = '#2F9599'; // Teal
      }
    }
  }

  const sqSize = 130;
  const strokeWidth = 10;
  const radius = (sqSize - strokeWidth) / 2;
  const dashArray = radius * Math.PI * 2;
  const percentVal = projectStatusPercentage === '-' ? 0 : Math.min(100, Math.max(0, Number(projectStatusPercentage)));
  const dashOffset = dashArray - (dashArray * percentVal) / 100;

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

      {/* Expanded Detail Panel Row */}
      {isExpanded && (
        <tr className="pm-detail-row">
          <td colSpan={4}>
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

              {/* Phase Life Cycle Duration Chart + Project Timeline — side by side */}
              <div className="pm-detail-bottom-row">
                {/* 1. Chart Component: Phase Life Cycle Stage Durations */}
                <div className="pm-detail-card pm-detail-card--chart">
                  <div className="pm-detail-card-header">
                    <h4 className="pm-detail-card-title">Chart</h4>
                  </div>
                  <div className="pm-chart-legend">
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#42A5F5' }} /> Planning</span>
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#EF4444' }} /> Development</span>
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#EC407A' }} /> Testing</span>
                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#66BB6A' }} /> Delivered</span>
                  </div>
                  <div className="pm-histogram-container">
                    <div className="pm-histogram-yaxis">
                      {[maxBarDays, Math.round(maxBarDays * 0.75), Math.round(maxBarDays * 0.5), Math.round(maxBarDays * 0.25), 0].map((y) => (
                        <span key={y} className="pm-yaxis-label">{y}d</span>
                      ))}
                    </div>
                    <div className="pm-histogram-canvas">
                      <div className="pm-grid-lines">
                        {[100, 75, 50, 25, 0].map((y) => (
                          <div key={y} className="pm-grid-line" />
                        ))}
                      </div>
                      <div className="pm-histogram-bars">
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div
                              className="pm-histo-bar"
                              style={{ height: `${Math.min(100, (planningDays / maxBarDays) * 100)}%`, background: '#42A5F5' }}
                              title={`Planning: ${planningDays} Days`}
                            />
                          </div>
                          <span className="pm-histo-label">Planning ({planningDays}d)</span>
                        </div>
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div
                              className="pm-histo-bar"
                              style={{ height: `${Math.min(100, (devDays / maxBarDays) * 100)}%`, background: '#EF4444' }}
                              title={`Development: ${devDays} Days`}
                            />
                          </div>
                          <span className="pm-histo-label">Development ({devDays}d)</span>
                        </div>
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div
                              className="pm-histo-bar"
                              style={{ height: `${Math.min(100, (testingDays / maxBarDays) * 100)}%`, background: '#EC407A' }}
                              title={`Testing: ${testingDays} Days`}
                            />
                          </div>
                          <span className="pm-histo-label">Testing ({testingDays}d)</span>
                        </div>
                        <div className="pm-histo-col">
                          <div className="pm-histo-bar-wrap">
                            <div
                              className="pm-histo-bar"
                              style={{ height: `${Math.min(100, (deliveredDays / maxBarDays) * 100)}%`, background: '#66BB6A' }}
                              title={`Delivered: ${deliveredDays} Days`}
                            />
                          </div>
                          <span className="pm-histo-label">Delivered ({deliveredDays}d)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Project Timeline Component: SVG Status Ring */}
                <div className="pm-detail-card pm-detail-card--timeline">
                  <div className="pm-detail-card-header">
                    <h4 className="pm-detail-card-title">Project Timeline</h4>
                  </div>
                  <div className="pm-timeline-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 0' }}>
                    <svg width={sqSize} height={sqSize} viewBox={`0 0 ${sqSize} ${sqSize}`} style={{ overflow: 'visible' }}>
                      <circle
                        cx={sqSize / 2}
                        cy={sqSize / 2}
                        r={radius}
                        stroke="var(--bg-tertiary)"
                        strokeWidth={strokeWidth}
                        fill="none"
                      />
                      <circle
                        cx={sqSize / 2}
                        cy={sqSize / 2}
                        r={radius}
                        stroke={progressBarColorCode}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                        transform={`rotate(-90 ${sqSize / 2} ${sqSize / 2})`}
                      />
                      <text
                        x="50%"
                        y="50%"
                        dy="0.3em"
                        textAnchor="middle"
                        style={{ fontSize: '20px', fontWeight: '700', fill: progressBarColorCode }}
                      >
                        {projectStatusPercentage}{projectStatusPercentage === '-' ? '' : '%'}
                      </text>
                    </svg>
                    <div className="pm-timeline-status-alert" style={{ marginTop: 10, textAlign: 'center', fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Status - <span style={{ color: progressBarColorCode }}>{projectStatusText}</span>
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
