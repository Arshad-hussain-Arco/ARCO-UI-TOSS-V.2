import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Check, Filter } from 'lucide-react';
import { getStatusFilterOptions } from '../utils/statusMapper';

export function StatusFilter({ value, onChange, mode = 'business', statusCounts = {} }) {
  const [open, setOpen] = useState(false);
  const options = getStatusFilterOptions(mode);

  const totalCount = statusCounts['__ALL__'] || 0;
  const currentLabel = value
    ? value
    : `All Statuses (${mode === 'development' ? '17 Stages' : '7 Phases'})`;
  const currentCount = value ? (statusCounts[value] || 0) : totalCount;

  return (
    <div className="pm-status-filter-wrap">
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`pm-custom-select-trigger ${value ? 'has-value' : ''}`}
            aria-label="Filter by project status"
          >
            <div className="pm-select-trigger-left">
              <Filter size={13} className="pm-select-icon" />
              <span className="pm-select-label">{currentLabel}</span>
            </div>
            <div className="pm-select-trigger-right">
              <span className="pm-select-badge">{currentCount}</span>
              <ChevronDown size={13} className={`pm-select-chevron ${open ? 'open' : ''}`} />
            </div>
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            className="pm-custom-select-dropdown"
            align="start"
            sideOffset={6}
          >
            <div className="pm-dropdown-header">
              <span className="pm-dropdown-header-title">
                {mode === 'development' ? 'Detailed SDLC Stages (17 Stages)' : 'High-Level Status Groups (7 Phases)'}
              </span>
            </div>

            <div className="pm-dropdown-options-list">
              {/* "All Statuses" Option */}
              <button
                type="button"
                className={`pm-dropdown-option ${!value ? 'selected' : ''}`}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                <div className="pm-option-left">
                  <span className="pm-option-dot dot-all" />
                  <span className="pm-option-text">
                    All Statuses ({mode === 'development' ? '17 Stages' : '7 Phases'})
                  </span>
                </div>
                <div className="pm-option-right">
                  <span className="pm-option-count-badge nonzero">{totalCount}</span>
                  {!value && <Check size={13} className="pm-option-check" />}
                </div>
              </button>

              <div className="pm-dropdown-divider" />

              {/* Individual Status Options with Count Badges */}
              {options.map((opt) => {
                const isSelected = value?.toLowerCase() === opt.value.toLowerCase();
                const count = statusCounts[opt.value] || statusCounts[opt.label] || 0;

                return (
                  <button
                    key={opt.key}
                    type="button"
                    className={`pm-dropdown-option ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <div className="pm-option-left">
                      <span className="pm-option-dot" />
                      <span className="pm-option-text">{opt.label}</span>
                    </div>
                    <div className="pm-option-right">
                      <span className={`pm-option-count-badge ${count > 0 ? 'nonzero' : 'zero'}`}>
                        {count}
                      </span>
                      {isSelected && <Check size={13} className="pm-option-check" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

export default StatusFilter;
