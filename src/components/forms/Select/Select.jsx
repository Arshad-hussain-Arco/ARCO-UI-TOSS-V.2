import * as RadixSelect from '@radix-ui/react-select';
import { ChevronDown, Check } from 'lucide-react';
import { useState } from 'react';
import './Select.css';

function Select({
  value,
  onChange,
  options,
  placeholder = 'Select\u2026',
  className = '',
  disabled = false,
  width,
}) {

  const PREDEFINED_WIDTHS = {
    department: '280px',
    leaveType: '240px',
    team: '220px',
    designation: '260px',
    manager: '240px',
    project: '260px',
    role: '200px',
    status: '180px',
    dateRange: '180px',
    sort: '180px',
    gender: '160px',
    featureType: '160px',
    dataType: '140px',
  };

  const resolvedWidth = PREDEFINED_WIDTHS[width] || width || '180px';
  const radixValue = value === '' ? void 0 : value;

  return (
    <RadixSelect.Root
      value={radixValue}
      onValueChange={onChange}
      disabled={disabled}
    >
      <RadixSelect.Trigger
        className={`cs-trigger${className ? ` ${className}` : ''}`}
        style={{ width: resolvedWidth, minWidth: resolvedWidth, maxWidth: resolvedWidth }}
        aria-label={placeholder}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon asChild style={{ pointerEvents: 'none' }}>
          <ChevronDown size={13} strokeWidth={2} className="cs-chevron" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className="cs-content"
          position="popper"
          sideOffset={4}
          align="start"
          avoidCollisions
        >
          <RadixSelect.Viewport className="cs-viewport">
            {options.map((opt) => (
              <RadixSelect.Item
                key={opt.value}
                value={opt.value}
                className="cs-item"
                disabled={opt.disabled}
              >
                <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator asChild>
                  <Check size={11} strokeWidth={2.5} className="cs-check" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}

export { Select };
export default Select;
