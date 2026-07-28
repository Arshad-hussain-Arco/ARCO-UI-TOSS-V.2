import { memo } from 'react';
import { Check, GripVertical } from 'lucide-react';

/**
 * Dashboard widget visibility and ordering.
 *
 * @param {Object} props
 * @param {{ id: string, label: string, enabled: boolean }[]} props.widgets
 * @param {(widgetId: string) => void} props.onToggleWidget
 * @param {() => void} props.onReset
 */
function HomeManagementPanelComponent({ widgets, onToggleWidget, onReset }) {
  return (
    <div className="ss-form-card p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[0.8125rem] font-semibold text-[var(--text-primary)]">
          Dashboard Widgets
        </span>
        <button
          type="button"
          onClick={onReset}
          className="text-[0.75rem] text-[var(--c-primary)] cursor-pointer hover:underline"
        >
          Reset to Default
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {widgets.map((widget, index) => (
          <div
            key={widget.id}
            className="flex items-center gap-3 p-3 border border-[var(--border-primary)] rounded bg-[var(--surface-primary)] hover:border-[var(--border-secondary)] transition-colors"
          >
            <GripVertical
              size={16}
              className="text-[var(--text-tertiary)] cursor-grab"
              aria-hidden="true"
            />

            <button
              type="button"
              role="checkbox"
              aria-checked={widget.enabled}
              aria-label={widget.label}
              onClick={() => onToggleWidget(widget.id)}
              className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer p-0 ${
                widget.enabled
                  ? 'border-[var(--c-primary)] bg-[var(--c-primary)]'
                  : 'border-[var(--border-secondary)] bg-transparent'
              }`}
            >
              {widget.enabled ? (
                <Check size={12} className="text-white" aria-hidden="true" />
              ) : null}
            </button>

            <span className="text-[0.8125rem] text-[var(--text-primary)] flex-1">
              {widget.label}
            </span>
            <span className="text-[0.7rem] text-[var(--text-tertiary)] uppercase bg-[var(--bg-secondary)] px-2 py-0.5 rounded">
              Row {index + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const HomeManagementPanel = memo(HomeManagementPanelComponent);
export default HomeManagementPanel;
