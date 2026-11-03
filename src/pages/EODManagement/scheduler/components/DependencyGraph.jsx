import { useMemo } from 'react';
import { NODE_HEIGHT, NODE_WIDTH, edgeStyle, graphBounds, layeredLayout } from '../schedulerModel';

const clip = (text, n) => (text.length > n ? `${text.slice(0, n - 1)}…` : text);

/**
 * The dependency graph of one folder, drawn as plain SVG (no graph library): jobs left to right in dependency order, edges for the conditions
 * that connect them. With a run selected the nodes show each job's status colour. Selecting a node highlights its edges.
 */
export function DependencyGraph({ graph, states, selected, onSelect }) {
  const layout = useMemo(() => layeredLayout(graph.nodes, graph.edges), [graph]);
  const { width, height } = useMemo(() => graphBounds(layout), [layout]);

  if (!graph.nodes.length) return <p className="eodsch-muted">This folder has no jobs.</p>;

  const pad = 16;
  const touches = (e) => selected && (e.source === selected || e.target === selected);

  return (
    <div className="eodsch-graph">
      <div className="eodsch-graph-legend" aria-hidden="true">
        <span className="eodsch-legend eodsch-edge-info">condition</span>
        <span className="eodsch-legend eodsch-edge-danger">on failure</span>
        <span className="eodsch-legend eodsch-edge-muted">dependency</span>
      </div>
      <div className="eodsch-graph-scroll">
        <svg
          width={width + pad * 2}
          height={height + pad * 2}
          viewBox={`${-pad} ${-pad} ${width + pad * 2} ${height + pad * 2}`}
          role="img"
          aria-label={`Dependency graph with ${graph.nodes.length} jobs`}
        >
          <defs>
            {['info', 'danger', 'muted'].map((tone) => (
              <marker
                key={tone}
                id={`eodsch-arrow-${tone}`}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path d="M0,0 L8,4 L0,8 z" className={`eodsch-arrow eodsch-arrow-${tone}`} />
              </marker>
            ))}
          </defs>
          {graph.edges.map((e) => {
            const a = layout[e.source];
            const b = layout[e.target];
            if (!a || !b) return null;
            const { tone, dashed } = edgeStyle(e);
            const x1 = a.x + NODE_WIDTH;
            const y1 = a.y + NODE_HEIGHT / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_HEIGHT / 2;
            const mid = Math.max(30, (x2 - x1) / 2);
            return (
              <path
                key={e.id}
                d={`M${x1},${y1} C${x1 + mid},${y1} ${x2 - mid},${y2} ${x2},${y2}`}
                className={`eodsch-edge eodsch-edge-${tone}`}
                strokeDasharray={dashed ? '6 4' : undefined}
                markerEnd={`url(#eodsch-arrow-${tone})`}
                opacity={selected && !touches(e) ? 0.2 : 1}
                strokeWidth={touches(e) ? 2.6 : 1.5}
              >
                <title>{`${e.source} → ${e.target}${e.label ? ` (${e.label})` : ''}`}</title>
              </path>
            );
          })}
          {graph.nodes.map((n) => {
            const p = layout[n.id];
            const state = states?.[n.id];
            return (
              <g
                key={n.id}
                transform={`translate(${p.x},${p.y})`}
                className={`eodsch-node eodsch-tone-${state?.tone ?? 'idle'}`}
                data-selected={selected === n.id}
                tabIndex={0}
                role="button"
                aria-pressed={selected === n.id}
                aria-label={`${n.id}${state ? `, ${state.label}` : ''}`}
                onClick={() => onSelect?.(n.id)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    onSelect?.(n.id);
                  }
                }}
              >
                <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="8" />
                <text x="10" y="22" className="eodsch-node-name">
                  {clip(n.id, 26)}
                </text>
                <text x="10" y="40" className="eodsch-node-state">
                  {state?.label ?? ''}
                </text>
                <title>{n.id}</title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default DependencyGraph;
