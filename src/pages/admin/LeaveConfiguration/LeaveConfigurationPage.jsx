import { useCallback, useMemo, useState } from 'react';
import {
  Briefcase,
  Calendar,
  Clock,
  Download,
  History,
  Settings2,
  TrendingUp,
  Users,
} from 'lucide-react';

import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { SearchInput } from '@components/forms/SearchInput/SearchInput';
import { useAsync } from '@hooks/useAsync';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useToast } from '@hooks/useToast';
import { leaveConfigurationService } from '@services/leaveConfigurationService';

import { TeamAllocationSection } from './TeamAllocationSection';
import { useAllocationEditor } from './useAllocationEditor';
import './LeaveConfigurationPage.css';

const SEARCH_CLASS_NAMES = {
  wrapper: 'lc-search-wrapper',
  icon: 'lc-search-icon',
  input: 'lc-search-input',
};

/** Banner `iconKey` → icon component and its modifier class. */
const SUMMARY_ICONS = {
  briefcase: { icon: Briefcase, className: 'carry-over' },
  clock: { icon: Clock, className: 'comp-off' },
  calendar: { icon: Calendar, className: 'weekend' },
  trending: { icon: TrendingUp, className: 'utilization' },
};

const ALL_TEAMS = 'All';

/** Admin screen for reviewing and editing per-consultant leave allocations. */
export function LeaveConfigurationPage() {
  useDocumentTitle('Leave Configuration');

  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState(ALL_TEAMS);
  const [collapsedTeamIds, setCollapsedTeamIds] = useState(() => new Set());

  const fetchConfiguration = useCallback(() => leaveConfigurationService.getConfiguration(), []);
  const { data, isLoading, error, refetch, setData } = useAsync(fetchConfiguration);

  const teams = useMemo(() => data?.teams ?? [], [data]);
  const summary = data?.summary ?? [];

  /**
   * Persists the edit, then patches the loaded data in place so the card leaves
   * edit mode showing the saved values without a full refetch.
   */
  const persistMetrics = useCallback(
    async ({ teamId, consultantId, metrics }) => {
      await leaveConfigurationService.updateConsultantMetrics({ teamId, consultantId, metrics });

      setData((current) => ({
        ...current,
        teams: current.teams.map((team) =>
          team.id !== teamId
            ? team
            : {
                ...team,
                consultants: team.consultants.map((consultant) =>
                  consultant.id !== consultantId ? consultant : { ...consultant, metrics },
                ),
              },
        ),
      }));

      toast.success('Configuration updated');
    },
    [setData, toast],
  );

  const editor = useAllocationEditor(persistMetrics);

  const toggleTeam = useCallback((teamId) => {
    setCollapsedTeamIds((current) => {
      const next = new Set(current);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setTeamFilter(ALL_TEAMS);
  }, []);

  /** Teams keep only the consultants matching the filters; empty teams drop out. */
  const filteredTeams = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();

    return teams.reduce((visible, team) => {
      if (teamFilter !== ALL_TEAMS && team.name !== teamFilter) return visible;

      const consultants =
        needle === ''
          ? team.consultants
          : team.consultants.filter((consultant) => consultant.name.toLowerCase().includes(needle));

      if (consultants.length > 0) visible.push({ ...team, consultants });
      return visible;
    }, []);
  }, [teams, teamFilter, searchQuery]);

  if (error) {
    return (
      <ErrorState
        title="Leave configuration could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading || !data) {
    return <Loader message="Loading leave configuration…" />;
  }

  return (
    <div className="leave-configuration-modern">
      <div className="lc-header">
        <div className="lc-title-group">
          <h2>Leave Configuration</h2>
          <div className="lc-breadcrumb">
            <span>Home</span> / <span>Administration</span> /{' '}
            <span className="active">Leave Config</span>
          </div>
        </div>

        <div className="lc-header-actions">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Filter by name..."
            classNames={SEARCH_CLASS_NAMES}
          />

          <div className="lc-action-buttons">
            <button type="button" className="lc-action-btn" title="View History">
              <History size={16} aria-hidden="true" />
            </button>
            <button type="button" className="lc-action-btn" title="Export CSV">
              <Download size={16} aria-hidden="true" />
            </button>
            <button type="button" className="lc-bulk-btn">
              <Settings2 size={14} aria-hidden="true" />
              <span>Bulk Action</span>
            </button>
          </div>
        </div>
      </div>

      <div className="lc-metrics-banner">
        {summary.map((stat) => {
          const config = SUMMARY_ICONS[stat.iconKey];
          const Icon = config?.icon;

          return (
            <div key={stat.id} className="lc-stat-card">
              <div className={`stat-icon ${config?.className ?? ''}`}>
                {Icon ? <Icon size={16} aria-hidden="true" /> : null}
              </div>
              <div className="stat-content">
                <span className="stat-label">{stat.label}</span>
                <span className="stat-value">{stat.value}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="lc-content-container">
        {filteredTeams.length === 0 ? (
          <div className="lc-empty-state">
            <Users size={48} className="empty-icon" aria-hidden="true" />
            <h3>No Records Found</h3>
            <p>We couldn&apos;t find any consultants matching your current filter criteria.</p>
            <button type="button" className="lc-reset-btn" onClick={resetFilters}>
              Reset Filters
            </button>
          </div>
        ) : (
          filteredTeams.map((team) => (
            <TeamAllocationSection
              key={team.id}
              team={team}
              isExpanded={!collapsedTeamIds.has(team.id)}
              onToggle={() => toggleTeam(team.id)}
              editor={editor}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default LeaveConfigurationPage;
