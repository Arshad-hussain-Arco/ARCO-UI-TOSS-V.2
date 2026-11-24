import React from 'react';

/**
 * Embedded SVG sprite containing all status and UI icons used across the Cockpit.
 * Zero external font or SVG file dependencies.
 */
export function IconSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', pointerEvents: 'none', display: 'none' }} aria-hidden="true">
      <defs>
        <symbol id="i-eye" viewBox="0 0 24 24">
          <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </symbol>
        <symbol id="i-eye-off" viewBox="0 0 24 24">
          <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </symbol>
        <symbol id="i-waiting" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        </symbol>
        <symbol id="i-hold" viewBox="0 0 16 16">
          <path d="M5.5 3.5v9M10.5 3.5v9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </symbol>
        <symbol id="i-queued" viewBox="0 0 16 16">
          <path d="M3 4.5h10M3 8h10M3 11.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </symbol>
        <symbol id="i-running" viewBox="0 0 16 16">
          <path d="M5 3.2v9.6L13 8z" fill="currentColor" />
        </symbol>
        <symbol id="i-done" viewBox="0 0 16 16">
          <path d="M3.2 8.4l3 3 6.6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </symbol>
        <symbol id="i-failed" viewBox="0 0 16 16">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </symbol>
        <symbol id="i-killed" viewBox="0 0 16 16">
          <rect x="4" y="4" width="8" height="8" rx="1.2" fill="currentColor" />
        </symbol>
        <symbol id="i-skipped" viewBox="0 0 16 16">
          <path d="M3.5 4l6 4-6 4zM12 4v8" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" fill="none" />
        </symbol>
        <symbol id="i-search" viewBox="0 0 16 16">
          <circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M10.3 10.3L14 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </symbol>
        <symbol id="i-dots" viewBox="0 0 16 16">
          <circle cx="8" cy="3" r="1.5" fill="currentColor" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="13" r="1.5" fill="currentColor" />
        </symbol>
        <symbol id="i-upload" viewBox="0 0 16 16">
          <path d="M8 11V3M4.8 6.2L8 3l3.2 3.2M3 13h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </symbol>
        <symbol id="i-file" viewBox="0 0 16 16">
          <path d="M4 2.5h5l3 3v8H4z M9 2.5v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none" />
        </symbol>
        <symbol id="i-play" viewBox="0 0 16 16">
          <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
        </symbol>
        <symbol id="i-x" viewBox="0 0 16 16">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </symbol>
        <symbol id="i-chevron" viewBox="0 0 16 16">
          <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </symbol>
        <symbol id="i-refresh" viewBox="0 0 16 16">
          <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </symbol>
        <symbol id="i-alert" viewBox="0 0 16 16">
          <path d="M8 2.2L14.4 13H1.6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" fill="none" />
          <path d="M8 6.5v3M8 11.2v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </symbol>
        <symbol id="i-info" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 7.2v4M8 4.8v.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </symbol>
        <symbol id="i-fit" viewBox="0 0 16 16">
          <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </symbol>
        <symbol id="i-plus" viewBox="0 0 16 16">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </symbol>
        <symbol id="i-minus" viewBox="0 0 16 16">
          <path d="M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </symbol>
        <symbol id="i-list" viewBox="0 0 16 16">
          <path d="M5.5 4h8M5.5 8h8M5.5 12h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="2.7" cy="4" r=".9" fill="currentColor" />
          <circle cx="2.7" cy="8" r=".9" fill="currentColor" />
          <circle cx="2.7" cy="12" r=".9" fill="currentColor" />
        </symbol>
        <symbol id="i-history" viewBox="0 0 16 16">
          <path d="M2.5 8a5.5 5.5 0 1 0 1.7-4M2.5 2.5v3h3M8 5v3.2l2 1.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </symbol>
      </defs>
    </svg>
  );
}

export function CockpitIcon({ name, className = '', ...props }) {
  const id = typeof name === 'string' && !name.startsWith('i-') ? `i-${name}` : name;
  return (
    <svg className={`cr-icon ${className}`.trim()} aria-hidden="true" {...props}>
      <use href={`#${id}`} />
    </svg>
  );
}

export default IconSprite;
