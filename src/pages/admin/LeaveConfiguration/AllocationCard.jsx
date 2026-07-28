import { memo } from 'react';
import { Briefcase, Calendar, Check, Clock, Edit2, X } from 'lucide-react';

import { LEAVE_ALLOCATION_MAX_DAYS } from '@mocks/data/leaveConfiguration';
import { getInitials } from '@utils/format';

/** The three editable allocation fields, in display order. */
const EDITABLE_METRICS = [
  { field: 'carryOver', label: 'Carry Over', icon: Briefcase },
  { field: 'compOff', label: 'Comp Off', icon: Clock },
  { field: 'weekendWork', label: 'Weekend', icon: Calendar },
];

/** Progress bar segments. */
const PROGRESS_SEGMENTS = [
  { field: 'carryOver', className: 'carry-over' },
  { field: 'compOff', className: 'comp-off' },
  { field: 'weekendWork', className: 'weekend' },
];

/**
 * One consultant's leave allocation, switchable between read and edit mode.
 *
 * @param {Object} props
 * @param {{ id: string, name: string, role: string, metrics: Object }} props.consultant
 * @param {boolean} props.isEditing
 * @param {boolean} props.isSaving
 * @param {Object|null} props.draft            Draft values while editing.
 * @param {() => void} props.onStartEditing
 * @param {() => void} props.onCancel
 * @param {() => void} props.onSave
 * @param {(field: string, value: string) => void} props.onChangeField
 */
function AllocationCardComponent({
  consultant,
  isEditing,
  isSaving,
  draft,
  onStartEditing,
  onCancel,
  onSave,
  onChangeField,
}) {
  const metrics = isEditing && draft ? draft : consultant.metrics;

  return (
    <div className="lc-visual-card" data-editing={isEditing}>
      <div className="card-top">
        <div className="consultant-info-mini">
          <div className="lc-avatar-small" aria-hidden="true">
            {getInitials(consultant.name).toUpperCase()}
          </div>
          <div className="lc-name-group">
            <span className="lc-name">{consultant.name}</span>
            <span className="lc-role">{consultant.role}</span>
          </div>
        </div>

        <div className="lc-card-actions">
          {isEditing ? (
            <div className="lc-edit-actions">
              <button
                type="button"
                className="lc-save-mini"
                onClick={onSave}
                disabled={isSaving}
                aria-label={`Save allocation for ${consultant.name}`}
              >
                <Check size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="lc-cancel-mini"
                onClick={onCancel}
                aria-label="Cancel editing"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="lc-edit-trigger"
              onClick={onStartEditing}
              aria-label={`Edit allocation for ${consultant.name}`}
            >
              <Edit2 size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="lc-card-metrics">
        <div className="metric-row">
          {EDITABLE_METRICS.slice(0, 2).map(({ field, label, icon: Icon }, index) => (
            <div key={field} className="metric-box">
              <span className="metric-label">
                <Icon size={10} aria-hidden="true" /> {label}
              </span>
              {isEditing ? (
                <input
                  type="number"
                  min="0"
                  className="lc-mini-input"
                  value={metrics[field]}
                  autoFocus={index === 0}
                  onChange={(event) => onChangeField(field, event.target.value)}
                  aria-label={`${label} days for ${consultant.name}`}
                />
              ) : (
                <span className="metric-value">{metrics[field]}d</span>
              )}
            </div>
          ))}
        </div>

        <div className="metric-row">
          {EDITABLE_METRICS.slice(2).map(({ field, label, icon: Icon }) => (
            <div key={field} className="metric-box">
              <span className="metric-label">
                <Icon size={10} aria-hidden="true" /> {label}
              </span>
              {isEditing ? (
                <input
                  type="number"
                  min="0"
                  className="lc-mini-input"
                  value={metrics[field]}
                  onChange={(event) => onChangeField(field, event.target.value)}
                  aria-label={`${label} days for ${consultant.name}`}
                />
              ) : (
                <span className="metric-value">{metrics[field]}d</span>
              )}
            </div>
          ))}

          <div className="metric-box total">
            <span className="metric-label">Total Available</span>
            <span className="metric-value">{metrics.totalAvailable}d</span>
          </div>
        </div>
      </div>

      <div className="lc-card-footer">
        <div className="lc-progress-visual">
          {PROGRESS_SEGMENTS.map(({ field, className }) => (
            <div
              key={field}
              className={`lc-progress-segment ${className}`}
              style={{ width: `${(metrics[field] / LEAVE_ALLOCATION_MAX_DAYS) * 100}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const AllocationCard = memo(AllocationCardComponent);
export default AllocationCard;
