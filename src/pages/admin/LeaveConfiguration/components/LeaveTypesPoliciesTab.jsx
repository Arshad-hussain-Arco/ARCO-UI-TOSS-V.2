import { useEffect, useState } from 'react';
import { Edit2, Plus, Search, Trash2 } from 'lucide-react';

import { Toggle } from '@components/ui/Toggle/Toggle';
import { TableSkeleton } from '@components/feedback/Skeleton';
import { useToast } from '@hooks/useToast';
import { leaveService } from '@services/leaveService';

import { combinedFormToPayload, combinedRowToForm, emptyCombinedForm, validateCombinedForm } from '../utils';
import { AddEditLeaveTypeModal } from './AddEditLeaveTypeModal';
import { GenderBadge, CategoryTag } from './LeaveTypeBadges';

export function LeaveTypesPoliciesTab({ onCountChange }) {
  const toast = useToast();

  const [combinedLeaveTypes, setCombinedLeaveTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isCombinedModalOpen, setIsCombinedModalOpen] = useState(false);
  const [editingCombinedCode, setEditingCombinedCode] = useState(null); // null = create
  const [combinedCodeError, setCombinedCodeError] = useState('');
  const [combinedForm, setCombinedForm] = useState(emptyCombinedForm());
  const [combinedFieldErrors, setCombinedFieldErrors] = useState({});

  const fetchCombinedLeaveTypes = async () => {
    setIsLoading(true);
    try {
      const res = await leaveService.getLeaveTypesWithPolicy();
      setCombinedLeaveTypes(res || []);
      onCountChange?.((res || []).length);
    } catch (err) {
      console.error('Failed to load leave types & policies', err);
      toast.error('Error loading leave types & policies');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCombinedLeaveTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddCombinedModal = () => {
    setEditingCombinedCode(null);
    setCombinedCodeError('');
    setCombinedFieldErrors({});
    setCombinedForm(emptyCombinedForm());
    setIsCombinedModalOpen(true);
  };

  const openEditCombinedModal = (row) => {
    setEditingCombinedCode(row.code);
    setCombinedCodeError('');
    setCombinedFieldErrors({});
    setCombinedForm(combinedRowToForm(row));
    setIsCombinedModalOpen(true);
  };

  const handleSaveCombined = async () => {
    const errors = validateCombinedForm(combinedForm);
    if (Object.keys(errors).length > 0) {
      setCombinedFieldErrors(errors);
      toast.error('Please fill in the required fields.');
      return;
    }
    setCombinedFieldErrors({});

    const payload = combinedFormToPayload(combinedForm);

    try {
      setCombinedCodeError('');
      if (editingCombinedCode) {
        delete payload.code; // immutable server-side; avoid sending a no-op change
        await leaveService.updateLeaveTypeWithPolicy(editingCombinedCode, payload);
        toast.success(`Updated ${combinedForm.name}`);
      } else {
        await leaveService.createLeaveTypeWithPolicy(payload);
        toast.success(`Added ${combinedForm.name}`);
      }
      setIsCombinedModalOpen(false);
      fetchCombinedLeaveTypes();
    } catch (err) {
      const codeErr = err.response?.data?.leave_type?.code;
      if (err.response?.status === 400 && codeErr) {
        setCombinedCodeError(Array.isArray(codeErr) ? codeErr[0] : String(codeErr));
      } else if (err.response?.status === 400 && err.response.data?.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error('Failed to save leave type & policy');
        console.error(err);
      }
    }
  };

  const handleDeleteCombined = async (row) => {
    if (window.confirm(`Deactivate "${row.name}" and its policy?`)) {
      try {
        await leaveService.deleteLeaveTypeWithPolicy(row.code);
        toast.success(`Deactivated ${row.name}`);
        fetchCombinedLeaveTypes();
      } catch (err) {
        toast.error('Failed to deactivate leave type');
        console.error(err);
      }
    }
  };

  const handleToggleCombinedActive = async (row, checked) => {
    try {
      await leaveService.updateLeaveTypeWithPolicy(row.code, { is_active: checked });
      toast.success(checked ? `Activated ${row.name}` : `Deactivated ${row.name}`);
      fetchCombinedLeaveTypes();
    } catch (err) {
      toast.error('Failed to update status');
      console.error(err);
    }
  };

  const toggleCarryForward = (checked) => {
    setCombinedForm((prev) => ({
      ...prev,
      is_carry_forward_allowed: checked,
      max_carry_forward: checked ? prev.max_carry_forward : 0,
      carry_forward_expiry_months: checked ? prev.carry_forward_expiry_months : '',
    }));
  };

  const toggleAllowNegative = (checked) => {
    setCombinedForm((prev) => ({
      ...prev,
      allow_negative: checked,
      max_negative_days: checked ? prev.max_negative_days : 0,
    }));
  };

  const filteredCombinedLeaveTypes = combinedLeaveTypes.filter((row) => {
    const q = (searchQuery || '').toLowerCase();
    return (
      (row.name || '').toLowerCase().includes(q) ||
      (row.code || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="lc-card-panel">
      <div className="lc-card-toolbar">
        <div className="lc-search-box">
          <Search className="search-icon" />
          <input
            type="text"
            placeholder="Search leave types or codes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button type="button" className="lc-btn-primary" onClick={openAddCombinedModal}>
          <Plus size={16} />
          Add Leave Type &amp; Policy
        </button>
      </div>

      <div className="lc-table-responsive">
        <table className="lc-data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Leave Type Name</th>
              <th>Entitled Days</th>
              <th>Gender</th>
              <th>Category</th>
              <th>Payment</th>
              <th>Active Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
                    <TableSkeleton rows={5} columns={8} showHeader={false} />
                  </div>
                </td>
              </tr>
            ) : filteredCombinedLeaveTypes.length === 0 ? (
              <tr>
                <td colSpan={8} className="lc-empty-state">
                  No leave types match your search criteria.
                </td>
              </tr>
            ) : (
              filteredCombinedLeaveTypes.map((row) => {
                const lt = row.leave_type || {};
                const p = row.policy;
                const isActive = lt.is_active ?? true;

                return (
                  <tr key={row.code}>
                    <td>
                      <span className="lc-code-badge">{row.code}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td style={{ fontWeight: 600 }}>
                      {p ? (
                        <span className="lc-num-cell">{Number(p.entitled_days).toFixed(1)} Days</span>
                      ) : (
                        <span className="lc-num-cell empty">—</span>
                      )}
                    </td>
                    <td>
                      <GenderBadge value={lt.gender_restriction} />
                    </td>
                    <td>
                      <CategoryTag value={lt.category} />
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#047857' }}>
                        {lt.payment_type === 'UNPAID' ? 'Unpaid' : 'Paid'}
                      </span>
                    </td>
                    <td>
                      <Toggle
                        checked={isActive}
                        onChange={(val) => handleToggleCombinedActive(row, val)}
                        ariaLabel={`Toggle active status for ${row.name}`}
                      />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="lc-ghost-btn"
                          title="Edit Leave Type & Policy"
                          onClick={() => openEditCombinedModal(row)}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          className="lc-ghost-btn danger"
                          title="Deactivate Leave Type & Policy"
                          onClick={() => handleDeleteCombined(row)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AddEditLeaveTypeModal
        isOpen={isCombinedModalOpen}
        onClose={() => setIsCombinedModalOpen(false)}
        isEditing={!!editingCombinedCode}
        form={combinedForm}
        setForm={setCombinedForm}
        onSave={handleSaveCombined}
        codeError={combinedCodeError}
        fieldErrors={combinedFieldErrors}
        setCodeError={setCombinedCodeError}
        setFieldErrors={setCombinedFieldErrors}
        toggleCarryForward={toggleCarryForward}
        toggleAllowNegative={toggleAllowNegative}
      />
    </div>
  );
}

export default LeaveTypesPoliciesTab;
