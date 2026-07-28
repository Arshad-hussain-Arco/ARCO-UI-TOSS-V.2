import { memo } from 'react';
import { Search } from 'lucide-react';

/**
 * Search field used by the list and table pages.
 *
 * Behaviour (labelling, icon placement, change handling) is centralised here,
 * while each page passes its own class names so the existing page stylesheets
 * continue to drive the appearance unchanged.
 *
 * `type` stays "text" rather than "search" on purpose: WebKit renders a native
 * clear button for search inputs, which would alter the original design.
 *
 * @param {Object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange   Receives the value, not the event.
 * @param {string} props.placeholder
 * @param {{ wrapper?: string, icon?: string, input?: string }} [props.classNames]
 * @param {number} [props.iconSize=14]
 * @param {string} [props.label]  Accessible name; defaults to the placeholder.
 */
function SearchInputComponent({
  value,
  onChange,
  placeholder,
  classNames = {},
  iconSize = 14,
  label,
  ...rest
}) {
  return (
    <div className={classNames.wrapper}>
      <Search size={iconSize} className={classNames.icon} aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={classNames.input}
        aria-label={label ?? placeholder}
        {...rest}
      />
    </div>
  );
}

export const SearchInput = memo(SearchInputComponent);
export default SearchInput;
