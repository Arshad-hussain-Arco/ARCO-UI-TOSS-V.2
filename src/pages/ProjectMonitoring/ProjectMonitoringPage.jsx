import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  Download,
  FileSearch,
  FileText,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';

import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import projectService from '@services/projectService';
import './ProjectMonitoringPage.css';

// Import enterprise sub-components and utilities
import LifecycleToggle from './components/LifecycleToggle';
import StatusFilter from './components/StatusFilter';
import ProjectRow from './components/ProjectRow';
import { getStageInfo } from './utils/statusMapper';
import { getBusinessStageInfo } from './utils/businessLifecycleMap';
import {
  calculateCategoryCounts,
  filterByCategory,
  calculateTeamRoleCounts,
  calculateBreachMetrics,
  getDrilldownProjects,
} from './utils/dataMapper';

/* ═══════════════════════════════════════════════════════════════════════════
   STATIC MOCK FALLBACK DATA — Used only if backend is unreachable
   ═══════════════════════════════════════════════════════════════════════════ */

const VELOCITY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COMPLETED_DATA = [1, 0, 2, 1, 3, 2, 2, 1, 5, 3, 2, 1];
const TARGET_DATA = [2, 2, 2, 2, 3, 3, 3, 3, 4, 3, 2, 2];

const SAMPLE_PROJECTS = [
  {
    id: 'p1',
    code: 'pr01268',
    ipmNumber: 'pr01268',
    summary: 'Murex Trade Reconciliation - Phase 3 Enhancement',
    workOrderType: 'Project',
    priority: 'High',
    startDate: 'May 21, 2025',
    clarityFinishDate: 'Feb 28, 2025',
    plannedDevDate: 'Apr 9, 2025',
    endDate: 'Jul 31, 2025',
    itdl: 'Mansoor Khan',
    backupItdl: 'Abdul Rahim Syed',
    po: 'unassigned',
    pmo: 'Adnan Sami Shaik Kallutla',
    ownedBy: 'Mohammad Faiz Shaik',
    requestorName: 'Marwan',
    stage: 'Testing',
    stageIdx: 3,
    lastComment: 'Last updated on Aug 07, 2025 08:17 AM by system',
    fullDesc: 'pr01268 — Murex Trade Reconciliation system enhancement focusing on T+1 settlement lifecycle and automated exception handling.',
    chartData: { planning: 78, development: 75, testing: 7, delivered: 72 },
    overdueDays: 364,
  },
  {
    id: 'p2',
    code: 'pr01301',
    ipmNumber: 'pr01301',
    summary: 'Risk Engine CR Data Integration Middleware',
    workOrderType: 'CR',
    priority: 'Medium',
    startDate: 'Jun 14, 2025',
    clarityFinishDate: 'Mar 15, 2025',
    plannedDevDate: 'May 10, 2025',
    endDate: 'Aug 20, 2025',
    itdl: 'Javeed Abdul',
    backupItdl: 'Adnan Sami Shaik Kallutla',
    po: 'Mansoor Khan',
    pmo: 'Mohammad Faiz Shaik',
    ownedBy: 'Javeed Abdul',
    requestorName: 'Khalid',
    stage: 'Building',
    stageIdx: 2,
    lastComment: 'Last updated on Jul 12, 2025 11:14 AM by system',
    fullDesc: 'pr01301 — Backend integration layer for risk engine data feeds including CR file matching logic and WO synchronization.',
    chartData: { planning: 65, development: 80, testing: 15, delivered: 50 },
    overdueDays: 120,
  },
  {
    id: 'p3',
    code: 'pr01302',
    ipmNumber: 'pr01302',
    summary: 'EOD Batch Processing Optimization Initiative',
    workOrderType: 'Project',
    priority: 'Critical',
    startDate: 'Apr 01, 2025',
    clarityFinishDate: 'Jan 15, 2025',
    plannedDevDate: 'Mar 01, 2025',
    endDate: 'Jun 30, 2025',
    itdl: 'Abdul Rahim Syed',
    backupItdl: 'Javeed Abdul',
    po: 'Adnan Sami Shaik Kallutla',
    pmo: 'Mansoor Khan',
    ownedBy: 'Abdul Rahim Syed',
    requestorName: 'Tariq',
    stage: 'Deployed',
    stageIdx: 5,
    lastComment: 'Last updated on Jul 10, 2025 09:22 AM by system',
    fullDesc: 'pr01302 — Optimization of end-of-day batch runs, reducing processing time by 40% through parallel job scheduling.',
    chartData: { planning: 80, development: 78, testing: 60, delivered: 80 },
    overdueDays: 0,
  },
  {
    id: 'p4',
    code: 'SD45526',
    ipmNumber: 'SD45526',
    summary: 'Service Desk Incident Classification Automation',
    workOrderType: 'Service Request',
    priority: 'Low',
    startDate: 'May 10, 2025',
    clarityFinishDate: 'Apr 30, 2025',
    plannedDevDate: 'Jun 15, 2025',
    endDate: 'Sep 30, 2025',
    itdl: 'Mansoor Khan',
    backupItdl: 'Mohammad Faiz Shaik',
    po: 'Abdul Rahim Syed',
    pmo: 'Javeed Abdul',
    ownedBy: 'Mansoor Khan',
    requestorName: 'Sami',
    stage: 'Planning',
    stageIdx: 1,
    lastComment: 'Last updated on Jul 08, 2025 03:45 PM by system',
    fullDesc: 'SD45526 — AI-driven incident classification and auto-routing system to reduce manual triage time from 4h to 15min.',
    chartData: { planning: 75, development: 20, testing: 0, delivered: 0 },
    overdueDays: 45,
  },
  {
    id: 'p5',
    code: 'SD45529',
    ipmNumber: 'SD45529',
    summary: 'Capacity Reporting Dashboard Real-Time Feeds',
    workOrderType: 'Project',
    priority: 'Medium',
    startDate: 'Jun 18, 2025',
    clarityFinishDate: 'May 15, 2025',
    plannedDevDate: 'Jul 20, 2025',
    endDate: 'Oct 31, 2025',
    itdl: 'Mohammad Faiz Shaik',
    backupItdl: 'Abdul Rahim Syed',
    po: 'Javeed Abdul',
    pmo: 'Adnan Sami Shaik Kallutla',
    ownedBy: 'Mohammad Faiz Shaik',
    requestorName: 'Youssef',
    stage: 'Inception',
    stageIdx: 0,
    lastComment: 'Last updated on Jul 07, 2025 10:58 AM by system',
    fullDesc: 'SD45529 — Real-time capacity data pipeline feeding the executive dashboard with live consultant utilization metrics.',
    chartData: { planning: 40, development: 0, testing: 0, delivered: 0 },
    overdueDays: 15,
  },
];

const STAGE_COLORS = {
  inception: '#8b5cf6',
  planning: '#3b82f6',
  building: '#06b6d4',
  testing: '#f59e0b',
  release: '#fb923c',
  deployed: '#10b981',
  completed: '#059669',
  'testing-blocked': '#ef4444',
  deferred: '#6b7280',
};

const STAGE_LABELS = {
  inception: 'Inception',
  planning: 'Planning',
  building: 'Building',
  testing: 'Testing',
  release: 'Release Process',
  deployed: 'Deployed',
  completed: 'Completed',
};

function exportToCSV(rows, filename) {
  if (!rows.length) return;
  const headers = ['Project Code', 'Project ID', 'Summary', 'Status', 'IT Delivery Lead', 'Backup ITDL', 'Product Owner', 'PMO Manager', 'Last Comment'];
  const lines = [
    headers.join(','),
    ...rows.map((p) =>
      [p.code, p.id, `"${p.summary}"`, STAGE_LABELS[p.stage.toLowerCase()] || p.stage, p.itdl, p.backupItdl, p.po, p.pmo, `"${p.lastComment}"`].join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Dynamic Drilldown Modal (Matches Image 2 & Image 5) ────────────────── */
function DrilldownModal({ stage, onClose, projectsData = [] }) {
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

  const matchedProjects = getDrilldownProjects(projectsData, stage).filter((p) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      p.code.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.itdl.toLowerCase().includes(q) ||
      p.po.toLowerCase().includes(q)
    );
  });

  const totalCount = stage.count || matchedProjects.length;

  return (
    <div className="pm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Projects - ${stage.label}`}>
      <div className="pm-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="pm-modal-header">
          <div className="pm-modal-title-row">
            <h2 className="pm-modal-title">Projects — {stage.label}</h2>
            <span className="pm-stage-pill" style={{ background: '#006838' }}>
              {totalCount} Projects
            </span>
          </div>
          <button type="button" className="pm-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        <div className="pm-modal-toolbar">
          <div className="pm-search-wrap">
            <Search size={14} className="pm-search-icon-inner" />
            <input
              ref={inputRef}
              type="text"
              className="pm-search-input"
              placeholder="Search by code, ID, summary, ITDL, Product Owner…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="pm-modal-result-count">
              Showing <strong>{matchedProjects.length}</strong> of {totalCount}
            </span>
            <button type="button" className="pm-export-btn" onClick={() => exportToCSV(matchedProjects, `Projects_${stage.label.replace(/\s+/g, '_')}.csv`)}>
              <Download size={14} /> Export
            </button>
          </div>
        </div>

        <div className="pm-modal-table-container">
          <table className="pm-master-table">
            <thead>
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
            </thead>
            <tbody>
              {matchedProjects.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="pm-empty-state">
                      <Search size={32} color="#cbd5e1" />
                      <p>No projects found matching your search criteria.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                matchedProjects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="pm-project-code">{p.code}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{p.id}</span>
                    </td>
                    <td style={{ maxWidth: 220 }}>
                      <span style={{ fontSize: 12, color: '#334155', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={p.summary}>
                        {p.summary}
                      </span>
                    </td>
                    <td>
                      <span className="pm-stage-pill" style={{ background: STAGE_COLORS[p.stage.toLowerCase()] || '#006838' }}>
                        {p.stage}
                      </span>
                    </td>
                    <td style={{ fontSize: 11, color: '#334155' }}>{p.itdl}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{p.backupItdl}</td>
                    <td style={{ fontSize: 11, color: '#334155' }}>{p.po}</td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>{p.pmo}</td>
                    <td>
                      <span className="pm-comment-text" title={p.lastComment}>{p.lastComment || 'No comments'}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PROJECT MONITORING PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export function ProjectMonitoringPage() {
  useDocumentTitle('Project Monitoring');

  // View mode: 'business' (SDLC View 7 stages) vs 'development' (Tech View 17 stages)
  const [lifecycleMode, setLifecycleMode] = useState('business');

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [syncing, setSyncing] = useState(false);

  // Tab 1 — chart timeframe & drilldowns
  const [timeframe, setTimeframe] = useState('Monthly');
  const [drilldownStage, setDrilldownStage] = useState(null);

  // Tab 2 — directory filters & expansion
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  // Tab 3 — breaches
  const [activeBreachMetric, setActiveBreachMetric] = useState(null);

  const [projectsList, setProjectsList] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Toggle mode handler
  const handleToggleLifecycleMode = (isDevMode) => {
    setLifecycleMode(isDevMode ? 'development' : 'business');
  };

  const fetchData = useCallback(async () => {
    try {
      setLoadingData(true);
      const workOrderRes = await projectService.getWorkOrderStatus();

      let allProjects = [];

      const mapWorkOrder = (wo) => ({
        id: wo.Wo_Id ? wo.Wo_Id.toString() : wo.Ipm_Number || '',
        code: wo.Ipm_Number || '',
        ipmNumber: wo.Ipm_Number || '',
        summary: wo.Summary || '',
        workOrderType: wo.Work_Order_Type || 'Project',
        dependsOn: (wo.Depends_On || wo.DependsOn || '').trim(),
        priority: wo.Priority || 'Medium',
        startDate: wo.Start_Date || '',
        clarityFinishDate: wo.Clarity_Planned_Finish_Date || '',
        plannedDevDate: wo.Planned_DEV_completion_Date || '',
        endDate: wo.Due_Date || wo.Handover_Planned_End_Date || '',
        itdl: wo.IT_Delivery_Lead || 'unassigned',
        backupItdl: wo.Backup_IT_Delivery_Lead || 'unassigned',
        po: wo.Product_Owner || 'unassigned',
        pmo: wo.PMO_Project_Manager || 'unassigned',
        ownedBy: wo.Owned_By || 'unassigned',
        requestorName: wo.Requestor_Name || 'unassigned',
        stage: wo.Status ? wo.Status : 'Planning',
        stageIdx: 0,
        lastComment: wo.Last_Comment || '',
        fullDesc: wo.Description || wo.Summary || '',
        overdueDays: 0,
      });

      // Only workOrders are shown in Project Monitoring.
      // changeRequests (CRs) are excluded — they have no Depends_On field
      // and do not belong in the Project Monitoring directory.
      if (workOrderRes?.workOrders) {
        allProjects = [...allProjects, ...workOrderRes.workOrders.map(mapWorkOrder)];
      }

      setProjectsList(allProjects.length > 0 ? allProjects : SAMPLE_PROJECTS);
    } catch (err) {
      console.error('Failed to fetch project data:', err);
      setProjectsList(SAMPLE_PROJECTS);
    } finally {
      setLoadingData(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = () => {
    setSyncing(true);
    fetchData();
  };

  // 1. Dynamic Category Chips
  const categoryChips = useMemo(() => {
    return calculateCategoryCounts(projectsList);
  }, [projectsList]);

  // 0. Filter projects by selected Depends_On category pill tab (All, Budget, BAU, Service, BUD - PR Wait, Not Available)
  const categoryProjects = useMemo(() => {
    return projectsList.filter((p) => filterByCategory(p, selectedCategory));
  }, [projectsList, selectedCategory]);

  // 2. Dynamic Team Role Breakdown Cards (Matches Image 1)
  const teamRoles = useMemo(() => {
    return [
      { id: 'itdl', title: 'Count By IT Delivery Lead', field: 'itdl' },
      { id: 'po', title: 'Count BY Product Owner', field: 'po' },
      { id: 'backupItdl', title: 'Count By Backup ITDL', field: 'backupItdl' },
      { id: 'sitLead', title: 'Count By SIT Lead', field: 'sitLead' },
      { id: 'uatLead', title: 'Count By UAT Lead', field: 'uatLead' },
      { id: 'developer', title: 'Count By Developer', field: 'developer' },
      { id: 'additionalDev', title: 'Count By Additional Developer', field: 'additionalDev' },
    ].map((r) => ({
      ...r,
      members: calculateTeamRoleCounts(categoryProjects, r.field),
    }));
  }, [categoryProjects]);

  // 3. Dynamic Breach Metrics (Matches Image 4)
  const breachMetrics = useMemo(() => {
    return calculateBreachMetrics(categoryProjects);
  }, [categoryProjects]);

  // Filtered projects list based on search, category chip, and dynamic status filter
  const filteredProjects = useMemo(() => {
    return categoryProjects.filter((p) => {
      // 1. Search query filter
      const q = searchQuery.toLowerCase().trim();
      if (
        q &&
        !p.code.toLowerCase().includes(q) &&
        !p.itdl.toLowerCase().includes(q) &&
        !p.po.toLowerCase().includes(q) &&
        !p.summary.toLowerCase().includes(q)
      ) {
        return false;
      }

      // 2. Status filter dropdown
      if (statusFilter) {
        const stageInfo = getStageInfo(p.stage, lifecycleMode);
        const selectedStageInfo = getStageInfo(statusFilter, lifecycleMode);
        if (stageInfo.index !== selectedStageInfo.index && p.stage.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      return true;
    });
  }, [categoryProjects, searchQuery, statusFilter, lifecycleMode]);

  const maxVelocity = Math.max(...COMPLETED_DATA, ...TARGET_DATA);

  // Dynamic Lifecycle Pipeline Overview stages (reflects active category pill tab selection)
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
      const stageInfo = getBusinessStageInfo(p.stage);
      const stageObj = stages.find((s) => s.key === stageInfo.phase.key);
      if (stageObj) stageObj.count++;
    });

    return stages;
  }, [categoryProjects]);

  const testingBlockedCount = useMemo(() => {
    return categoryProjects.filter(
      (p) => (p.stage || '').toLowerCase().includes('testing blocked') || (p.stage || '').toLowerCase().includes('blocked')
    ).length;
  }, [categoryProjects]);

  const deferredCount = useMemo(() => {
    return categoryProjects.filter(
      (p) => (p.stage || '').toLowerCase().includes('deferred')
    ).length;
  }, [categoryProjects]);

  return (
    <div className="pm-shell">
      {/* Tab Navigation */}
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

      {/* TAB 1: PROJECT SUMMARY */}
      {activeTab === 'summary' && (
        <div className="pm-tab-content">
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

            <div className="pm-pipeline-track">
              {dynamicPipelineStages.map((s) => (
                <div key={s.key} className="pm-pipeline-stage">
                  <div
                    className={`pm-pipeline-block ${s.cls} clickable`}
                    role="button"
                    tabIndex={0}
                    title={`View ${s.label} projects`}
                    onClick={() => setDrilldownStage(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setDrilldownStage(s);
                    }}
                  >
                    <span className="pm-stage-label">{s.label}</span>
                    <span className="pm-stage-count">{s.count}</span>
                    <div className="pm-stage-bar" />
                    <span className="pm-stage-click-hint">Click to explore →</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pm-pipeline-badges">
              <span
                className="pm-special-badge pm-badge-blocked"
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => setDrilldownStage({ key: 'testing-blocked', label: 'Testing Blocked', count: testingBlockedCount })}
              >
                🚨 Testing Blocked — {testingBlockedCount}
              </span>
              <span
                className="pm-special-badge pm-badge-deferred"
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => setDrilldownStage({ key: 'deferred', label: 'Deferred', count: deferredCount })}
              >
                ⏸️ Deferred — {deferredCount}
              </span>
            </div>
          </div>

          <div className="pm-charts-row">
            <div className="pm-chart-card pm-chart-card--velocity">
              <div className="pm-velocity-header">
                <h3 className="pm-card-title" style={{ margin: 0 }}>
                  <CheckCircle size={14} color="#059669" /> Delivery Velocity &amp; Completion Trends
                </h3>
                <div className="pm-timeframe-controls">
                  {['Monthly', 'Quarterly', 'HalfYearly', 'Annually'].map((tf) => (
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

              <div className="pm-velocity-chart-wrap">
                <div className="pm-bar-chart">
                  {VELOCITY_MONTHS.map((m, i) => (
                    <div key={m} className="pm-bar-col">
                      <span className="pm-bar-value">{COMPLETED_DATA[i]}</span>
                      <div className="pm-bar-inner">
                        <div
                          className="pm-bar target-bar"
                          title={`Target: ${TARGET_DATA[i]}`}
                          style={{ height: `${(TARGET_DATA[i] / maxVelocity) * 100}%` }}
                        />
                        <div
                          className="pm-bar completed-bar"
                          title={`Completed: ${COMPLETED_DATA[i]}`}
                          style={{ height: `${(COMPLETED_DATA[i] / maxVelocity) * 100}%` }}
                        />
                      </div>
                      <span className="pm-bar-label">{m}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pm-velocity-legend">
                <span className="pm-velocity-legend-item">
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />
                  Completed
                </span>
                <span className="pm-velocity-legend-item">
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: '#e2e8f0', display: 'inline-block' }} />
                  Target
                </span>
              </div>
            </div>

            {/* Dynamic Team Overview Cards (Matches Image 1) */}
            <div className="pm-chart-card pm-chart-card--compact-org">
              <h3 className="pm-card-title" style={{ margin: '0 0 12px 0' }}>
                <Users size={14} color="#006838" /> Team Overview Role Counts
              </h3>
              <div className="pm-compact-org-list">
                {calculateTeamRoleCounts(projectsList, 'itdl').slice(0, 5).map((item) => (
                  <div key={item.name} className="pm-compact-org-row" onClick={() => setDrilldownStage({ key: 'itdl', label: item.name, count: item.count, type: 'member' })}>
                    <span className="pm-compact-org-name">{item.name}</span>
                    <div className="pm-compact-org-bar-wrap">
                      <div className="pm-compact-org-bar-fill" style={{ width: `${Math.min((item.count / 20) * 100, 100)}%`, background: '#006838' }} />
                    </div>
                    <div className="pm-compact-org-right">
                      <span className="pm-compact-org-count">{item.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dynamic 7-Role Team Overview Section (Matches Image 1) */}
          <div className="pm-itdl-overview-section">
            <h3 className="pm-section-subtitle">Team Breakdown Cards</h3>
            <div className="pm-itdl-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
              {teamRoles.map((roleCard) => (
                <div key={roleCard.id} className="pm-itdl-card">
                  <div className="pm-itdl-card-header">
                    <span className="pm-itdl-card-type-label">
                      <Users size={14} className="pm-itdl-card-icon" /> {roleCard.title}
                    </span>
                  </div>
                  <div className="pm-itdl-divider" />
                  <div className="pm-itdl-member-list">
                    {roleCard.members.map((member) => (
                      <div
                        key={member.name}
                        className="pm-itdl-member-row"
                        onClick={() => setDrilldownStage({ key: roleCard.field, label: member.name, count: member.count, type: 'member' })}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="pm-itdl-member-name">{member.name}</span>
                        <span className="pm-itdl-member-count" style={{ background: '#006838', color: '#fff', padding: '1px 6px', borderRadius: 10, fontSize: 10 }}>{member.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROJECT MONITORING DIRECTORY */}
      {activeTab === 'monitoring' && (
        <div className="pm-tab-content">
          <div className="pm-card">
            <div className="pm-filter-card-body">
              <div className="pm-filter-row">
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

              {/* Enhanced Toolbar with App DatePicker & Reusable Toggle */}
              <div className="pm-toolbar">
                <div className="pm-search-wrap">
                  <Search size={14} className="pm-search-icon-inner" />
                  <input
                    type="text"
                    className="pm-search-input"
                    placeholder="Search project code, ITDL, Product Owner…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <StatusFilter
                  value={statusFilter}
                  onChange={setStatusFilter}
                  mode={lifecycleMode}
                />

                <div className="pm-datepicker-wrap">
                  <DatePicker
                    value={startDate}
                    onChange={setStartDate}
                    placeholder="Start Date"
                    width="140px"
                  />
                </div>
                <div className="pm-datepicker-wrap">
                  <DatePicker
                    value={endDate}
                    onChange={setEndDate}
                    placeholder="End Date"
                    width="140px"
                  />
                </div>

                <div className="pm-toolbar-divider" />

                <LifecycleToggle
                  mode={lifecycleMode}
                  onToggle={handleToggleLifecycleMode}
                />

                <button
                  type="button"
                  className="pm-reset-btn"
                  title="Reset Filters"
                  onClick={(e) => {
                    const icon = e.currentTarget.querySelector('.pm-reset-icon');
                    if (icon) {
                      icon.classList.add('spin-animation');
                      setTimeout(() => icon.classList.remove('spin-animation'), 500);
                    }
                    setSearchQuery('');
                    setStatusFilter('');
                    setStartDate(null);
                    setEndDate(null);
                    setSelectedCategory('all');
                  }}
                >
                  <RotateCcw className="pm-reset-icon" size={15} />
                  <span>Reset</span>
                </button>

                <div className="pm-toolbar-divider" />

                <button
                  type="button"
                  className="pm-export-btn"
                  onClick={() => exportToCSV(filteredProjects, 'project_monitoring.csv')}
                >
                  <Download size={14} /> Export
                </button>
              </div>
            </div>
          </div>

          {/* Sticky Master Table Container */}
          <div className="pm-table-container pm-table-sticky-container">
            <table className="pm-master-table">
              <thead>
                <tr>
                  <th className="col-code pm-sticky-col pm-sticky-col-1">Project Code</th>
                  <th className="col-summary pm-sticky-col pm-sticky-col-2">Summary / Description</th>
                  <th className="col-owner pm-sticky-col pm-sticky-col-3">IT Delivery Lead</th>
                  <th className="col-lifecycle">
                    Lifecycle Progress ({lifecycleMode === 'development' ? 'Tech View — 17 Stages' : 'SDLC View — 7 Stages'})
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={4}>
                        <div className="pm-skeleton-row" />
                      </td>
                    </tr>
                  ))
                ) : filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="pm-empty-state">
                        <Search size={32} color="#cbd5e1" />
                        <p>No projects match your filters. Try adjusting your search criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      isExpanded={expandedId === project.id}
                      onToggleExpand={() => setExpandedId(expandedId === project.id ? null : project.id)}
                      mode={lifecycleMode}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PROJECT BREACHES (Matches Image 4) */}
      {activeTab === 'breaches' && (
        <div className="pm-tab-content">
          <div className="pm-governance-grid">
            <div className="pm-gov-card">
              <div className="pm-gov-card-header">
                <AlertTriangle size={14} className="pm-gov-card-icon text-red" />
                <h3 className="pm-card-title">SLA &amp; Phase Breaches</h3>
              </div>
              <div className="pm-gov-card-body">
                {breachMetrics.sla.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pm-breach-metric ${m.count > 0 ? 'clickable' : ''}`}
                    onClick={() => {
                      if (m.count > 0) setDrilldownStage({ key: m.id, label: m.label, count: m.count });
                    }}
                  >
                    <span className="pm-breach-label">{m.label}</span>
                    <span className={`pm-breach-val ${m.count === 0 ? 'zero' : 'nonzero'}`}>{m.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pm-gov-card">
              <div className="pm-gov-card-header">
                <Calendar size={14} className="pm-gov-card-icon text-amber" />
                <h3 className="pm-card-title">Due Dates</h3>
              </div>
              <div className="pm-gov-card-body">
                {breachMetrics.dueDate.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pm-breach-metric ${m.count > 0 ? 'clickable' : ''}`}
                    onClick={() => {
                      if (m.count > 0) setDrilldownStage({ key: m.id, label: m.label, count: m.count });
                    }}
                  >
                    <span className="pm-breach-label">{m.label}</span>
                    <span className={`pm-breach-val ${m.count === 0 ? 'zero' : 'nonzero'}`}>{m.count}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pm-gov-card">
              <div className="pm-gov-card-header">
                <ShieldCheck size={14} className="pm-gov-card-icon text-emerald" />
                <h3 className="pm-card-title">CR Exceptions</h3>
              </div>
              <div className="pm-gov-card-body">
                {breachMetrics.cr.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pm-breach-metric ${m.count > 0 ? 'clickable' : ''}`}
                    onClick={() => {
                      if (m.count > 0) setDrilldownStage({ key: m.id, label: m.label, count: m.count });
                    }}
                  >
                    <span className="pm-breach-label">{m.label}</span>
                    <span className={`pm-breach-val ${m.count === 0 ? 'zero' : 'nonzero'}`}>{m.count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drill-down Modal Overlay */}
      {drilldownStage && (
        <DrilldownModal
          stage={drilldownStage}
          onClose={() => setDrilldownStage(null)}
          projectsData={categoryProjects}
        />
      )}
    </div>
  );
}

export default ProjectMonitoringPage;
