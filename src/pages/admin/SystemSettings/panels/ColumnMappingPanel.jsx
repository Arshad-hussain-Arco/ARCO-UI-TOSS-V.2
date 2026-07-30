import { memo, useMemo, useState } from 'react';
import { ArrowUpDown, Edit2 } from 'lucide-react';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useToast } from '@hooks/useToast';

const SAMPLE_CR_DATA = [
  { id: '1', code: 'Additional_Developers', excel: 'Additional Developers' },
  { id: '2', code: 'Assigned_Developer', excel: 'Assigned Programmer' },
  { id: '3', code: 'Effort_in_MDs', excel: 'Proposed Effort in MDs' },
  { id: '4', code: 'End_Date', excel: 'End Date' },
  { id: '5', code: 'Id', excel: 'Id' },
  { id: '6', code: 'Priority', excel: 'Priority' },
  { id: '7', code: 'Project', excel: 'Project' },
  { id: '8', code: 'Start_Date', excel: 'Start Date' },
  { id: '9', code: 'Status', excel: 'Status Information' },
];

const SAMPLE_WO_DATA = [
  { id: '1', code: 'Attachments', excel: 'Attachment' },
  { id: '2', code: 'Backup_IT_Delivery_Lead', excel: 'Backup IT Delivery Lead' },
  { id: '3', code: 'Clarity_Planned_Finish_Date', excel: 'Clarity Planned Finish Date' },
  { id: '4', code: 'Created_By', excel: 'Created By' },
  { id: '5', code: 'Creation_Date', excel: 'Creation Date' },
  { id: '6', code: 'Depends_On', excel: 'Depends On' },
  { id: '7', code: 'Description', excel: 'Description' },
  { id: '8', code: 'Due_Date', excel: 'Due Date' },
  { id: '9', code: 'Estimation', excel: 'Estimation' },
];

/**
 * TAB 3 & TAB 4: CR and WO File Matching Columns Table
 */
function ColumnMappingPanelComponent({ type = 'CR', title }) {
  const toast = useToast();
  const initialData = type === 'CR' ? SAMPLE_CR_DATA : SAMPLE_WO_DATA;
  const [data, setData] = useState(initialData);

  // Sorting state
  const [sortField, setSortField] = useState('code');
  const [sortAsc, setSortAsc] = useState(true);

  // Editing state
  const [editRow, setEditRow] = useState(null);
  const [editCode, setEditCode] = useState('');
  const [editExcel, setEditExcel] = useState('');

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
    setEditCode(row.code);
    setEditExcel(row.excel);
  };

  const handleSaveEdit = () => {
    if (editRow) {
      setData((prev) =>
        prev.map((item) =>
          item.id === editRow.id ? { ...item, code: editCode, excel: editExcel } : item,
        ),
      );
      toast.success(`Updated column mapping for ${editCode}`);
      setEditRow(null);
    }
  };

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
                onClick={() => handleSort('code')}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span>Code Column</span>
                  <ArrowUpDown size={14} style={{ opacity: sortField === 'code' ? 1 : 0.4 }} />
                </div>
              </th>
              <th
                style={{ padding: '12px 20px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', width: '45%' }}
                onClick={() => handleSort('excel')}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span>Excel Column</span>
                  <ArrowUpDown size={14} style={{ opacity: sortField === 'excel' ? 1 : 0.4 }} />
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
                  {row.code}
                </td>
                <td style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {row.excel}
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
            >
              Cancel
            </button>
            <button type="button" className="ss-btn-update" onClick={handleSaveEdit}>
              Save Changes
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
