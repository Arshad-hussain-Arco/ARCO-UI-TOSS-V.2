import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element #root was not found in index.html.');
}

// Global click listener to spin refresh buttons on click
document.addEventListener('click', (e) => {
  const target = e.target;
  let icon = null;
  
  if (target.closest('.lucide-refresh-cw, .lucide-rotate-ccw')) {
    icon = target.closest('.lucide-refresh-cw, .lucide-rotate-ccw');
  } else if (target.closest('button')) {
    icon = target.closest('button').querySelector('.lucide-refresh-cw, .lucide-rotate-ccw');
  }

  if (icon) {
    icon.classList.add('click-spin');
    setTimeout(() => icon.classList.remove('click-spin'), 1000);
  }
});

createRoot(container).render(
  // <StrictMode>
  <App />
  // </StrictMode>,
);

