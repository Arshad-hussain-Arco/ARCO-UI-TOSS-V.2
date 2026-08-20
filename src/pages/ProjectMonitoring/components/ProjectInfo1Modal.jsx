import React from 'react';
import { X, Calendar, User, Clock, AlertTriangle, CheckCircle2, FileText, Layers, ShieldCheck } from 'lucide-react';

/**
 * Format date utility
 */
function formatDate(dateStr) {
  if (!dateStr || dateStr.length <= 1) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Circular Progress Bar SVG component (StatusBar)
 */
function CircularStatusBar({ percentage = 0, color = '#046a38', size = 110, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const numPerc = typeof percentage === 'number' ? Math.max(0, Math.min(100, percentage)) : 0;
  const offset = circumference - (numPerc / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
        />
      </svg>
      <div className="absolute text-center">
        <span className="text-xl font-bold text-slate-800">
          {typeof percentage === 'number' ? `${percentage}%` : percentage}
        </span>
      </div>
    </div>
  );
}

export default function ProjectInfo1Modal({ project, crList = [], isOpen, onClose }) {
  if (!isOpen || !project) return null;

  const startDate = project.Start_Date ? new Date(project.Start_Date) : null;
  const dueDate = project.Due_Date ? new Date(project.Due_Date) : null;
  const isCompleted = (project.Status || '').toLowerCase() === 'completed';

  let statusPercentage = 0;
  let isOverdue = false;
  let overdueDays = 0;
  let progressBarColor = '#046a38';
  let statusDisplayText = project.Status || '';

  if (isCompleted) {
    statusPercentage = 100;
    progressBarColor = '#046a38';
    statusDisplayText = 'Completed';
  } else if (startDate && dueDate && !isNaN(startDate.getTime()) && !isNaN(dueDate.getTime())) {
    const today = new Date();
    const totalExpectedDuration = (dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const totalCompletedDays = (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (totalExpectedDuration > 0) {
      const calcPct = Math.round((totalCompletedDays * 100) / totalExpectedDuration);
      if (calcPct > 100) {
        isOverdue = true;
        overdueDays = Math.round(totalCompletedDays - totalExpectedDuration);
        statusPercentage = '-';
        progressBarColor = '#e11d48';
        statusDisplayText = `${project.Status || ''} ( Over Due for - ${overdueDays} Days)`;
      } else {
        statusPercentage = Math.max(0, calcPct);
        progressBarColor = '#046a38';
      }
    }
  }

  // Calculate Life Cycle Bar Chart Durations
  const matchingCRs = crList.filter((cr) => String(cr.Wo_Id) === String(project.Wo_Id));
  let planningDays = 0;
  let devDays = 0;
  let testingDays = 0;
  let totalDeliveredDays = 0;

  if (startDate && dueDate && !isNaN(startDate.getTime()) && !isNaN(dueDate.getTime())) {
    totalDeliveredDays = Math.max(0, Math.round((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  if (matchingCRs.length > 0) {
    const crDevStarts = matchingCRs.map((cr) => cr.Start_Date ? new Date(cr.Start_Date) : null).filter((d) => d && !isNaN(d.getTime()));
    const crDevEnds = matchingCRs.map((cr) => cr.End_Date ? new Date(cr.End_Date) : null).filter((d) => d && !isNaN(d.getTime()));

    if (startDate && crDevStarts.length > 0) {
      const minDevStart = new Date(Math.min(...crDevStarts.map((d) => d.getTime())));
      planningDays = Math.max(0, Math.round((minDevStart.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    }

    if (crDevStarts.length > 0 && crDevEnds.length > 0) {
      const minDevStart = new Date(Math.min(...crDevStarts.map((d) => d.getTime())));
      const maxDevEnd = new Date(Math.max(...crDevEnds.map((d) => d.getTime())));
      devDays = Math.max(0, Math.round((maxDevEnd.getTime() - minDevStart.getTime()) / (1000 * 60 * 60 * 24)));
    }
  }

  const sitDate = project.SIT_Received_date ? new Date(project.SIT_Received_date) : null;
  const uatDate = project.UAT_Actual_End_Date ? new Date(project.UAT_Actual_End_Date) : null;
  if (sitDate && uatDate && !isNaN(sitDate.getTime()) && !isNaN(uatDate.getTime())) {
    testingDays = Math.max(0, Math.round((uatDate.getTime() - sitDate.getTime()) / (1000 * 60 * 60 * 24)));
  }

  return (
    <div className="pm-project-info-backdrop">
      <div className="pm-project-info-modal">
        {/* Header */}
        <div className="pm-project-info-header">
          <div className="pm-project-info-header-left">
            <div className="pm-project-info-icon-badge">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="pm-project-info-title">
                <span>{project.Ipm_Number}</span>
                <span className="pm-project-info-type-badge">
                  {project.Work_Order_Type || 'Project'}
                </span>
              </h2>
              <p className="pm-project-info-subtitle">{project.Summary}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="pm-project-info-header-close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="pm-project-info-body">
          {/* Status Alert Banner if Overdue */}
          {isOverdue && (
            <div className="pm-project-info-overdue-alert">
              <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
              <div>
                <strong>Overdue Warning: </strong>
                <span>Project schedule has breached target finish by {overdueDays} days.</span>
              </div>
            </div>
          )}

          {/* Left and Right Metadata Tables */}
          <div className="pm-project-info-grid">
            {/* Left Table */}
            <div className="pm-info-card-box">
              <h3 className="pm-info-card-title">
                Project Information (Left)
              </h3>
              <div>
                <div className="pm-info-row">
                  <span className="pm-info-label">Project Summary:</span>
                  <span className="pm-info-value" title={project.Summary}>
                    {project.Summary}
                  </span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">IPM Number:</span>
                  <span className="pm-info-value">{project.Ipm_Number}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">IT Delivery Lead:</span>
                  <span className="pm-info-value">{project.IT_Delivery_Lead}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">Product Owner:</span>
                  <span className="pm-info-value">{project.Product_Owner}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">Owned By:</span>
                  <span className="pm-info-value">{project.Owned_By}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">Clarity Planned Finish:</span>
                  <span className="pm-info-value">{formatDate(project.Clarity_Planned_Finish_Date)}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">Start Date:</span>
                  <span className="pm-info-value">{formatDate(project.Start_Date)}</span>
                </div>
              </div>
            </div>

            {/* Right Table */}
            <div className="pm-info-card-box">
              <h3 className="pm-info-card-title">
                Governance & Details (Right)
              </h3>
              <div>
                <div className="pm-info-row">
                  <span className="pm-info-label">Work Order Type:</span>
                  <span className="pm-info-value">{project.Work_Order_Type}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">Priority:</span>
                  <span className="pm-info-value">{project.Priority}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">Backup ITDL:</span>
                  <span className="pm-info-value">{project.Backup_IT_Delivery_Lead}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">PMO Project Manager:</span>
                  <span className="pm-info-value">{project.PMO_Project_Manager}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">Requestor Name:</span>
                  <span className="pm-info-value">{project.Requestor_Name}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">Planned Dev Completion:</span>
                  <span className="pm-info-value">{formatDate(project.Planned_DEV_completion_Date)}</span>
                </div>
                <div className="pm-info-row">
                  <span className="pm-info-label">End Date / Due Date:</span>
                  <span className="pm-info-value">{formatDate(project.Due_Date)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline & Circular Progress Bar */}
          <div className="pm-info-status-card">
            <div>
              <h4 className="pm-info-status-title">Lifecycle Completion Status</h4>
              <div>
                <span className="pm-info-label">Current Stage: </span>
                <span className="pm-info-stage-badge">
                  {statusDisplayText}
                </span>
              </div>
              <div className="pm-info-dates">
                <p><span className="pm-info-label">Start Date:</span> {formatDate(project.Start_Date)}</p>
                <p><span className="pm-info-label">Target Finish:</span> {formatDate(project.Due_Date)}</p>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <CircularStatusBar
                percentage={statusPercentage}
                color={progressBarColor}
                size={100}
                strokeWidth={9}
              />
            </div>
          </div>

          {/* Lifecycle Duration Metrics */}
          <div className="pm-info-phase-section">
            <h4 className="pm-info-card-title" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
              Phase Duration Breakdown (Days)
            </h4>
            <div className="pm-info-phase-grid">
              <div className="pm-phase-box">
                <span className="pm-phase-label">Planning</span>
                <span className="pm-phase-value planning">{planningDays} d</span>
              </div>
              <div className="pm-phase-box">
                <span className="pm-phase-label">Development</span>
                <span className="pm-phase-value dev">{devDays} d</span>
              </div>
              <div className="pm-phase-box">
                <span className="pm-phase-label">Testing</span>
                <span className="pm-phase-value testing">{testingDays} d</span>
              </div>
              <div className="pm-phase-box">
                <span className="pm-phase-label">Total Expected</span>
                <span className="pm-phase-value total">{totalDeliveredDays} d</span>
              </div>
            </div>
          </div>

          {/* Last Comment Box */}
          {project.Last_Comment && (
            <div className="pm-info-comment-box">
              <span className="pm-info-comment-header">Latest Comment Log:</span>
              <p className="pm-info-comment-text">
                {project.Last_Comment}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pm-project-info-footer">
          <button
            type="button"
            onClick={onClose}
            className="pm-project-info-close-btn"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}
