import { ChevronDown, Copy, Database, Search, Server } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

import { AdminTable } from '@components/ui/AdminTable/AdminTable';

import { ExportDropdown } from './ExportDropdown';

/** Accordion 2: Environment Details — raw per-config record tables, each independently searchable/exportable. */
export function EnvironmentDetailsSection({
  isExpanded,
  onToggle,
  configList,
  expandedConfigs,
  onToggleConfigRow,
  configRowSearchQueries,
  onConfigRowSearchChange,
  copyToClipboard,
  toast,
}) {
  return (
    <div className="env-accordion-section" data-expanded={isExpanded}>
      <button type="button" className="env-accordion-header" onClick={onToggle}>
        <div className="env-accordion-header-left">
          <Server size={14} />
          <span>Environment Details</span>
        </div>

        <div className="env-accordion-header-center">
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
        <div className="env-details-workspace" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {configList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
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

              const searchQuery = (configRowSearchQueries[config.id] || '').toLowerCase();
              const filteredRecords = searchQuery
                ? fileData.records.filter((r) =>
                  Object.values(r).some(
                    (val) => val !== null && val !== undefined && String(val).toLowerCase().includes(searchQuery),
                  ),
                )
                : fileData.records;

              const handleExportPdf = () => {
                if (filteredRecords.length === 0) {
                  toast.error('No records to export.');
                  return;
                }
                const doc = new jsPDF('landscape');
                doc.text(`Export - ${config.featureType || config.fileName}`, 14, 15);
                const headers = dynamicCols.map((c) => c.label);
                const data = filteredRecords.map((r) => dynamicCols.map((c) => (r[c.key] !== null && r[c.key] !== undefined ? String(r[c.key]) : '-')));
                doc.autoTable({ head: [headers], body: data, startY: 20, styles: { fontSize: 8 } });
                doc.save(`${config.featureType || config.fileName || 'export'}.pdf`);
                toast.success(`Exported ${filteredRecords.length} records to PDF.`);
              };

              const handleExportExcel = () => {
                if (filteredRecords.length === 0) {
                  toast.error('No records to export.');
                  return;
                }
                const data = filteredRecords.map((r) => {
                  const row = {};
                  dynamicCols.forEach((c) => (row[c.label] = r[c.key] !== null && r[c.key] !== undefined ? String(r[c.key]) : '-'));
                  return row;
                });
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
                XLSX.writeFile(wb, `${config.featureType || config.fileName || 'export'}.xlsx`);
                toast.success(`Exported ${filteredRecords.length} records to Excel.`);
              };

              return (
                <div key={config.id} className="config-card" style={{ flexShrink: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div
                    className="env-tab-toolbar"
                    style={{
                      borderBottom: expandedConfigs[config.id] ? '1px solid #e2e8f0' : 'none',
                      padding: '20px 20px',
                      background: '#f8fafc',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                    onClick={() => onToggleConfigRow(config.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#0f172a', fontWeight: '600', fontSize: '15px' }}>
                      <div style={{ background: '#e0e7ff', color: '#4f46e5', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Database size={16} />
                      </div>
                      <span>{config.featureType || config.fileName}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <Search size={14} style={{ position: 'absolute', left: '10px', color: '#64748b' }} />
                          <input
                            type="text"
                            placeholder="Search records..."
                            value={configRowSearchQueries[config.id] || ''}
                            onChange={(e) => onConfigRowSearchChange(config.id, e.target.value)}
                            style={{
                              padding: '6px 12px 6px 32px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '6px',
                              fontSize: '13px',
                              width: '180px',
                              outline: 'none',
                            }}
                          />
                        </div>
                        <ExportDropdown onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} />
                      </div>
                      <div
                        style={{ display: 'flex', alignItems: 'center', paddingLeft: '20px', marginLeft: '20px', borderLeft: '1px solid #e2e8f0', height: '32px', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleConfigRow(config.id);
                        }}
                      >
                        <ChevronDown
                          size={18}
                          style={{
                            color: '#64748b',
                            transform: expandedConfigs[config.id] ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {expandedConfigs[config.id] && (
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
  );
}

export default EnvironmentDetailsSection;
