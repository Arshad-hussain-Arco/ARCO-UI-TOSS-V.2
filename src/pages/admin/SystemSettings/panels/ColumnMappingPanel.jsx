import { memo, useMemo, useState, useEffect } from 'react';
import { ArrowUpDown, Edit2, Loader2 } from 'lucide-react';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useToast } from '@hooks/useToast';
import { settingsService } from '@services/settingsService';

/**
 * TAB 3 & TAB 4: CR and WO File Matching Columns Table
 */
function ColumnMappingPanelComponent({ type = 'CR', title }) {
  const toast = useToast();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sorting state
  const [sortField, setSortField] = useState('code_col');
  const [sortAsc, setSortAsc] = useState(true);

  // Editing state
  const [editRow, setEditRow] = useState(null);
  const [editCode, setEditCode] = useState('');
  const [editExcel, setEditExcel] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [type]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = type === 'CR' 
        ? await settingsService.getCrColumns()
        : await settingsService.getWoColumns();
      setData(res || []);
    } catch (error) {
      console.error(`Failed to fetch ${type} columns:`, error);
      toast.error(`Failed to load ${type} column mappings`);
    } finally {
      setLoading(false);
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      const valA = (a[sortField] || '').toLowerCase();
      const valB = (b[sortField] || '').toLowerCase();
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [data, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleOpenEdit = (row) => {
    setEditRow(row);
    setEditCode(row.code_col || '');
    setEditExcel(row.excel_col || '');
  };

  const handleSaveEdit = async () => {
    if (!editRow) return;
    
    try {
      setSaving(true);
      const payload = {
        code_col: editCode,
        excel_col: editExcel,
      };

      if (type === 'CR') {
        await settingsService.updateCrColumn(editRow.id, payload);
      } else {
        await settingsService.updateWoColumn(editRow.id, payload);
      }
      
      setData((prev) =>
        prev.map((item) =>
          item.id === editRow.id ? { ...item, code_col: editCode, excel_col: editExcel } : item,
        ),
      );
      toast.success(`Updated column mapping for ${editCode}`);
      setEditRow(null);
    } catch (error) {
      console.error(`Failed to update ${type} column mapping:`, error);
      toast.error(`Failed to update column mapping`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="ss-form-card" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
        <Loader2 className="spinner" size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div className="ss-form-card">
      <div className="ss-panel-header">
        <h2 className="ss-panel-title">{title}</h2>
      </div>

      <div style={{ padding: '0', overflowX: 'auto' }}>
        <table className="ui-admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
              <th
                style={{ padding: '12px 20px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', width: '45%' }}
                onClick={() => handleSort('code_col')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Code Column</span>
                  <ArrowUpDown size={14} style={{ opacity: sortField === 'code_col' ? 1 : 0.4 }} />
                </div>
              </th>
              <th
                style={{ padding: '12px 20px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', width: '45%' }}
                onClick={() => handleSort('excel_col')}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Excel Column</span>
                  <ArrowUpDown size={14} style={{ opacity: sortField === 'excel_col' ? 1 : 0.4 }} />
                </div>
              </th>
              <th style={{ padding: '12px 20px', textAlign: 'right', width: '10%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <tr
                key={row.id}
                style={{
                  background: idx % 2 === 0 ? 'var(--surface-primary)' : 'var(--bg-secondary)',
                  borderBottom: '1px solid var(--border-primary)',
                  transition: 'background 0.15s ease',
                }}
              >
                <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                  {row.code_col}
                </td>
                <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {row.excel_col}
                </td>
                <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="ui-file-action"
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--c-primary)',
                      padding: '4px',
                      borderRadius: '4px',
                    }}
                    onClick={() => handleOpenEdit(row)}
                    title="Edit Column Mapping"
                  >
                    <Edit2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <AdminModal
        isOpen={Boolean(editRow)}
        onClose={() => setEditRow(null)}
        title={`Edit ${type} Column Mapping`}
        footer={
          <>
            <button
              type="button"
              className="ss-btn-update"
              style={{ background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}
              onClick={() => setEditRow(null)}
              disabled={saving}
            >
              Cancel
            </button>
            <button type="button" className="ss-btn-update" onClick={handleSaveEdit} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {saving ? <><Loader2 size={16} className="spin-animation" /> Saving...</> : 'Save Changes'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="col-edit-code">
              Code Column
            </label>
            <input
              id="col-edit-code"
              className="ss-input"
              value={editCode}
              onChange={(e) => setEditCode(e.target.value)}
            />
          </div>
          <div className="ss-modal-form-group">
            <label className="ss-modal-label" htmlFor="col-edit-excel">
              Excel Column
            </label>
            <input
              id="col-edit-excel"
              className="ss-input"
              value={editExcel}
              onChange={(e) => setEditExcel(e.target.value)}
            />
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

export const ColumnMappingPanel = memo(ColumnMappingPanelComponent);
export default ColumnMappingPanel;
