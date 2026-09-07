import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  RotateCcw,
  Users,
  ChevronDown,
  Lock,
  X,
  Power
} from 'lucide-react';
import { useAsync } from '@hooks/useAsync';
import { useAuth } from '@hooks/useAuth';
import { useDebounce } from '@hooks/useDebounce';
import { useToast } from '@hooks/useToast';
import { consultantService } from '@services/consultantService';
import { ConsultantCard, ConsultantCardSkeleton, ConsultantListSkeleton } from '@components/data-display/ConsultantCard/ConsultantCard';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { normalizeConsultant } from './utils';
import { ResetButton } from '@components/ui/ResetButton/ResetButton';

export function InactiveConsultants({ onEdit, onPassword, onDelete, onProfileView, onFilteredCountChange, designationsData, teamsData, inactiveData, isLoading, error, refetch, viewMode }) {
  const consultants = useMemo(() => {
    const list = Array.isArray(inactiveData) ? inactiveData : (inactiveData?.results || []);
    return list.map(c => normalizeConsultant(c, false));
  }, [inactiveData]);
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canActivateDeactivate = hasPermission('EMPLOYEE_ACTIVATE_DEACTIVATE');

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
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
    const q = debouncedSearchQuery.toLowerCase();
    return inactiveConsultants.filter((c) => {
      return (
        (c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.userId.toLowerCase().includes(q)) &&
        (selectedTeam === 'All Teams' || c.team === selectedTeam) &&
        (selectedDesignation === 'All Designations' || c.designation === selectedDesignation)
      );
    });
  }, [inactiveConsultants, debouncedSearchQuery, selectedTeam, selectedDesignation]);

  useEffect(() => {
    if (onFilteredCountChange) {
      onFilteredCountChange(filtered.length);
      return () => onFilteredCountChange(null);
    }
  }, [filtered.length, onFilteredCountChange]);

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

  if (isLoading && !inactiveData) {
    if (viewMode === 'list') {
      return (
        <div className="consultants-grid-scrollable">
          <ConsultantListSkeleton actionsCount={1} />
        </div>
      );
    }
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
          </div>
        </div>
      </div>
      
      {/* Standalone loader removed to prevent layout shift */}

      {viewMode === 'card' ? (
        <div className="consultants-grid-scrollable">
          <div className="consultants-grid">
            {filtered.map((c) => (
              <ConsultantCard
                key={c.id}
                consultant={c}
                isInactive={true}
                isActivating={activatingId === (c.emp_id || c.id)}
                onActivate={canActivateDeactivate ? handleActivate : undefined}
                onAvatarClick={() => onProfileView && onProfileView(c.id)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="consultants-grid-scrollable">
          <table className="consultants-list-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Name</th>
                <th>Employee ID</th>
                <th>Role</th>
                <th>Designation</th>
                <th>Team</th>
                <th>Email</th>
                <th>Mobile</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                    <img
                      src={c.photo || 'https://static.vecteezy.com/system/resources/previews/024/766/958/non_2x/default-male-avatar-profile-icon-social-media-user-free-vector.jpg'}
                      alt={c.name}
                      className="list-view-avatar"
                      onClick={() => onProfileView && onProfileView(c.id)}
                      style={{ cursor: 'pointer', display: 'block', margin: '0 auto' }}
                    />
                  </td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.userId}</td>
                  <td>{c.role}</td>
                  <td>{c.designation}</td>
                  <td>{c.team}</td>
                  <td>{c.email}</td>
                  <td>{c.mobile}</td>
                  <td>
                    <span className={`list-view-status ${c.accountStatus?.toLowerCase() || 'inactive'}`}>
                      {c.accountStatus || 'inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {canActivateDeactivate && handleActivate && (
                      <button
                        onClick={() => handleActivate(c)}
                        className="consultant-footer-btn consultant-footer-btn-activate"
                        title="Activate Consultant"
                        disabled={activatingId === (c.emp_id || c.id)}
                        style={{ width: '28px', height: '28px', padding: 0, minWidth: 'auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        {activatingId === (c.emp_id || c.id) ? (
                          <span className="spin-animation" style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid var(--c-success)', borderTopColor: 'transparent', borderRadius: '50%' }} />
                        ) : (
                          <Power size={14} className="consultant-footer-btn-icon" />
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
