import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ApprovalRow } from '../ApprovalRow';
import { ApprovalRejectModal } from '../ApprovalRejectModal';
import httpClient from '@api/httpClient';

vi.mock('@api/httpClient', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('@hooks/useAuth', () => ({
  useAuth: () => ({
    user: { emp_id: 999, name: 'Manager User' },
  }),
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
};

vi.mock('@hooks/useToast', () => ({
  useToast: () => mockToast,
}));

describe('ApprovalRow Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('SDM-required row includes sdm_emp_id in the approve payload', async () => {
    httpClient.post.mockResolvedValueOnce({ data: { success: true } });

    const sdmRow = {
      id: 101,
      row_type: 'OW_EXCESS_NEW',
      emp_name: 'John Doe',
      requires_sdm_emp_id: true,
      approve_endpoint: '/api/leaves/excess/101/approve/',
      reject_endpoint: '/api/leaves/excess/101/reject/',
    };

    render(
      <table>
        <tbody>
          <ApprovalRow row={sdmRow} onResolved={vi.fn()} />
        </tbody>
      </table>
    );

    const approveBtn = screen.getByText('Approve');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(httpClient.post).toHaveBeenCalledWith(
        '/api/leaves/excess/101/approve/',
        { sdm_emp_id: 999 }
      );
    });
  });

  test('LEAVE row sends "reason" on reject, non-LEAVE row sends "comment"', async () => {
    httpClient.post.mockResolvedValue({ data: { success: true } });

    // 1. LEAVE Row
    const leaveRow = {
      id: 201,
      row_type: 'LEAVE',
      emp_name: 'Alice Smith',
      reject_reason_required: true,
      reject_endpoint: '/api/leaves/201/reject/',
    };

    const handleConfirmLeave = vi.fn();
    render(
      <ApprovalRejectModal
        row={leaveRow}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirmLeave}
        isSubmitting={false}
      />
    );

    const textarea = screen.getByPlaceholderText(/Enter rejection reason/i);
    fireEvent.change(textarea, { target: { value: 'Too many leaves requested' } });

    const confirmBtn = screen.getByText('Confirm Rejection');
    fireEvent.click(confirmBtn);

    expect(handleConfirmLeave).toHaveBeenCalledWith({
      reason: 'Too many leaves requested',
    });

    // 2. MODIFICATION Row (Non-LEAVE)
    const modRow = {
      id: 301,
      row_type: 'MODIFICATION',
      emp_name: 'Bob Jones',
      reject_reason_required: false,
      reject_endpoint: '/api/leaves/mod/301/reject/',
    };

    const handleConfirmMod = vi.fn();
    render(
      <ApprovalRejectModal
        row={modRow}
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={handleConfirmMod}
        isSubmitting={false}
      />
    );

    const modTextarea = screen.getByPlaceholderText(/Enter rejection comment/i);
    fireEvent.change(modTextarea, { target: { value: 'Invalid date shift' } });
    
    const confirmModBtn = screen.getAllByText('Confirm Rejection')[1];
    fireEvent.click(confirmModBtn);

    expect(handleConfirmMod).toHaveBeenCalledWith({
      comment: 'Invalid date shift',
    });
  });

  test('Failed approve reverts optimistic removal and shows server error text', async () => {
    const serverErrorMsg = 'SLA policy window expired. Cannot approve.';
    httpClient.post.mockRejectedValueOnce({
      response: { data: { error: serverErrorMsg } },
    });

    const failedRow = {
      id: 401,
      row_type: 'LEAVE',
      emp_name: 'Charlie Brown',
      requires_sdm_emp_id: false,
      approve_endpoint: '/api/leaves/401/approve/',
      reject_endpoint: '/api/leaves/401/reject/',
    };

    const onResolved = vi.fn();

    render(
      <table>
        <tbody>
          <ApprovalRow row={failedRow} onResolved={onResolved} />
        </tbody>
      </table>
    );

    const approveBtn = screen.getByText('Approve');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      // Reverted optimistic removal: row content is still in DOM
      expect(screen.getByText('Charlie Brown')).toBeInTheDocument();
      // Toast displayed exact server error message
      expect(mockToast.error).toHaveBeenCalledWith('Approval Failed', {
        description: serverErrorMsg,
      });
      // onResolved callback was NOT called
      expect(onResolved).not.toHaveBeenCalled();
    });
  });
});
