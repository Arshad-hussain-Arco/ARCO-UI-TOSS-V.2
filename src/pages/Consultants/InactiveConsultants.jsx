import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  RotateCcw,
  Users,
  ChevronDown,
  Lock,
} from 'lucide-react';
import { useAsync } from '@hooks/useAsync';
import { useToast } from '@hooks/useToast';
import { consultantService } from '@services/consultantService';
import { ConsultantCard, ConsultantCardSkeleton } from '@components/data-display/ConsultantCard/ConsultantCard';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { normalizeConsultant } from './utils';

export function InactiveConsultants({ onEdit, onPassword, onDelete, onProfileView, designationsData, teamsData }) {
  const fetchInactive = useCallback(async () => {
    const res = await consultantService.getInactiveConsultants();
    const list = Array.isArray(res) ? res : res?.results || [];
    return list.map(c => normalizeConsultant(c, false));
  }, []);

  const { data: consultants, isLoading, error, refetch } = useAsync(fetchInactive);
  const toast = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('All Teams');
  const [selectedDesignation, setSelectedDesignation] = useState('All Designations');
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [showDesignationDropdown, setShowDesignationDropdown] = useState(false);
  const [activatingId, setActivatingId] = useState(null);

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

  const inactiveConsultants = consultants || [];

  const teams = useMemo(() => {
    if (teamsData && teamsData.length > 0) return teamsData.map(t => t.name);
    return Array.from(new Set(inactiveConsultants.map(c => c.team).filter(Boolean)));
  }, [inactiveConsultants, teamsData]);

  const designations = useMemo(() => {
    if (designationsData && designationsData.length > 0) return designationsData.map(d => d.name || d.designation).filter(Boolean);
    return Array.from(new Set(inactiveConsultants.map(c => c.designation).filter(Boolean)));
  }, [inactiveConsultants, designationsData]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return inactiveConsultants.filter((c) => {
      return (
        (c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.userId.toLowerCase().includes(q)) &&
        (selectedTeam === 'All Teams' || c.team === selectedTeam) &&
        (selectedDesignation === 'All Designations' || c.designation === selectedDesignation)
      );
    });
  }, [inactiveConsultants, searchQuery, selectedTeam, selectedDesignation]);

  const handleActivate = async (consultant) => {
    setActivatingId(consultant.id);
    try {
      await consultantService.activateConsultant({ emp_id: consultant.emp_id || consultant.id });
      toast.success(`${consultant.name} has been activated successfully.`);
      refetch();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to activate consultant');
    } finally {
      setActivatingId(null);
    }
  };

  if (error) {
    return (
      <ErrorState
        title="Inactive Consultants could not be loaded"
        description={error.message}
        onRetry={refetch}
      />
    );
  }

  if (isLoading && !consultants) {
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
      <div className="consultants-filter-panel-sticky" style={{ marginTop: '16px' }}>
        <div className="consultants-filter-row">
          <div className="consultants-search-wrapper">
            <Search className="consultants-search-icon" />
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              className="consultants-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
            <button
              className="consultants-reset-button"
              onClick={() => {
                setSearchQuery('');
                setSelectedTeam('All Teams');
                setSelectedDesignation('All Designations');
              }}
            >
              <RotateCcw className="consultants-reset-icon" />
            </button>
          </div>
        </div>
      </div>
      
      {activatingId && (
        <div style={{ padding: '8px 16px', color: 'var(--c-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-light)' }}>
          <Loader message="Activating consultant..." inline={true} />
        </div>
      )}

      <div className="consultants-grid-scrollable">
        <div className="consultants-grid">
          {filtered.map((c) => (
            <ConsultantCard
              key={c.id}
              consultant={c}
              isInactive={true}
              onActivate={handleActivate}
              onAvatarClick={() => onProfileView && onProfileView(c.id)}
            />
          ))}
        </div>
      </div>
      {filtered.length === 0 && (
        <div className="consultants-empty-state">
          <Users className="consultants-empty-icon" />
          <h3 className="consultants-empty-title">No inactive consultants found</h3>
          <p className="consultants-empty-description">
            There are no inactive consultants matching your criteria.
          </p>
        </div>
      )}
    </>
  );
}
