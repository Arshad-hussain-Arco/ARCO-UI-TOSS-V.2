import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Toggle } from '@components/ui/Toggle/Toggle';
import { Button, Input, NumberInput, Textarea, Dropdown } from '@components/common';

import { parseDateValue, toDateInputValue } from '../utils';

export function AddEditLeaveTypeModal({
  isOpen, onClose, isEditing, form, setForm, onSave,
  codeError, fieldErrors, setCodeError, setFieldErrors,
  toggleCarryForward, toggleAllowNegative,
}) {
  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit ${form.name || 'Leave Type'}` : 'Add Leave Type & Policy'}
      subtitle="Creates the leave type and its entitlement policy in a single save."
      size="lg"
      variant="panel"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave}>
            Save Leave Type
          </Button>
        </>
      }
    >
      <div className="lc-combined-form">
        {/* Section: Basic Info */}
        <div className="lc-form-section">
          <div className="lc-form-section-title">Basic Info</div>
          <div className="lc-modal-grid">
            <div className="ss-modal-form-group">
              {isEditing ? (
                <>
                  <label className="ss-modal-label ss-modal-label-required" htmlFor="lt-code">
                    Code
                  </label>
                  <div className="lc-locked-field" title="Cannot be changed once created">
                    {form.code}
                  </div>
                </>
              ) : (
                <Input
                  id="lt-code"
                  label="Code"
                  required
                  style={{ textTransform: 'uppercase' }}
                  value={form.code}
                  placeholder="e.g. PAT"
                  errorText={codeError || fieldErrors.code}
                  onChange={(e) => {
                    setCodeError('');
                    setFieldErrors((prev) => ({ ...prev, code: undefined }));
                    setForm((prev) => ({ ...prev, code: e.target.value }));
                  }}
                />
              )}
            </div>

            <div className="ss-modal-form-group">
              <Input
                id="lt-name"
                label="Name"
                required
                value={form.name}
                placeholder="e.g. Paternity Leave"
                errorText={fieldErrors.name}
                onChange={(e) => {
                  setFieldErrors((prev) => ({ ...prev, name: undefined }));
                  setForm((prev) => ({ ...prev, name: e.target.value }));
                }}
              />
            </div>

            <div className="ss-modal-form-group lc-modal-grid-span-2">
              <Input
                id="lt-desc"
                label="Description"
                placeholder="Shown to employees when applying"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-category">Category</label>
              <Dropdown
                value={form.category}
                width="100%"
                onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                options={[
                  { value: 'ACTUAL', label: 'Actual — deducts balance' },
                  { value: 'CLAIM', label: 'Claim — earns balance' },
                  { value: 'NOMINAL', label: 'Nominal — no balance impact' },
                ]}
              />
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-payment">Payment Type</label>
              <Dropdown
                value={form.payment_type}
                width="100%"
                onChange={(value) => setForm((prev) => ({ ...prev, payment_type: value }))}
                options={[
                  { value: 'PAID', label: 'Paid' },
                  { value: 'UNPAID', label: 'Unpaid' },
                ]}
              />
            </div>

            <div className="ss-modal-form-group">
              <NumberInput
                id="lt-maxdays"
                label="Max Quota Days"
                placeholder="Blank = no cap"
                value={form.max_quota_days}
                onChange={(e) => setForm((prev) => ({ ...prev, max_quota_days: e.target.value }))}
              />
            </div>

            <div className="ss-modal-form-group">
              <NumberInput
                id="lt-order"
                label="Display Order"
                value={form.display_order}
                onChange={(e) => setForm((prev) => ({ ...prev, display_order: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Section: Entitlement */}
        <div className="lc-form-section">
          <div className="lc-form-section-title">
            Entitlement <span className="lc-form-section-hint">Creates the policy row</span>
          </div>
          <div className="lc-modal-grid">
            <div className="ss-modal-form-group">
              <NumberInput
                id="lt-entitled"
                label="Entitled Days"
                required
                placeholder="e.g. 10"
                value={form.entitled_days}
                errorText={fieldErrors.entitled_days}
                onChange={(e) => {
                  setFieldErrors((prev) => ({ ...prev, entitled_days: undefined }));
                  setForm((prev) => ({ ...prev, entitled_days: e.target.value }));
                }}
              />
            </div>

            <div className="ss-modal-form-group">
              <NumberInput
                id="lt-maxperapp"
                label="Max Days / Application"
                placeholder="Blank = no limit"
                value={form.max_days_per_application}
                onChange={(e) => setForm((prev) => ({ ...prev, max_days_per_application: e.target.value }))}
              />
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-accrual">Accrual Type</label>
              <Dropdown
                value={form.accrual_type}
                width="100%"
                onChange={(value) => setForm((prev) => ({ ...prev, accrual_type: value }))}
                options={[
                  { value: 'NONE', label: 'Grant all at start of year' },
                  { value: 'MONTHLY', label: 'Accrue monthly' },
                ]}
              />
            </div>

            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-proration">Proration Type</label>
              <Dropdown
                value={form.proration_type}
                width="100%"
                onChange={(value) => setForm((prev) => ({ ...prev, proration_type: value }))}
                options={[
                  { value: 'NONE', label: 'No proration' },
                  { value: 'MONTHLY', label: 'By full months worked' },
                  { value: 'DAILY', label: 'By calendar days worked' },
                ]}
              />
            </div>

            <div className="ss-modal-form-group">
              <NumberInput
                id="lt-notice"
                label="Min Notice (days)"
                value={form.min_notice_days}
                onChange={(e) => setForm((prev) => ({ ...prev, min_notice_days: e.target.value }))}
              />
            </div>

            <div className="ss-modal-form-group">
              <NumberInput
                id="lt-consecutive"
                label="Max Consecutive (days)"
                placeholder="Blank = no limit"
                value={form.max_consecutive}
                onChange={(e) => setForm((prev) => ({ ...prev, max_consecutive: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Section: Carry-Forward & Advance */}
        <div className="lc-form-section">
          <div className="lc-form-section-title">Carry-Forward &amp; Advance</div>

          <label className="lc-checkrow">
            <input
              type="checkbox"
              aria-label="Allow carry-forward"
              checked={form.is_carry_forward_allowed}
              onChange={(e) => toggleCarryForward(e.target.checked)}
            />
            <span>
              <span className="lc-checkrow-title">Allow carry-forward</span>
              <span className="lc-checkrow-sub">Unused days roll into the next year</span>
            </span>
          </label>
          <div className={`lc-conditional-grid ${form.is_carry_forward_allowed ? '' : 'disabled'}`}>
            <div className="ss-modal-form-group">
              <NumberInput
                id="lt-carryforward"
                label="Max Carry Forward (days)"
                value={form.max_carry_forward}
                disabled={!form.is_carry_forward_allowed}
                onChange={(e) => setForm((prev) => ({ ...prev, max_carry_forward: e.target.value }))}
              />
            </div>
            <div className="ss-modal-form-group">
              <NumberInput
                id="lt-carryforward-expiry"
                label="Expires After (months)"
                placeholder="Blank = never"
                value={form.carry_forward_expiry_months}
                disabled={!form.is_carry_forward_allowed}
                onChange={(e) => setForm((prev) => ({ ...prev, carry_forward_expiry_months: e.target.value }))}
              />
            </div>
          </div>

          <label className="lc-checkrow" style={{ marginTop: '14px' }}>
            <input
              type="checkbox"
              aria-label="Allow advance leave"
              checked={form.allow_negative}
              onChange={(e) => toggleAllowNegative(e.target.checked)}
            />
            <span>
              <span className="lc-checkrow-title">Allow advance leave</span>
              <span className="lc-checkrow-sub">Employees can borrow from next year&apos;s balance</span>
            </span>
          </label>
          <div className={`lc-conditional-grid ${form.allow_negative ? '' : 'disabled'}`}>
            <div className="ss-modal-form-group lc-modal-grid-span-2">
              <NumberInput
                id="lt-negative-days"
                label="Max Negative Days"
                value={form.max_negative_days}
                disabled={!form.allow_negative}
                onChange={(e) => setForm((prev) => ({ ...prev, max_negative_days: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Section: Restrictions & Status */}
        <div className="lc-form-section">
          <div className="lc-form-section-title">Restrictions &amp; Status</div>

          <div className="ss-modal-form-group" style={{ marginBottom: '16px' }}>
            <div className="ss-modal-label" role="heading" aria-level="4">Gender Restriction</div>
            <div className="lc-gender-radio-row">
              <label className={`lc-gender-radio-card ${form.gender_restriction === '' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="gender_restriction"
                  checked={form.gender_restriction === ''}
                  onChange={() => setForm((prev) => ({ ...prev, gender_restriction: '' }))}
                />
                <span className="rtitle">All employees</span>
                <span className="rsub">No restriction</span>
              </label>
              <label className={`lc-gender-radio-card male ${form.gender_restriction === 'M' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="gender_restriction"
                  checked={form.gender_restriction === 'M'}
                  onChange={() => setForm((prev) => ({ ...prev, gender_restriction: 'M' }))}
                />
                <span className="rtitle">&#9794; Male only</span>
                <span className="rsub">e.g. Paternity</span>
              </label>
              <label className={`lc-gender-radio-card female ${form.gender_restriction === 'F' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="gender_restriction"
                  checked={form.gender_restriction === 'F'}
                  onChange={() => setForm((prev) => ({ ...prev, gender_restriction: 'F' }))}
                />
                <span className="rtitle">&#9792; Female only</span>
                <span className="rsub">e.g. Maternity</span>
              </label>
            </div>
          </div>

          <div className="lc-modal-grid" style={{ marginBottom: '6px' }}>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-eff-from">Effective From</label>
              <DatePicker
                id="lt-eff-from"
                value={parseDateValue(form.effective_from)}
                onChange={(value) => setForm((prev) => ({ ...prev, effective_from: toDateInputValue(value) }))}
                placeholder="Select date"
                width="100%"
                showClear={false}
              />
            </div>
            <div className="ss-modal-form-group">
              <label className="ss-modal-label" htmlFor="lt-eff-to">Effective To</label>
              <DatePicker
                id="lt-eff-to"
                value={parseDateValue(form.effective_to)}
                onChange={(value) => setForm((prev) => ({ ...prev, effective_to: toDateInputValue(value) }))}
                placeholder="Blank = ongoing"
                width="100%"
                showClear={true}
              />
            </div>
          </div>

          <div className="lc-toggle-field">
            <div>
              <div className="lc-toggle-field-label">Requires approval</div>
              <div className="lc-toggle-field-hint">If off, leave is auto-approved on submission</div>
            </div>
            <Toggle
              checked={form.requires_approval}
              onChange={(v) => setForm((prev) => ({ ...prev, requires_approval: v }))}
              ariaLabel="Requires approval"
            />
          </div>
          <div className="lc-toggle-field">
            <div>
              <div className="lc-toggle-field-label">Active</div>
              <div className="lc-toggle-field-hint">Inactive leave types can&apos;t be applied for</div>
            </div>
            <Toggle
              checked={form.is_active}
              onChange={(v) => setForm((prev) => ({ ...prev, is_active: v }))}
              ariaLabel="Active status"
            />
          </div>

          <div className="lc-modal-grid" style={{ marginTop: '14px' }}>
            <div className="ss-modal-form-group lc-modal-grid-span-2">
              <Textarea
                id="lt-notes"
                label={<>Notes <span className="lc-form-optional-hint">— internal, on the leave type</span></>}
                rows={2}
                placeholder="Internal HR reference note"
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="ss-modal-form-group lc-modal-grid-span-2">
              <Textarea
                id="lt-policy-notes"
                label={<>Policy Notes <span className="lc-form-optional-hint">— internal, on the policy</span></>}
                rows={2}
                placeholder="Optional — note specific to this entitlement rule"
                value={form.policy_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, policy_notes: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>
    </AdminModal>
  );
}

export default AddEditLeaveTypeModal;
