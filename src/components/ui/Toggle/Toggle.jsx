import './Toggle.css';

/**
 * Reusable, accessible toggle switch component.
 *
 * @param {Object} props
 * @param {boolean} props.checked - Current state.
 * @param {(checked: boolean) => void} props.onChange - State change handler.
 * @param {string} [props.ariaLabel] - Accessibility label.
 * @param {boolean} [props.disabled] - Disabled state.
 */
export function Toggle({ checked, onChange, ariaLabel, disabled = false }) {
  return (
    <label className="ui-toggle-wrapper" data-disabled={disabled}>
      <input
        type="checkbox"
        className="ui-toggle-input"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={ariaLabel}
      />
      <span className="ui-toggle-track">
        <span className="ui-toggle-thumb" />
      </span>
    </label>
  );
}

export default Toggle;
