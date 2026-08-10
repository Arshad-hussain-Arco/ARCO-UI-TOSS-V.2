import React, { useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@utils/cn';
import './ResetButton.css';

/**
 * Standard Reset Button component across the application.
 * Matches the design and animation of the Consultants page reset button.
 */
export function ResetButton({ 
  onClick, 
  disabled = false, 
  loading = false, 
  className = '', 
  title = 'Reset Filters',
  ...rest 
}) {
  const iconRef = useRef(null);

  const handleClick = (e) => {
    if (disabled || loading) return;
    
    if (iconRef.current) {
      iconRef.current.classList.add('spin-animation');
      setTimeout(() => {
        if (iconRef.current) {
          iconRef.current.classList.remove('spin-animation');
        }
      }, 500);
    }
    
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      type="button"
      className={cn('global-reset-button', className)}
      onClick={handleClick}
      disabled={disabled || loading}
      title={title}
      {...rest}
    >
      <RotateCcw 
        ref={iconRef} 
        className={cn('global-reset-icon', loading && 'spin-animation')} 
        size={14} 
      />
      <span>Reset</span>
    </button>
  );
}

export default ResetButton;
