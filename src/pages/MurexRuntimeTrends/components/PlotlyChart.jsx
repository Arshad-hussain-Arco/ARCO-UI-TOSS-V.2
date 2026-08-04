import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Plotly Chart Wrapper Component (CDN Auto-Loader).
 *
 * NOTE: loads Plotly from a CDN script tag rather than an npm dependency —
 * flagged for replacement with a local package in a future pass (offline/perf).
 */
export function PlotlyChart({ data, layout, config, onClick, style }) {
  const containerRef = useRef(null);
  const [plotlyLoaded, setPlotlyLoaded] = useState(Boolean(window.Plotly));

  useEffect(() => {
    if (window.Plotly) {
      setPlotlyLoaded(true);
      return;
    }
    const existing = document.getElementById('plotly-script');
    if (existing) {
      existing.addEventListener('load', () => setPlotlyLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.id = 'plotly-script';
    script.src = 'https://cdn.plot.ly/plotly-2.35.2.min.js';
    script.async = true;
    script.onload = () => setPlotlyLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!plotlyLoaded || !containerRef.current || !window.Plotly) return;

    const el = containerRef.current;
    window.Plotly.newPlot(el, data, layout, {
      responsive: true,
      displayModeBar: false,
      ...config,
    });

    if (onClick) {
      el.removeAllListeners?.('plotly_click');
      el.on('plotly_click', onClick);
    }

    const handleResize = () => {
      if (window.Plotly && el) {
        window.Plotly.Plots.resize(el);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (window.Plotly && el) {
        window.Plotly.purge(el);
      }
    };
  }, [plotlyLoaded, data, layout, config, onClick]);

  if (!plotlyLoaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: 'var(--text-tertiary)' }}>
        <RefreshCw size={14} className="eod-pulse-icon" style={{ marginRight: 8 }} /> Loading Plotly engine...
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: 220, ...style }} />;
}

export default PlotlyChart;
