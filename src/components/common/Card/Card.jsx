import { memo } from 'react';

import { cn } from '@utils/cn';

import styles from './Card.module.css';

export const Card = memo(function Card({ hoverable = false, className, children, ...rest }) {
  return (
    <div className={cn(styles.card, hoverable && styles.hoverable, className)} {...rest}>
      {children}
    </div>
  );
});

export default Card;
