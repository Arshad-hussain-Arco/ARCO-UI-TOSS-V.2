import { Activity, ChevronDown, Cloud, Calendar, Edit, FileText, FileUp, HardDrive, Trash2, Users, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { Button } from '@components/ui/Button/Button';

import { ExportDropdown } from './ExportDropdown';

const EXPORT_COLUMNS = [
  { key: 'featureType', label: 'Type' },
  { key: 'version', label: 'Version' },
  { key: 'fileName', label: 'File Name' },
  { key: 'size', label: 'File Size' },
  { key: 'uploadedBy', label: 'Uploaded By' },
  { key: 'createdDate', label: 'Upload Date' },
  { key: 'storageLocation', label: 'File Location' },
];

/** Accordion 1: Environment Configuration — config list, search, add/export, and per-config cards. */
export function EnvironmentConfigSection({
  isExpanded,
  onToggle,
  filteredConfigs,
  searchQuery,
  onSearchChange,
  onAdd,
  onEdit,
  onDelete,
  toast,
}) {
  const handleExportPdf = () => {
    if (filteredConfigs.length === 0) {
      toast.error('No configurations to export.');
      return;
    }
    const doc = new jsPDF('landscape');
    doc.text('Environment Configurations', 14, 15);
    const cols = EXPORT_COLUMNS.map((c) => c.label);
    const data = filteredConfigs.map((c) => EXPORT_COLUMNS.map((col) => c[col.key]));
    doc.autoTable({ head: [cols], body: data, startY: 20, styles: { fontSize: 8 } });
    doc.save('environment_configurations.pdf');
    toast.success('Configurations exported to PDF.');
  };

  const handleExportExcel = () => {
    if (filteredConfigs.length === 0) {
      toast.error('No configurations to export.');
      return;
    }
    const data = filteredConfigs.map((c) => ({
      Type: c.featureType, Version: c.version, 'File Name': c.fileName,
      'File Size': c.size, 'Uploaded By': c.uploadedBy, 'Upload Date': c.createdDate, 'File Location': c.storageLocation,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Configs');
    XLSX.writeFile(wb, 'environment_configurations.xlsx');
    toast.success('Configurations exported to Excel.');
  };

  return (
    <div className="env-accordion-section" data-expanded={isExpanded}>
      <button type="button" className="env-accordion-header" onClick={onToggle}>
        <div className="env-accordion-header-left">
          <HardDrive size={14} />
          <span>Environment Configuration</span>
        </div>
        <div className="env-accordion-header-center" />
        <div className="env-accordion-header-right">
          <ChevronDown className="env-accordion-chevron" size={14} />
        </div>
      </button>

      <div className="env-accordion-content">
        <div className="env-toolbar">
          <div className="env-toolbar-search">
            <Search className="env-search-icon" size={14} />
            <input
              type="text"
              placeholder="Search configurations..."
              className="env-search-input"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="env-toolbar-actions">
            <Button variant="primary" size="sm" leadingIcon={FileUp} onClick={onAdd}>
              Add Config
            </Button>
            <ExportDropdown onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} />
          </div>
        </div>

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
                      <span className={`env-badge ${config.featureType === 'Infra' ? 'env-badge-infra' : 'env-badge-status'}`}>
                        {config.featureType === 'Infra' ? <HardDrive size={14} /> : <Activity size={14} />}
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
                      <div className="env-config-meta-item" style={{ gridColumn: 'span 2' }} title={`File Location: ${config.storageLocation}`}>
                        <Cloud size={14} />
                        <span>{config.storageLocation}</span>
                      </div>
                    </div>
                  </div>

                  <div className="env-config-card-footer">
                    <button className="env-action-btn-compact" onClick={() => onEdit(config)} title="Edit Configuration">
                      <Edit size={14} />
                    </button>
                    <button className="env-action-btn-compact danger" onClick={() => onDelete(config)} title="Delete Configuration">
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
  );
}

export default EnvironmentConfigSection;
