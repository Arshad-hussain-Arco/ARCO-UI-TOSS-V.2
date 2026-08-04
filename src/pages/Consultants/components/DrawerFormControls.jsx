// Small local building blocks shared across the Consultant drawer's form sections.

export const EfSection = ({ label }) => (
  <div className="ef-section">
    <h4 className="ef-section-title">{label}</h4>
    <div className="ef-section-divider" />
  </div>
);

export const EfField = ({ label, required, children, className = '' }) => (
  <div className={`ef-field ${className}`}>
    <label className="ef-label">
      {label} {required && <span className="ef-required">*</span>}
    </label>
    {children}
  </div>
);

export const EfSwitchRow = ({ checked, onChange, label }) => (
  <div className={`ef-switch-row ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
    <span className="ef-switch-text">{label}</span>
    <div className="ef-switch-track">
      <div className="ef-switch-thumb" />
    </div>
  </div>
);
