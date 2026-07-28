import { memo, useEffect, useState } from 'react';

import { cn } from '@utils/cn';

import styles from './Image.module.css';

/**
 * Inline SVG placeholder rendered when the source fails to load. Carried over
 * from the original export so broken images look the same as before.
 */
const FALLBACK_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg==';

/**
 * The application's image primitive — the SPA replacement for framework image
 * components. Native `loading`/`decoding` hints handle deferral, and a load
 * failure degrades to a neutral placeholder rather than a broken-image glyph.
 *
 * @param {Object} props
 * @param {string} props.src
 * @param {string} props.alt          Pass "" for purely decorative images.
 * @param {'lazy'|'eager'} [props.loading='lazy']
 * @param {string} [props.fallbackSrc]
 */
function ImageComponent({
  src,
  alt = '',
  loading = 'lazy',
  decoding = 'async',
  fallbackSrc = FALLBACK_SRC,
  className,
  style,
  ...rest
}) {
  const [hasFailed, setHasFailed] = useState(false);

  // Retry when the caller swaps the source.
  useEffect(() => setHasFailed(false), [src]);

  if (hasFailed) {
    return (
      <span className={cn(styles.fallback, className)} style={style}>
        <img src={fallbackSrc} alt={alt} data-original-src={src} {...rest} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding={decoding}
      className={className}
      style={style}
      onError={() => setHasFailed(true)}
      {...rest}
    />
  );
}

export const Image = memo(ImageComponent);
export default Image;
