import React, { useCallback, useState, useEffect } from 'react';
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
  const [envDetailsData, setEnvDetailsData] = useState({});

  // Search input queries for each Environment (keyed by env.id)
  const [envSearchQueries, setEnvSearchQueries] = useState({});

  // Add Configuration Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ featureType: '', fileName: '', storageLocation: '' });
  const [addErrors, setAddErrors] = useState({});

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

  const toggleEnvironmentRow = async (envId) => {
    if (expandedEnvironment === envId) {
      setExpandedEnvironment(null);
    } else {
      setExpandedEnvironment(envId);
      if (!envDetailsData[envId]) {
        try {
          const details = await environmentService.getEnvDetails(envId);
          setEnvDetailsData((prev) => ({ ...prev, [envId]: details.files_data }));
        } catch (err) {
          toast.error('Failed to load raw configuration details.');
        }
      }
    }
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

  const handleUpdateConfig = async () => {
    const errors = {};
    if (!editForm.featureType?.trim()) {
      errors.featureType = 'Configuration Type is required';
    }
    if (!editForm.fileName?.trim()) {
      errors.fileName = 'File Name is required';
    }
    if (!editForm.storageLocation?.trim()) {
      errors.storageLocation = 'File Location is required';
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    try {
      await environmentService.updateConfig(editingConfig.id, {
        feature: editForm.featureType,
        file_name: editForm.fileName,
        file_location: editForm.storageLocation,
      });
      toast.success('Configuration updated successfully!');
      setEditingConfig(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update configuration.');
    }
  };

  const handleOpenDelete = (config) => {
    setDeletingConfig(config);
  };

  const handleDeleteConfig = async () => {
    try {
      await environmentService.deleteConfig(deletingConfig.id);
      toast.success('Configuration deleted successfully!');
      setDeletingConfig(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete configuration.');
    }
  };

  // Add Config Handler
  const handleCreateConfig = async () => {
    const errors = {};
    if (!addForm.featureType) errors.featureType = 'Required';
    if (!addForm.fileName) errors.fileName = 'Required';
    if (!addForm.storageLocation) errors.storageLocation = 'Required';
    if (Object.keys(errors).length > 0) {
      setAddErrors(errors);
      return;
    }

    try {
      await environmentService.createConfig({
        feature: addForm.featureType,
        file_name: addForm.fileName,
        file_location: addForm.storageLocation,
      });
      toast.success('Configuration added successfully!');
      setShowAddModal(false);
      setAddForm({ featureType: '', fileName: '', storageLocation: '' });
      setAddErrors({});
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add configuration.');
    }
  };

  // Consolidated Environment Components Mapper (merges servers, dbHosts, directory, services)

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
                onClick={() => {
                  setAddForm({ featureType: '', fileName: '', storageLocation: '' });
                  setAddErrors({});
                  setShowAddModal(true);
                }}
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
              const allComponents = env.components || [];
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

                    <div className="env-row-cell" title={`Team Owner: ${env.team}`}>
                      <Users size={14} className="text-tertiary" />
                      <span>{env.team}</span>
                    </div>

                    <div className="env-row-cell env-row-cell-stat">
                      <Server size={14} />
                      <span>{env.servers_count} Servers</span>
                    </div>

                    <div className="env-row-cell env-row-cell-stat">
                      <Database size={14} />
                      <span>{env.db_hosts_count} DB Hosts</span>
                    </div>

                    <div className="env-row-cell">
                      <Network size={14} className={env.rtbs_status && env.rtbs_status.toLowerCase().includes('not connected') ? 'text-danger' : 'text-success'} />
                      <span className={env.rtbs_status && env.rtbs_status.toLowerCase().includes('not connected') ? 'text-danger font-semibold' : 'text-success font-semibold'}>
                        {env.rtbs_status}
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

                        {/* Raw Config Files Section */}
                        {envDetailsData[env.id] && envDetailsData[env.id].length > 0 && (
                          <div className="env-raw-configs-section" style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#334155' }}>Raw Configuration Mapping (SFTP)</h4>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                              {envDetailsData[env.id].map((fileConfig) => (
                                <div key={fileConfig.config_id} style={{ background: '#fff', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', flex: '1 1 300px' }}>
                                  <div style={{ fontWeight: '600', fontSize: '12px', marginBottom: '8px', color: '#0f172a' }}>
                                    {fileConfig.file_name} <span style={{ color: '#64748b', fontWeight: 'normal' }}>({fileConfig.feature})</span>
                                  </div>
                                  <div style={{ fontSize: '11px', display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 12px' }}>
                                    {Object.entries(fileConfig.data || {}).map(([key, value]) => (
                                      <React.Fragment key={key}>
                                        <span style={{ color: '#64748b' }}>{key}:</span>
                                        <span style={{ color: '#334155', wordBreak: 'break-all' }}>{String(value)}</span>
                                      </React.Fragment>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── MODAL 1: Add Configuration ──────────────────────────────────── */}
      <AdminModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Configuration"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" leadingIcon={FileUp} onClick={handleCreateConfig}>
              Create
            </Button>
          </>
        }
      >
        <div className="env-form-grid">
          <div className="env-form-field-wrapper">
            <label className="env-form-label env-form-label-required" htmlFor="add-featureType">
              Configuration Type
            </label>
            <input
              id="add-featureType"
              type="text"
              className={`env-form-input ${addErrors.featureType ? 'has-error' : ''}`}
              value={addForm.featureType}
              onChange={(e) => setAddForm((prev) => ({ ...prev, featureType: e.target.value }))}
            />
            {addErrors.featureType && <span className="env-form-error-msg">{addErrors.featureType}</span>}
          </div>

          <div className="env-form-field-wrapper">
            <label className="env-form-label env-form-label-required" htmlFor="add-fileName">
              File Name
            </label>
            <input
              id="add-fileName"
              type="text"
              className={`env-form-input ${addErrors.fileName ? 'has-error' : ''}`}
              value={addForm.fileName}
              onChange={(e) => setAddForm((prev) => ({ ...prev, fileName: e.target.value }))}
            />
            {addErrors.fileName && <span className="env-form-error-msg">{addErrors.fileName}</span>}
          </div>

          <div className="env-form-field-wrapper">
            <label className="env-form-label env-form-label-required" htmlFor="add-storageLocation">
              File Location
            </label>
            <input
              id="add-storageLocation"
              type="text"
              className={`env-form-input ${addErrors.storageLocation ? 'has-error' : ''}`}
              value={addForm.storageLocation}
              onChange={(e) => setAddForm((prev) => ({ ...prev, storageLocation: e.target.value }))}
            />
            {addErrors.storageLocation && (
              <span className="env-form-error-msg">{addErrors.storageLocation}</span>
            )}
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
              <input
                id="edit-featureType"
                type="text"
                className={`env-form-input ${editErrors.featureType ? 'has-error' : ''}`}
                value={editForm.featureType}
                onChange={(e) => setEditForm((prev) => ({ ...prev, featureType: e.target.value }))}
              />
              {editErrors.featureType && <span className="env-form-error-msg">{editErrors.featureType}</span>}
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
