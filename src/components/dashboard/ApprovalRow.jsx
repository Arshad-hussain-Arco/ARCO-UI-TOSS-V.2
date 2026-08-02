import React, { useState } from 'react';
import { Pill, Avatar } from '../ui';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import httpClient from '@api/httpClient';
import ApprovalRejectModal from './ApprovalRejectModal';
import './ApprovalRow.css';

export function ApprovalRow({ row, onResolved }) {
  const { user } = useAuth();
  const toast = useToast();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOptimisticallyRemoved, setIsOptimisticallyRemoved] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [modalError, setModalError] = useState('');

  if (isOptimisticallyRemoved) {
    return null;
  }

  const resolveSdmEmpId = () => {
    return user?.emp_id || user?.empId || user?.id || null;
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    setIsOptimisticallyRemoved(true); // Optimistic removal

    const payload = {};
    if (row.requires_sdm_emp_id) {
      payload.sdm_emp_id = resolveSdmEmpId();
    }

    try {
      await httpClient.post(row.approve_endpoint, payload);
      if (toast?.success) {
        toast.success(`Request #${row.id} approved successfully`);
      }
      if (onResolved) {
        onResolved(row.id, 'approve');
      }
    } catch (err) {
      // Revert optimistic removal on failure
      setIsOptimisticallyRemoved(false);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Approval failed';

      if (toast?.error) {
        toast.error('Approval Failed', { description: errorMsg });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectConfirm = async (payload) => {
    setIsSubmitting(true);
    setModalError('');

    try {
      await httpClient.post(row.reject_endpoint, payload);
      setIsRejectModalOpen(false);
      setIsOptimisticallyRemoved(true);

      if (toast?.success) {
        toast.success(`Request #${row.id} rejected`);
      }
      if (onResolved) {
        onResolved(row.id, 'reject');
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Rejection failed';

      setModalError(errorMsg);
      if (toast?.error) {
        toast.error('Rejection Failed', { description: errorMsg });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRowTypeVariant = (rowType) => {
    switch (rowType) {
      case 'LEAVE':
        return 'blue';
      case 'MODIFICATION':
        return 'purple';
      case 'OW_EXCESS_NEW':
        return 'amber';
      case 'OW_EXCESS_MOD':
        return 'red';
      default:
        return 'neutral';
    }
  };

  return (
    <>
      <tr className="approval-row">
        <td>
          <Pill variant={getRowTypeVariant(row.row_type)}>
            {row.row_type}
          </Pill>
        </td>
        <td><strong>#{row.id}</strong></td>
        <td>
          <div className="approval-employee-cell">
            <Avatar name={row.emp_name} size={28} />
            <span>{row.emp_name}</span>
          </div>
        </td>
        <td>{row.department_name || '-'}</td>
        <td><code>{row.leave_type || row.row_type}</code></td>
        <td>{row.start_date} to {row.end_date}</td>
        <td>{row.business_days}d</td>
        <td>{row.age_days}d</td>
        <td>
          {row.sla_breached ? (
            <Pill variant="red">🚨 SLA BREACH</Pill>
          ) : (
            <Pill variant="green">IN SLA</Pill>
          )}
        </td>
        <td>
          <div className="approval-actions-cell">
            <button
              type="button"
              className="lms-btn lms-btn-sm lms-btn-success"
              onClick={handleApprove}
              disabled={isSubmitting}
            >
              Approve
            </button>
            <button
              type="button"
              className="lms-btn lms-btn-sm lms-btn-danger"
              onClick={() => setIsRejectModalOpen(true)}
              disabled={isSubmitting}
            >
              Reject
            </button>
          </div>
        </td>
      </tr>

      <ApprovalRejectModal
        row={row}
        isOpen={isRejectModalOpen}
        onClose={() => {
          setIsRejectModalOpen(false);
          setModalError('');
        }}
        onConfirm={handleRejectConfirm}
        isSubmitting={isSubmitting}
        errorMsg={modalError}
      />
    </>
  );
}

export default ApprovalRow;
