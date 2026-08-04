import { memo } from 'react';

import styles from './Tooltip.module.css';

export const Tooltip = memo(function Tooltip({ label, children, className }) {
  return (
    <span className={styles.wrapper}>
      {children}
      {label ? (
        <span role="tooltip" className={styles.tooltip}>
          {label}
        </span>
      ) : null}
    </span>
  );
});

export default Tooltip;
