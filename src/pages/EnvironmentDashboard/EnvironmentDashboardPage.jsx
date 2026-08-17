import React, { useCallback, useState, useEffect } from 'react';
import {
  Server,
  Database,
  RefreshCw,
  Trash,
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
  Settings,
  FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { Select } from '@components/forms/Select/Select';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { AdminTable } from '@components/ui/AdminTable/AdminTable';
import { Button } from '@components/ui/Button/Button';
import { ExportButton } from '@components/ui/ExportButton';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { useDebounce } from '@hooks/useDebounce';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useToast } from '@hooks/useToast';
import { environmentService } from '@services/environmentService';

import './EnvironmentDashboardPage.css';

/** Environment inventory: configuration files and the per-environment feature matrix. */
export function EnvironmentDashboardPage() {
  useDocumentTitle('Environment Dashboard');
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('ENVIRONMENT_DASHBOARD_CREATE');
  const canEdit = hasPermission('ENVIRONMENT_DASHBOARD_EDIT');
  const canDelete = hasPermission('ENVIRONMENT_DASHBOARD_DELETE');
  const canExport = hasPermission('ENVIRONMENT_DASHBOARD_EXPORT');

  const fetchEnvironments = useCallback(() => environmentService.getEnvironments(), []);
  const { data, isLoading, error, refetch } = useAsync(fetchEnvironments);

  // Accordion Expand/Collapse States (Environment Configuration & Details)
  const [isConfigExpanded, setIsConfigExpanded] = useState(true);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);

  // In-Memory Data Synchronization (Configs & Environments)
  const [configList, setConfigList] = useState([]);
  const [envList, setEnvList] = useState([]);
  const [expandedConfigs, setExpandedConfigs] = useState({});

  const toggleConfigRowAccordion = (configId) => {
    setExpandedConfigs(prev => {
      const isCurrentlyExpanded = prev[configId] !== false;
      return {
        ...prev,
        [configId]: !isCurrentlyExpanded
      };
    });
  };

  useEffect(() => {
    if (data) {
      setConfigList(data.configFiles || []);
      setEnvList(data.environments || []);
    }
  }, [data]);

  // Global Config Search State
  const [configSearchQuery, setConfigSearchQuery] = useState('');
  const debouncedConfigSearchQuery = useDebounce(configSearchQuery, 500);

  // Environment Sub-Accordion Expand State (Only one environment expanded at a time)
  const [expandedEnvironment, setExpandedEnvironment] = useState(null);
  const [envDetailsData, setEnvDetailsData] = useState({});

  // Search input queries for each Environment (keyed by env.id)
  const [envSearchQueries, setEnvSearchQueries] = useState({});
  // Search input queries for each Config row (keyed by config.id)
  const [configRowSearchQueries, setConfigRowSearchQueries] = useState({});
  const debouncedConfigRowSearchQueries = useDebounce(configRowSearchQueries, 500);

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
    const term = debouncedConfigSearchQuery.toLowerCase().trim();
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

  const handleGlobalExportPDF = () => {
    if (filteredConfigs.length > 0) {
      const doc = new jsPDF('landscape');
      doc.text('Environment Configurations', 14, 15);
      const cols = ['Type', 'Version', 'File Name', 'File Size', 'Uploaded By', 'Upload Date', 'File Location'];
      const data = filteredConfigs.map(c => [
        c.featureType, c.version, c.fileName, c.size, c.uploadedBy, c.createdDate, c.storageLocation
      ]);
      autoTable(doc, { head: [cols], body: data, startY: 20, styles: { fontSize: 8 } });
      doc.save('environment_configurations.pdf');
      toast.success('Configurations exported to PDF.');
    } else {
      toast.error('No configurations to export.');
    }
  };

  const handleGlobalExportExcel = () => {
    if (filteredConfigs.length > 0) {
      const data = filteredConfigs.map(c => ({
        'Type': c.featureType, 'Version': c.version, 'File Name': c.fileName,
        'File Size': c.size, 'Uploaded By': c.uploadedBy, 'Upload Date': c.createdDate, 'File Location': c.storageLocation
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Configs");
      XLSX.writeFile(wb, 'environment_configurations.xlsx');
      toast.success('Configurations exported to Excel.');
    } else {
      toast.error('No configurations to export.');
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
              {canCreate && (
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
              )}
              {canExport && (
                <ExportButton
                  excel
                  pdf
                  onExcelExport={handleGlobalExportExcel}
                  onPdfExport={handleGlobalExportPDF}
                />
              )}
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
                      {canEdit && (
                        <button
                          className="action-icon-btn edit"
                          onClick={() => handleOpenEdit(config)}
                          title="Edit Configuration"
                        >
                          <Edit size={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          className="action-icon-btn delete"
                          onClick={() => handleOpenDelete(config)}
                          title="Delete Configuration"
                        >
                          <Trash size={14} />
                        </button>
                      )}
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
          {/* No legend required, just raw environments as accordions */}

          <div className="env-details-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '8px', }}>
            {configList.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                No configurations found.
              </div>
            ) : (
              configList.map((config) => {
                const fileData = config.fileData;
                if (!fileData || !fileData.records || !fileData.columnNames) return null;

                const dynamicCols = fileData.columnNames.map((col) => ({
                  key: col,
                  label: col,
                  render: (item) => (
                    <span style={{ fontSize: '13px' }}>
                      {item[col] !== null && item[col] !== undefined ? String(item[col]) : '-'}
                    </span>
                  ),
                }));

                const searchQuery = (debouncedConfigRowSearchQueries[config.id] || '').toLowerCase();
                const filteredRecords = searchQuery
                  ? fileData.records.filter(r =>
                    Object.values(r).some(val =>
                      val !== null && val !== undefined && String(val).toLowerCase().includes(searchQuery)
                    )
                  )
                  : fileData.records;

                return (
                  <div key={config.id} className="config-card" style={{ flexShrink: 0, background: 'var(--surface-primary)', border: '1px solid var(--border-secondary)', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    {/* Header: Icon, Name, Search, Export */}
                    <div
                      className="env-tab-toolbar"
                      style={{
                        borderBottom: expandedConfigs[config.id] !== false ? '1px solid var(--border-secondary)' : 'none',
                        padding: '20px 20px',
                        background: 'var(--bg-secondary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer'
                      }}
                      onClick={() => toggleConfigRowAccordion(config.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)', fontWeight: '600', fontSize: '15px' }}>
                        <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Database size={16} />
                        </div>
                        <span>{config.featureType || config.fileName}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
                            <input
                              type="text"
                              placeholder="Search records..."
                              value={configRowSearchQueries[config.id] || ''}
                              onChange={(e) => setConfigRowSearchQueries(prev => ({ ...prev, [config.id]: e.target.value }))}
                              style={{
                                padding: '6px 12px 6px 32px',
                                border: '1px solid var(--border-secondary)',
                                borderRadius: '6px',
                                fontSize: '13px',
                                width: '180px',
                                outline: 'none'
                              }}
                            />
                          </div>
                          {canExport && (
                            <ExportButton
                              excel
                              pdf
                              onExcelExport={() => {
                                if (filteredRecords.length > 0) {
                                  const data = filteredRecords.map(r => {
                                    const row = {};
                                    dynamicCols.forEach(c => row[c.label] = r[c.key] !== null && r[c.key] !== undefined ? String(r[c.key]) : '-');
                                    return row;
                                  });
                                  const ws = XLSX.utils.json_to_sheet(data);
                                  const wb = XLSX.utils.book_new();
                                  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
                                  XLSX.writeFile(wb, `${config.featureType || config.fileName || 'export'}.xlsx`);
                                  toast.success(`Exported ${filteredRecords.length} records to Excel.`);
                                } else {
                                  toast.error('No records to export.');
                                }
                              }}
                              onPdfExport={() => {
                                if (filteredRecords.length > 0) {
                                  const doc = new jsPDF('landscape');
                                  doc.text(`Export - ${config.featureType || config.fileName}`, 14, 15);
                                  const headers = dynamicCols.map(c => c.label);
                                  const data = filteredRecords.map(r => dynamicCols.map(c => r[c.key] !== null && r[c.key] !== undefined ? String(r[c.key]) : '-'));
                                  autoTable(doc, { head: [headers], body: data, startY: 20, styles: { fontSize: 8 } });
                                  doc.save(`${config.featureType || config.fileName || 'export'}.pdf`);
                                  toast.success(`Exported ${filteredRecords.length} records to PDF.`);
                                } else {
                                  toast.error('No records to export.');
                                }
                              }}
                            />
                          )}
                        </div>
                        <div
                          style={{ display: 'flex', alignItems: 'center', paddingLeft: '20px', marginLeft: '20px', borderLeft: '1px solid var(--border-secondary)', height: '32px', cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleConfigRowAccordion(config.id);
                          }}
                        >
                          <ChevronDown
                            size={18}
                            style={{
                              color: 'var(--text-secondary)',
                              transform: expandedConfigs[config.id] !== false ? 'rotate(180deg)' : 'none',
                              transition: 'transform 0.2s ease',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Table */}
                    {expandedConfigs[config.id] !== false && (
                      <div className="env-tab-table-container">
                        <AdminTable
                          keyField="id"
                          emptyText="No records available."
                          columns={dynamicCols}
                          data={filteredRecords.map((r, i) => ({ ...r, id: `row-${i}` }))}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
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
            <Button variant="danger" size="sm" leadingIcon={Trash} onClick={handleDeleteConfig}>
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
