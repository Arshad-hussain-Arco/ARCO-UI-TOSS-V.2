import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  FileText,
  MessageSquare,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { projectService } from '@services/projectService';

import './ProjectMonitoringPage.css';

/** Delivery project tracker with SLA breach reporting. */
export function ProjectMonitoringPage() {
  useDocumentTitle('Project Monitoring');

  const fetchProjects = useCallback(() => projectService.getProjects(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchProjects);

  const sources = data?.sources;
  const projects = data?.projects ?? [];

  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [leadSearch, setLeadSearch] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [expandedProject, setExpandedProject] = useState(null);
  const [activeBreachTab, setActiveBreachTab] = useState('project');
  const uniqueLeads = [...new Set(projects.map((p) => p.itDeliveryLead))];
  const uniqueOwners = [...new Set(projects.map((p) => p.productOwner))];
  const statusCounts = projects.reduce((acc, project) => {
    acc[project.currentStage] = (acc[project.currentStage] || 0) + 1;
    return acc;
  }, {});
  const filteredProjects = projects.filter((project) => {
    const matchesStatus = selectedStatus === 'all' || project.currentStage === selectedStatus;
    const matchesSearch =
      project.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLead = !leadSearch || project.itDeliveryLead === leadSearch;
    const matchesOwner = !ownerSearch || project.productOwner === ownerSearch;
    return matchesStatus && matchesSearch && matchesLead && matchesOwner;
  });
  const breachCounts = {
    project: projects.filter((p) => p.breaches.project).length,
    dueDate: projects.filter((p) => p.breaches.dueDate).length,
    crException: projects.filter((p) => p.breaches.crException).length,
  };
  const getStatusColor = (status) => {
    const colors = {
      inception: '#8b5cf6',
      planning: '#3b82f6',
      building: '#06b6d4',
      testing: '#f59e0b',
      'release-process': '#fb923c',
      deployed: '#10b981',
      completed: '#059669',
      'testing-blocked': '#ef4444',
      deferred: '#6b7280',
    };
    return colors[status];
  };
  const getStatusLabel = (status) => {
    const labels = {
      inception: 'Inception',
      planning: 'Planning',
      building: 'Building',
      testing: 'Testing',
      'release-process': 'Release Process',
      deployed: 'Deployed',
      completed: 'Completed',
      'testing-blocked': 'Testing Blocked',
      deferred: 'Deferred',
    };
    return labels[status];
  };
  const getRiskColor = (risk) => {
    const colors = {
      low: '#10b981',
      medium: '#f59e0b',
      high: '#f97316',
      critical: '#ef4444',
    };
    return colors[risk];
  };
  const getRiskIcon = (risk) => {
    if (risk === 'low') return <CheckCircle size={14} />;
    if (risk === 'medium' || risk === 'high') return <AlertTriangle size={14} />;
    return <AlertTriangle size={14} />;
  };
  if (error) {
    return (
      <ErrorState
        title="Projects could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !sources) {
    return <Loader message="Loading projects…" />;
  }

  return (
    <div className="project-monitoring-page">
      {/* Header */}
      <div className="project-header">
        <div className="project-header-left">
          <h1 className="project-title">Project Monitoring</h1>
          <p className="project-subtitle">
            Last updated: WO {sources.woFile} | CR {sources.crFile}
          </p>
        </div>
        <div className="project-header-actions">
          <button className="project-action-btn">
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
          <button className="project-action-btn">
            <Download size={14} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="project-status-strip">
        <button
          className={`project-status-chip ${selectedStatus === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedStatus('all')}
        >
          <span className="project-chip-label">All</span>
          <span className="project-chip-count">{projects.length}</span>
        </button>

        {Object.keys(statusCounts).map((status) => (
          <button
            key={status}
            className={`project-status-chip ${selectedStatus === status ? 'active' : ''}`}
            style={{ '--status-color': getStatusColor(status) }}
            onClick={() => setSelectedStatus(status)}
          >
            <span className="project-chip-label">{getStatusLabel(status)}</span>
            <span className="project-chip-count">{statusCounts[status]}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="project-content-wrapper">
        {/* Left: Project Table */}
        <div className="project-table-section">
          {/* Filters */}
          <div className="project-filters">
            <div className="project-search-wrapper">
              <Search className="project-search-icon" size={14} />
              <input
                type="text"
                placeholder="Search projects..."
                className="project-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <Select
              value={leadSearch}
              onChange={setLeadSearch}
              placeholder="All IT Leads"
              options={[
                { value: '', label: 'All IT Leads' },
                ...uniqueLeads.map((lead) => ({ value: lead, label: lead })),
              ]}
            />

            <Select
              value={ownerSearch}
              onChange={setOwnerSearch}
              placeholder="All Product Owners"
              options={[
                { value: '', label: 'All Product Owners' },
                ...uniqueOwners.map((owner) => ({ value: owner, label: owner })),
              ]}
            />
          </div>

          {/* Projects Table */}
          <div className="project-table-container">
            <table className="project-table">
              <thead className="project-table-head">
                <tr>
                  <th className="project-th code-col">Project Code</th>
                  <th className="project-th summary-col">Summary</th>
                  <th className="project-th lifecycle-col">Lifecycle Progress</th>
                  <th className="project-th stage-col">Current Stage</th>
                  <th className="project-th risk-col">Risk</th>
                </tr>
              </thead>
              <tbody className="project-table-body">
                {filteredProjects.flatMap((project) => {
                  const rows = [
                    <tr
                      key={`project-${project.id}`}
                      className={`project-row ${expandedProject === project.id ? 'expanded' : ''}`}
                      onClick={() =>
                        setExpandedProject(expandedProject === project.id ? null : project.id)
                      }
                    >
                      <td className="project-td code-col">
                        <div className="project-code-cell">
                          {expandedProject === project.id ? (
                            <ChevronDown size={14} className="project-expand-icon" />
                          ) : (
                            <ChevronRight size={14} className="project-expand-icon" />
                          )}
                          <span className="project-code">{project.code}</span>
                        </div>
                      </td>
                      <td className="project-td summary-col">
                        <div className="project-summary-cell">
                          <span className="project-summary-text">{project.summary}</span>
                          {project.isOverdue && (
                            <span className="project-overdue-badge">Overdue</span>
                          )}
                        </div>
                      </td>
                      <td className="project-td lifecycle-col">
                        <div className="project-lifecycle-mini">
                          {project.lifecycleStages.map((stage, i) => (
                            <div
                              key={i}
                              className={`project-lifecycle-step ${stage.status}`}
                              title={stage.name}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="project-td stage-col">
                        <span
                          className="project-stage-badge"
                          style={{ background: getStatusColor(project.currentStage) }}
                        >
                          {getStatusLabel(project.currentStage)}
                        </span>
                      </td>
                      <td className="project-td risk-col">
                        <div
                          className="project-risk-badge"
                          style={{ color: getRiskColor(project.riskLevel) }}
                        >
                          {getRiskIcon(project.riskLevel)}
                          <span>{project.riskLevel.toUpperCase()}</span>
                        </div>
                      </td>
                    </tr>,
                  ];
                  if (expandedProject === project.id) {
                    rows.push(
                      <tr key={`detail-${project.id}`} className="project-detail-row">
                        <td colSpan={5} className="project-detail-cell">
                          <div className="project-detail-panel">
                            {/* Description */}
                            <div className="project-detail-section">
                              <h4 className="project-detail-title">
                                <FileText size={14} />
                                Description
                              </h4>
                              <p className="project-detail-description">
                                {project.fullDescription}
                              </p>
                            </div>

                            {/* Team Grid */}
                            <div className="project-detail-grid">
                              <div className="project-detail-section">
                                <h4 className="project-detail-title">
                                  <Users size={14} />
                                  Ownership
                                </h4>
                                <div className="project-ownership-list">
                                  <div className="project-ownership-item">
                                    <span className="project-ownership-label">
                                      IT Delivery Lead
                                    </span>
                                    <span className="project-ownership-value">
                                      {project.itDeliveryLead}
                                    </span>
                                  </div>
                                  <div className="project-ownership-item">
                                    <span className="project-ownership-label">Product Owner</span>
                                    <span className="project-ownership-value">
                                      {project.productOwner}
                                    </span>
                                  </div>
                                  <div className="project-ownership-item">
                                    <span className="project-ownership-label">PMO</span>
                                    <span className="project-ownership-value">{project.pmo}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="project-detail-section">
                                <h4 className="project-detail-title">
                                  <Clock size={14} />
                                  Timeline
                                </h4>
                                <div className="project-timeline-info">
                                  <div className="project-timeline-item">
                                    <span className="project-timeline-label">Due Date</span>
                                    <span className="project-timeline-value">
                                      {project.dueDate}
                                    </span>
                                  </div>
                                  <div className="project-timeline-item">
                                    <span className="project-timeline-label">Last Activity</span>
                                    <span className="project-timeline-value">
                                      {project.lastActivity}
                                    </span>
                                  </div>
                                  {project.slaCountdown && (
                                    <div className="project-timeline-item warning">
                                      <span className="project-timeline-label">SLA Status</span>
                                      <span className="project-timeline-value">
                                        {project.slaCountdown}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Latest Comment */}
                            <div className="project-detail-section">
                              <h4 className="project-detail-title">
                                <MessageSquare size={14} />
                                Latest Comment
                              </h4>
                              <p className="project-comment-text">{project.lastComment}</p>
                            </div>
                          </div>
                        </td>
                      </tr>,
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>

            {filteredProjects.length === 0 && (
              <div className="project-empty-state">
                <Search size={32} />
                <h3>No projects found</h3>
                <p>Try adjusting your filters</p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Breach & Ownership Panels */}
        <div className="project-sidebar-panels">
          {/* Breach Monitoring */}
          <div className="project-breach-panel">
            <h3 className="project-panel-title">Breach & Risk Monitor</h3>

            <div className="project-breach-tabs">
              <button
                className={`project-breach-tab ${activeBreachTab === 'project' ? 'active' : ''}`}
                onClick={() => setActiveBreachTab('project')}
              >
                <span>Project</span>
                {breachCounts.project > 0 && (
                  <span className="project-breach-count">{breachCounts.project}</span>
                )}
              </button>
              <button
                className={`project-breach-tab ${activeBreachTab === 'dueDate' ? 'active' : ''}`}
                onClick={() => setActiveBreachTab('dueDate')}
              >
                <span>Due Date</span>
                {breachCounts.dueDate > 0 && (
                  <span className="project-breach-count">{breachCounts.dueDate}</span>
                )}
              </button>
              <button
                className={`project-breach-tab ${activeBreachTab === 'crException' ? 'active' : ''}`}
                onClick={() => setActiveBreachTab('crException')}
              >
                <span>CR Exception</span>
                {breachCounts.crException > 0 && (
                  <span className="project-breach-count">{breachCounts.crException}</span>
                )}
              </button>
            </div>

            <div className="project-breach-list">
              {projects
                .filter((p) => p.breaches[activeBreachTab])
                .map((project) => (
                  <div key={project.id} className="project-breach-item">
                    <div className="project-breach-header">
                      <span className="project-breach-code">{project.code}</span>
                      <AlertTriangle size={12} className="project-breach-icon" />
                    </div>
                    <div className="project-breach-summary">{project.summary}</div>
                    {project.slaCountdown && (
                      <div className="project-breach-sla">{project.slaCountdown}</div>
                    )}
                  </div>
                ))}
              {projects.filter((p) => p.breaches[activeBreachTab]).length === 0 && (
                <div className="project-breach-empty">
                  <CheckCircle size={16} />
                  <span>No breaches</span>
                </div>
              )}
            </div>
          </div>

          {/* Ownership Panel */}
          <div className="project-ownership-panel">
            <h3 className="project-panel-title">Ownership</h3>

            <div className="project-ownership-section">
              <h4 className="project-ownership-subtitle">IT Delivery Lead</h4>
              <div className="project-owner-list">
                {uniqueLeads.map((lead) => (
                  <div key={lead} className="project-owner-item">
                    <span className="project-owner-name">{lead}</span>
                    <span className="project-owner-count">
                      {projects.filter((p) => p.itDeliveryLead === lead).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="project-ownership-section">
              <h4 className="project-ownership-subtitle">Product Owner</h4>
              <div className="project-owner-list">
                {uniqueOwners.map((owner) => (
                  <div key={owner} className="project-owner-item">
                    <span className="project-owner-name">{owner}</span>
                    <span className="project-owner-count">
                      {projects.filter((p) => p.productOwner === owner).length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
export default ProjectMonitoringPage;
