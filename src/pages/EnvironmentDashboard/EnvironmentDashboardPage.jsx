import { useCallback, useState, useEffect } from 'react';
import { FileUp, RefreshCw, Trash2 } from 'lucide-react';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { CardGridSkeleton, TableSkeleton } from '@components/feedback/Skeleton';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Button } from '@components/ui/Button/Button';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useToast } from '@hooks/useToast';
import { environmentService } from '@services/environmentService';

import { EnvironmentConfigSection } from './components/EnvironmentConfigSection';
import { EnvironmentDetailsSection } from './components/EnvironmentDetailsSection';
import { ConfigFormFields } from './components/ConfigFormFields';

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
  const [expandedConfigs, setExpandedConfigs] = useState({});

  const toggleConfigRowAccordion = (configId) => {
    setExpandedConfigs((prev) => ({ ...prev, [configId]: !prev[configId] }));
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
    }
  }, [data]);

  // Global Config Search State
  const [configSearchQuery, setConfigSearchQuery] = useState('');

  // Search input queries for each Config row (keyed by config.id)
  const [configRowSearchQueries, setConfigRowSearchQueries] = useState({});

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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied: "${text}"`);
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
    if (!editForm.featureType?.trim()) errors.featureType = 'Configuration Type is required';
    if (!editForm.fileName?.trim()) errors.fileName = 'File Name is required';
    if (!editForm.storageLocation?.trim()) errors.storageLocation = 'File Location is required';

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

  if (error) {
    return <ErrorState title="Environments could not be loaded" description={error.message} onRetry={refetch} />;
  }

  if (isLoading || !data) {
    return (
      <div className="env-dashboard-page">
        <CardGridSkeleton count={3} minWidth={280} />
        <TableSkeleton rows={6} columns={5} />
      </div>
    );
  }

  return (
    <div className="env-dashboard-page">
      <EnvironmentConfigSection
        isExpanded={isConfigExpanded}
        onToggle={() => setIsConfigExpanded((p) => !p)}
        filteredConfigs={filteredConfigs}
        searchQuery={configSearchQuery}
        onSearchChange={setConfigSearchQuery}
        onAdd={() => {
          setAddForm({ featureType: '', fileName: '', storageLocation: '' });
          setAddErrors({});
          setShowAddModal(true);
        }}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
        toast={toast}
      />

      <EnvironmentDetailsSection
        isExpanded={isDetailsExpanded}
        onToggle={() => setIsDetailsExpanded((p) => !p)}
        configList={configList}
        expandedConfigs={expandedConfigs}
        onToggleConfigRow={toggleConfigRowAccordion}
        configRowSearchQueries={configRowSearchQueries}
        onConfigRowSearchChange={(configId, query) =>
          setConfigRowSearchQueries((prev) => ({ ...prev, [configId]: query }))
        }
        copyToClipboard={copyToClipboard}
        toast={toast}
      />

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
        <ConfigFormFields idPrefix="add" form={addForm} setForm={setAddForm} errors={addErrors} />
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
          <ConfigFormFields idPrefix="edit" form={editForm} setForm={setEditForm} errors={editErrors} />
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
