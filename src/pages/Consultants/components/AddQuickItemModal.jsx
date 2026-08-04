import { AdminModal } from '@components/ui/AdminModal/AdminModal';

/** Reusable "add a single named item" modal — used for Add Designation / Add Computer Location. */
export function AddQuickItemModal({ isOpen, onClose, title, description, fieldLabel, value, onChange, onSubmit }) {
  return (
    <AdminModal isOpen={isOpen} onClose={onClose} title={title}>
      <div style={{ padding: '16px' }}>
        <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>{description}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{fieldLabel}</span>
          <input
            type="text"
            className="ef-input"
            style={{ flex: 1 }}
            placeholder={`Enter ${fieldLabel}`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: '6px 24px', backgroundColor: '#ef4444', color: '#fff', borderRadius: '4px', border: 'none', fontWeight: '500', cursor: 'pointer' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            style={{ padding: '6px 32px', backgroundColor: '#10b981', color: '#fff', borderRadius: '4px', border: 'none', fontWeight: '500', cursor: 'pointer' }}
          >
            Add
          </button>
        </div>
      </div>
    </AdminModal>
  );
}

export default AddQuickItemModal;
