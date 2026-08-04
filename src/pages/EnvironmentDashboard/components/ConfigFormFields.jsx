/** Shared 3-field form used by both the Add and Edit Configuration modals. */
export function ConfigFormFields({ idPrefix, form, setForm, errors }) {
  const patch = (delta) => setForm((prev) => ({ ...prev, ...delta }));

  return (
    <div className="env-form-grid">
      <div className="env-form-field-wrapper">
        <label className="env-form-label env-form-label-required" htmlFor={`${idPrefix}-featureType`}>
          Configuration Type
        </label>
        <input
          id={`${idPrefix}-featureType`}
          type="text"
          className={`env-form-input ${errors.featureType ? 'has-error' : ''}`}
          value={form.featureType}
          onChange={(e) => patch({ featureType: e.target.value })}
        />
        {errors.featureType && <span className="env-form-error-msg">{errors.featureType}</span>}
      </div>

      <div className="env-form-field-wrapper">
        <label className="env-form-label env-form-label-required" htmlFor={`${idPrefix}-fileName`}>
          File Name
        </label>
        <input
          id={`${idPrefix}-fileName`}
          type="text"
          className={`env-form-input ${errors.fileName ? 'has-error' : ''}`}
          value={form.fileName}
          onChange={(e) => patch({ fileName: e.target.value })}
        />
        {errors.fileName && <span className="env-form-error-msg">{errors.fileName}</span>}
      </div>

      <div className="env-form-field-wrapper">
        <label className="env-form-label env-form-label-required" htmlFor={`${idPrefix}-storageLocation`}>
          File Location
        </label>
        <input
          id={`${idPrefix}-storageLocation`}
          type="text"
          className={`env-form-input ${errors.storageLocation ? 'has-error' : ''}`}
          value={form.storageLocation}
          onChange={(e) => patch({ storageLocation: e.target.value })}
        />
        {errors.storageLocation && <span className="env-form-error-msg">{errors.storageLocation}</span>}
      </div>
    </div>
  );
}

export default ConfigFormFields;
