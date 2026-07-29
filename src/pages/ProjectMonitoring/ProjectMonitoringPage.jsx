import { useState, useRef, useEffect } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeftRight,
  Building2,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
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
  BarChart2,
  TrendingUp,
} from 'lucide-react';

import { useDocumentTitle } from '@hooks/useDocumentTitle';
import './ProjectMonitoringPage.css';

/* ═══════════════════════════════════════════════════════════════════════════
   STATIC MOCK DATA — All numbers from the spec
   ═══════════════════════════════════════════════════════════════════════════ */

const CATEGORY_CHIPS = [
  { id: 'all', label: 'All Projects', count: 103 },
  { id: 'budget', label: 'Budget', count: 30 },
  { id: 'na', label: 'Not Available', count: 8 },
  { id: 'bau', label: 'BAU', count: 4 },
  { id: 'service', label: 'Service', count: 10 },
  { id: 'bud-pr', label: 'BUD - PR Wait', count: 51 },
];

const LIFECYCLE_STAGES = [
  { key: 'inception', label: 'Inception', countAll: 9, countSelected: 1, cls: 'pm-stage-inception' },
  { key: 'planning', label: 'Planning', countAll: 25, countSelected: 4, cls: 'pm-stage-planning' },
  { key: 'building', label: 'Building', countAll: 25, countSelected: 3, cls: 'pm-stage-building' },
  { key: 'testing', label: 'Testing', countAll: 29, countSelected: 13, cls: 'pm-stage-testing' },
  { key: 'release', label: 'Release Process', countAll: 2, countSelected: 1, cls: 'pm-stage-release' },
  { key: 'deployed', label: 'Deployed', countAll: 5, countSelected: 5, cls: 'pm-stage-deployed' },
  { key: 'completed', label: 'Completed', countAll: 5, countSelected: 1, cls: 'pm-stage-completed' },
];

const VELOCITY_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COMPLETED_DATA = [1, 0, 2, 1, 3, 2, 2, 1, 5, 3, 2, 1];
const TARGET_DATA = [2, 2, 2, 2, 3, 3, 3, 3, 4, 3, 2, 2];

/* Count by Organization Data — Minimal enterprise list */
const ORG_ROLE_COUNTS = [
  { role: 'ITDL', color: '#3b82f6', count: 76 },
  { role: 'Product Owner', color: '#8b5cf6', count: 81 },
  { role: 'Backup ITDL', color: '#06b6d4', count: 89 },
  { role: 'SIT Lead', color: '#f59e0b', count: 85 },
  { role: 'Developer', color: '#10b981', count: 98 },
];

const ITDL_TEAMS = [
  {
    headName: 'Adnan Sami Shaik',
    totalProjects: 24,
    members: [
      { name: 'Mansoor Khan', count: 6 },
      { name: 'Mohammad Faiz Shaik', count: 5 },
      { name: 'Javeed Abdul', count: 4 },
      { name: 'Ishaq Ali', count: 4 },
      { name: 'Rahim Syed', count: 3 },
      { name: 'Adnan Khan', count: 2 }
    ]
  },
  {
    headName: 'Mansoor Khan',
    totalProjects: 20,
    members: [
      { name: 'Mohammad Faiz Shaik', count: 5 },
      { name: 'Abdul Rahim Syed', count: 4 },
      { name: 'Javeed Abdul', count: 4 },
      { name: 'Ishaq Ali', count: 3 },
      { name: 'Sami Shaik', count: 2 },
      { name: 'Adnan Sami', count: 2 }
    ]
  },
  {
    headName: 'Mohammad Faiz Shaik',
    totalProjects: 18,
    members: [
      { name: 'Mansoor Khan', count: 4 },
      { name: 'Javeed Abdul', count: 4 },
      { name: 'Adnan Sami Shaik', count: 3 },
      { name: 'Abdul Rahim Syed', count: 3 },
      { name: 'Ishaq Ali', count: 2 },
      { name: 'Sami Shaik', count: 2 }
    ]
  },
  {
    headName: 'Javeed Abdul',
    totalProjects: 16,
    members: [
      { name: 'Mansoor Khan', count: 4 },
      { name: 'Adnan Sami Shaik', count: 3 },
      { name: 'Mohammad Faiz Shaik', count: 3 },
      { name: 'Abdul Rahim Syed', count: 2 },
      { name: 'Ishaq Ali', count: 2 },
      { name: 'Adnan Khan', count: 2 }
    ]
  }
];

/* ── Count by Organization Card (Enhanced compact layout) ──────────────── */
function CountByOrganizationCard() {
  const maxCount = 100;
  return (
    <div className="pm-chart-card pm-chart-card--compact-org">
      <h3 className="pm-card-title" style={{ margin: '0 0 12px 0' }}>
        Count by Teams
      </h3>

      <div className="pm-compact-org-list">
        {ORG_ROLE_COUNTS.map((item) => (
          <div key={item.role} className="pm-compact-org-row">
            <span className="pm-compact-org-name">{item.role}</span>
            <div className="pm-compact-org-bar-wrap">
              <div
                className="pm-compact-org-bar-fill"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  background: item.color,
                }}
              />
            </div>
            <div className="pm-compact-org-right">
              <Users size={13} className="pm-compact-org-icon" />
              <span className="pm-compact-org-count">{item.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const HORIZON_BUCKETS = [
  { label: 'Next 15 Days', dev: 8, testing: 5, delivery: 3, total: 16 },
  { label: 'Next 30 Days', dev: 14, testing: 10, delivery: 7, total: 31 },
  { label: 'Next 45 Days', dev: 21, testing: 15, delivery: 10, total: 46 },
  { label: 'Next 60 Days', dev: 28, testing: 20, delivery: 14, total: 62 },
];

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
    stage: 'testing',
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
    stage: 'building',
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
    stage: 'deployed',
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
    stage: 'planning',
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
    stage: 'inception',
    stageIdx: 0,
    lastComment: 'Last updated on Jul 07, 2025 10:58 AM by system',
    fullDesc: 'SD45529 — Real-time capacity data pipeline feeding the executive dashboard with live consultant utilization metrics.',
    chartData: { planning: 40, development: 0, testing: 0, delivered: 0 },
    overdueDays: 15,
  },
];

const BREACH_METRICS = {
  sla: [
    { id: 'sla1', label: 'Unclosed Projects Started Before 60 Days', count: 92 },
    { id: 'sla2', label: 'Project in Testing for More Than 15 Days', count: 2 },
    { id: 'sla3', label: 'Project in BRD/SSD Stage for More Than 14 Days', count: 0 },
    { id: 'sla4', label: 'Any CR Whose Due Date Has Passed', count: 0 },
    { id: 'sla5', label: 'CR in Progress Stage, but WO Moved to Testing', count: 41 },
    { id: 'sla6', label: 'CR in Open Stage, but WO Moved', count: 0 },
  ],
  dueDate: [
    { id: 'dd1', label: 'Empty Planned Development Completion (Next 45 Days)', count: 0 },
    { id: 'dd2', label: 'Due Date — Dev Completion < 2 Weeks', count: 1 },
  ],
  cr: [
    { id: 'cr1', label: 'CR Due Date > WO Due Date', count: 0 },
    { id: 'cr2', label: 'No Man Days in CR', count: 40 },
    { id: 'cr3', label: 'No Start Date in CR', count: 1 },
    { id: 'cr4', label: 'No Due Date in CR', count: 0 },
  ],
};

const RESOLUTION_TABLE_DATA = [
  { code: 'pr01268', itdl: 'Adnan Sami Shaik Kallutla', status: 'Testing', missingField: 'Man Days' },
  { code: 'SD45526', itdl: 'Mansoor Khan', status: 'Planning', missingField: 'Man Days' },
  { code: 'SD45529', itdl: 'Mohammad Faiz Shaik', status: 'Inception', missingField: 'Man Days' },
  { code: 'SD45550', itdl: 'Adnan Sami Shaik Kallutla', status: 'Testing', missingField: 'Man Days' },
  { code: 'pr01301', itdl: 'Javeed Abdul', status: 'Building', missingField: 'Man Days' },
  { code: 'SD45554', itdl: 'Javeed Abdul', status: 'Release Process', missingField: 'Man Days' },
];

/* ═══════════════════════════════════════════════════════════════════════════
   Utility helpers
   ═══════════════════════════════════════════════════════════════════════════ */

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

const STAGE_TOTAL = 7;

function getLifecyclePills(stageIdx, stageKey) {
  return Array.from({ length: STAGE_TOTAL }, (_, i) => {
    if (i < stageIdx) return 'pm-pill-completed';
    if (i === stageIdx && stageKey !== 'completed') return 'pm-pill-current';
    if (stageKey === 'completed') return 'pm-pill-completed';
    return 'pm-pill-future';
  });
}

/* CSV Export helper */
function exportToCSV(rows, filename) {
  if (!rows.length) return;
  const headers = ['Project Code', 'Summary', 'Stage', 'Start Date', 'ITDL', 'Backup ITDL', 'Product Owner', 'PMO'];
  const lines = [
    headers.join(','),
    ...rows.map((p) =>
      [p.code, `"${p.summary}"`, STAGE_LABELS[p.stage] || p.stage, p.startDate, p.itdl, p.backupItdl, p.po, p.pmo].join(',')
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

/* ═══════════════════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Drill-down Modal Overlay (Consistent App Component UI) ───────────── */
function DrilldownModal({ stage, onClose }) {
  const [search, setSearch] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  if (!stage) return null;

  const stageInfo = LIFECYCLE_STAGES.find((s) => s.key === stage.key);
  const totalCount = stageInfo ? stageInfo.countAll : (stage.count || 0);
  const stageColor = STAGE_COLORS[stage.key] || '#006838';

  const projects = SAMPLE_PROJECTS.filter((p) => {
    // If it's a team member drill-down
    if (stage.type === 'member') {
      const name = stage.label.toLowerCase();
      return (
        (p.itdl && p.itdl.toLowerCase().includes(name)) ||
        (p.po && p.po.toLowerCase().includes(name)) ||
        (p.pmo && p.pmo.toLowerCase().includes(name)) ||
        (p.ownedBy && p.ownedBy.toLowerCase().includes(name))
      );
    }

    // If it's a breach stage key
    if (stage.key === 'testing-blocked') return p.stage === 'testing';
    if (stage.key === 'sla1') return p.stage !== 'completed';
    if (stage.key === 'sla2') return p.stage === 'testing';
    if (stage.key === 'sla5') return p.stage === 'testing';
    if (stage.key === 'dd2') return p.stage === 'building';
    if (stage.key === 'cr2') return p.workOrderType === 'CR';
    if (stage.key === 'cr3') return p.workOrderType === 'CR';

    // Standard stages
    if (p.stage === stage.key) return true;

    // Fallback if stage key is a general breach
    if (stage.key && (stage.key.startsWith('sla') || stage.key.startsWith('dd') || stage.key.startsWith('cr'))) {
      return p.stage !== 'completed';
    }

    return false;
  }).filter((p) => {
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

  const handleExport = () => {
    exportToCSV(projects, `Projects_${stage.label.replace(/\s+/g, '_')}.csv`);
  };

  const isMemberType = stage.type === 'member';

  return (
    <div className="pm-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Projects - ${stage.label}`}>
      <div className="pm-modal-panel" onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="pm-modal-header">
          <div className="pm-modal-title-row">
            <h2 className="pm-modal-title">Projects — {stage.label}</h2>
            <span className="pm-stage-pill" style={{ background: stageColor }}>
              {totalCount} Projects
            </span>
          </div>
          <button type="button" className="pm-modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>

        {/* Modal Toolbar: App Standard Search Input & Export Button on same row */}
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
              Showing <strong>{projects.length}</strong> of {totalCount}
            </span>
            <button type="button" className="pm-export-btn" onClick={handleExport}>
              <Download size={14} /> Export
            </button>
          </div>
        </div>

        {/* Modal Content Table */}
        <div className="pm-modal-table-container">
          <table className="pm-master-table">
            <thead>
              {isMemberType ? (
                <tr>
                  <th>Project Code</th>
                  <th>Project Name</th>
                  <th>Status</th>
                  <th>Current Lifecycle Stage</th>
                  <th>Priority</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Product Owner</th>
                  <th>Delivery Head</th>
                  <th>Last Updated</th>
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
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={isMemberType ? 10 : 9}>
                    <div className="pm-empty-state">
                      <Search size={32} color="#cbd5e1" />
                      <p>No projects found matching your search.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="pm-project-code">{p.code}</span>
                    </td>
                    {isMemberType ? (
                      <>
                        <td style={{ maxWidth: 200 }}>
                          <span style={{ fontSize: 12, color: '#334155', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={p.summary}>
                            {p.summary}
                          </span>
                        </td>
                        <td>
                          <span className="pm-stage-pill" style={{ background: STAGE_COLORS[p.stage] || stageColor }}>
                            {STAGE_LABELS[p.stage] || p.stage}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{p.stageIdx + 1}/{STAGE_TOTAL}</td>
                        <td>
                          <span className={`pm-stage-pill`} style={{ background: p.priority === 'High' || p.priority === 'Critical' ? '#fef2f2' : '#f1f5f9', color: p.priority === 'High' || p.priority === 'Critical' ? '#ef4444' : '#64748b', border: '1px solid currentColor', textTransform: 'capitalize' }}>
                            {p.priority}
                          </span>
                        </td>
                        <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: 11 }}>{p.startDate}</td>
                        <td style={{ whiteSpace: 'nowrap', color: '#64748b', fontSize: 11 }}>{p.endDate}</td>
                        <td style={{ fontSize: 11, color: '#334155' }}>{p.po}</td>
                        <td style={{ fontSize: 11, color: '#334155' }}>{p.itdl}</td>
                        <td>
                          <span className="pm-comment-text" title={p.lastComment}>{p.lastComment}</span>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>
                          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{p.id}</span>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          <span style={{ fontSize: 12, color: '#334155', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={p.summary}>
                            {p.summary}
                          </span>
                        </td>
                        <td>
                          <span className="pm-stage-pill" style={{ background: STAGE_COLORS[p.stage] || stageColor }}>
                            {STAGE_LABELS[p.stage] || p.stage}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: '#334155' }}>{p.itdl}</td>
                        <td style={{ fontSize: 11, color: '#64748b' }}>{p.backupItdl}</td>
                        <td style={{ fontSize: 11, color: '#334155' }}>{p.po}</td>
                        <td style={{ fontSize: 11, color: '#64748b' }}>{p.pmo}</td>
                        <td>
                          <span className="pm-comment-text" title={p.lastComment}>{p.lastComment}</span>
                        </td>
                      </>
                    )}
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

/* ── Role Count Breakdown Card ──────────────────────────────────────────── */
function RoleBreakdownCard() {
  const [hoveredRole, setHoveredRole] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const maxTotal = 103;

  const handleMouseMove = (e) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <div className="pm-chart-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h3 className="pm-card-title" style={{ margin: 0 }}>
          <BarChart2 size={14} color="#006838" /> Project Counts by Organisational Role
        </h3>
        <span className="pm-role-total-badge">
          <TrendingUp size={11} /> {maxTotal} Total Projects
        </span>
      </div>

      <div className="pm-role-breakdown">
        {ROLE_BREAKDOWN.map((role) => {
          const assignedPct = (role.assigned / maxTotal) * 100;
          const isHovered = hoveredRole === role.role;
          return (
            <div
              key={role.role}
              className={`pm-role-row ${isHovered ? 'hovered' : ''}`}
              onMouseEnter={() => setHoveredRole(role.role)}
              onMouseLeave={() => setHoveredRole(null)}
              onMouseMove={handleMouseMove}
            >
              {/* Role Label */}
              <div className="pm-role-label-wrap">
                <span className="pm-role-dot" style={{ background: role.color }} />
                <span className="pm-role-name">{role.role}</span>
              </div>

              {/* Bar */}
              <div className="pm-role-bar-track">
                <div
                  className="pm-role-bar-fill"
                  style={{
                    width: `${assignedPct}%`,
                    background: `linear-gradient(90deg, ${role.color}cc, ${role.color})`,
                  }}
                />
                {role.unassigned > 0 && (
                  <div
                    className="pm-role-bar-unassigned"
                    style={{
                      width: `${(role.unassigned / maxTotal) * 100}%`,
                    }}
                  />
                )}
              </div>

              {/* Counts */}
              <div className="pm-role-counts">
                <span className="pm-role-assigned-count" style={{ color: role.color }}>{role.assigned}</span>
                <span className="pm-role-sep">/</span>
                <span className="pm-role-total-count">{maxTotal}</span>
              </div>

              {/* Pct badge */}
              <span
                className="pm-role-pct-badge"
                style={{ background: role.colorLight, color: role.color, borderColor: `${role.color}30` }}
              >
                {Math.round(assignedPct)}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Tooltip */}
      {hoveredRole && (() => {
        const role = ROLE_BREAKDOWN.find((r) => r.role === hoveredRole);
        if (!role) return null;
        return (
          <div
            className="pm-role-tooltip"
            style={{ left: tooltipPos.x + 16, top: tooltipPos.y - 8 }}
          >
            <div className="pm-role-tooltip-title" style={{ color: role.color }}>
              {role.role}
            </div>
            <div className="pm-role-tooltip-meta">
              <span>{role.assigned} Assigned</span>
              <span className="pm-role-tooltip-sep">·</span>
              <span style={{ color: '#94a3b8' }}>{role.unassigned} Unassigned</span>
            </div>
            <div className="pm-role-tooltip-members">
              {role.members.map((m) => (
                <div key={m.name} className="pm-role-tooltip-member">
                  <span>{m.name}</span>
                  <span style={{ fontWeight: 700, color: role.color }}>{m.count}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Legend */}
      <div className="pm-role-legend">
        <span className="pm-role-legend-item">
          <span className="pm-role-legend-swatch" style={{ background: '#94a3b8' }} />
          Assigned
        </span>
        <span className="pm-role-legend-item">
          <span className="pm-role-legend-swatch" style={{ background: '#e2e8f0' }} />
          Unassigned
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════════════════════════════ */
export function ProjectMonitoringPage() {
  useDocumentTitle('Project Monitoring');

  // Navigation
  const [activeTab, setActiveTab] = useState('summary');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [syncing, setSyncing] = useState(false);

  // Tab 1 — chart timeframe
  const [timeframe, setTimeframe] = useState('Monthly');

  // Tab 1 — Lifecycle drill-down
  const [drilldownStage, setDrilldownStage] = useState(null);

  // Tab 2 — filters & expansion
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  // Tab 3 — resolution table
  const [activeBreachMetric, setActiveBreachMetric] = useState(null);

  /* Handlers */
  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1800);
  };

  const filteredProjects = SAMPLE_PROJECTS.filter((p) => {
    const q = searchQuery.toLowerCase();
    if (q && !p.code.toLowerCase().includes(q) && !p.itdl.toLowerCase().includes(q) && !p.po.toLowerCase().includes(q) && !p.summary.toLowerCase().includes(q)) return false;
    if (statusFilter && p.stage !== statusFilter) return false;
    return true;
  });

  const handleBreachClick = (metricId, count) => {
    if (count === 0) return;
    setActiveBreachMetric((prev) => (prev === metricId ? null : metricId));
  };

  const maxVelocity = Math.max(...COMPLETED_DATA, ...TARGET_DATA);

  /* ─── Lifecycle count depending on category ─── */
  const isAllCategory = selectedCategory === 'all';

  return (
    <div className="pm-shell">

      {/* ── Tab Navigation + Sync Button ───────────────────────────────── */}
      <div className="pm-tabs-nav" role="tablist" aria-label="Project tabs">
        <button type="button" role="tab" aria-selected={activeTab === 'summary'}
          className={`pm-tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
          onClick={() => setActiveTab('summary')}
        >
          <Layers size={15} /> Project Summary
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'monitoring'}
          className={`pm-tab-btn ${activeTab === 'monitoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('monitoring')}
        >
          <FileSearch size={15} /> Project Monitoring
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'breaches'}
          className={`pm-tab-btn ${activeTab === 'breaches' ? 'active' : ''}`}
          onClick={() => setActiveTab('breaches')}
        >
          <Shield size={15} /> Project Breaches
        </button>

      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1: PROJECT SUMMARY
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'summary' && (
        <div className="pm-tab-content">

          {/* 1) Lifecycle Pipeline */}
          <div className="pm-pipeline-card">
            <div className="pm-pipeline-card-header">
              <h3 className="pm-card-title"><Layers size={14} /> Lifecycle Pipeline Overview</h3>
              <button
                type="button"
                className={`pm-refresh-text-btn ${syncing ? 'spinning' : ''}`}
                onClick={handleSync}
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            <div className="pm-pipeline-chips-container">
              {CATEGORY_CHIPS.map((chip) => (
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
              {LIFECYCLE_STAGES.map((s) => {
                const count = isAllCategory ? s.countAll : s.countSelected;
                return (
                  <div key={s.key} className="pm-pipeline-stage">
                    <div
                      className={`pm-pipeline-block ${s.cls} clickable`}
                      role="button"
                      tabIndex={0}
                      title={`View ${s.label} projects`}
                      onClick={() => setDrilldownStage(s)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDrilldownStage(s); }}
                    >
                      <span className="pm-stage-label">{s.label}</span>
                      <span className="pm-stage-count">{count}</span>
                      <div className="pm-stage-bar" />
                      <span className="pm-stage-click-hint">Click to explore →</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="pm-pipeline-badges">
              <span
                className="pm-special-badge pm-badge-blocked"
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => setDrilldownStage({ key: 'testing-blocked', label: 'Testing Blocked', count: 2 })}
              >
                🚨 Testing Blocked — 2
              </span>
              <span className="pm-special-badge pm-badge-deferred">
                ⏸️ Deferred — {isAllCategory ? 1 : 0}
              </span>
            </div>
          </div>

          {/* 2) Charts Row */}
          <div className="pm-charts-row">

            {/* Delivery Velocity Chart — fixed layout */}
            <div className="pm-chart-card pm-chart-card--velocity">
              <div className="pm-velocity-header">
                <h3 className="pm-card-title" style={{ margin: 0 }}>
                  <CheckCircle size={14} color="#059669" /> Delivery Velocity &amp; Completion Trends
                </h3>
                <div className="pm-timeframe-controls">
                  {['Monthly', 'Quarterly', 'HalfYearly', 'Annually'].map((tf) => (
                    <button key={tf} type="button"
                      className={`pm-tf-btn ${timeframe === tf ? 'active' : ''}`}
                      onClick={() => setTimeframe(tf)}
                    >{tf}</button>
                  ))}
                </div>
              </div>

              {/* Bar Chart — fills available space cleanly */}
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

            {/* Count by Organization Card */}
            <CountByOrganizationCard />
          </div>

          {/* 3) Milestone Horizon */}
          <div className="pm-horizon-card">
            <h3 className="pm-card-title"><Clock size={14} /> Integrated Milestone Completion Horizon</h3>
            <div className="pm-horizon-grid">
              {HORIZON_BUCKETS.map((b, i) => {
                const pct = Math.min((b.total / 62) * 100, 100);
                const colors = ['#f59e0b', '#3b82f6', '#8b5cf6', '#006838'];
                return (
                  <div key={b.label} className="pm-horizon-bucket">
                    <span className="pm-horizon-days">{b.label}</span>
                    <span className="pm-horizon-count" style={{ color: colors[i] }}>{b.total}</span>
                    <span className="pm-horizon-sublabel">Projects entering delivery window</span>
                    <div className="pm-horizon-bar-wrap">
                      <div className="pm-horizon-bar-fill" style={{ width: `${pct}%`, background: colors[i] }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                      {[['Dev', b.dev, '#3b82f6'], ['Test', b.testing, '#f59e0b'], ['Delivery', b.delivery, '#10b981']].map(([lbl, val, clr]) => (
                        <span key={lbl} style={{ fontSize: 10, color: '#64748b' }}>
                          <span style={{ color: clr, fontWeight: 700 }}>{val}</span> {lbl}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4) IT Delivery Heads Overview */}
          <div className="pm-itdl-overview-section">
            <h3 className="pm-section-subtitle">Team Overview</h3>
            <div className="pm-itdl-grid">
              {ITDL_TEAMS.map((team) => (
                <div key={team.headName} className="pm-itdl-card">
                  <div className="pm-itdl-card-header">
                    <span className="pm-itdl-card-type-label">
                      <Users size={14} className="pm-itdl-card-icon" /> IT Delivery Head
                    </span>
                    <span className="pm-itdl-card-badge">{team.totalProjects}</span>
                  </div>

                  <div className="pm-itdl-divider" />

                  <div className="pm-itdl-member-list">
                    {team.members.map((member) => (
                      <div
                        key={member.name}
                        className="pm-itdl-member-row"
                        onClick={() => setDrilldownStage({ key: 'member-name', label: member.name, count: member.count, type: 'member' })}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDrilldownStage({ key: 'member-name', label: member.name, count: member.count, type: 'member' }); }}
                      >
                        <span className="pm-itdl-member-name">{member.name}</span>
                        <span className="pm-itdl-member-count">{member.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2: PROJECT MONITORING DIRECTORY
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'monitoring' && (
        <div className="pm-tab-content">

          {/* Unified Project Filters Card */}
          <div className="pm-card">


            <div className="pm-filter-card-body">
              {/* Pills row inside unified toolbar block */}
              <div className="pm-filter-row">
                {CATEGORY_CHIPS.map((chip) => (
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

              {/* Inputs Toolbar Row */}
              <div className="pm-toolbar">
                {/* Search */}
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

                {/* Status filter */}
                <select className="pm-filter-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="">All Status</option>
                  <option value="inception">Inception</option>
                  <option value="planning">Planning</option>
                  <option value="building">Building</option>
                  <option value="testing">Testing</option>
                  <option value="release">Release Process</option>
                  <option value="deployed">Deployed</option>
                  <option value="completed">Completed</option>
                </select>

                {/* Date range */}
                <input type="date" className="pm-date-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} title="Start Date" />
                <input type="date" className="pm-date-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} title="End Date" />

                <div className="pm-toolbar-divider" />

                {/* Icon Actions */}
                <button type="button" className="pm-icon-btn" title="Swap / Sort">
                  <ArrowLeftRight size={15} />
                </button>
                <button type="button" className="pm-icon-btn" title="Reset Filters" onClick={() => { setSearchQuery(''); setStatusFilter(''); setStartDate(''); setEndDate(''); }}>
                  <RotateCcw size={15} />
                </button>
                <button type="button" className="pm-icon-btn" title="Column Visibility">
                  <Eye size={15} />
                </button>

                <div className="pm-toolbar-divider" />

                <button type="button" className="pm-export-btn" onClick={() => exportToCSV(filteredProjects, 'project_monitoring.csv')}>
                  <Download size={14} /> Export
                </button>
              </div>
            </div>
          </div>

          {/* Master Table */}
          <div className="pm-table-container">
            <table className="pm-master-table">
              <thead>
                <tr>
                  <th className="sortable" style={{ width: '200px' }}>Project ID / Code</th>
                  <th>Summary / Description</th>
                  <th style={{ width: '340px' }}>Lifecycle Progress</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={3}>
                      <div className="pm-empty-state">
                        <Search size={32} color="#cbd5e1" />
                        <p>No projects match your filters. Try adjusting your search criteria.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredProjects.flatMap((project) => {
                    const pills = getLifecyclePills(project.stageIdx, project.stage);
                    const isExpanded = expandedId === project.id;
                    const chart = project.chartData || { planning: 78, development: 75, testing: 7, delivered: 72 };

                    const rows = [
                      <tr
                        key={project.id}
                        className={isExpanded ? 'expanded-row' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedId(isExpanded ? null : project.id)}
                      >
                        <td>
                          <div className="pm-code-cell">
                            {isExpanded
                              ? <ChevronDown size={14} color="#64748b" />
                              : <ChevronRight size={14} color="#64748b" />
                            }
                            <span className="pm-project-code">{project.code}</span>
                            <button type="button" className="pm-info-btn" onClick={(e) => e.stopPropagation()} title="More Info">i</button>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: 13, color: '#334155', fontWeight: 500 }}>
                            {project.summary}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {pills.map((cls, i) => (
                                <div
                                  key={i}
                                  className={`pm-lifecycle-pill ${cls}`}
                                  style={{ width: 28, flexShrink: 0 }}
                                  title={LIFECYCLE_STAGES[i]?.label ?? `Stage ${i + 1}`}
                                />
                              ))}
                            </div>
                            <span className="pm-stage-progress-label">
                              {project.stageIdx + 1}/{STAGE_TOTAL}
                            </span>
                          </div>
                        </td>
                      </tr>,
                    ];

                    if (isExpanded) {
                      rows.push(
                        <tr key={`detail-${project.id}`} className="pm-detail-row">
                          <td colSpan={3}>
                            <div className="pm-expanded-detail-container">

                              {/* 2-Column Key-Value Info Grid */}
                              <div className="pm-kv-grid">

                                {/* Column 1 */}
                                <div className="pm-kv-col">
                                  <div className="pm-kv-item">
                                    <span className="pm-kv-label">Project Summary:</span>
                                    <span className="pm-kv-val">
                                      {project.code}- {project.summary}{' '}
                                      <button type="button" className="pm-more-link" onClick={() => alert(project.summary)}>More</button>
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

                              {/* Project Description Section */}
                              <div className="pm-desc-block">
                                <span className="pm-kv-label">Project Description:</span>
                                <span className="pm-desc-text">
                                  {project.fullDesc}{' '}
                                  <button type="button" className="pm-more-link" onClick={() => alert(project.fullDesc)}>More</button>
                                </span>
                              </div>

                              {/* Visual Charts & Status Section (Bottom Panel Side-by-Side) */}
                              <div className="pm-detail-bottom-row">

                                {/* Left Side: Bar Chart / Histogram */}
                                <div className="pm-detail-card pm-detail-card--chart">
                                  <div className="pm-detail-card-header">
                                    <h4 className="pm-detail-card-title">Chart</h4>
                                  </div>

                                  {/* Top Legend */}
                                  <div className="pm-chart-legend">
                                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#60a5fa' }} /> Planning</span>
                                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#ef4444' }} /> Development</span>
                                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#ec4899' }} /> Testing</span>
                                    <span className="pm-legend-item"><span className="pm-legend-dot" style={{ background: '#10b981' }} /> Delivered</span>
                                  </div>

                                  {/* Histogram Bar Chart */}
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
                                        {/* Planning */}
                                        <div className="pm-histo-col">
                                          <div className="pm-histo-bar-wrap">
                                            <div className="pm-histo-bar" style={{ height: `${(chart.planning / 80) * 100}%`, background: '#60a5fa' }} title={`Planning: ${chart.planning}`} />
                                          </div>
                                          <span className="pm-histo-label">Planning</span>
                                        </div>

                                        {/* Development */}
                                        <div className="pm-histo-col">
                                          <div className="pm-histo-bar-wrap">
                                            <div className="pm-histo-bar" style={{ height: `${(chart.development / 80) * 100}%`, background: '#ef4444' }} title={`Development: ${chart.development}`} />
                                          </div>
                                          <span className="pm-histo-label">Development</span>
                                        </div>

                                        {/* Testing */}
                                        <div className="pm-histo-col">
                                          <div className="pm-histo-bar-wrap">
                                            <div className="pm-histo-bar" style={{ height: `${(chart.testing / 80) * 100}%`, background: '#ec4899' }} title={`Testing: ${chart.testing}`} />
                                          </div>
                                          <span className="pm-histo-label">Testing</span>
                                        </div>

                                        {/* Delivered */}
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

                                {/* Right Side: Project Timeline (Donut Gauge) */}
                                <div className="pm-detail-card pm-detail-card--timeline">
                                  <div className="pm-detail-card-header">
                                    <h4 className="pm-detail-card-title">Project Timeline</h4>
                                  </div>

                                  <div className="pm-donut-body">
                                    <div className="pm-donut-wrap">
                                      <svg viewBox="0 0 100 100" className="pm-donut-svg">
                                        <circle cx="50" cy="50" r="38" className="pm-donut-bg" />
                                        <circle cx="50" cy="50" r="38" className="pm-donut-fill" />
                                      </svg>
                                      <span className="pm-donut-text">-%</span>
                                    </div>

                                    <div className="pm-timeline-status-alert">
                                      Status - Ready For Production ( Over Due for - {project.overdueDays || 364} Days)
                                    </div>
                                  </div>
                                </div>

                              </div>

                            </div>
                          </td>
                        </tr>,
                      );
                    }

                    return rows;
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3: PROJECT BREACHES
          ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'breaches' && (
        <div className="pm-tab-content">

          {/* Executive Risk Banners (KPI Cards) */}
          <div className="pm-risk-banners">
            <div
              className="pm-risk-banner critical"
              onClick={() => setDrilldownStage({ key: 'sla1', label: 'Unclosed Projects Started Before 60 Days', count: 92 })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDrilldownStage({ key: 'sla1', label: 'Unclosed Projects Started Before 60 Days', count: 92 }); }}
            >
              <div className="pm-risk-icon-container">
                <AlertOctagon size={16} />
              </div>
              <div className="pm-risk-meta">
                <span className="pm-risk-count">92</span>
                <span className="pm-risk-desc">Unclosed Projects Started &gt; 60 Days</span>
              </div>
            </div>

            <div
              className="pm-risk-banner warning"
              onClick={() => setDrilldownStage({ key: 'sla5', label: 'CR in Progress Stage, but WO Moved to Testing', count: 41 })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDrilldownStage({ key: 'sla5', label: 'CR in Progress Stage, but WO Moved to Testing', count: 41 }); }}
            >
              <div className="pm-risk-icon-container">
                <AlertTriangle size={16} />
              </div>
              <div className="pm-risk-meta">
                <span className="pm-risk-count">41</span>
                <span className="pm-risk-desc">CR in Progress but WO in Testing</span>
              </div>
            </div>

            <div
              className="pm-risk-banner info"
              onClick={() => setDrilldownStage({ key: 'cr2', label: 'No Man Days in CR', count: 40 })}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setDrilldownStage({ key: 'cr2', label: 'No Man Days in CR', count: 40 }); }}
            >
              <div className="pm-risk-icon-container">
                <FileText size={16} />
              </div>
              <div className="pm-risk-meta">
                <span className="pm-risk-count">40</span>
                <span className="pm-risk-desc">No Man Days in CR</span>
              </div>
            </div>
          </div>

          {/* Governance Cards */}
          <div className="pm-governance-grid">

            {/* Card A: SLA & Phase Breaches */}
            <div className="pm-gov-card">
              <div className="pm-gov-card-header">
                <AlertTriangle size={14} className="pm-gov-card-icon text-red" />
                <h3 className="pm-card-title">SLA &amp; Phase Breaches</h3>
              </div>
              <div className="pm-gov-card-body">
                {BREACH_METRICS.sla.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pm-breach-metric ${m.count > 0 ? 'clickable' : ''}`}
                    onClick={() => {
                      setActiveBreachMetric((prev) => (prev === m.id ? null : m.id));
                      if (m.count > 0) {
                        setDrilldownStage({ key: m.id, label: m.label, count: m.count });
                      }
                    }}
                    disabled={m.count === 0}
                  >
                    <span className="pm-breach-label">{m.label}</span>
                    <span className={`pm-breach-val ${m.count === 0 ? 'zero' : 'nonzero'}`}>
                      {m.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card B: Due Date Exceptions */}
            <div className="pm-gov-card">
              <div className="pm-gov-card-header">
                <Calendar size={14} className="pm-gov-card-icon text-amber" />
                <h3 className="pm-card-title">Due Date Exceptions</h3>
              </div>
              <div className="pm-gov-card-body">
                {BREACH_METRICS.dueDate.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pm-breach-metric ${m.count > 0 ? 'clickable' : ''}`}
                    onClick={() => {
                      setActiveBreachMetric((prev) => (prev === m.id ? null : m.id));
                      if (m.count > 0) {
                        setDrilldownStage({ key: m.id, label: m.label, count: m.count });
                      }
                    }}
                    disabled={m.count === 0}
                  >
                    <span className="pm-breach-label">{m.label}</span>
                    <span className={`pm-breach-val ${m.count === 0 ? 'zero' : 'nonzero'}`}>
                      {m.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Card C: CR Data Hygiene */}
            <div className="pm-gov-card">
              <div className="pm-gov-card-header">
                <ShieldCheck size={14} className="pm-gov-card-icon text-emerald" />
                <h3 className="pm-card-title">Change Request (CR) Data Hygiene</h3>
              </div>
              <div className="pm-gov-card-body">
                {BREACH_METRICS.cr.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`pm-breach-metric ${m.count > 0 ? 'clickable' : ''}`}
                    onClick={() => {
                      setActiveBreachMetric((prev) => (prev === m.id ? null : m.id));
                      if (m.count > 0) {
                        setDrilldownStage({ key: m.id, label: m.label, count: m.count });
                      }
                    }}
                    disabled={m.count === 0}
                  >
                    <span className="pm-breach-label">{m.label}</span>
                    <span className={`pm-breach-val ${m.count === 0 ? 'zero' : 'nonzero'}`}>
                      {m.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Resolution Table — appears when a nonzero breach metric is selected */}
          {activeBreachMetric && (
            <div className="pm-resolution-section">
              <div className="pm-resolution-header">
                <h3 className="pm-resolution-title">
                  <FileSearch size={14} />
                  Resolution Grid
                  <span className="pm-resolution-badge">{RESOLUTION_TABLE_DATA.length}</span>
                </h3>
                <button
                  type="button"
                  className="pm-export-btn"
                  onClick={() => exportToCSV(RESOLUTION_TABLE_DATA, 'governance_breaches_resolution.csv')}
                >
                  <Download size={14} /> Export
                </button>
              </div>
              <div className="pm-resolution-table-wrap">
                <table className="pm-master-table">
                  <thead>
                    <tr>
                      <th style={{ width: '180px' }}>Project Code</th>
                      <th>IT Delivery Lead</th>
                      <th style={{ width: '180px' }}>Current Stage</th>
                      <th>Missing Data Field</th>
                      <th style={{ width: '120px', textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RESOLUTION_TABLE_DATA.map((row, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className="pm-project-code">{row.code}</span>
                        </td>
                        <td style={{ fontSize: 12, color: '#334155', fontWeight: 500 }}>{row.itdl}</td>
                        <td>
                          <span className="pm-stage-pill" style={{ background: STAGE_COLORS[row.status.toLowerCase()] || '#f59e0b' }}>
                            {row.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
                          {row.missingField}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button type="button" className="pm-export-btn" style={{ height: 28, fontSize: 11, padding: '0 12px' }}>
                            Assign
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Drill-down Modal Overlay ────────────────────────────────────── */}
      {drilldownStage && (
        <DrilldownModal
          stage={drilldownStage}
          onClose={() => setDrilldownStage(null)}
        />
      )}
    </div>
  );
}

export default ProjectMonitoringPage;
