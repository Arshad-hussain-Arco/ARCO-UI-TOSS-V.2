import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { Button, Input } from '@components/common';

import { computeDayOfWeek, computeStatus, parseDateValue, toDateInputValue } from '../utils';
import { CreatableSelect } from './CreatableSelect';

export function AddEditHolidayModal({ isOpen, onClose, isEditing, form, setForm, onSave, existingTypes }) {
  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Holiday' : 'Add Holiday'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave}>
            Save Holiday
          </Button>
        </>
      }
    >
      <div className="lc-modal-grid">
        <div className="ss-modal-form-group">
          <Input
            id="holiday-name"
            label="Holiday Name"
            required
            value={form.name}
            placeholder="e.g. Founding Day"
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="ss-modal-form-group">
          <label className="ss-modal-label ss-modal-label-required" htmlFor="holiday-date">
            Date
          </label>
          <DatePicker
            value={parseDateValue(form.date)}
            onChange={(value) => {
              const dateStr = toDateInputValue(value);
              setForm((prev) => ({
                ...prev,
                date: dateStr,
                day: computeDayOfWeek(dateStr),
                status: computeStatus(dateStr)
              }));
            }}
            placeholder="Select holiday date"
            width="100%"
            showClear={false}
          />
        </div>

        <div className="ss-modal-form-group">
          <Input
            id="holiday-computed-day"
            label="Day of Week (Computed)"
            readOnly
            disabled
            value={form.date ? computeDayOfWeek(form.date) : 'Select a date'}
          />
        </div>

        <div className="ss-modal-form-group">
          <label className="ss-modal-label" htmlFor="holiday-computed-status">
            Status (Computed)
          </label>
          <div id="holiday-computed-status" className="lc-computed-status-field">
            {form.date ? (
              computeStatus(form.date) === 'Upcoming' ? (
                <span className="lc-tag-upcoming">Upcoming</span>
              ) : (
                <span className="lc-tag-past">Past</span>
              )
            ) : (
              <span className="lc-computed-status-placeholder">Select a date</span>
            )}
          </div>
        </div>

        <div className="ss-modal-form-group">
          <label className="ss-modal-label" htmlFor="holiday-type">
            Holiday Type
          </label>
          <CreatableSelect
            id="holiday-type"
            value={form.type}
            onChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
            placeholder="Select or type holiday type"
            options={Array.from(new Set(['Public Holiday', 'National Holiday', 'Company Holiday', ...existingTypes]))}
          />
        </div>

        <div className="ss-modal-form-group lc-modal-grid-span-2">
          <Input
            id="holiday-description"
            label="Description"
            placeholder="Add a concise holiday summary"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>
      </div>
    </AdminModal>
  );
}

export default AddEditHolidayModal;
