import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  PlayCircle,
  SkipForward,
  Server,
  Terminal,
  HelpCircle,
  Play,
  Loader2,
  Ban,
} from 'lucide-react';

const STATUS_ICONS = {
  good: CheckCircle2,
  run: PlayCircle,
  bad: AlertCircle,
  wait: Clock,
  off: SkipForward,
  idle: HelpCircle,
};

const STATUS_LABELS = {
  good: 'Success',
  run: 'Running',
  bad: 'Failed',
  wait: 'Waiting',
  off: 'Skipped',
  idle: 'Idle',
};

function JobNodeComponent({ data, selected }) {
  const {
    id,
    job,
    state,
    duration,
    direction = 'LR',
    isHot = false,
    isDim = false,
    isAllWorkflows = false,
    onExecuteJob,
    playDisabled = false, // the Cockpit's real Play: blocked while a run is going, a chain is being started or nothing is approved
    playBusy = false,
    playTitle = '',
  } = data;

  const tone = state?.tone || 'idle';
  const rawLabel = state?.label || STATUS_LABELS[tone] || tone;
  const isBlocked = String(rawLabel).toLowerCase() === 'blocked';
  const statusLabel = isBlocked ? 'Blocked' : rawLabel;
  const StatusIcon = isBlocked ? Ban : STATUS_ICONS[tone] || HelpCircle;

  const isRunning = tone === 'run' || String(rawLabel).toLowerCase() === 'running';

  const isLR = direction === 'LR';
  const targetPos = isLR ? Position.Left : Position.Top;
  const sourcePos = isLR ? Position.Right : Position.Bottom;

  const targetHost =
    job?.target?.target_name ||
    (job?.target?.host
      ? `${job.target.username ? `${job.target.username}@` : ''}${job.target.host}`
      : null);

  const commandShort = job?.command
    ? job.command.length > 28
      ? `${job.command.slice(0, 26)}…`
      : job.command
    : null;

  const folderName = job?.folder || null;

  return (
    <div
      className={`rf-job-node rf-tone-${tone} ${selected ? 'is-selected' : ''} ${isHot ? 'is-hot' : ''} ${isDim ? 'is-dim' : ''}`}
      tabIndex={0}
      role="button"
      aria-label={`${id}: ${statusLabel}`}
    >
      <Handle
        type="target"
        position={targetPos}
        className="rf-handle rf-handle-target"
        isConnectable={false}
      />

      {/* Header: Status Pill + Metadata + Play Button */}
      <div className="rf-node-header">
        <span className={`rf-status-pill rf-pill-${tone}`}>
          <StatusIcon size={12} className={`rf-status-icon ${isRunning ? 'rf-spin' : ''}`} />
          <span>{statusLabel}</span>
        </span>

        <div className="rf-node-header-right">
          {isAllWorkflows && folderName ? (
            <span className="rf-node-folder" title={`Workflow: ${folderName}`}>
              {folderName}
            </span>
          ) : duration ? (
            <span className="rf-node-duration" title="Execution duration">
              <Clock size={10} />
              <span>{duration}</span>
            </span>
          ) : null}

          {/* Independent Play Button (only where simulated execution is offered) */}
          {onExecuteJob ? (
            <button
              type="button"
              className={`rf-play-btn ${isRunning ? 'is-running' : ''}`}
              disabled={isRunning || playDisabled}
              onClick={(e) => {
                e.stopPropagation();
                onExecuteJob?.(id, { simulateFailure: e.shiftKey || e.altKey });
              }}
              title={
                playTitle ||
                (isRunning
                  ? `${id} is currently running`
                  : `Execute ${id} and prerequisites (Shift+Click to test failure handling)`)
              }
              aria-label={`Execute ${id} and prerequisites`}
            >
              {isRunning || playBusy ? (
                <Loader2 size={11} className="rf-spin" />
              ) : (
                <Play size={11} fill="currentColor" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      {/* Title: Job Name */}
      <div className="rf-node-title" title={id}>
        {id}
      </div>

      {/* Metadata Row: Target / Command + Optional duration */}
      <div className="rf-node-meta">
        {targetHost ? (
          <span className="rf-meta-item rf-meta-target" title={`Target: ${targetHost}`}>
            <Server size={11} />
            <span>{targetHost}</span>
          </span>
        ) : commandShort ? (
          <span className="rf-meta-item rf-meta-cmd" title={`Command: ${job.command}`}>
            <Terminal size={11} />
            <code>{commandShort}</code>
          </span>
        ) : (
          <span className="rf-meta-item rf-meta-muted">Batch Job</span>
        )}
        {duration && isAllWorkflows ? (
          <span className="rf-node-duration rf-meta-duration" title="Execution duration">
            <Clock size={10} />
            <span>{duration}</span>
          </span>
        ) : null}
      </div>

      <Handle
        type="source"
        position={sourcePos}
        className="rf-handle rf-handle-source"
        isConnectable={false}
      />
    </div>
  );
}

export const JobNode = memo(JobNodeComponent);
export default JobNode;
