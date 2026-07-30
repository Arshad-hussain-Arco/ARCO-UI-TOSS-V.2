import React from 'react';
import './DotsLoader.css';

export function DotsLoader({ size = 24, className = '', color }) {
  const dotSize = size * 0.25;
  const radius = size * 0.35;
  const center = size / 2;

  // Dot 1: Top
  const d1x = center - dotSize / 2;
  const d1y = center - radius - dotSize / 2;

  // Dot 2: Bottom Right
  const d2x = center + radius * Math.cos(Math.PI / 6) - dotSize / 2;
  const d2y = center + radius * Math.sin(Math.PI / 6) - dotSize / 2;

  // Dot 3: Bottom Left
  const d3x = center - radius * Math.cos(Math.PI / 6) - dotSize / 2;
  const d3y = center + radius * Math.sin(Math.PI / 6) - dotSize / 2;

  return (
    <div 
      className={`rwiz-dots-loader ${className}`} 
      style={{ width: size, height: size, color: color || 'currentColor' }}
    >
      <div className="dot" style={{ width: dotSize, height: dotSize, top: d1y, left: d1x }} />
      <div className="dot" style={{ width: dotSize, height: dotSize, top: d2y, left: d2x }} />
      <div className="dot" style={{ width: dotSize, height: dotSize, top: d3y, left: d3x }} />
    </div>
  );
}
