import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  RotateCcw,
  Plus,
  Users,
  ChevronDown,
  Lock,
  X
} from 'lucide-react';
import { useAsync } from '@hooks/useAsync';
import { useDebounce } from '@hooks/useDebounce';
import { consultantService } from '@services/consultantService';
import { ConsultantCard, ConsultantCardSkeleton } from '@components/data-display/ConsultantCard/ConsultantCard';
import { ConsultantsStats } from '@components/data-display/ConsultantsStats/ConsultantsStats';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { normalizeConsultant } from './utils';
import { ResetButton } from '@components/ui/ResetButton/ResetButton';

export function ActiveConsultants({ onAdd, onEdit, onPassword, onDelete, onProfileView, onFilteredCountChange, employeesData, designationsData, teamsData, isLoading, error, refetch }) {
  const activeConsultants = useMemo(() => {
    const list = Array.isArray(employeesData) ? employeesData : employeesData?.results || [];
    return list.map(c => normalizeConsultant(c, true));
  }, [employeesData]);

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [selectedTeam, setSelectedTeam] = useState('All Teams');
  const [selectedDesignation, setSelectedDesignation] = useState('All Designations');
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showDesignationDropdown, setShowDesignationDropdown] = useState(false);

  const teamRef = useRef(null);
  const designRef = useRef(null);

  useEffect(() => {
    const handle = (e) => {
      if (teamRef.current && !teamRef.current.contains(e.target)) setShowTeamDropdown(false);
      if (designRef.current && !designRef.current.contains(e.target))
        setShowDesignationDropdown(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const teams = useMemo(() => {
    if (teamsData && teamsData.length > 0) return teamsData.map(t => t.name);
    return Array.from(new Set(activeConsultants.map(c => c.team).filter(Boolean)));
  }, [activeConsultants, teamsData]);

  const designations = useMemo(() => {
    if (designationsData && designationsData.length > 0) return designationsData.map(d => d.name || d.designation).filter(Boolean);
    return Array.from(new Set(activeConsultants.map(c => c.designation).filter(Boolean)));
  }, [activeConsultants, designationsData]);

  const filtered = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase();
    return activeConsultants.filter((c) => {
      return (
        (c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.userId.toLowerCase().includes(q)) &&
        (selectedTeam === 'All Teams' || c.team === selectedTeam) &&
        (selectedDesignation === 'All Designations' || c.designation === selectedDesignation)
      );
    });
  }, [activeConsultants, debouncedSearchQuery, selectedTeam, selectedDesignation]);



  const filteredTeamsCount = useMemo(() => {
    return new Set(filtered.map(c => c.team).filter(Boolean)).size;
  }, [filtered]);

  const filteredDesignationsCount = useMemo(() => {
    return new Set(filtered.map(c => c.designation).filter(Boolean)).size;
  }, [filtered]);

  useEffect(() => {
    if (onFilteredCountChange) {
      onFilteredCountChange(filtered.length);
      return () => onFilteredCountChange(null);
    }
  }, [filtered.length, onFilteredCountChange]);

  if (error) {
    return (
      <ErrorState
        title="Consultants could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading && activeConsultants.length === 0) {
    return (
      <div className="consultants-grid-scrollable">
        <div className="consultants-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <ConsultantCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <ConsultantsStats
        total={filtered.length}
        active={filtered.length}
        teams={filteredTeamsCount}
        designations={filteredDesignationsCount}
      />
      <div className="consultants-filter-panel-sticky">
        <div className="consultants-filter-row">
          <div className="consultants-search-wrapper">
            <Search className="consultants-search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              className="consultants-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
              name="search_consultants_filter"
              id="consultants-search-field"
              data-form-type="other"
              style={{ paddingRight: '32px' }} />
            {searchQuery && (
              <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
          <div className="consultants-filter-group">
            <div className="consultants-dropdown-wrapper" ref={teamRef}>
              <button
                className="consultants-dropdown-trigger"
                data-active={selectedTeam !== 'All Teams'}
                onClick={() => setShowTeamDropdown((v) => !v)}
              >
                <Users className="consultants-dropdown-icon" />
                <span className="consultants-dropdown-label">{selectedTeam}</span>
                <ChevronDown className="consultants-dropdown-chevron" />
              </button>
              {showTeamDropdown && (
                <div className="consultants-dropdown-menu">
                  {['All Teams', ...teams].map((t) => (
                    <button
                      key={t}
                      className="consultants-dropdown-item"
                      data-active={selectedTeam === t}
                      onClick={() => {
                        setSelectedTeam(t);
                        setShowTeamDropdown(false);
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="consultants-dropdown-wrapper" ref={designRef}>
              <button
                className="consultants-dropdown-trigger"
                data-active={selectedDesignation !== 'All Designations'}
                onClick={() => setShowDesignationDropdown((v) => !v)}
              >
                <Lock className="consultants-dropdown-icon" />
                <span className="consultants-dropdown-label">{selectedDesignation}</span>
                <ChevronDown className="consultants-dropdown-chevron" />
              </button>
              {showDesignationDropdown && (
                <div className="consultants-dropdown-menu">
                  {['All Designations', ...designations].map((d) => (
                    <button
                      key={d}
                      className="consultants-dropdown-item"
                      data-active={selectedDesignation === d}
                      onClick={() => {
                        setSelectedDesignation(d);
                        setShowDesignationDropdown(false);
                      }}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ResetButton
              onClick={() => {
                setSearchQuery('');
                setSelectedTeam('All Teams');
                setSelectedDesignation('All Designations');
              }}
            />
            {onAdd && (
              <button className="consultants-add-button" onClick={onAdd}>
                <Plus className="consultants-add-icon" />
                <span className="consultants-add-label">Add Consultant</span>
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="consultants-grid-scrollable">
        <div className="consultants-grid">
          {filtered.map((c) => (
            <ConsultantCard
              key={c.id}
              consultant={c}
              onEdit={onEdit ? () => onEdit(c) : undefined}
              onChangePassword={onPassword ? () => onPassword(c) : undefined}
              onDelete={onDelete ? () => onDelete(c) : undefined}
              onAvatarClick={() => onProfileView && onProfileView(c.id)}
            />
          ))}
        </div>
      </div>
      {filtered.length === 0 && (
        <div className="consultants-empty-state">
          <Users className="consultants-empty-icon" />
          <h3 className="consultants-empty-title">No consultants found</h3>
          <p className="consultants-empty-description">
            Try adjusting your search or filter criteria
          </p>
        </div>
      )}
    </>
  );
}
