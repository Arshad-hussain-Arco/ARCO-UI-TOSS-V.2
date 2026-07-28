import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges conditional class names, de-duplicating conflicting Tailwind utilities. */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export default cn;
