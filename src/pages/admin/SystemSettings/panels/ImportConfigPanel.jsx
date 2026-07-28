import { memo } from 'react';
import { FileText, Plus, Settings, Upload } from 'lucide-react';

/**
 * Import file configuration: drop zone plus the configured file paths.
 *
 * Tailwind utility classes are kept verbatim from the design; only the
 * interactive elements were promoted to real buttons.
 *
 * @param {Object} props
 * @param {{ id: string, path: string }[]} props.paths
 */
function ImportConfigPanelComponent({ paths }) {
  return (
    <div className="ss-form-card">
      <div className="flex flex-col gap-4 p-6">
        <button
          type="button"
          className="border border-dashed border-[var(--border-secondary)] rounded-md p-6 flex flex-col items-center justify-center gap-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors w-full"
        >
          <Upload size={20} className="text-[var(--text-tertiary)]" aria-hidden="true" />
          <span className="text-[0.8125rem] font-medium text-[var(--text-primary)]">
            Drag &amp; drop import files here
          </span>
          <span className="text-[0.75rem] text-[var(--text-tertiary)]">
            Supports CSV, XML, JSON up to 50MB
          </span>
        </button>

        <div className="border border-[var(--border-primary)] rounded-md divide-y divide-[var(--border-primary)]">
          <div className="p-3 flex items-center justify-between bg-[var(--bg-secondary)] text-[0.75rem] font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            <span>File Path Settings</span>
            <button
              type="button"
              className="text-[var(--c-primary)] flex items-center gap-1 hover:underline"
            >
              <Plus size={12} aria-hidden="true" /> Add Path
            </button>
          </div>

          {paths.map((entry) => (
            <div key={entry.id} className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-[var(--text-tertiary)]" aria-hidden="true" />
                <span className="text-[0.8125rem] text-[var(--text-primary)]">{entry.path}</span>
              </div>
              <button
                type="button"
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                aria-label={`Configure ${entry.path}`}
              >
                <Settings size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const ImportConfigPanel = memo(ImportConfigPanelComponent);
export default ImportConfigPanel;
