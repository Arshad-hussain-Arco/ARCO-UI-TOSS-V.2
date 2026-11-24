import { memo } from 'react';

/**
 * The labelled box drawn behind the jobs of one workflow in the "All workflows" graph: its name, how many jobs it has and how many are done.
 * It is only a background (no handles, no clicks); the colour tells the workflows apart.
 */
function WorkflowGroupNodeComponent({ data }) {
  const { title, total, done = 0, color = '#0284c7' } = data;
  return (
    <div className="rf-workflow-group" style={{ '--wg-color': color }}>
      <div className="rf-wg-head">
        <span className="rf-wg-name" title={title}>
          {title}
        </span>
        <span className="rf-wg-count">
          {done}/{total} done
        </span>
      </div>
    </div>
  );
}

export const WorkflowGroupNode = memo(WorkflowGroupNodeComponent);
export default WorkflowGroupNode;
