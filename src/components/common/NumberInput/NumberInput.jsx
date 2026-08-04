import { forwardRef } from 'react';

import { Input } from '../Input/Input';

/**
 * Numeric field — thin wrapper over Input, shares all styling/states.
 */
export const NumberInput = forwardRef(function NumberInput({ inputMode = 'numeric', ...rest }, ref) {
  return <Input ref={ref} type="number" inputMode={inputMode} {...rest} />;
});

export default NumberInput;
