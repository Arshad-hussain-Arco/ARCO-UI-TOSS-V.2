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
  Settings,
  FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
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
  const [expandedConfigs, setExpandedConfigs] = useState({});

  const toggleConfigRowAccordion = (configId) => {
    setExpandedConfigs(prev => ({
      ...prev,
      [configId]: !prev[configId],
    }));
  };

  // Expand ALL accordions by default when configList first loads
  useEffect(() => {
    if (configList.length > 0) {
      const allExpanded = {};
      configList.forEach((c) => { allExpanded[c.id] = true; });
      setExpandedConfigs(allExpanded);
    }
  }, [configList.length]); // only re-run when count changes (initial load)

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
  // Search input queries for each Config row (keyed by config.id)
  const [configRowSearchQueries, setConfigRowSearchQueries] = useState({});
  const [exportDropdownOpen, setExportDropdownOpen] = useState(null);
  const [globalExportDropdownOpen, setGlobalExportDropdownOpen] = useState(false);

  // Add Configuration Modal States
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ featureType: '', fileName: '', storageLocation: '' });
  const [addErrors, setAddErrors] = useState({});
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
  Settings,
  FileSpreadsheet
} from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
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
  const [expandedConfigs, setExpandedConfigs] = useState({});

  const toggleConfigRowAccordion = (configId) => {
    setExpandedConfigs(prev => ({
      ...prev,
      [configId]: !prev[configId],
    }));
  };

  // Expand ALL accordions by default when configList first loads
  useEffect(() => {
    if (configList.length > 0) {
      const allExpanded = {};
      configList.forEach((c) => { allExpanded[c.id] = true; });
      setExpandedConfigs(allExpanded);
    }
  }, [configList.length]); // only re-run when count changes (initial load)

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
  // Search input queries for each Config row (keyed by config.id)
  const [configRowSearchQueries, setConfigRowSearchQueries] = useState({});
  const [exportDropdownOpen, setExportDropdownOpen] = useState(null);
  const [globalExportDropdownOpen, setGlobalExportDropdownOpen] = useState(false);

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

  const [isSaving, setIsSaving] = useState(false);

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

    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenDelete = (config) => {
    setDeletingConfig(config);
  };

  const handleDeleteConfig = async () => {
    setIsSaving(true);
    try {
      await environmentService.deleteConfig(deletingConfig.id);
      toast.success('Configuration deleted successfully!');
      setDeletingConfig(null);
      refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete configuration.');
    } finally {
      setIsSaving(false);
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

    setIsSaving(true);
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
    } finally {
      setIsSaving(false);
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
               style={{ paddingRight: '32px' }} />
      {configSearchQuery && (
        <button type="button" className="search-clear-btn" onClick={() => setConfigSearchQuery('')}>
          <X size={14} />
        </button>
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
