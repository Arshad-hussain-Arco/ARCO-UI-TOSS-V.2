import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  Download,
  FileSearch,
  Layers,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  X,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { useAuth } from '@hooks/useAuth';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useDebounce } from '@hooks/useDebounce';
import projectService from '@services/projectService';
import './ProjectMonitoringPage.css';

// Import Utilities & Calculations Engine (FUNCTIONALITY IS 100% PRESERVED)
import {
  mapWorkOrderRecord,
  mapChangeRequestRecord,
  calculateCategoryCounts,
  filterByCategory,
  calculateTeamRoleCounts,
  calculateUpcomingCompletions,
  calculateBreachMetrics,
  getDrilldownProjects,
  calculateCompletedProjectsTrends,
} from './utils/dataMapper';
import { PMStatusGroups } from './utils/staticData';
import { getStageInfo, getStatusFilterOptions, calculateStatusCounts } from './utils/statusMapper';

// Import UI Components for Expandable Table & Modals
import ProjectRow from './components/ProjectRow';
import ProjectSummary from './components/ProjectSummary';
import LifecycleToggle from './components/LifecycleToggle';
import StatusFilter from './components/StatusFilter';
import ProjectInfo1Modal from './components/ProjectInfo1Modal';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { ExportButton } from '@components/ui/ExportButton';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Skeleton } from '@components/feedback/Skeleton/Skeleton';

function formatDateToYMD(date) {
  if (!date || isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const STAGE_COLORS = {
  inception: '#8b5cf6',
  planning: 'var(--c-info)',
  building: '#06b6d4',
  testing: 'var(--c-warning)',
  release: '#fb923c',
  deployed: 'var(--c-success)',
  completed: 'var(--c-success)',
  'testing-blocked': 'var(--c-danger)',
  deferred: '#6b7280',
};

/* ── CSV / Excel Export Function ─────────────────────────────────────────── */
function exportToCSV(rows, filename, isCR = false) {
  if (!rows || !rows.length) return;
  const exportData = rows.map((p) => {
    if (isCR) {
      return {
        'CR IPM Number': p.Ipm_Number || p.code || p.ipmNumber || '',
        'Work Order ID': p.Wo_Id || p.woId || p.id || '',
        'Summary': p.Summary || p.summary || '',
        'Status': p.Status || p.status || p.stage || '',
        'Effort (MDs)': p.Effort_in_MDs || p.effortInMDs || '0',
        'Assigned Developer': p.Assigned_Developer || p.assignedDeveloper || '',
        'Additional Developers': p.Additional_Developers || p.additionalDevelopers || '',
        'Start Date': p.Start_Date || p.startDate || '',
        'End Date': p.End_Date || p.endDate || '',
      };
    }
    return {
      'Project Code': p.Ipm_Number || p.code || '',
      'Project ID': p.Wo_Id || p.id || '',
      'Summary': p.Summary || p.summary || '',
      'Status': p.Status || p.stage || '',
      'IT Delivery Lead': p.IT_Delivery_Lead || p.itdl || '',
      'Backup ITDL': p.Backup_IT_Delivery_Lead || p.backupItdl || '',
      'Product Owner': p.Product_Owner || p.po || '',
      'PMO Project Manager': p.PMO_Project_Manager || p.pmo || '',
      'Last Comment': p.Last_Comment || p.lastComment || '',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
  XLSX.writeFile(workbook, `${filename.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
}

/* ── Dynamic Drilldown Modal Overlay ────────────────────────────────────── */
function DrilldownModal({ stage, onClose, projectsData = [], changeRequestsData = [], canExport = true, onSelectProject }) {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!stage) return null;

  const drilldownResult = getDrilldownProjects(projectsData, changeRequestsData, stage);
  const isCR = Boolean(stage.isCR || drilldownResult.isCR);

  const matchedProjects = (drilldownResult.records || []).filter((p) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const code = (p.Ipm_Number || p.code || p.ipmNumber || '').toLowerCase();
    const summary = (p.Summary || p.summary || '').toLowerCase();
    const itdl = (p.IT_Delivery_Lead || p.itdl || '').toLowerCase();
    const po = (p.Product_Owner || p.po || '').toLowerCase();
    const dev = (p.Assigned_Developer || p.assignedDeveloper || '').toLowerCase();
    return code.includes(q) || summary.includes(q) || itdl.includes(q) || po.includes(q) || dev.includes(q);
  });

  const isMemberDrilldown = stage.type === 'member' || stage.roleLabel;
  const titleText = stage.label || stage.name || 'Stage Explorer';
  const roleText = stage.roleLabel || '';
  const memberNameText = stage.memberName || stage.name || stage.label;

  return (
    <div className="pm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="pm-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pm-modal-header pm-modal-header--member">
          {isMemberDrilldown && roleText ? (
            <div className="pm-modal-member-header">
              <div className="pm-modal-member-identity">
                <h2 className="pm-modal-member-name">{memberNameText}</h2>
                <span className="pm-modal-member-role">{roleText}</span>
              </div>
              <div className="pm-modal-member-meta">
                <span className="pm-modal-count-badge">{matchedProjects.length} Records</span>
              </div>
            </div>
          ) : (
            <div className="pm-modal-title-row">
              <h2 className="pm-modal-title">{titleText}</h2>
              <span className="pm-modal-count-badge">{matchedProjects.length} Records</span>
            </div>
          )}
          <button type="button" className="pm-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        <div className="pm-modal-toolbar">
          <div className="pm-search-wrap" style={{ width: 260 }}>
            <Search size={14} className="pm-search-icon" />
            <input
              ref={inputRef}
              type="text"
              className="pm-search-input"
              placeholder={isCR ? "Search CR IPM, summary, developer..." : "Search code, ITDL, Product Owner..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="pm-clear-btn" onClick={() => setSearch('')}>
                <X size={12} />
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="pm-modal-result-count">
              Showing <strong>{matchedProjects.length}</strong> records
            </span>
            <ExportButton
              excel={true}
              onExcelExport={() => exportToCSV(matchedProjects, `${titleText}_Export`, isCR)}
            />
          </div>
        </div>

        <div className="pm-modal-table-container">
          <table className="pm-master-table">
            <thead>
              {isCR ? (
                <tr>
                  <th>CR IPM Number</th>
                  <th>Work Order ID</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>Effort (MDs)</th>
                  <th>Assigned Developer</th>
                  <th>Additional Developers</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                </tr>
              ) : (
                <tr>
                  <th>Project Code</th>
                  <th>Project ID</th>
                  <th>Summary</th>
                  <th>Status</th>
                  <th>IT Delivery Lead</th>
                  <th>Backup ITDL</th>
                  <th>Product Owner</th>
                  <th>PMO Project Manager</th>
                  <th>Last Comment</th>
                </tr>
              )}
            </thead>
            <tbody>
              {matchedProjects.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="pm-empty-state">
                      <Search size={32} color="var(--border-secondary)" />
                      <p>No records found matching your search criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                matchedProjects.map((p, idx) =>
                  isCR ? (
                    <tr
                      key={p.Ipm_Number || p.code || p.Id || idx}
                      onClick={() => onSelectProject && onSelectProject(p)}
                      style={{ cursor: 'pointer' }}
                      className="pm-modal-project-row"
                    >
                      <td>
                        <span className="pm-project-code">{p.Ipm_Number || p.code}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{p.Wo_Id || p.woId || p.id}</span>
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <ProjectSummary summary={p.Summary || p.summary} />
                      </td>
                      <td>
                        <span className="pm-stage-pill" style={{ background: STAGE_COLORS[(p.Status || p.status || p.stage || '').toLowerCase()] || 'var(--c-primary)' }}>
                          {p.Status || p.status || p.stage || 'Open'}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-primary)' }}>{p.Effort_in_MDs || p.effortInMDs || '0'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-primary)' }}>{p.Assigned_Developer || p.assignedDeveloper || 'unassigned'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.Additional_Developers || p.additionalDevelopers || 'unassigned'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.Start_Date || p.startDate || '-'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.End_Date || p.endDate || '-'}</td>
                    </tr>
                  ) : (
                    <tr
                      key={p.Ipm_Number || p.code || p.Wo_Id || idx}
                      onClick={() => onSelectProject && onSelectProject(p)}
                      style={{ cursor: 'pointer' }}
                      className="pm-modal-project-row"
                    >
                      <td>
                        <span className="pm-project-code">{p.Ipm_Number || p.code}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{p.Wo_Id || p.id}</span>
                      </td>
                      <td style={{ maxWidth: 220 }}>
                        <ProjectSummary summary={p.Summary || p.summary} />
                      </td>
                      <td>
                        <span className="pm-stage-pill" style={{ background: STAGE_COLORS[(p.Status || p.stage || '').toLowerCase()] || 'var(--c-primary)' }}>
                          {p.Status || p.stage}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-primary)' }}>{p.IT_Delivery_Lead || p.itdl}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.Backup_IT_Delivery_Lead || p.backupItdl}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-primary)' }}>{p.Product_Owner || p.po}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.PMO_Project_Manager || p.pmo}</td>
                      <td>
                        <span className="pm-comment-text" title={p.Last_Comment || p.lastComment}>{p.Last_Comment || p.lastComment || 'No comments'}</span>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Dynamic Skeleton Layout ────────────────────────────────────────────── */
function ProjectMonitoringSkeleton({ activeTab }) {
  if (activeTab === 'summary') {
    const mockStages = [
      { label: 'INCEPTION', cls: 'pm-stage-inception' },
      { label: 'PLANNING', cls: 'pm-stage-planning' },
      { label: 'BUILDING', cls: 'pm-stage-building' },
      { label: 'TESTING', cls: 'pm-stage-testing' },
      { label: 'RELEASE PROCESS', cls: 'pm-stage-release' },
      { label: 'DEPLOYED', cls: 'pm-stage-deployed' },
      { label: 'COMPLETED', cls: 'pm-stage-completed' },
    ];
    const mockMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const teamRoles = ['IT Delivery Lead', 'Product Owner', 'Backup ITDL', 'SIT Lead', 'UAT Lead', 'Developer', 'Additional Developer'];

    return (
      <div className="pm-tab-content">
        {/* Lifecycle Pipeline Overview Card */}
        <div className="pm-pipeline-card">
          <div className="pm-pipeline-card-header">
            <h3 className="pm-card-title">
              <Layers size={14} /> LIFECYCLE PIPELINE OVERVIEW
            </h3>
            <button type="button" className="pm-refresh-text-btn" disabled>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          <div className="pm-pipeline-chips-container">
             <button className="pm-chip active" type="button" disabled>
               All Projects <Skeleton width={16} height={16} style={{ borderRadius: '8px', marginLeft: '6px' }} />
             </button>
          </div>

          <div className="pm-pipeline-track">
            {mockStages.map((s, i) => (
              <div key={i} className="pm-pipeline-stage">
                <div className={`pm-pipeline-block ${s.cls}`}>
                  <span className="pm-stage-label">{s.label}</span>
                  <span className="pm-stage-count">
                     <Skeleton width={36} height={36} style={{ borderRadius: '6px', margin: '0 auto' }} />
                  </span>
                  <div className="pm-stage-bar" />
                </div>
              </div>
            ))}
          </div>

          <div className="pm-pipeline-badges">
             <span className="pm-special-badge pm-badge-blocked" style={{ gap: 0 }}>
                Testing Blocked — <span style={{ background: 'var(--border-secondary)', color: 'transparent', borderRadius: '4px', display: 'inline-block', marginLeft: '4px' }}>00</span>
             </span>
             <span className="pm-special-badge pm-badge-deferred" style={{ gap: 0 }}>
                Deferred — <span style={{ background: 'var(--border-secondary)', color: 'transparent', borderRadius: '4px', display: 'inline-block', marginLeft: '4px' }}>00</span>
             </span>
          </div>
        </div>

        {/* Completed Projects Trends Chart Card */}
        <div className="pm-charts-row">
          <div className="pm-chart-card pm-chart-card--velocity" style={{ width: '100%' }}>
            <div className="pm-velocity-header">
              <h3 className="pm-card-title" style={{ margin: 0 }}>
                <CheckCircle size={14} color="var(--c-success)" /> COMPLETED PROJECTS TRENDS
              </h3>
              <div className="pm-timeframe-controls">
                {['Monthly', 'Quarterly', 'HalfYearly', 'Annual'].map((tf, i) => (
                  <button key={i} type="button" className={`pm-tf-btn ${i === 0 ? 'active' : ''}`} disabled>
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div className="pm-velocity-chart-wrap" style={{ minHeight: '180px' }}>
              <div className="pm-bar-chart">
                {mockMonths.map((lbl, i) => (
                  <div key={i} className="pm-bar-col">
                    <span className="pm-bar-value">
                      <Skeleton width={16} height={12} />
                    </span>
                    <div className="pm-bar-inner">
                      <div
                        className="pm-bar completed-bar"
                        style={{ height: `${Math.max(10, (i * 17) % 80 + 20)}%`, opacity: 0.5 }}
                      />
                    </div>
                    <span className="pm-bar-label">{lbl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Team Role Breakdown Cards Grid */}
        <div className="pm-section-subtitle" style={{ marginTop: 10 }}>TEAM ROLE SUMMARY BREAKDOWN CARDS</div>
        <div className="pm-itdl-grid">
          {teamRoles.map((role, i) => (
            <div key={i} className="pm-itdl-card">
              <div className="pm-itdl-card-header">
                <span className="pm-itdl-card-type-label">
                  <Users size={13} className="pm-itdl-card-icon" /> COUNT BY {role.toUpperCase()}
                </span>
                <span className="pm-chip-badge">
                   <Skeleton width={12} height={12} style={{ display: 'inline-block' }} />
                </span>
              </div>
              <div className="pm-itdl-divider" />
              <div className="pm-itdl-member-list">
                {Array(3).fill(0).map((_, j) => (
                  <div key={j} className="pm-itdl-member-row" style={{ cursor: 'default' }}>
                    <span className="pm-itdl-member-name"><Skeleton width={`${Math.random() * 40 + 40}%`} height={14} /></span>
                    <span className="pm-itdl-member-count"><Skeleton width={16} height={14} /></span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Upcoming Completion Milestone Cards */}
        <div className="pm-upcoming-completions-section">
          <div className="pm-upcoming-grid">
            {[
              'Development Completion In Upcoming Days',
              'Testing Completion In Upcoming Days',
              'Release / Delivery In Upcoming Days'
            ].map((title, i) => (
              <div key={i} className="pm-upcoming-card">
                <div className="pm-upcoming-card-header">
                  <Clock size={15} className="pm-upcoming-header-icon" />
                  <h3 className="pm-upcoming-card-title">{title}</h3>
                </div>
                <div className="pm-upcoming-tiles-grid">
                  {['15 Days', '30 Days', '45 Days', '60 Days'].map((label, j) => (
                    <div key={j} className="pm-upcoming-tile">
                      <span className="pm-upcoming-tile-count">
                        <Skeleton width={20} height={20} style={{ margin: '0 auto' }} />
                      </span>
                      <span className="pm-upcoming-tile-label">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === 'monitoring') {
    return (
      <div className="pm-tab-content">
        {/* Controls & Filter Card Skeleton */}
        <div className="pm-filter-card">
          <div className="pm-toolbar">
            <div className="pm-search-wrap" style={{ flex: 1, minWidth: 240, border: '1px solid var(--border-secondary)', padding: '8px 12px', borderRadius: '6px' }}>
               <Skeleton width="100%" height={20} />
            </div>
            <div style={{ width: '160px', border: '1px solid var(--border-secondary)', padding: '8px 12px', borderRadius: '6px' }}>
               <Skeleton width="100%" height={20} />
            </div>
            <div style={{ width: '130px', border: '1px solid var(--border-secondary)', padding: '8px 12px', borderRadius: '6px' }}>
               <Skeleton width="100%" height={20} />
            </div>
            <div style={{ width: '130px', border: '1px solid var(--border-secondary)', padding: '8px 12px', borderRadius: '6px' }}>
               <Skeleton width="100%" height={20} />
            </div>
            <Skeleton width={60} height={32} style={{ borderRadius: '6px' }} />
            <Skeleton width={140} height={32} style={{ borderRadius: '6px', marginLeft: 'auto' }} />
          </div>
        </div>

        {/* Main Master Table Skeleton */}
        <div className="pm-table-card">
          <div className="pm-table-container">
            <table className="pm-master-table">
              <thead>
                <tr>
                  <th className="pm-col-code pm-sticky-col pm-sticky-col-1">Project Code</th>
                  <th className="pm-col-summary pm-sticky-col pm-sticky-col-2">Summary</th>
                  <th className="pm-col-owner pm-sticky-col pm-sticky-col-3">IT Delivery Lead</th>
                  <th className="pm-col-lifecycle">Lifecycle Progress</th>
                </tr>
              </thead>
              <tbody>
                {Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="pm-project-row mode-business">
                    <td className="pm-col-code pm-sticky-col pm-sticky-col-1">
                      <div className="pm-code-cell">
                        <span className="pm-expand-icon">
                          <ChevronRight size={13} color="var(--text-secondary)" />
                        </span>
                        <span className="pm-project-code">
                          <Skeleton width={80} height={14} />
                        </span>
                      </div>
                    </td>
                    <td className="pm-col-summary pm-sticky-col pm-sticky-col-2">
                       <Skeleton width={`${Math.random() * 20 + 70}%`} height={14} className="mb-1" />
                       <Skeleton width={`${Math.random() * 20 + 40}%`} height={12} />
                    </td>
                    <td className="pm-col-owner pm-sticky-col pm-sticky-col-3">
                       <span className="pm-owner-text">
                          <Skeleton width={120} height={14} />
                       </span>
                    </td>
                    <td className="pm-col-lifecycle">
                       <div className="pm-lifecycle-wrapper" style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '600px', height: '40px', gap: '4px' }}>
                          {['Inception', 'Planning', 'Building', 'Testing', 'Release Process', 'Deployed', 'Completed'].map((step, j) => (
                             <div key={j} style={{ flex: 1, height: '6px', background: 'var(--border-secondary)', borderRadius: '3px' }} />
                          ))}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Breaches Tab Skeleton
  return (
    <div className="pm-tab-content pm-tab-content--breaches">
      <div className="pm-breaches-banner">
        <div className="pm-breaches-banner-pills">
          <div className="pm-banner-pill pill-red">
            <span className="pill-dot" />
            <span className="pill-label">SLA Breaches</span>
            <span className="pill-val"><Skeleton width={20} height={16} /></span>
          </div>
          <div className="pm-banner-pill pill-amber">
            <span className="pill-dot" />
            <span className="pill-label">Due Date Alerts</span>
            <span className="pill-val"><Skeleton width={20} height={16} /></span>
          </div>
          <div className="pm-banner-pill pill-emerald">
            <span className="pill-dot" />
            <span className="pill-label">CR Exceptions</span>
            <span className="pill-val"><Skeleton width={20} height={16} /></span>
          </div>
        </div>
      </div>

      <div className="pm-governance-grid">
        {[
          { title: 'SLA & Operational Breaches', sub: 'Card 11 (7 Rule Categories)', icon: <AlertTriangle size={16} />, color: 'red' },
          { title: 'Due Date Thresholds', sub: 'Card 12 (2 Rule Categories)', icon: <Calendar size={16} />, color: 'amber' },
          { title: 'CR Governance Exceptions', sub: 'Card 13 (4 Rule Categories)', icon: <ShieldCheck size={16} />, color: 'emerald' }
        ].map((panel, i) => (
          <div key={i} className={`pm-gov-card pm-gov-card--${panel.color}`}>
            <div className="pm-gov-card-header">
              <div className="pm-gov-header-left">
                <div className={`pm-gov-icon-badge badge-${panel.color}`}>
                  {panel.icon}
                </div>
                <div className="pm-gov-title-block">
                  <h3 className="pm-card-title">{panel.title}</h3>
                  <span className="pm-card-subtitle">{panel.sub}</span>
                </div>
              </div>
              <span className={`pm-gov-total-badge badge-${panel.color}`}>
                <Skeleton width={16} height={16} />
              </span>
            </div>
            <div className="pm-gov-card-body">
              {Array(i === 0 ? 7 : i === 1 ? 2 : 4).fill(0).map((_, j) => (
                <button key={j} type="button" className="pm-breach-metric disabled-metric">
                  <div className="pm-breach-metric-left">
                    <span className="pm-metric-dot dot-muted" />
                    <span className="pm-breach-label"><Skeleton width={160 + Math.random() * 60} height={14} /></span>
                  </div>
                  <div className="pm-breach-metric-right">
                    <Skeleton width={20} height={20} style={{ borderRadius: '4px' }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PROJECT MONITORING PAGE — RESTORED PREVIOUS NEW UI DESIGN
   ═══════════════════════════════════════════════════════════════════════════ */
export function ProjectMonitoringPage() {
  useDocumentTitle('Project Monitoring');
  const { hasPermission } = useAuth();
  const canExport = hasPermission ? hasPermission('PROJECT_MONITORING_EXPORT') : true;

  // View mode: 'business' (SDLC View 7 stages) vs 'development' (Tech View 17 stages)
  const [lifecycleMode, setLifecycleMode] = useState('business');

  // Navigation Tabs (RESTORED 3-TAB STRUCTURE)
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'monitoring' | 'breaches'
  const [selectedCategory, setSelectedCategory] = useState('All Projects');
  const [syncing, setSyncing] = useState(false);

  // Tab 1 — chart timeframe & drilldowns
  const [timeframe, setTimeframe] = useState('Monthly');
  const [drilldownStage, setDrilldownStage] = useState(null);
  const [selectedProjectModal, setSelectedProjectModal] = useState(null);

  // Tab 2 — directory filters & expansion
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Toggle Mode Handler
  const handleToggleLifecycleMode = (isDevMode) => {
    setLifecycleMode(isDevMode ? 'development' : 'business');
  };

  // Backend Work Orders and Change Requests
  const [projectsList, setProjectsList] = useState([]);
  const [changeRequestsList, setChangeRequestsList] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState(null);

  // Fetch API Data from backend
  const fetchData = useCallback(async () => {
    try {
      setLoadingData(true);
      setError(null);
      const workOrderRes = await projectService.getWorkOrderStatus();

      let rawWO = [];
      let rawCR = [];

      if (workOrderRes) {
        if (Array.isArray(workOrderRes.result1)) rawWO = workOrderRes.result1;
        else if (Array.isArray(workOrderRes.workOrders)) rawWO = workOrderRes.workOrders;

        if (Array.isArray(workOrderRes.result2)) rawCR = workOrderRes.result2;
        else if (Array.isArray(workOrderRes.changeRequests)) rawCR = workOrderRes.changeRequests;
      }

      const mappedWO = rawWO.map(mapWorkOrderRecord);
      const mappedCR = rawCR.map(mapChangeRequestRecord);

      setProjectsList(mappedWO);
      setChangeRequestsList(mappedCR);
    } catch (err) {
      console.error('Error fetching project monitoring data:', err);
      setError(err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync handler
  const handleSync = async () => {
    setSyncing(true);
    await fetchData();
    setSyncing(false);
  };

  const tableContainerRef = useRef(null);

  const updateTableVisibleWidth = useCallback(() => {
    const el = tableContainerRef.current;
    if (el) {
      const w = el.getBoundingClientRect().width;
      if (w > 0) {
        el.style.setProperty('--table-visible-width', `${Math.floor(w)}px`);
      }
    }
  }, []);

  useEffect(() => {
    updateTableVisibleWidth();
    window.addEventListener('resize', updateTableVisibleWidth);
    const el = tableContainerRef.current;
    let ro = null;
    if (el) {
      ro = new ResizeObserver(updateTableVisibleWidth);
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', updateTableVisibleWidth);
      if (ro) ro.disconnect();
    };
  }, [updateTableVisibleWidth, lifecycleMode, activeTab]);

  // Reset Filters Handler
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setStartDate('');
    setEndDate('');
  };

  // 1. Dynamic Category Pill Chips ("All Projects" + unique Depends_On types)
  const categoryChips = useMemo(() => {
    return calculateCategoryCounts(projectsList);
  }, [projectsList]);

  // Filter projects by selected Project Type radio/chip
  const categoryProjects = useMemo(() => {
    return projectsList.filter((p) => filterByCategory(p, selectedCategory));
  }, [projectsList, selectedCategory]);

  // Filter CRs matching category projects. Only "All Projects" (no real
  // filter selected) returns the full unfiltered list — a specific category
  // with zero WO-Id matches must return zero CRs, not silently fall back to
  // everyone else's CRs (that previously made Cards 6/7 ignore the selected
  // category whenever the CR->WO Id linkage found no matches).
  const categoryCRs = useMemo(() => {
    if (!changeRequestsList || changeRequestsList.length === 0) return [];
    if (!selectedCategory || selectedCategory === 'All Projects') return changeRequestsList;

    const activeWoIds = new Set(categoryProjects.map((p) => String(p.Wo_Id || '')));
    return changeRequestsList.filter((cr) => activeWoIds.has(String(cr.Wo_Id || '')));
  }, [changeRequestsList, categoryProjects, selectedCategory]);

  // 2. Team Role Breakdown Cards (Cards 1 to 7)
  const teamCardsData = useMemo(() => {
    return [
      { id: 1, title: 'Count by IT Delivery Lead', field: 'itdl', isCR: false },
      { id: 2, title: 'Count by Product Owner', field: 'po', isCR: false },
      { id: 3, title: 'Count by Backup ITDL', field: 'backupItdl', isCR: false },
      { id: 4, title: 'Count by SIT Lead', field: 'sitLead', isCR: false },
      { id: 5, title: 'Count by UAT Lead', field: 'uatLead', isCR: false },
      { id: 6, title: 'Count by Developer', field: 'developer', isCR: true },
      { id: 7, title: 'Count by Additional Developer', field: 'additionalDev', isCR: true },
    ].map((r) => ({
      ...r,
      members: calculateTeamRoleCounts(categoryProjects, categoryCRs, r.field),
    }));
  }, [categoryProjects, categoryCRs]);

  // 3. Upcoming Completion Milestone Cards (Cards 8 to 10)
  const upcomingCompletions = useMemo(() => {
    return {
      development: calculateUpcomingCompletions(categoryProjects, categoryCRs, 'development'),
      testing: calculateUpcomingCompletions(categoryProjects, categoryCRs, 'testing'),
      delivery: calculateUpcomingCompletions(categoryProjects, categoryCRs, 'delivery'),
    };
  }, [categoryProjects, categoryCRs]);

  // 4. Dynamic Breach Metrics (Cards 11 to 13)
  const breachMetrics = useMemo(() => {
    return calculateBreachMetrics(categoryProjects, changeRequestsList);
  }, [categoryProjects, changeRequestsList]);

  const totalSlaBreaches = useMemo(() => {
    return breachMetrics.breaches.reduce((sum, m) => sum + m.count, 0);
  }, [breachMetrics.breaches]);

  const totalDueDateBreaches = useMemo(() => {
    return breachMetrics.dueDates.reduce((sum, m) => sum + m.count, 0);
  }, [breachMetrics.dueDates]);

  const totalCrBreaches = useMemo(() => {
    return breachMetrics.crExceptions.reduce((sum, m) => sum + m.count, 0);
  }, [breachMetrics.crExceptions]);

  // 5. Completed Projects Trends Dataset
  const completedTrends = useMemo(() => {
    return calculateCompletedProjectsTrends(categoryProjects, timeframe);
  }, [categoryProjects, timeframe]);

  const maxTrendValue = Math.max(...(completedTrends.counts || [1]), 1);

  // Calculate status counts for custom status filter dropdown with count badges
  const statusCounts = useMemo(() => {
    return calculateStatusCounts(categoryProjects, lifecycleMode);
  }, [categoryProjects, lifecycleMode]);

  // Filtered projects list for Tab 2 (Project Directory - Legacy FilterProjectGridData eligibility StatusId > 0)
  const filteredProjects = useMemo(() => {
    return categoryProjects.filter((p) => {
      // Legacy Project Eligibility Validation: Only valid mapped SDLC statuses (StatusId > 0)
      if (!p.StatusId || p.StatusId <= 0) {
        return false;
      }

      // Search query filter
      const q = debouncedSearchQuery.toLowerCase().trim();
      if (
        q &&
        !p.Ipm_Number.toLowerCase().includes(q) &&
        !p.IT_Delivery_Lead.toLowerCase().includes(q) &&
        !p.Product_Owner.toLowerCase().includes(q) &&
        !p.Summary.toLowerCase().includes(q)
      ) {
        return false;
      }

      // Status filter dropdown (7 Phases / 17 Stages status filtering)
      if (statusFilter && statusFilter !== 'All') {
        const selLower = statusFilter.toLowerCase().trim();
        const statusStr = (p.Status || '').toLowerCase().trim();

        if (statusStr !== selLower) {
          const groupObj = PMStatusGroups.find((g) => g.id === p.StatusGroup);
          const groupName = groupObj ? groupObj.name.toLowerCase() : '';
          const info = getStageInfo(p.Status, lifecycleMode);
          const phaseLabel = info?.phase?.label ? info.phase.label.toLowerCase() : '';

          if (groupName !== selLower && phaseLabel !== selLower) {
            return false;
          }
        }
      }

      // Start Date Filter
      if (startDate) {
        if (!p.Start_Date || p.Start_Date < startDate) return false;
      }

      // End Date Filter
      if (endDate) {
        if (!p.Due_Date || p.Due_Date > endDate) return false;
      }

      return true;
    });
  }, [categoryProjects, debouncedSearchQuery, statusFilter, startDate, endDate, lifecycleMode]);

  // Dynamic Lifecycle Pipeline Overview stages (7 SDLC Stages)
  const dynamicPipelineStages = useMemo(() => {
    const stages = [
      { key: 'inception', label: 'Inception', cls: 'pm-stage-inception', count: 0 },
      { key: 'planning', label: 'Planning', cls: 'pm-stage-planning', count: 0 },
      { key: 'building', label: 'Building', cls: 'pm-stage-building', count: 0 },
      { key: 'testing', label: 'Testing', cls: 'pm-stage-testing', count: 0 },
      { key: 'release', label: 'Release Process', cls: 'pm-stage-release', count: 0 },
      { key: 'deployed', label: 'Deployed', cls: 'pm-stage-deployed', count: 0 },
      { key: 'completed', label: 'Completed', cls: 'pm-stage-completed', count: 0 },
    ];

    categoryProjects.forEach((p) => {
      const stageGroup = p.StatusGroup || 0;
      if (stageGroup >= 1 && stageGroup <= 7) {
        stages[stageGroup - 1].count++;
      }
    });

    return stages;
  }, [categoryProjects]);

  const testingBlockedCount = useMemo(() => {
    return categoryProjects.filter((p) => p.Status === 'Testing Blocked').length;
  }, [categoryProjects]);

  const deferredCount = useMemo(() => {
    return categoryProjects.filter((p) => p.Status === 'Deferred').length;
  }, [categoryProjects]);

  if (error) {
    return (
      <ErrorState
        title="Projects could not be loaded"
        description={error.message}
        onRetry={fetchData}
      />
    );
  }

  return (
    <div className="pm-shell" style={{ position: 'relative' }}>
      <div className="pm-tabs-nav" role="tablist" aria-label="Project tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'summary'}
          className={`pm-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <Layers size={15} /> Project Summary
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'monitoring'}
          className={`pm-tab-btn ${activeTab === 'monitoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitoring')}
        >
          <FileSearch size={15} /> Project Monitoring
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'breaches'}
          className={`pm-tab-btn ${activeTab === 'breaches' ? 'active' : ''}`}
          onClick={() => setActiveTab('breaches')}
        >
          <Shield size={15} /> Project Breaches
        </button>
      </div>

      {loadingData ? (
        <ProjectMonitoringSkeleton activeTab={activeTab} />
      ) : (
        <>
          {/* ═══════════════════════════════════════════════════════════════════════
             TAB 1: PROJECT SUMMARY
             ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'summary' && (
            <div className="pm-tab-content">
          {/* Lifecycle Pipeline Overview Card */}
          <div className="pm-pipeline-card">
            <div className="pm-pipeline-card-header">
              <h3 className="pm-card-title">
                <Layers size={14} /> Lifecycle Pipeline Overview
              </h3>
              <button
                type="button"
                className={`pm-refresh-text-btn ${syncing ? 'spinning' : ''}`}
                onClick={handleSync}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {/* Category Pill Chips */}
            <div className="pm-pipeline-chips-container">
              {categoryChips.map((chip) => (
                <button
                  type="button"
                  key={chip.id}
                  className={`pm-chip ${selectedCategory === chip.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(chip.id)}
                >
                  {chip.label}
                  <span className="pm-chip-badge">{chip.count}</span>
                </button>
              ))}
            </div>

            {/* Stage Progress Blocks */}
            <div className="pm-pipeline-track">
              {dynamicPipelineStages.map((s) => (
                <div key={s.key} className="pm-pipeline-stage">
                  <div
                    className={`pm-pipeline-block ${s.cls} clickable`}
                    role="button"
                    tabIndex={0}
                    title={`View ${s.label} projects`}
                    onClick={() =>
                      setDrilldownStage({
                        key: s.key,
                        label: s.label,
                        records: categoryProjects.filter((p) => (p.StatusGroup || 0) === dynamicPipelineStages.indexOf(s) + 1),
                      })
                    }
                  >
                    <span className="pm-stage-label">{s.label}</span>
                    <span className="pm-stage-count">{s.count}</span>
                    <div className="pm-stage-bar" />
                    <span className="pm-stage-click-hint">Click to explore →</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Exception Badges */}
            <div className="pm-pipeline-badges">
              <span
                className="pm-special-badge pm-badge-blocked"
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  setDrilldownStage({
                    key: 'testing-blocked',
                    label: 'Testing Blocked',
                    records: categoryProjects.filter((p) => p.Status === 'Testing Blocked'),
                  })
                }
              >
                Testing Blocked — {testingBlockedCount}
              </span>
              <span
                className="pm-special-badge pm-badge-deferred"
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  setDrilldownStage({
                    key: 'deferred',
                    label: 'Deferred',
                    records: categoryProjects.filter((p) => p.Status === 'Deferred'),
                  })
                }
              >
                Deferred — {deferredCount}
              </span>
            </div>
          </div>

          {/* Completed Projects Trends Chart Card */}
          <div className="pm-charts-row">
            <div className="pm-chart-card pm-chart-card--velocity" style={{ width: '100%' }}>
              <div className="pm-velocity-header">
                <h3 className="pm-card-title" style={{ margin: 0 }}>
                  <CheckCircle size={14} color="var(--c-success)" /> Completed Projects Trends
                </h3>
                <div className="pm-timeframe-controls">
                  {['Monthly', 'Quarterly', 'HalfYearly', 'Annual'].map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      className={`pm-tf-btn ${timeframe === tf ? 'active' : ''}`}
                      onClick={() => setTimeframe(tf)}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bar Chart Bars */}
              <div className="pm-velocity-chart-wrap">
                <div className="pm-bar-chart">
                  {completedTrends.labels.map((lbl, idx) => {
                    const count = completedTrends.counts[idx] || 0;
                    const heightPct = Math.round((count / maxTrendValue) * 100);
                    return (
                      <div key={lbl} className="pm-bar-col">
                        <span className="pm-bar-value">{count}</span>
                        <div className="pm-bar-inner">
                          <div
                            className="pm-bar completed-bar"
                            style={{ height: `${Math.max(4, heightPct)}%` }}
                            title={`${lbl}: ${count} completed projects`}
                          />
                        </div>
                        <span className="pm-bar-label">{lbl}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Team Role Breakdown Cards Grid (Cards 1 to 7) */}
          <div className="pm-section-subtitle" style={{ marginTop: 10 }}>Team Role Summary Breakdown Cards</div>
          <div className="pm-itdl-grid">
            {teamCardsData.map((card) => (
              <div key={card.id} className="pm-itdl-card">
                <div className="pm-itdl-card-header">
                  <span className="pm-itdl-card-type-label">
                    <Users size={13} className="pm-itdl-card-icon" /> {card.title}
                  </span>
                  <span className="pm-chip-badge">{card.members.length}</span>
                </div>
                <div className="pm-itdl-divider" />
                <div className="pm-itdl-member-list">
                  {card.members.map((m) => (
                    <div
                      key={m.name}
                      className="pm-itdl-member-row"
                      onClick={() =>
                        setDrilldownStage({
                          key: card.field,
                          label: `${card.title}: ${m.name}`,
                          records: m.records,
                          isCR: card.isCR,
                          type: 'member',
                        })
                      }
                    >
                      <span className="pm-itdl-member-name">{m.name}</span>
                      <span className="pm-itdl-member-count">{m.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming Completion Milestone Cards (Cards 8 to 10 - Matches requested design) */}
          <div className="pm-upcoming-completions-section">
            <div className="pm-upcoming-grid">
              {/* Card 8: Dev Completion */}
              <div className="pm-upcoming-card">
                <div className="pm-upcoming-card-header">
                  <Clock size={15} className="pm-upcoming-header-icon" />
                  <h3 className="pm-upcoming-card-title">Development Completion In Upcoming Days</h3>
                </div>
                <div className="pm-upcoming-tiles-grid">
                  {['15', '30', '45', '60'].map((days) => {
                    const bData = upcomingCompletions.development?.[`b${days}`] || { count: 0, records: [] };
                    const isActive = bData.count > 0;
                    return (
                      <div
                        key={days}
                        className={`pm-upcoming-tile ${isActive ? 'active' : 'inactive'}`}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          setDrilldownStage({
                            key: 'devUpcoming',
                            label: `Dev Completion in ${days} Days`,
                            records: bData.records,
                            isCR: true,
                          })
                        }
                      >
                        <span className="pm-upcoming-tile-label">{days} Days</span>
                        <span className="pm-upcoming-tile-count">{bData.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 9: Testing Completion */}
              <div className="pm-upcoming-card">
                <div className="pm-upcoming-card-header">
                  <Calendar size={15} className="pm-upcoming-header-icon" />
                  <h3 className="pm-upcoming-card-title">Testing Completion In Upcoming Days</h3>
                </div>
                <div className="pm-upcoming-tiles-grid">
                  {['15', '30', '45', '60'].map((days) => {
                    const bData = upcomingCompletions.testing?.[`b${days}`] || { count: 0, records: [] };
                    const isActive = bData.count > 0;
                    return (
                      <div
                        key={days}
                        className={`pm-upcoming-tile ${isActive ? 'active' : 'inactive'}`}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          setDrilldownStage({
                            key: 'testingUpcoming',
                            label: `Testing Completion in ${days} Days`,
                            records: bData.records,
                            isCR: false,
                          })
                        }
                      >
                        <span className="pm-upcoming-tile-label">{days} Days</span>
                        <span className="pm-upcoming-tile-count">{bData.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card 10: Delivery Completion */}
              <div className="pm-upcoming-card">
                <div className="pm-upcoming-card-header">
                  <CheckCircle size={15} className="pm-upcoming-header-icon" />
                  <h3 className="pm-upcoming-card-title">Delivery Completion In Upcoming Days</h3>
                </div>
                <div className="pm-upcoming-tiles-grid">
                  {['15', '30', '45', '60'].map((days) => {
                    const bData = upcomingCompletions.delivery?.[`b${days}`] || { count: 0, records: [] };
                    const isActive = bData.count > 0;
                    return (
                      <div
                        key={days}
                        className={`pm-upcoming-tile ${isActive ? 'active' : 'inactive'}`}
                        role="button"
                        tabIndex={0}
                        style={{ cursor: 'pointer' }}
                        onClick={() =>
                          setDrilldownStage({
                            key: 'deliveryUpcoming',
                            label: `Delivery Completion in ${days} Days`,
                            records: bData.records,
                            isCR: false,
                          })
                        }
                      >
                        <span className="pm-upcoming-tile-label">{days} Days</span>
                        <span className="pm-upcoming-tile-count">{bData.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         TAB 2: PROJECT MONITORING (WITH EXPANDABLE ROWS)
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'monitoring' && (
        <div className="pm-tab-content">
          {/* Controls & Filter Card */}
          <div className="pm-filter-card">
            <div className="pm-toolbar">
              {/* Search Query Input */}
              <div className="pm-search-wrap" style={{ flex: 1, minWidth: 240 }}>
                <Search size={14} className="pm-search-icon" />
                <input
                  type="text"
                  className="pm-search-input"
                  placeholder="Search by code, ITDL, PO, or summary..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button type="button" className="pm-clear-btn" onClick={() => setSearchQuery('')}>
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Customized Status Dropdown Filter with Count Badges */}
              <StatusFilter
                value={statusFilter}
                onChange={setStatusFilter}
                mode={lifecycleMode}
                statusCounts={statusCounts}
              />

              {/* Start Date Customized DatePicker */}
              <div className="pm-datepicker-wrap" title="Start Date From">
                <DatePicker
                  value={startDate ? new Date(startDate) : null}
                  onChange={(date) => setStartDate(date ? formatDateToYMD(date) : '')}
                  placeholder="Start Date"
                  showClear={true}
                  className="pm-custom-datepicker"
                />
              </div>

              {/* End Date Customized DatePicker */}
              <div className="pm-datepicker-wrap" title="End Date To">
                <DatePicker
                  value={endDate ? new Date(endDate) : null}
                  onChange={(date) => setEndDate(date ? formatDateToYMD(date) : '')}
                  placeholder="End Date"
                  showClear={true}
                  className="pm-custom-datepicker"
                />
              </div>

              {/* Reset Filters */}
              <button
                type="button"
                className="pm-refresh-text-btn"
                onClick={handleResetFilters}
              >
                Reset
              </button>

              {/* Lifecycle Mode Toggle ('business' vs 'development') */}
              <LifecycleToggle mode={lifecycleMode} onToggle={handleToggleLifecycleMode} />
            </div>
          </div>

          {/* Main Master Table with Expandable Project Rows */}
          <div className="pm-table-card">
            <div className="pm-table-container" ref={tableContainerRef}>
              <table className="pm-master-table">
                <thead>
                  <tr>
                    <th className="pm-col-code pm-sticky-col pm-sticky-col-1">Project Code</th>
                    <th className="pm-col-summary pm-sticky-col pm-sticky-col-2">Summary</th>
                    <th className="pm-col-owner pm-sticky-col pm-sticky-col-3">IT Delivery Lead</th>
                    <th className="pm-col-lifecycle">Lifecycle Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="pm-empty-state">
                          <Search size={32} color="var(--border-secondary)" />
                          <p>No projects match your search criteria.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => (
                      <ProjectRow
                        key={project.Wo_Id || project.Ipm_Number || project.id}
                        project={{
                          ...project,
                          id: project.Wo_Id || project.id,
                          code: project.Ipm_Number || project.code,
                          summary: project.Summary || project.summary,
                          itdl: project.IT_Delivery_Lead || project.itdl,
                          po: project.Product_Owner || project.po,
                          backupItdl: project.Backup_IT_Delivery_Lead || project.backupItdl,
                          pmo: project.PMO_Project_Manager || project.pmo,
                          ownedBy: project.Owned_By || project.ownedBy,
                          requestorName: project.Requestor_Name || project.requestorName,
                          workOrderType: project.Work_Order_Type || project.workOrderType,
                          priority: project.Priority || project.priority,
                          startDate: project.Start_Date || project.startDate,
                          endDate: project.Due_Date || project.endDate,
                          dueDate: project.Due_Date || project.dueDate,
                          clarityFinishDate: project.Clarity_Planned_Finish_Date || project.clarityFinishDate,
                          plannedDevDate: project.Planned_DEV_completion_Date || project.plannedDevDate,
                          sitReceivedDate: project.SIT_Received_date || project.sitReceivedDate,
                          uatEndDate: project.UAT_Actual_End_Date || project.uatEndDate,
                          dependsOn: project.Depends_On || project.dependsOn,
                          lastComment: project.Last_Comment || project.lastComment,
                          fullDesc: project.Description || project.Summary || project.fullDesc,
                          stage: project.Status || project.stage,
                        }}
                        changeRequests={changeRequestsList}
                        isExpanded={expandedId === (project.Wo_Id || project.Ipm_Number)}
                        onToggleExpand={() =>
                          setExpandedId(expandedId === (project.Wo_Id || project.Ipm_Number) ? null : (project.Wo_Id || project.Ipm_Number))
                        }
                        mode={lifecycleMode}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         TAB 3: PROJECT BREACHES & GOVERNANCE
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'breaches' && (
        <div className="pm-tab-content pm-tab-content--breaches">
          {/* Governance Summary Banner */}
          <div className="pm-breaches-banner">
            <div className="pm-breaches-banner-pills">
              <div className="pm-banner-pill pill-red">
                <span className="pill-dot" />
                <span className="pill-label">SLA Breaches</span>
                <span className="pill-val">{totalSlaBreaches}</span>
              </div>
              <div className="pm-banner-pill pill-amber">
                <span className="pill-dot" />
                <span className="pill-label">Due Date Alerts</span>
                <span className="pill-val">{totalDueDateBreaches}</span>
              </div>
              <div className="pm-banner-pill pill-emerald">
                <span className="pill-dot" />
                <span className="pill-label">CR Exceptions</span>
                <span className="pill-val">{totalCrBreaches}</span>
              </div>
            </div>
          </div>

          {/* 3-Column Governance Grid */}
          <div className="pm-governance-grid">
            {/* Column 1: SLA Breaches (Card 11) */}
            <div className="pm-gov-card pm-gov-card--red">
              <div className="pm-gov-card-header">
                <div className="pm-gov-header-left">
                  <div className="pm-gov-icon-badge badge-red">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="pm-gov-title-block">
                    <h3 className="pm-card-title">SLA &amp; Operational Breaches</h3>
                    <span className="pm-card-subtitle">Card 11 (7 Rule Categories)</span>
                  </div>
                </div>
                <span className="pm-gov-total-badge badge-red">{totalSlaBreaches}</span>
              </div>
              <div className="pm-gov-card-body">
                {breachMetrics.breaches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pm-breach-metric ${m.count > 0 ? 'clickable' : 'disabled-metric'}`}
                    onClick={() => {
                      if (m.count > 0) setDrilldownStage(m);
                    }}
                  >
                    <div className="pm-breach-metric-left">
                      <span className={`pm-metric-dot ${m.count > 0 ? 'dot-red' : 'dot-muted'}`} />
                      <span className="pm-breach-label">{m.label}</span>
                    </div>
                    <div className="pm-breach-metric-right">
                      <span className={`pm-breach-val ${m.count === 0 ? 'zero' : 'nonzero nonzero-red'}`}>{m.count}</span>
                      {m.count > 0 && <ChevronRight size={13} className="pm-breach-chevron" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Column 2: Due Dates (Card 12) */}
            <div className="pm-gov-card pm-gov-card--amber">
              <div className="pm-gov-card-header">
                <div className="pm-gov-header-left">
                  <div className="pm-gov-icon-badge badge-amber">
                    <Calendar size={16} />
                  </div>
                  <div className="pm-gov-title-block">
                    <h3 className="pm-card-title">Due Date Thresholds</h3>
                    <span className="pm-card-subtitle">Card 12 (2 Rule Categories)</span>
                  </div>
                </div>
                <span className="pm-gov-total-badge badge-amber">{totalDueDateBreaches}</span>
              </div>
              <div className="pm-gov-card-body">
                {breachMetrics.dueDates.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pm-breach-metric ${m.count > 0 ? 'clickable' : 'disabled-metric'}`}
                    onClick={() => {
                      if (m.count > 0) setDrilldownStage(m);
                    }}
                  >
                    <div className="pm-breach-metric-left">
                      <span className={`pm-metric-dot ${m.count > 0 ? 'dot-amber' : 'dot-muted'}`} />
                      <span className="pm-breach-label">{m.label}</span>
                    </div>
                    <div className="pm-breach-metric-right">
                      <span className={`pm-breach-val ${m.count === 0 ? 'zero' : 'nonzero nonzero-amber'}`}>{m.count}</span>
                      {m.count > 0 && <ChevronRight size={13} className="pm-breach-chevron" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Column 3: CR Exceptions (Card 13) */}
            <div className="pm-gov-card pm-gov-card--emerald">
              <div className="pm-gov-card-header">
                <div className="pm-gov-header-left">
                  <div className="pm-gov-icon-badge badge-emerald">
                    <ShieldCheck size={16} />
                  </div>
                  <div className="pm-gov-title-block">
                    <h3 className="pm-card-title">CR Governance Exceptions</h3>
                    <span className="pm-card-subtitle">Card 13 (4 Rule Categories)</span>
                  </div>
                </div>
                <span className="pm-gov-total-badge badge-emerald">{totalCrBreaches}</span>
              </div>
              <div className="pm-gov-card-body">
                {breachMetrics.crExceptions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pm-breach-metric ${m.count > 0 ? 'clickable' : 'disabled-metric'}`}
                    onClick={() => {
                      if (m.count > 0) setDrilldownStage(m);
                    }}
                  >
                    <div className="pm-breach-metric-left">
                      <span className={`pm-metric-dot ${m.count > 0 ? 'dot-emerald' : 'dot-muted'}`} />
                      <span className="pm-breach-label">{m.label}</span>
                    </div>
                    <div className="pm-breach-metric-right">
                      <span className={`pm-breach-val ${m.count === 0 ? 'zero' : 'nonzero nonzero-emerald'}`}>{m.count}</span>
                      {m.count > 0 && <ChevronRight size={13} className="pm-breach-chevron" />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Dynamic Drilldown Modal Overlay */}
      {drilldownStage && (
        <DrilldownModal
          stage={drilldownStage}
          onClose={() => setDrilldownStage(null)}
          projectsData={categoryProjects}
          changeRequestsData={changeRequestsList}
          canExport={canExport}
          onSelectProject={(proj) => setSelectedProjectModal(proj)}
        />
      )}

      {/* Single Project Detail Popup Modal Overlay */}
      {selectedProjectModal && (
        <ProjectInfo1Modal
          project={selectedProjectModal}
          crList={changeRequestsList}
          isOpen={!!selectedProjectModal}
          onClose={() => setSelectedProjectModal(null)}
        />
      )}
    </div>
  );
}

export default ProjectMonitoringPage;
