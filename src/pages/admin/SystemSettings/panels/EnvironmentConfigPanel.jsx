import { memo, useState } from 'react';
import { Clock, Eye, EyeOff, Folder, HardDrive, Hash, Lock, User } from 'lucide-react';

import { ENVIRONMENT_FIELDS } from '@mocks/data/systemSettings';

/** Field `iconKey` → leading icon component. */
const FIELD_ICONS = {
  folder: Folder,
  clock: Clock,
  drive: HardDrive,
  hash: Hash,
  user: User,
  lock: Lock,
};

/**
 * Environment properties form.
 *
 * The eight rows were near-identical markup in the original; they are now driven
 * by ENVIRONMENT_FIELDS, so adding a setting is a one-line data change.
 *
 * @param {Object} props
 * @param {Record<string, string>} props.values
 * @param {(name: string, value: string) => void} props.onChange
 */
function EnvironmentConfigPanelComponent({ values, onChange }) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  return (
    <div className="ss-form-card">
      {ENVIRONMENT_FIELDS.map((field) => {
        const Icon = FIELD_ICONS[field.iconKey];
        const isPassword = field.type === 'password';
        const inputId = `ss-${field.name}`;

        return (
          <div key={field.name} className="ss-form-row">
            <div className="ss-form-label-col">
              <label className="ss-form-label" htmlFor={inputId}>
                {field.label}
              </label>
              <span className="ss-form-helper">{field.helper}</span>
            </div>

            <div className="ss-form-input-col">
              <div className="ss-input-wrapper">
                {Icon ? <Icon className="input-icon input-icon-left" aria-hidden="true" /> : null}

                <input
                  id={inputId}
                  name={field.name}
                  type={isPassword && isPasswordVisible ? 'text' : field.type}
                  className={`ss-input with-left-icon${isPassword ? ' with-right-icon' : ''}`}
                  value={values[field.name] ?? ''}
                  onChange={(event) => onChange(field.name, event.target.value)}
                  autoComplete={isPassword ? 'new-password' : 'off'}
                />

                {isPassword ? (
                  <button
                    type="button"
                    className="input-icon input-icon-right"
                    onClick={() => setIsPasswordVisible((visible) => !visible)}
                    aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                    aria-pressed={isPasswordVisible}
                  >
                    {isPasswordVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const EnvironmentConfigPanel = memo(EnvironmentConfigPanelComponent);
export default EnvironmentConfigPanel;
