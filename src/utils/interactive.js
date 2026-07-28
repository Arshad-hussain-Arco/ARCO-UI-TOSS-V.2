/**
 * Accessibility helpers for elements that behave like controls but are not
 * rendered as `<button>`.
 *
 * The design relies on `<div>` cards and table rows whose styling assumes a
 * non-button element. Rather than restyle each one, these helpers add the
 * semantics and keyboard handling a control needs, leaving the appearance
 * untouched.
 */

/** Keys that activate a control, matching native button behaviour. */
const ACTIVATION_KEYS = ['Enter', ' '];

/**
 * Props that turn a static element into a keyboard-operable button.
 *
 * @param {(event: Event) => void} onActivate
 * @param {Object}  [options]
 * @param {string}  [options.label]           Accessible name, when the content alone is unclear.
 * @param {boolean} [options.isPressed]       Renders aria-pressed for toggle controls.
 * @param {boolean} [options.isExpanded]      Renders aria-expanded for disclosure controls.
 * @param {string}  [options.controls]        id of the region a disclosure controls.
 * @returns {Object} Spread onto the element in place of a bare `onClick`.
 *
 * @example
 * <div className="card" {...activatable(() => select(id), { label: name })}>
 */
export const activatable = (onActivate, { label, isPressed, isExpanded, controls } = {}) => ({
  role: 'button',
  tabIndex: 0,
  onClick: onActivate,
  onKeyDown: (event) => {
    if (!ACTIVATION_KEYS.includes(event.key)) return;
    // Space would otherwise scroll the page.
    event.preventDefault();
    onActivate(event);
  },
  ...(label === undefined ? {} : { 'aria-label': label }),
  ...(isPressed === undefined ? {} : { 'aria-pressed': isPressed }),
  ...(isExpanded === undefined ? {} : { 'aria-expanded': isExpanded }),
  ...(controls === undefined ? {} : { 'aria-controls': controls }),
});

/**
 * Props for a click-to-dismiss overlay that is a *sibling* of the content it sits
 * behind. It is hidden from assistive technology entirely — the dialog owns the
 * Escape handling — so it carries no role and no tab stop.
 *
 * @param {() => void} onDismiss
 */
export const dismissOverlay = (onDismiss) => ({
  onClick: onDismiss,
  role: 'presentation',
  'aria-hidden': 'true',
});

/**
 * Props for a backdrop that *wraps* its dialog.
 *
 * Unlike `dismissOverlay` this must not be `aria-hidden`, or it would hide the
 * dialog inside it from assistive technology. Dismissal only fires for clicks
 * landing on the backdrop itself, which removes the need for the dialog to stop
 * propagation.
 *
 * @param {() => void} onDismiss
 */
export const dismissBackdrop = (onDismiss) => ({
  role: 'presentation',
  onClick: (event) => {
    if (event.target === event.currentTarget) onDismiss();
  },
});
