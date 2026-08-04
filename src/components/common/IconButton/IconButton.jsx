import { forwardRef, memo } from 'react';

import { Button } from '@components/ui/Button/Button';

/** Thin wrapper over Button for icon-only actions. */
const IconButtonComponent = forwardRef(function IconButton(
  { icon: Icon, label, variant = 'ghost', size = 'iconOnly', ...rest },
  ref,
) {
  return (
    <Button ref={ref} variant={variant} size={size} aria-label={label} {...rest}>
      {Icon ? <Icon aria-hidden="true" /> : null}
    </Button>
  );
});

export const IconButton = memo(IconButtonComponent);
export default IconButton;
