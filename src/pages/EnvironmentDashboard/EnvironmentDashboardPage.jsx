import { useCallback, useState } from 'react';
import {
  Server,
  Database,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  FileText,
  Upload,
  Download,
  Trash2,
  Edit,
  Copy,
  ChevronRight,
  ChevronDown,
  Search,
  Calendar,
  Cloud,
  HardDrive,
  Network,
  Activity,
  Clock,
  Users,
  Settings,
  FileUp,
  Eye,
  X,
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { environmentService } from '@services/environmentService';

import './EnvironmentDashboardPage.css';
import { activatable, dismissOverlay } from '@utils/interactive';

/** Environment inventory: configuration files and the per-environment feature matrix. */
export function EnvironmentDashboardPage() {
  useDocumentTitle('Environment Dashboard');

  const fetchEnvironments = useCallback(() => environmentService.getEnvironments(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchEnvironments);

  const overviewStats = data?.overview;
  const configFiles = data?.configFiles ?? [];
  const environments = data?.environments ?? [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFeatureType, setSelectedFeatureType] = useState('All');
  const [expandedEnvironment, setExpandedEnvironment] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [modalFeatureType, setModalFeatureType] = useState('Infra');
  const [expandedInfraGroup, setExpandedInfraGroup] = useState({});
  const toggleEnvironment = (envId) => {
    setExpandedEnvironment(expandedEnvironment === envId ? null : envId);
  };
  const toggleInfraGroup = (envId, groupType) => {
    setExpandedInfraGroup((prev) => {
      const envGroups = prev[envId] || [];
      const isExpanded = envGroups.includes(groupType);
      return {
        ...prev,
        [envId]: isExpanded ? envGroups.filter((g) => g !== groupType) : [...envGroups, groupType],
      };
    });
  };
  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'warning':
        return 'warning';
      case 'critical':
        return 'danger';
    }
  };
  const getEnvStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return 'success';
      case 'inactive':
        return 'secondary';
      case 'maintenance':
        return 'warning';
      default:
        return 'secondary';
    }
  };
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };
  const groupServersByType = (servers) => {
    return servers.reduce((acc, server) => {
      if (!acc[server.type]) acc[server.type] = [];
      acc[server.type].push(server);
      return acc;
    }, {});
  };
  const filteredConfigs = configFiles.filter((config) => {
    const matchesSearch =
      config.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      config.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedFeatureType === 'All' || config.featureType === selectedFeatureType;
    return matchesSearch && matchesType;
  });
  if (error) {
    return (
      <ErrorState
        title="Environments could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !overviewStats) {
    return <Loader message="Loading environments…" />;
  }

  return (
    <div className="env-dashboard-page">
      {/* Page Header */}
      <div className="env-dashboard-header">
        <div className="env-dashboard-header-content">
          <h1 className="env-dashboard-title">Environment Dashboard</h1>
          <p className="env-dashboard-subtitle">
            Centralized control and visibility hub for environment management
          </p>
        </div>
      </div>

      {/* 1️⃣ Environment Overview */}
      <div className="env-overview-section">
        <h2 className="env-section-title">Environment Overview</h2>
        <div className="env-overview-grid">
          <div className="env-overview-card">
            <div className="env-overview-icon" data-color="blue">
              <Server size={20} />
            </div>
            <div className="env-overview-content">
              <div className="env-overview-value">{overviewStats.totalEnvironments}</div>
              <div className="env-overview-label">Total Environments</div>
            </div>
          </div>

          <div className="env-overview-card">
            <div className="env-overview-icon" data-color="green">
              <CheckCircle size={20} />
            </div>
            <div className="env-overview-content">
              <div className="env-overview-value">{overviewStats.activeEnvironments}</div>
              <div className="env-overview-label">Active Environments</div>
            </div>
          </div>

          <div className="env-overview-card">
            <div className="env-overview-icon" data-color="purple">
              <Clock size={20} />
            </div>
            <div className="env-overview-content">
              <div className="env-overview-value">{overviewStats.lastConfigUpdate}</div>
              <div className="env-overview-label">Last Config Update</div>
            </div>
          </div>

          <div className="env-overview-card">
            <div className="env-overview-icon" data-color="orange">
              <RefreshCw size={20} />
            </div>
            <div className="env-overview-content">
              <div className="env-overview-value">{overviewStats.lastEnvRefresh}</div>
              <div className="env-overview-label">Last Environment Refresh</div>
            </div>
          </div>

          <div className="env-overview-card" data-alert="true">
            <div className="env-overview-icon" data-color="red">
              <AlertCircle size={20} />
            </div>
            <div className="env-overview-content">
              <div className="env-overview-value">{overviewStats.environmentsWithIssues}</div>
              <div className="env-overview-label">Environments with Issues</div>
            </div>
          </div>
        </div>
      </div>

      {/* 2️⃣ Environment Configuration Management */}
      <div className="env-config-section">
        <div className="env-section-header">
          <h2 className="env-section-title">Environment Configuration</h2>
          <button className="env-upload-btn" onClick={() => setShowUploadModal(true)}>
            <Upload size={16} />
            <span>Upload Config</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="env-config-filter-bar">
          <div className="env-search-wrapper">
            <Search className="env-search-icon" size={16} />
            <input
              type="text"
              placeholder="Search configurations..."
              className="env-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="env-filter-group">
            <button
              className={`env-filter-btn ${selectedFeatureType === 'All' ? 'active' : ''}`}
              onClick={() => setSelectedFeatureType('All')}
            >
              All Types
            </button>
            <button
              className={`env-filter-btn ${selectedFeatureType === 'Infra' ? 'active' : ''}`}
              onClick={() => setSelectedFeatureType('Infra')}
            >
              <HardDrive size={14} />
              Infra
            </button>
            <button
              className={`env-filter-btn ${selectedFeatureType === 'Status' ? 'active' : ''}`}
              onClick={() => setSelectedFeatureType('Status')}
            >
              <Activity size={14} />
              Status
            </button>
          </div>
        </div>

        {/* Config Cards */}
        <div className="env-config-grid">
          {filteredConfigs.map((config) => (
            <div key={config.id} className="env-config-card">
              <div className="env-config-card-header">
                <div className="env-config-type-badge" data-type={config.featureType.toLowerCase()}>
                  {config.featureType === 'Infra' ? (
                    <HardDrive size={12} />
                  ) : (
                    <Activity size={12} />
                  )}
                  <span>{config.featureType}</span>
                </div>
                <div className="env-config-version">v{config.version}</div>
              </div>

              <div className="env-config-card-body">
                <div className="env-config-file-info">
                  <FileText size={20} className="env-config-file-icon" />
                  <div className="env-config-file-details">
                    <div className="env-config-file-name">{config.fileName}</div>
                    <div className="env-config-file-meta">{config.size}</div>
                  </div>
                </div>

                <div className="env-config-metadata">
                  <div className="env-config-meta-item">
                    <Users size={14} />
                    <span>{config.uploadedBy}</span>
                  </div>
                  <div className="env-config-meta-item">
                    <Calendar size={14} />
                    <span>{config.createdDate}</span>
                  </div>
                  <div className="env-config-meta-item">
                    <Cloud size={14} />
                    <span>{config.storageLocation}</span>
                  </div>
                </div>
              </div>

              <div className="env-config-card-footer">
                <button className="env-config-action-btn" title="Preview">
                  <Eye size={14} />
                </button>
                <button className="env-config-action-btn" title="Edit">
                  <Edit size={14} />
                </button>
                <button className="env-config-action-btn" title="Download">
                  <Download size={14} />
                </button>
                <button className="env-config-action-btn env-config-action-danger" title="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredConfigs.length === 0 && (
          <div className="env-empty-state">
            <FileText size={48} className="env-empty-icon" />
            <h3 className="env-empty-title">No configurations found</h3>
            <p className="env-empty-description">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* 3️⃣ & 4️⃣ Environment Details - Combined Infrastructure & Status */}
      <div className="env-details-section">
        <h2 className="env-section-title">Environment Details</h2>

        <div className="env-cards-container">
          {environments.map((env) => (
            <div key={env.id} className="env-detail-card">
              {/* Environment Header */}
              <div
                className="env-detail-header"
                {...activatable(() => toggleEnvironment(env.id), {
                  isExpanded: expandedEnvironment === env.id,
                })}
              >
                <div className="env-detail-header-left">
                  <button className="env-detail-toggle">
                    {expandedEnvironment === env.id ? (
                      <ChevronDown size={18} />
                    ) : (
                      <ChevronRight size={18} />
                    )}
                  </button>
                  <div className="env-detail-info">
                    <h3 className="env-detail-name">{env.name}</h3>
                    <div className="env-detail-meta">
                      <span className={`env-status-badge ${getEnvStatusBadge(env.status)}`}>
                        {env.status}
                      </span>
                      <span className="env-detail-owner">
                        <Users size={12} />
                        {env.statusInfo.owner}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="env-detail-quick-stats">
                  <div className="env-quick-stat">
                    <Server size={14} />
                    <span>{env.infra.servers.length} servers</span>
                  </div>
                  <div className="env-quick-stat">
                    <Database size={14} />
                    <span>{env.infra.dbHosts.length} DB hosts</span>
                  </div>
                  <div
                    className={`env-quick-stat ${env.statusInfo.rtbsConnectivity === 'connected' ? 'success' : 'danger'}`}
                  >
                    <Network size={14} />
                    <span>RTBS {env.statusInfo.rtbsConnectivity}</span>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedEnvironment === env.id && (
                <div className="env-detail-body">
                  {/* Infrastructure Tab */}
                  <div className="env-detail-tab">
                    <h4 className="env-tab-title">
                      <HardDrive size={16} />
                      Infrastructure Topology
                    </h4>

                    {/* Server Groups */}
                    <div className="env-server-groups">
                      {Object.entries(groupServersByType(env.infra.servers)).map(
                        ([type, servers]) => (
                          <div key={type} className="env-server-group">
                            <button
                              className="env-server-group-header"
                              onClick={() => toggleInfraGroup(env.id, type)}
                            >
                              <div className="env-server-group-title">
                                {expandedInfraGroup[env.id]?.includes(type) ? (
                                  <ChevronDown size={16} />
                                ) : (
                                  <ChevronRight size={16} />
                                )}
                                <span>{type} Servers</span>
                                <span className="env-server-count">{servers.length}</span>
                              </div>
                            </button>

                            {expandedInfraGroup[env.id]?.includes(type) && (
                              <div className="env-server-list">
                                {servers.map((server) => (
                                  <div key={server.name} className="env-server-item">
                                    <div className="env-server-info">
                                      <div
                                        className={`env-server-status-dot ${getStatusColor(server.status)}`}
                                      />
                                      <span className="env-server-name">{server.name}</span>
                                    </div>
                                    <div className="env-server-ip">
                                      <code>{server.ip}</code>
                                      <button
                                        className="env-copy-btn"
                                        onClick={() => copyToClipboard(server.ip)}
                                        title="Copy IP"
                                      >
                                        <Copy size={12} />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>

                    {/* App Directory */}
                    <div className="env-info-row">
                      <div className="env-info-label">
                        <Settings size={14} />
                        Application Directory
                      </div>
                      <div className="env-info-value">
                        <code>{env.infra.appDirectory}</code>
                        <button
                          className="env-copy-btn"
                          onClick={() => copyToClipboard(env.infra.appDirectory)}
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>

                    {/* DB Hosts */}
                    <div className="env-info-row">
                      <div className="env-info-label">
                        <Database size={14} />
                        Database Hosts
                      </div>
                      <div className="env-db-hosts">
                        {env.infra.dbHosts.map((host, idx) => (
                          <div key={idx} className="env-db-host-chip">
                            <code>{host}</code>
                            <button className="env-copy-btn" onClick={() => copyToClipboard(host)}>
                              <Copy size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Status Tab */}
                  <div className="env-detail-tab">
                    <h4 className="env-tab-title">
                      <Activity size={16} />
                      Operational Status
                    </h4>

                    <div className="env-status-grid">
                      <div className="env-status-item">
                        <div className="env-status-label">Last DB Refresh</div>
                        <div className="env-status-value">
                          <RefreshCw size={14} />
                          {env.statusInfo.lastDBRefresh}
                        </div>
                      </div>

                      <div className="env-status-item">
                        <div className="env-status-label">Last App Refresh</div>
                        <div className="env-status-value">
                          <RefreshCw size={14} />
                          {env.statusInfo.lastAppRefresh}
                        </div>
                      </div>

                      <div className="env-status-item">
                        <div className="env-status-label">Last EOD Run</div>
                        <div className="env-status-value">
                          <Clock size={14} />
                          {env.statusInfo.lastEODRun}
                        </div>
                      </div>

                      <div className="env-status-item">
                        <div className="env-status-label">System Version</div>
                        <div className="env-status-value">
                          <Settings size={14} />
                          {env.statusInfo.systemVersion}
                        </div>
                      </div>

                      <div className="env-status-item">
                        <div className="env-status-label">Oracle Version</div>
                        <div className="env-status-value">
                          <Database size={14} />
                          {env.statusInfo.oracleVersion}
                        </div>
                      </div>

                      <div className="env-status-item">
                        <div className="env-status-label">RTBS Connectivity</div>
                        <div
                          className={`env-status-value ${env.statusInfo.rtbsConnectivity === 'connected' ? 'success' : 'danger'}`}
                        >
                          <Network size={14} />
                          {env.statusInfo.rtbsConnectivity}
                        </div>
                      </div>
                    </div>

                    {/* Health Badge */}
                    <div className="env-health-indicator">
                      <div
                        className={`env-health-badge ${env.infra.servers.some((s) => s.status === 'critical') ? 'danger' : env.infra.servers.some((s) => s.status === 'warning') ? 'warning' : 'success'}`}
                      >
                        {env.infra.servers.some((s) => s.status === 'critical') ? (
                          <>
                            <AlertCircle size={16} />
                            <span>Requires Attention</span>
                          </>
                        ) : env.infra.servers.some((s) => s.status === 'warning') ? (
                          <>
                            <AlertCircle size={16} />
                            <span>At Risk</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle size={16} />
                            <span>Healthy</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <>
          <div
            className="env-modal-backdrop"
            {...dismissOverlay(() => setShowUploadModal(false))}
          />
          <div className="env-modal">
            <div className="env-modal-header">
              <h3 className="env-modal-title">Upload Configuration</h3>
              <button className="env-modal-close" onClick={() => setShowUploadModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="env-modal-body">
              <div className="env-upload-area">
                <FileUp size={48} className="env-upload-icon" />
                <h4>Drag and drop your CSV file here</h4>
                <p>or click to browse</p>
                <input type="file" accept=".csv" style={{ display: 'none' }} />
              </div>
              <div className="env-form-group">
                <span className="env-form-label">Feature Type</span>
                <Select
                  value={modalFeatureType}
                  onChange={setModalFeatureType}
                  options={[
                    { value: 'Infra', label: 'Infra' },
                    { value: 'Status', label: 'Status' },
                  ]}
                  width="featureType"
                />
              </div>
            </div>
            <div className="env-modal-footer">
              <button className="env-btn-secondary" onClick={() => setShowUploadModal(false)}>
                Cancel
              </button>
              <button className="env-btn-primary">Upload</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
export default EnvironmentDashboardPage;
