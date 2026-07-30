import { useCallback, useState, useEffect } from 'react';
import {
  Server,
  Database,
  RefreshCw,
  Trash2,
  Edit,
  Copy,
  ChevronDown,
  Search,
  Calendar,
  Cloud,
  Users,
  FileUp,
  X,
  Activity,
  HardDrive,
  Network,
  Download,
  FileText,
  Settings
} from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { AdminTable } from '@components/ui/AdminTable/AdminTable';
import { Button } from '@components/ui/Button/Button';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useToast } from '@hooks/useToast';
import { environmentService } from '@services/environmentService';

import './EnvironmentDashboardPage.css';

/** Environment inventory: configuration files and the per-environment feature matrix. */
export function EnvironmentDashboardPage() {
  useDocumentTitle('Environment Dashboard');
  const toast = useToast();

  const fetchEnvironments = useCallback(() => environmentService.getEnvironments(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchEnvironments);

  // Accordion Expand/Collapse States (Environment Configuration & Details)
  const [isConfigExpanded, setIsConfigExpanded] = useState(true);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);

  // In-Memory Data Synchronization (Configs & Environments)
  const [configList, setConfigList] = useState([]);
  const [envList, setEnvList] = useState([]);

  useEffect(() => {
    if (data) {
      setConfigList(data.configFiles || []);
      setEnvList(data.environments || []);
    }
  }, [data]);

  // Global Config Search State
  const [configSearchQuery, setConfigSearchQuery] = useState('');

  // Environment Sub-Accordion Expand State (Only one environment expanded at a time)
  const [expandedEnvironment, setExpandedEnvironment] = useState(null);

  // Search input queries for each Environment (keyed by env.id)
  const [envSearchQueries, setEnvSearchQueries] = useState({});

  // Upload Configuration Modal States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadFeatureType, setUploadFeatureType] = useState('Infra');

  // Edit Configuration Modal States
  const [editingConfig, setEditingConfig] = useState(null);
  const [editForm, setEditForm] = useState({ featureType: '', fileName: '', storageLocation: '' });
  const [editErrors, setEditErrors] = useState({});

  // Delete Configuration Modal States
  const [deletingConfig, setDeletingConfig] = useState(null);

  // Expand/Collapse Toggles
  const toggleConfigAccordion = () => {
    setIsConfigExpanded(!isConfigExpanded);
  };

  const toggleDetailsAccordion = () => {
    setIsDetailsExpanded(!isDetailsExpanded);
  };

  const toggleEnvironmentRow = (envId) => {
    setExpandedEnvironment(expandedEnvironment === envId ? null : envId);
  };

  // Search query helper for environment component search
  const getEnvSearchQuery = (envId) => {
    return envSearchQueries[envId] || '';
  };
  const handleEnvSearchChange = (envId, query) => {
    setEnvSearchQueries((prev) => ({ ...prev, [envId]: query }));
  };

  // Clipboard Copier
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied: "${text}"`);
  };

  // Client-Side CSV Exporter
  const exportToCSV = (rowsData, colsDef, filename) => {
    const headers = colsDef.map((col) => `"${col.label}"`).join(',');
    const rows = rowsData.map((row) =>
      colsDef
        .map((col) => {
          let cellVal = '';
          if (col.renderText) {
            cellVal = col.renderText(row);
          } else if (col.key) {
            cellVal = row[col.key] ?? '';
          }
          return `"${cellVal.toString().replace(/"/g, '""')}"`;
        })
        .join(','),
    );

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Config Action Handlers
  const handleExportConfigs = () => {
    const columns = [
      { key: 'featureType', label: 'Type' },
      { key: 'version', label: 'Version' },
      { key: 'fileName', label: 'File Name' },
      { key: 'size', label: 'File Size' },
      { key: 'uploadedBy', label: 'Uploaded By' },
      { key: 'createdDate', label: 'Upload Date' },
      { key: 'storageLocation', label: 'File Location' },
    ];
    exportToCSV(filteredConfigs, columns, 'environment_configurations.csv');
    toast.success('Configurations list exported successfully.');
  };

  const handleOpenEdit = (config) => {
    setEditingConfig(config);
    setEditForm({
      featureType: config.featureType,
      fileName: config.fileName,
      storageLocation: config.storageLocation,
    });
    setEditErrors({});
  };

  const handleUpdateConfig = () => {
    const errors = {};
    if (!editForm.fileName.trim()) {
      errors.fileName = 'File Name is required';
    }
    if (!editForm.storageLocation.trim()) {
      errors.storageLocation = 'File Location is required';
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setConfigList((prev) =>
      prev.map((c) =>
        c.id === editingConfig.id ? { ...c, ...editForm, version: c.version + 1 } : c,
      ),
    );
    toast.success('Configuration updated successfully!');
    setEditingConfig(null);
  };

  const handleOpenDelete = (config) => {
    setDeletingConfig(config);
  };

  const handleDeleteConfig = () => {
    setConfigList((prev) => prev.filter((c) => c.id !== deletingConfig.id));
    toast.success('Configuration deleted successfully!');
    setDeletingConfig(null);
  };

  // Upload Handlers
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
    }
  };

  const handleConfirmUpload = () => {
    if (!uploadFile) {
      toast.error('Please drag & drop or select a CSV configuration file first.');
      return;
    }

    const newConfig = {
      id: `cfg-${Date.now()}`,
      featureType: uploadFeatureType,
      fileName: uploadFile.name,
      size: `${(uploadFile.size / 1024).toFixed(1)} KB`,
      uploadedBy: 'Current User',
      createdDate: new Date().toISOString().split('T')[0],
      storageLocation: `/configs/${uploadFeatureType.toLowerCase()}/`,
      version: 1,
    };

    setConfigList((prev) => [newConfig, ...prev]);
    toast.success('Configuration file uploaded successfully!');
    setShowUploadModal(false);
    setUploadFile(null);
  };

  // Consolidated Environment Components Mapper (merges servers, dbHosts, directory, services)
  const getEnvironmentComponents = (env) => {
    const rows = [];

    // 1. Servers
    if (env.infra?.servers) {
      env.infra.servers.forEach((srv) => {
        rows.push({
          id: `${env.id}-srv-${srv.name}`,
          name: srv.name,
          type: `${srv.type} Server`,
          endpoint: srv.ip,
          status: srv.status,
        });
      });
    }

    // 2. Database Hosts
    if (env.infra?.dbHosts) {
      env.infra.dbHosts.forEach((host, idx) => {
        let role = 'Primary';
        if (host.toLowerCase().includes('standby')) {
          role = 'Standby';
        } else if (host.toLowerCase().includes('dr')) {
          role = 'DR';
        }

        rows.push({
          id: `${env.id}-db-${idx}`,
          name: `Database Host (${role})`,
          type: 'Database Host',
          endpoint: host,
          status: 'active',
        });
      });
    }

    // 3. Application Directory
    if (env.infra?.appDirectory) {
      rows.push({
        id: `${env.id}-appdir`,
        name: 'Application Directory',
        type: 'Deployment Path',
        endpoint: env.infra.appDirectory,
        status: 'active',
      });
    }

    // 4. RTBS Connectivity
    if (env.statusInfo?.rtbsConnectivity) {
      rows.push({
        id: `${env.id}-rtbs`,
        name: 'RTBS Connection',
        type: 'External Connectivity',
        endpoint: `Connectivity: ${env.statusInfo.rtbsConnectivity}`,
        status: env.statusInfo.rtbsConnectivity === 'connected' ? 'connected' : 'disconnected',
      });
    }

    // 5. EOD Service
    if (env.statusInfo?.lastEODRun) {
      rows.push({
        id: `${env.id}-eod`,
        name: 'EOD Processing Engine',
        type: 'EOD Service',
        endpoint: `Last Run: ${env.statusInfo.lastEODRun}`,
        status: 'active',
      });
    }

    // 6. System Version Metadata
    if (env.statusInfo?.systemVersion) {
      rows.push({
        id: `${env.id}-version`,
        name: 'System Software Release',
        type: 'Version Metadata',
        endpoint: `Build: v${env.statusInfo.systemVersion} (Oracle: ${env.statusInfo.oracleVersion || '19c'})`,
        status: 'active',
      });
    }

    return rows;
  };

  // Search Filter Handler for Config Cards
  const filteredConfigs = configList.filter((config) => {
    const term = configSearchQuery.toLowerCase().trim();
    if (!term) return true;
    return (
      config.fileName.toLowerCase().includes(term) ||
      config.uploadedBy.toLowerCase().includes(term) ||
      config.storageLocation.toLowerCase().includes(term) ||
      config.featureType.toLowerCase().includes(term)
    );
  });

  // Env status utilities
  const getEnvStatusBadgeClass = (status) => {
    switch (status) {
      case 'active':
        return 'env-badge-status';
      case 'maintenance':
        return 'env-badge-version';
      default:
        return 'env-badge-version';
    }
  };

  if (error) {
    return (
      <ErrorState
        title="Environments could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !data) {
    return <Loader message="Loading environments…" />;
  }

  return (
    <div className="env-dashboard-page">
      {/* 1️⃣ Accordion: Environment Configuration */}
      <div className="env-accordion-section" data-expanded={isConfigExpanded}>
        {/* Standardized 3-Column Accordion Header */}
        <button
          type="button"
          className="env-accordion-header"
          onClick={toggleConfigAccordion}
        >
          <div className="env-accordion-header-left">
            <HardDrive size={14} />
            <span>Environment Configuration</span>
          </div>
          <div className="env-accordion-header-center"></div>
          <div className="env-accordion-header-right">
            <ChevronDown className="env-accordion-chevron" size={14} />
          </div>
        </button>

        <div className="env-accordion-content">
          {/* Config Filter / Actions Bar */}
          <div className="env-toolbar">
            <div className="env-toolbar-search">
              <Search className="env-search-icon" size={14} />
              <input
                type="text"
                placeholder="Search configurations..."
                className="env-search-input"
                value={configSearchQuery}
                onChange={(e) => setConfigSearchQuery(e.target.value)}
              />
            </div>
            <div className="env-toolbar-actions">
              <Button
                variant="primary"
                size="sm"
                leadingIcon={FileUp}
                onClick={() => setShowUploadModal(true)}
              >
                Add Config
              </Button>
              <Button
                variant="outline"
                size="sm"
                leadingIcon={Download}
                onClick={handleExportConfigs}
              >
                Export
              </Button>
            </div>
          </div>

          {/* Config Cards Grid */}
          <div className="env-config-cards-container">
            {filteredConfigs.length === 0 ? (
              <div className="env-empty-box">
                <FileText size={32} />
                <h4>No configurations found</h4>
                <p>Try refining your search text.</p>
              </div>
            ) : (
              <div className="env-config-grid">
                {filteredConfigs.map((config) => (
                  <div key={config.id} className="env-config-card">
                    <div className="env-config-card-header">
                      <div className="env-config-badges">
                        <span
                          className={`env-badge ${config.featureType === 'Infra'
                              ? 'env-badge-infra'
                              : 'env-badge-status'
                            }`}
                        >
                          {config.featureType === 'Infra' ? (
                            <HardDrive size={14} />
                          ) : (
                            <Activity size={14} />
                          )}
                          {config.featureType}
                        </span>
                        <span className="env-badge env-badge-version">v{config.version}</span>
                      </div>
                    </div>

                    <div className="env-config-card-body">
                      <div className="env-config-file-row">
                        <FileText size={14} className="env-config-file-icon" />
                        <span className="env-config-file-name" title={config.fileName}>
                          {config.fileName}
                        </span>
                        <span className="env-config-file-size">{config.size}</span>
                      </div>

                      <div className="env-config-metadata">
                        <div className="env-config-meta-item" title={`Uploader: ${config.uploadedBy}`}>
                          <Users size={14} />
                          <span>{config.uploadedBy}</span>
                        </div>
                        <div className="env-config-meta-item" title={`Upload Date: ${config.createdDate}`}>
                          <Calendar size={14} />
                          <span>{config.createdDate}</span>
                        </div>
                        <div
                          className="env-config-meta-item"
                          style={{ gridColumn: 'span 2' }}
                          title={`File Location: ${config.storageLocation}`}
                        >
                          <Cloud size={14} />
                          <span>{config.storageLocation}</span>
                        </div>
                      </div>
                    </div>

                    <div className="env-config-card-footer">
                      <button
                        className="env-action-btn-compact"
                        onClick={() => handleOpenEdit(config)}
                        title="Edit Configuration"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        className="env-action-btn-compact danger"
                        onClick={() => handleOpenDelete(config)}
                        title="Delete Configuration"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2️⃣ Accordion: Environment Details */}
      <div className="env-accordion-section" data-expanded={isDetailsExpanded}>
        {/* Standardized 3-Column Accordion Header with centered location path copy field */}
        <button
          type="button"
          className="env-accordion-header"
          onClick={toggleDetailsAccordion}
        >
          <div className="env-accordion-header-left">
            <Server size={14} />
            <span>Environment Details</span>
          </div>

          <div className="env-accordion-header-center">
            {/* Native text input & button stop click propagation cleanly without ESLint errors */}
            <div className="env-details-path-container">
              <span className="env-details-path-label">Murex NPR Clients Location:</span>
              <input
                type="text"
                readOnly
                value="/upload/csvfiles/oss/"
                className="env-details-path-value"
                onClick={(e) => e.stopPropagation()}
                style={{ width: '135px', background: 'transparent', border: 'none', outline: 'none', padding: 0 }}
              />
              <button
                type="button"
                className="env-details-path-copy-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  copyToClipboard('/upload/csvfiles/oss/');
                }}
                title="Copy path location"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>

          <div className="env-accordion-header-right">
            <ChevronDown className="env-accordion-chevron" size={14} />
          </div>
        </button>

        <div className="env-accordion-content">
          {/* Legend Table Header Row above list cards */}
          <div className="env-rows-header-legend">
            <div className="env-legend-cell">Environment</div>
            <div className="env-legend-cell">Status</div>
            <div className="env-legend-cell">Team</div>
            <div className="env-legend-cell">Servers</div>
            <div className="env-legend-cell">DB Hosts</div>
            <div className="env-legend-cell">RTBS Status</div>
            <div className="env-legend-cell" style={{ justifyContent: 'flex-end' }}></div>
          </div>

          <div className="env-details-workspace">
            {envList.map((env) => {
              const isExpanded = expandedEnvironment === env.id;
              const envQuery = getEnvSearchQuery(env.id);

              // Map & Filter Consolidated Items
              const allComponents = getEnvironmentComponents(env);
              const filteredComponents = allComponents.filter((item) => {
                if (!envQuery) return true;
                const query = envQuery.toLowerCase().trim();
                return (
                  item.name.toLowerCase().includes(query) ||
                  item.type.toLowerCase().includes(query) ||
                  item.endpoint.toLowerCase().includes(query) ||
                  item.status.toLowerCase().includes(query)
                );
              });

              // CSV Exporter for local table
              const handleExportEnvTable = () => {
                const cols = [
                  { key: 'name', label: 'Component/Service Name' },
                  { key: 'type', label: 'Type' },
                  { key: 'endpoint', label: 'Endpoint/Address/Path' },
                  { key: 'status', label: 'Status' },
                ];
                const fn = `${env.name.toLowerCase()}_components.csv`;
                exportToCSV(filteredComponents, cols, fn);
                toast.success(`Exported ${env.name} components to ${fn}`);
              };

              return (
                <div key={env.id} className="env-detail-card">
                  {/* Compact, Aligned Environment Header Row */}
                  <button
                    type="button"
                    className="env-row-header"
                    data-expanded={isExpanded}
                    onClick={() => toggleEnvironmentRow(env.id)}
                  >
                    <div className="env-row-cell env-row-cell-title">
                      <Settings size={14} className="text-secondary" />
                      <span>{env.name}</span>
                    </div>

                    <div className="env-row-cell">
                      <span className={`env-badge ${getEnvStatusBadgeClass(env.status)}`}>
                        {env.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="env-row-cell" title={`Team Owner: ${env.statusInfo.owner}`}>
                      <Users size={14} className="text-tertiary" />
                      <span>{env.statusInfo.owner}</span>
                    </div>

                    <div className="env-row-cell env-row-cell-stat">
                      <Server size={14} />
                      <span>{env.infra.servers.length} Servers</span>
                    </div>

                    <div className="env-row-cell env-row-cell-stat">
                      <Database size={14} />
                      <span>{env.infra.dbHosts.length} DB Hosts</span>
                    </div>

                    <div className="env-row-cell">
                      <Network size={14} className={env.statusInfo.rtbsConnectivity === 'connected' ? 'text-success' : 'text-danger'} />
                      <span className={env.statusInfo.rtbsConnectivity === 'connected' ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                        RTBS {env.statusInfo.rtbsConnectivity === 'connected' ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>

                    <div className="env-row-cell" style={{ paddingRight: 0, justifyContent: 'flex-end' }}>
                      <ChevronDown
                        className="env-toggle-icon"
                        size={14}
                        style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                      />
                    </div>
                  </button>

                  {/* Collapsible Card Body Workspace */}
                  <div className="env-detail-card-body-wrapper" data-expanded={isExpanded}>
                    <div className="env-row-body">
                      {/* Search & Export Toolbar */}
                      <div className="env-tab-toolbar">
                        <div className="env-tab-toolbar-search">
                          <Search className="env-search-icon" size={14} />
                          <input
                            type="text"
                            placeholder="Search environment components..."
                            className="env-search-input"
                            value={envQuery}
                            onChange={(e) => handleEnvSearchChange(env.id, e.target.value)}
                          />
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          leadingIcon={Download}
                          onClick={handleExportEnvTable}
                        >
                          Export
                        </Button>
                      </div>

                      {/* Unified Scrollable Table of Environment components */}
                      <div className="env-tab-table-container">
                        <AdminTable
                          keyField="id"
                          emptyText="No components match search query."
                          columns={[
                            {
                              key: 'name',
                              label: 'Component / Service Name',
                              width: '30%',
                              render: (item) => (
                                <span style={{ fontWeight: 600, fontSize: '12px' }}>
                                  {item.name}
                                </span>
                              ),
                            },
                            {
                              key: 'type',
                              label: 'Type',
                              width: '20%',
                              render: (item) => (
                                <span className="env-badge env-badge-version" style={{ fontSize: '10px' }}>
                                  {item.type}
                                </span>
                              ),
                            },
                            {
                              key: 'endpoint',
                              label: 'Endpoint / Address / Path',
                              width: '35%',
                              render: (item) => (
                                <div className="env-server-status-wrapper">
                                  <code>{item.endpoint}</code>
                                  {item.endpoint &&
                                    !item.endpoint.startsWith('Connectivity:') &&
                                    !item.endpoint.startsWith('Last Run:') &&
                                    !item.endpoint.startsWith('Build:') && (
                                      <button
                                        type="button"
                                        className="env-copy-table-btn"
                                        onClick={() => copyToClipboard(item.endpoint)}
                                        title="Copy address"
                                      >
                                        <Copy size={14} />
                                      </button>
                                    )}
                                </div>
                              ),
                            },
                            {
                              key: 'status',
                              label: 'Status',
                              width: '15%',
                              render: (item) => {
                                const getStatusDotType = (status) => {
                                  if (status === 'healthy' || status === 'active' || status === 'connected') {
                                    return 'healthy';
                                  }
                                  if (status === 'warning') return 'warning';
                                  return 'critical';
                                };
                                return (
                                  <div className="env-server-status-wrapper">
                                    <span
                                      className="env-server-status-dot"
                                      data-status={getStatusDotType(item.status)}
                                    />
                                    <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600 }}>
                                      {item.status}
                                    </span>
                                  </div>
                                );
                              },
                            },
                          ]}
                          data={filteredComponents}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── MODAL 1: Upload / Add Configuration ──────────────────────────────────── */}
      <AdminModal
        isOpen={showUploadModal}
        onClose={() => {
          setShowUploadModal(false);
          setUploadFile(null);
        }}
        title="Upload Configuration"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowUploadModal(false);
                setUploadFile(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" leadingIcon={FileUp} onClick={handleConfirmUpload}>
              Upload
            </Button>
          </>
        }
      >
        <div className="env-form-grid">
          <div className="env-form-field-wrapper">
            <span className="env-form-label env-form-label-required">Select CSV File</span>
            <button
              type="button"
              className="env-modal-upload-zone"
              onClick={() => document.getElementById('config-file-picker').click()}
            >
              <FileUp className="env-modal-upload-icon" size={32} />
              <p className="env-modal-upload-title">Click to browse your computer</p>
              <p className="env-modal-upload-hint">Supported file extension: .csv (max 5MB)</p>
              <input
                id="config-file-picker"
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </button>
            {uploadFile && (
              <div className="env-file-chip">
                <FileText size={14} className="text-secondary" />
                <span className="env-file-chip-name">{uploadFile.name}</span>
                <span className="text-tertiary" style={{ fontSize: '11px' }}>
                  ({(uploadFile.size / 1024).toFixed(1)} KB)
                </span>
                <button
                  type="button"
                  className="env-file-chip-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUploadFile(null);
                  }}
                  title="Remove selected file"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <div className="env-form-field-wrapper">
            <span className="env-form-label env-form-label-required">Feature Type Type</span>
            <Select
              value={uploadFeatureType}
              onChange={setUploadFeatureType}
              options={[
                { value: 'Infra', label: 'Infra' },
                { value: 'Status', label: 'Status' },
              ]}
              width="featureType"
            />
          </div>
        </div>
      </AdminModal>

      {/* ── MODAL 2: Edit Configuration ───────────────────────────────────── */}
      <AdminModal
        isOpen={!!editingConfig}
        onClose={() => setEditingConfig(null)}
        title="Edit Configuration"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditingConfig(null)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" leadingIcon={RefreshCw} onClick={handleUpdateConfig}>
              Update
            </Button>
          </>
        }
      >
        {editingConfig && (
          <div className="env-form-grid">
            <div className="env-form-field-wrapper">
              <label className="env-form-label env-form-label-required" htmlFor="edit-featureType">
                Configuration Type
              </label>
              <Select
                value={editForm.featureType}
                onChange={(val) => setEditForm((prev) => ({ ...prev, featureType: val }))}
                options={[
                  { value: 'Infra', label: 'Infra' },
                  { value: 'Status', label: 'Status' },
                ]}
                width="featureType"
              />
            </div>

            <div className="env-form-field-wrapper">
              <label className="env-form-label env-form-label-required" htmlFor="edit-fileName">
                File Name
              </label>
              <input
                id="edit-fileName"
                type="text"
                className={`env-form-input ${editErrors.fileName ? 'has-error' : ''}`}
                value={editForm.fileName}
                onChange={(e) => setEditForm((prev) => ({ ...prev, fileName: e.target.value }))}
              />
              {editErrors.fileName && <span className="env-form-error-msg">{editErrors.fileName}</span>}
            </div>

            <div className="env-form-field-wrapper">
              <label className="env-form-label env-form-label-required" htmlFor="edit-storageLocation">
                File Location
              </label>
              <input
                id="edit-storageLocation"
                type="text"
                className={`env-form-input ${editErrors.storageLocation ? 'has-error' : ''}`}
                value={editForm.storageLocation}
                onChange={(e) => setEditForm((prev) => ({ ...prev, storageLocation: e.target.value }))}
              />
              {editErrors.storageLocation && (
                <span className="env-form-error-msg">{editErrors.storageLocation}</span>
              )}
            </div>
          </div>
        )}
      </AdminModal>

      {/* ── MODAL 3: Delete Configuration Confirmation ───────────────────── */}
      <AdminModal
        isOpen={!!deletingConfig}
        onClose={() => setDeletingConfig(null)}
        title="Delete Configuration"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeletingConfig(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" leadingIcon={Trash2} onClick={handleDeleteConfig}>
              Delete
            </Button>
          </>
        }
      >
        {deletingConfig && (
          <div className="env-delete-confirm-box">
            <p className="env-delete-warning-text">
              Are you sure you want to delete this configuration file:
              <strong> {deletingConfig.fileName}</strong>?
            </p>
            <p className="env-delete-sub-text">This action cannot be undone.</p>
          </div>
        )}
      </AdminModal>
    </div>
  );
}

export default EnvironmentDashboardPage;
