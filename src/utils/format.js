/**
 * Two-letter initials for an avatar, e.g. "Sofia Martinez" → "SM".
 *
 * @param {string} name
 * @param {number} [maxLength=2]
 */
export const getInitials = (name, maxLength = 2) =>
  String(name ?? '')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, maxLength);

/**
 * Percentage of a whole, rounded to the nearest integer. Returns 0 when the
 * denominator is zero so callers never render NaN.
 */
export const toPercentage = (value, total) => (total === 0 ? 0 : Math.round((value / total) * 100));
