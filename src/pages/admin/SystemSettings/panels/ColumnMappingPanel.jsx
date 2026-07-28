import { memo, useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';

import { COLUMN_DATA_TYPES } from '@mocks/data/systemSettings';
import { Select } from '@components/forms/Select/Select';

const HEADER_CELL_CLASS =
  'p-3 text-[0.75rem] font-semibold text-[var(--text-secondary)] border-b border-[var(--border-primary)]';

const MappingRow = memo(function MappingRow({ mapping }) {
  const [dataType, setDataType] = useState(mapping.dataType);
  return (
    <tr className="hover:bg-[var(--bg-hover)]">
      <td className="p-3 text-[0.8125rem] text-[var(--text-primary)] font-medium">
        {mapping.source}
      </td>
      <td className="p-3 text-[0.8125rem] text-[var(--text-secondary)]">
        {mapping.destination}
      </td>
      <td className="p-3">
        <Select
          value={dataType}
          onChange={setDataType}
          width="dataType"
          options={COLUMN_DATA_TYPES.map((type) => ({ value: type, label: type }))}
        />
      </td>
      <td className="p-3 text-[var(--text-tertiary)]">
        <button
          type="button"
          className="hover:text-[var(--c-danger)]"
          aria-label={`Remove mapping for ${mapping.source}`}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </td>
    </tr>
  );
});

/**
 * Source-to-destination column mapping table, shared by the CR and WO tabs.
 *
 * @param {Object} props
 * @param {{ id: string, source: string, destination: string, dataType: string }[]} props.mappings
 * @param {string} props.title  Names the table for assistive technology.
 */
function ColumnMappingPanelComponent({ mappings, title }) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return mappings;

    return mappings.filter(
      (mapping) =>
        mapping.source.toLowerCase().includes(needle) ||
        mapping.destination.toLowerCase().includes(needle),
    );
  }, [mappings, query]);

  return (
    <div className="ss-form-card">
      <div className="flex flex-col h-[400px]">
        <div className="p-3 border-b border-[var(--border-primary)] flex justify-between items-center bg-[var(--bg-secondary)]">
          <div className="relative w-64">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Search columns..."
              aria-label="Search columns"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full h-7 pl-8 pr-3 text-[0.8125rem] border border-[var(--border-primary)] rounded bg-[var(--surface-primary)] focus:border-[var(--c-primary)] outline-none"
            />
          </div>

          <button
            type="button"
            className="flex items-center gap-1 text-[0.75rem] font-medium text-[var(--text-inverse)] bg-[var(--text-primary)] hover:bg-[var(--text-secondary)] px-3 py-1.5 rounded transition-colors"
          >
            <Plus size={12} aria-hidden="true" /> Add Rule
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <caption className="sr-only">{title}</caption>
            <thead className="bg-[var(--bg-secondary)] sticky top-0">
              <tr>
                <th scope="col" className={HEADER_CELL_CLASS}>
                  Source Column
                </th>
                <th scope="col" className={HEADER_CELL_CLASS}>
                  Destination Column
                </th>
                <th scope="col" className={HEADER_CELL_CLASS}>
                  Data Type
                </th>
                <th scope="col" className={`${HEADER_CELL_CLASS} w-16`}>
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-primary)]">
              {visible.map((mapping) => (
                <MappingRow key={mapping.id} mapping={mapping} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export const ColumnMappingPanel = memo(ColumnMappingPanelComponent);
export default ColumnMappingPanel;
