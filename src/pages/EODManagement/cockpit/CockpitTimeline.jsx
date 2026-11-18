import React, { useState, useRef, useMemo } from 'react';
import { CockpitIcon } from './IconSprite';
import { runBars, criticalChain, tickStep, clock, dur, wall } from './timelineUtils';
import { getGroupColor } from './cockpitData';
import './CockpitTimeline.css';

export function CockpitTimeline({
  run,
  definition,
  onSelectJob,
  selectedJob,
  latestRun = null,
  onOpenRun = null,
}) {
  const [zoom, setZoom] = useState(1.0);
  const [order, setOrder] = useState('start');
  const [showCriticalOnly, setShowCriticalOnly] = useState(true);
  const [hoveredJob, setHoveredJob] = useState(null);
  const scrollRef = useRef(null);

  const defIndex = useMemo(
    () => new Map((definition?.jobs || []).map((j) => [j.name, j])),
    [definition],
  );

  const rawBars = useMemo(() => runBars(run?.jobs || []), [run]);
  const chain = useMemo(() => criticalChain(defIndex, run?.jobs || []), [defIndex, run]);
  const inChain = useMemo(() => new Set(chain.names), [chain]);

  // Slowest jobs (top 6) and the row order. These hooks must stay ABOVE the early return below: if they came after it, the number of hooks
  // would change the moment the first job of a run starts and React would crash the tab.
  const slowestJobs = useMemo(() => {
    return [...rawBars]
      .sort((a, b) => b.end - b.start - (a.end - a.start))
      .slice(0, 6)
      .map((b) => ({
        name: b.name,
        duration: dur(b.end - b.start),
        status: b.status,
      }));
  }, [rawBars]);

  const sortedBars = useMemo(() => {
    if (order === 'longest') {
      return [...rawBars].sort((a, b) => b.end - b.start - (a.end - a.start));
    }
    return rawBars;
  }, [rawBars, order]);

  if (!rawBars.length) {
    const isReady = !run || run.isReadyState;
    return (
      <div className="cr-timeline-empty">
        <span className="cr-tl-empty-icon">
          <CockpitIcon name="i-waiting" className="xl" />
        </span>
        <h2>{isReady ? 'This workflow has not run yet' : 'No job has started yet'}</h2>
        <p>
          {isReady
            ? 'Start a run to see when each job started and ended, and the critical chain that decided how long the run took.'
            : 'Times appear here as soon as the first job of this run starts.'}
        </p>
        {latestRun && onOpenRun ? (
          <button
            type="button"
            className="cr-btn outline sm"
            onClick={() => onOpenRun(latestRun.id)}
          >
            <CockpitIcon name="i-play" className="xs" /> View the latest run
            <span className="cr-tl-empty-sub">
              {latestRun.status}
              {latestRun.when ? ` · ${latestRun.when}` : ''}
            </span>
          </button>
        ) : null}
      </div>
    );
  }

  const t0 = Math.min(...rawBars.map((b) => b.start));
  const tEnd = Math.max(...rawBars.map((b) => b.end), t0 + 1000);
  const total = Math.max(tEnd - t0, 1000);
  const notStarted = (run?.jobs?.length || rawBars.length) - rawBars.length;

  const frac = (t) => Math.max(0, Math.min(1, (t - t0) / total));

  // Track ticks
  const step = tickStep(total, 8);
  const ticks = [];
  for (let t = 0; t <= total; t += step) {
    ticks.push(t);
  }

  const trackWidthPx = Math.round(920 * zoom);

  return (
    <div className="cr-timeline-content">
      {/* ── Summary Strip ── */}
      <div className="cr-timeline-summary">
        <div className="cr-tl-stat">
          <b>{clock(total)}</b>
          <span>{run?.ended_at ? 'run took' : 'so far'}</span>
        </div>
        <div className="cr-tl-stat">
          <b>{rawBars.length}</b>
          <span>jobs started{notStarted > 0 ? `, ${notStarted} not yet` : ''}</span>
        </div>
        {chain.names.length > 0 && (
          <div className="cr-tl-stat" title="The jobs that decided the duration of the run">
            <b>{chain.names.length}</b>
            <span>
              in the critical chain · {clock(chain.busyMs)} busy
              {chain.gapMs > 1000 ? ` · ${clock(chain.gapMs)} waiting between them` : ''}
            </span>
          </div>
        )}

        <span className="cr-spacer" />

        <div className="cr-tl-controls-right">
          <label className="cr-tl-label-toggle">
            Order
            <select
              className="cr-select sm"
              value={order}
              onChange={(e) => setOrder(e.target.value)}
            >
              <option value="start">By start time</option>
              <option value="longest">Longest first</option>
            </select>
          </label>

          <label className="cr-tl-checkbox">
            <input
              type="checkbox"
              checked={showCriticalOnly}
              onChange={(e) => setShowCriticalOnly(e.target.checked)}
            />
            Critical chain
          </label>

          <div className="cr-tl-zoom">
            <button
              type="button"
              className="cr-tool-btn"
              title="Zoom out"
              onClick={() => setZoom((z) => Math.max(0.6, z / 1.4))}
            >
              <CockpitIcon name="i-minus" className="xs" />
            </button>
            <span className="cr-zoom-text">{zoom.toFixed(1)}×</span>
            <button
              type="button"
              className="cr-tool-btn"
              title="Zoom in"
              onClick={() => setZoom((z) => Math.min(6.0, z * 1.4))}
            >
              <CockpitIcon name="i-plus" className="xs" />
            </button>
            <button
              type="button"
              className="cr-tool-btn"
              title="Fit whole run"
              onClick={() => setZoom(1.0)}
            >
              <CockpitIcon name="i-fit" className="xs" />
            </button>
          </div>

          <span
            className="cr-tl-info"
            title="Bars show real start and end times. Glowing bars form the critical chain."
          >
            <CockpitIcon name="i-info" className="sm" />
          </span>
        </div>
      </div>

      {/* ── Slowest Row ── */}
      <div className="cr-tl-slowest-bar">
        <span className="cr-tl-slow-heading">SLOWEST</span>
        <div className="cr-tl-slow-chips">
          {slowestJobs.map((b) => (
            <button
              key={b.name}
              type="button"
              className="cr-tl-slow-pill"
              onClick={() => onSelectJob(b.name)}
            >
              <span className="cr-tl-slow-name">{b.name}</span>
              <b>{b.duration}</b>
            </button>
          ))}
        </div>
      </div>

      {/* ── Gantt Chart Area ── */}
      <div className="cr-tl-scroll" ref={scrollRef}>
        {/* Sticky Ticks Axis */}
        <div className="cr-tl-axis">
          <div className="cr-tl-axis-label">JOB ({rawBars.length})</div>
          <div className="cr-tl-axis-track" style={{ minWidth: `${trackWidthPx}px` }}>
            {ticks.map((t) => (
              <span key={t} className="cr-tl-tick" style={{ left: `${frac(t0 + t) * 100}%` }}>
                {clock(t)}
              </span>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="cr-tl-rows">
          {sortedBars.map((b) => {
            const def = defIndex.get(b.name);
            const group = def?.group || 'EOD-CORE';
            const left = frac(b.start) * 100;
            const width = Math.max(((b.end - b.start) / total) * 100, 0.4);
            const hot = inChain.has(b.name);
            const isDim = showCriticalOnly && inChain.size > 0 && !hot;
            const text = `${dur(b.end - b.start)} · ${wall(b.start)}`;
            const isSelected = selectedJob === b.name;

            return (
              <div
                key={b.name}
                role="button"
                tabIndex={0}
                className={`cr-tl-row ${isSelected ? 'is-sel' : ''} ${isDim ? 'is-dim' : ''}`}
                onClick={() => onSelectJob(b.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectJob(b.name);
                  }
                }}
                onMouseEnter={() => setHoveredJob(b)}
                onMouseLeave={() => setHoveredJob(null)}
              >
                <div className="cr-tl-row-label">
                  <CockpitIcon
                    name={
                      b.status === 'Done'
                        ? 'i-done'
                        : b.status === 'Running'
                          ? 'i-running'
                          : b.status === 'On hold'
                            ? 'i-hold'
                            : b.status === 'Failed'
                              ? 'i-failed'
                              : 'i-waiting'
                    }
                    className="xs"
                  />
                  <span className="cr-tl-job-name">{b.name}</span>
                  <span
                    className="cr-tl-group-strip"
                    style={{ backgroundColor: getGroupColor(group) }}
                    title={group}
                  />
                </div>

                <div className="cr-tl-track" style={{ minWidth: `${trackWidthPx}px` }}>
                  {ticks.map((t) => (
                    <i
                      key={t}
                      className="cr-tl-grid-col"
                      style={{ left: `${frac(t0 + t) * 100}%` }}
                    />
                  ))}

                  {/* Horizontal Gantt bar */}
                  <span
                    className={`cr-tl-bar st-${b.status.toLowerCase().replace(/\s+/g, '-')} ${hot ? 'hot' : ''}`}
                    style={{
                      left: `${left}%`,
                      width: `max(${width}%, 8px)`,
                    }}
                  />

                  {/* Duration label */}
                  <span
                    className="cr-tl-duration-label"
                    style={{ left: `calc(${left + width}% + 8px)` }}
                  >
                    {text}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hover Tooltip Popup */}
        {hoveredJob && (
          <div className="cr-tl-hover-card">
            <b>{hoveredJob.name}</b>
            <div className="cr-tl-hc-meta">
              {hoveredJob.status} · {dur(hoveredJob.end - hoveredJob.start)}
            </div>
            <div className="cr-tl-hc-sub">
              started {wall(hoveredJob.start)}, ended {wall(hoveredJob.end)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CockpitTimeline;
