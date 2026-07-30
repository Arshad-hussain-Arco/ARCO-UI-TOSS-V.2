import { useState, useCallback, useMemo, useEffect } from 'react';
import { Users, Briefcase, Mail, Phone, ChevronDown, Copy } from 'lucide-react';
import { useAsync } from '@hooks/useAsync';
import { consultantService } from '@services/consultantService';
import { ErrorState } from '@components/feedback/ErrorState/ErrorState';
import { Loader } from '@components/feedback/Loader/Loader';
import { normalizeConsultant } from './utils';
import { activatable } from '@utils/interactive';
import { useToast } from '@hooks/useToast';
import api from '@api/httpClient';
import endpoints from '@api/endpoints';
import { useAuth } from '@hooks/useAuth';
import './TeamsView.css';

const MOCK_AVATAR = (name) => `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=random`;

function EmployeeCard({ consultant, onClick }) {
  const toast = useToast();
  const isWfh = consultant.location?.toLowerCase().includes('home') || consultant.location?.toLowerCase().includes('wfh');
  const isLeave = consultant.accountStatus === 'leave';
  const statusClass = isLeave ? 'leave' : isWfh ? 'wfh' : 'active';

  const handleCopy = (e, text) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    toast.success('Employee ID copied');
  };

  return (
    <div className="tv-emp-card" {...activatable(() => onClick(consultant.id))}>
      <div className="tv-emp-avatar">
        <img src={consultant.avatar || MOCK_AVATAR(consultant.name)} alt={consultant.name} />
        <span className={`tv-emp-status-dot ${statusClass}`} />
      </div>
      <div className="tv-emp-info">
        <div className="tv-emp-name">{consultant.name}</div>
        <div className="tv-emp-meta">
          <div className="tv-emp-designation">{consultant.designation || consultant.role}</div>
          <div 
            className="tv-emp-id-copy" 
            onClick={(e) => handleCopy(e, consultant.userId || 'N/A')}
            onKeyDown={(e) => e.key === 'Enter' && handleCopy(e, consultant.userId || 'N/A')}
            role="button"
            tabIndex={0}
            title="Copy Employee ID"
          >
            <span className="tv-emp-id">{consultant.userId || 'N/A'}</span>
            <Copy size={12} className="copy-icon" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamAccordion({ team, isExpanded, onToggle, onProfileView, cache, setCache, headcountMap }) {
  const hc = headcountMap[team.id];
  const activeMembers = useMemo(() => {
    const list = hc?.members || hc?.employees || hc?.consultants || hc?.users || [];
    return list.map(c => normalizeConsultant(c, true));
  }, [hc]);

  const { manager, employees } = useMemo(() => {
    const mems = activeMembers;
    let mgr = mems.find(m => m.designation?.toLowerCase().includes('manager') || m.designation?.toLowerCase().includes('lead') || m.role?.toLowerCase().includes('manager'));
    if (!mgr && mems.length > 0) mgr = mems[0];
    const emps = mgr ? mems.filter(m => m.id !== mgr.id) : mems;
    return { manager: mgr, employees: emps };
  }, [activeMembers]);

  // Use live headcount data if available, otherwise fall back to member list count
  const displayTotal = hc ? hc.total : activeMembers.length;

  const priDev = parseFloat(team.pri_dev_contr_per || 0).toFixed(1);
  const addDev = parseFloat(team.add_dev_contr_per || 0).toFixed(1);

  return (
    <div className={`tv-accordion ${isExpanded ? 'expanded' : ''}`}>
      <div className="tv-accordion-header" {...activatable(onToggle)}>
        <div className="tv-ah-left">
          <div className="tv-ah-icon">
            <Briefcase size={20} />
          </div>
          <div className="tv-ah-title">
            <h3>{team.name || team.team_name}</h3>
            <span>{displayTotal} Members</span>
          </div>
        </div>
        <div className="tv-ah-right">
          <div className="tv-ah-progress-group">
            <div className="tv-ah-progress-label">
              <span>Primary Dev Contribution</span>
              <strong>{priDev}%</strong>
            </div>
            <div className="tv-ah-progress-bar">
              <div className="tv-ah-progress-fill pri" style={{ width: `${priDev}%` }} />
            </div>
          </div>
          <div className="tv-ah-progress-group">
            <div className="tv-ah-progress-label">
              <span>Additional Dev Contribution</span>
              <strong>{addDev}%</strong>
            </div>
            <div className="tv-ah-progress-bar">
              <div className="tv-ah-progress-fill add" style={{ width: `${addDev}%` }} />
            </div>
          </div>
          <ChevronDown size={20} className={`tv-ah-chevron ${isExpanded ? 'open' : ''}`} />
        </div>
      </div>

      {isExpanded && (
        <div className="tv-accordion-body">
          <div className="tv-body-content">
              {activeMembers.length > 0 && (
                <div className="tv-members-section">
                  <h4 className="tv-section-title">TEAM MEMBERS</h4>
                  <div className="tv-members-grid">
                    {activeMembers.map(emp => (
                      <EmployeeCard key={emp.id} consultant={emp} onClick={onProfileView} />
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamsView({ onProfileView }) {
  const { user } = useAuth();

  const fetchTeams = useCallback(async () => {
    const res = await consultantService.getTeams();
    return Array.isArray(res) ? res : res?.results || [];
  }, []);

  const fetchHeadcount = useCallback(async () => {
    if (!user?.emp_id) return [];
    const dateStr = new Date().toISOString().split('T')[0];
    const res = await api.get(endpoints.manager.departmentAttendance, {
      params: { date: dateStr }
    });
    const payload = res.data?.data || res.data;
    return Array.isArray(payload) ? payload : (payload?.results || []);
  }, [user?.emp_id]);

  const { data: teams, isLoading, error, refetch } = useAsync(fetchTeams);
  const { data: headcountData } = useAsync(fetchHeadcount);

  // Build a fast lookup: team_id -> headcount object
  const headcountMap = useMemo(() => {
    if (!headcountData) return {};
    return headcountData.reduce((acc, hc) => {
      acc[hc.team_id] = hc;
      return acc;
    }, {});
  }, [headcountData]);

  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [teamMembersCache, setTeamMembersCache] = useState({});

  if (error) {
    return <ErrorState title="Teams could not be loaded" description={error.message} onRetry={refetch} />;
  }

  if (isLoading && !teams) {
    return <Loader message="Loading teams..." />;
  }

  const teamsData = teams || [];

  const handleCardClick = (teamId) => {
    setExpandedTeamId(teamId === expandedTeamId ? null : teamId);
    setTimeout(() => {
      const el = document.getElementById(`team-acc-${teamId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="teams-tab-container">
      {/* Top Summary Cards */}
      <div className="tv-summary-strip">
        {teamsData.map((team) => {
          const isActive = expandedTeamId === team.id;
          const hc = headcountMap[team.id];
          return (
            <div 
              key={team.id} 
              className={`tv-summary-card ${isActive ? 'active' : ''}`}
              {...activatable(() => handleCardClick(team.id), { isPressed: isActive })}
            >
              <div className="tv-sc-header">
                <span className="tv-sc-name">{team.name || team.team_name}</span>
                <Users size={16} className={isActive ? 'text-brand' : 'text-gray-400'} />
              </div>
              <div className="tv-sc-stats">
                <div className="tv-sc-stat">
                  <span className="tv-sc-val">{hc ? hc.active : '--'}</span>
                  <span className="tv-sc-lbl">Active</span>
                </div>
                <div className="tv-sc-stat">
                  <span className="tv-sc-val leave">{hc ? hc.on_leave : '--'}</span>
                  <span className="tv-sc-lbl">On Leave</span>
                </div>
                <div className="tv-sc-stat">
                  <span className="tv-sc-val wfh">{hc ? hc.wfh : '--'}</span>
                  <span className="tv-sc-lbl">WFH</span>
                </div>
                <div className="tv-sc-stat total">
                  <span className="tv-sc-val">{hc ? hc.total : (team.members_count || '--')}</span>
                  <span className="tv-sc-lbl">Total</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Accordions */}
      <div className="tv-accordions-list">
        {teamsData.map((team) => (
          <div key={team.id} id={`team-acc-${team.id}`} className="tv-accordion-wrapper">
            <TeamAccordion 
              team={team} 
              isExpanded={expandedTeamId === team.id}
              onToggle={() => handleCardClick(team.id)}
              onProfileView={onProfileView}
              cache={teamMembersCache}
              setCache={setTeamMembersCache}
              headcountMap={headcountMap}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

