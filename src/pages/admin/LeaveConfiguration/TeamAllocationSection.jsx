import { memo } from 'react';
import { ChevronDown, Plus, Users } from 'lucide-react';

import { AllocationCard } from './AllocationCard';

/**
 * One collapsible team block containing its consultants' allocation cards.
 *
 * @param {Object} props
 * @param {{ id: string, name: string, stats: Object, consultants: Array }} props.team
 * @param {boolean} props.isExpanded
 * @param {() => void} props.onToggle
 * @param {Object} props.editor  Result of useAllocationEditor.
 */
function TeamAllocationSectionComponent({ team, isExpanded, onToggle, editor }) {
  const panelId = `lc-team-panel-${team.id}`;

  return (
    <div className="lc-team-section" data-expanded={isExpanded}>
      <button
        type="button"
        className="lc-team-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={panelId}
      >
        <div className="lc-team-main">
          <ChevronDown
            size={18}
            className="lc-chevron"
            data-expanded={isExpanded}
            aria-hidden="true"
          />
          <div className="lc-team-badge">
            <Users size={14} aria-hidden="true" />
            <span>{team.name}</span>
          </div>
          <span className="lc-team-count">{team.consultants.length} members</span>
        </div>

        <div className="lc-team-stats-visual">
          <div className="lc-stat-mini">
            <span className="mini-label">CO</span>
            <span className="mini-value">{team.stats.avgCarryOver}d</span>
          </div>
          <div className="lc-stat-mini">
            <span className="mini-label">COMP</span>
            <span className="mini-value">{team.stats.totalCompOff}d</span>
          </div>
          <div className="lc-utilization-bar">
            <div className="util-fill" style={{ width: `${team.stats.teamUtilization}%` }} />
          </div>
        </div>
      </button>

      {isExpanded ? (
        <div className="lc-consultant-grid" id={panelId}>
          {team.consultants.map((consultant) => (
            <AllocationCard
              key={consultant.id}
              consultant={consultant}
              isEditing={editor.editingId === consultant.id}
              isSaving={editor.isSaving}
              draft={editor.draft}
              onStartEditing={() => editor.startEditing(consultant)}
              onCancel={editor.cancel}
              onSave={() => editor.save(team.id, consultant.id)}
              onChangeField={editor.changeField}
            />
          ))}

          <button type="button" className="lc-add-card-btn">
            <Plus size={16} aria-hidden="true" />
            <span>Quick Add</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export const TeamAllocationSection = memo(TeamAllocationSectionComponent);
export default TeamAllocationSection;
