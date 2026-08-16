import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Users, Briefcase, ChevronDown, Copy, Plus, Edit, Trash, ChevronLeft, ChevronRight, Loader2, Search, X, RotateCcw } from 'lucide-react';
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
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import { useDebounce } from '@hooks/useDebounce';
import { Select } from '@components/forms/Select/Select';
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
    toast.success('Username copied');
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
            title="Copy Username"
          >
            <span className="tv-emp-id">{consultant.userId || 'N/A'}</span>
            <Copy size={12} className="copy-icon" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamAccordion({ team, isExpanded, onToggle, onProfileView, cache, setCache, headcountMap, onEdit, onDelete, employeesData }) {
  const [memberSearch, setMemberSearch] = useState('');
  const hc = headcountMap[team.id];
  const activeMembers = useMemo(() => {
    const list = hc?.members || hc?.employees || hc?.consultants || hc?.users || [];
    return list.map(c => {
      const norm = normalizeConsultant(c, true);
      if (employeesData) {
        const fullList = Array.isArray(employeesData) ? employeesData : (employeesData.results || []);
        const fullEmp = fullList.find(e => String(e.emp_id || e.id) === String(norm.id));
        if (fullEmp && (fullEmp.user_name || fullEmp.username || fullEmp.userId)) {
          norm.userId = fullEmp.user_name || fullEmp.username || fullEmp.userId;
        }
      }
      return norm;
    });
  }, [hc, employeesData]);

  const filteredActiveMembers = useMemo(() => {
    if (!memberSearch.trim()) return activeMembers;
    const lower = memberSearch.toLowerCase();
    return activeMembers.filter(m => 
      (m.name || '').toLowerCase().includes(lower) || 
      (m.designation || m.role || '').toLowerCase().includes(lower)
    );
  }, [activeMembers, memberSearch]);

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
        <div className="tv-ah-left" style={{ flexShrink: 0 }}>
          <div className="tv-ah-icon">
            <Briefcase size={20} />
          </div>
          <div className="tv-ah-title" style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <h3>{team.name || team.team_name}</h3>
            <span>{displayTotal} Members</span>
          </div>
        </div>
        
        <div className="tv-ah-progress-container" style={{ display: 'flex', gap: '32px', marginLeft: 'auto', marginRight: '32px' }}>
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
        </div>

        <div className="tv-ah-right">
          <div className="tv-ah-actions" style={{ display: 'flex', gap: '8px' }}>
            <button
              className="action-icon-btn edit"
              title="Edit Team"
              onClick={(e) => { e.stopPropagation(); onEdit(team); }}
            >
              <Edit size={16} />
            </button>
            <button
              className="action-icon-btn delete"
              title="Delete Team"
              onClick={(e) => { e.stopPropagation(); onDelete(team); }}
            >
              <Trash size={16} />
            </button>
          </div>

          <ChevronDown size={20} className={`tv-ah-chevron ${isExpanded ? 'open' : ''}`} style={{ marginLeft: '16px' }} />
        </div>
      </div>

      {isExpanded && (
        <div className="tv-accordion-body">
          <div className="tv-body-content">
            {activeMembers.length > 0 && (
              <div className="tv-members-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h4 className="tv-section-title" style={{ margin: 0 }}>TEAM MEMBERS</h4>
                  <div className="tv-search-wrap" style={{ margin: 0, position: 'relative' }}>
                    <Search size={13} className="tv-search-icon" />
                    <input
                      type="text"
                      placeholder="Search members..."
                      className="tv-search-input"
                      value={memberSearch}
                      onChange={e => setMemberSearch(e.target.value)}
                      style={{ paddingRight: '32px' }}
                    />
                    {memberSearch && (
                      <button type="button" className="search-clear-btn" onClick={() => setMemberSearch('')} style={{ position: 'absolute', right: '8px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="tv-members-grid">
                  {filteredActiveMembers.map(emp => (
                    <EmployeeCard key={emp.id} consultant={emp} onClick={onProfileView} />
                  ))}
                </div>
                {filteredActiveMembers.length === 0 && (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No members found matching "{memberSearch}"
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TeamsView({ onProfileView, onTeamChanged, employeesData }) {
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
  const toast = useToast();
  const stripRef = useRef(null);

  const scrollStrip = (dir) => {
    if (stripRef.current) {
      stripRef.current.scrollBy({ left: dir * 300, behavior: 'smooth' });
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedTeam, setSelectedTeam] = useState('all');

  const [showSlider, setShowSlider] = useState(false);
  useEffect(() => {
    const checkOverflow = () => {
      if (stripRef.current) {
        setShowSlider(stripRef.current.scrollWidth > stripRef.current.clientWidth);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    // Slight delay in case images/fonts load
    setTimeout(checkOverflow, 100);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [teams, selectedTeam, debouncedSearch]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [form, setForm] = useState({ name: '', pri_dev_contr_per: '', add_dev_contr_per: '' });
  const [formErrors, setFormErrors] = useState({});
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const openAddModal = () => {
    setEditingTeam(null);
    setForm({ name: '', pri_dev_contr_per: '', add_dev_contr_per: '' });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const openEditModal = (team) => {
    setEditingTeam(team);
    setForm({
      name: team.name || team.team_name || '',
      pri_dev_contr_per: team.pri_dev_contr_per || '',
      add_dev_contr_per: team.add_dev_contr_per || ''
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleSaveTeam = async () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Team Name is required';
    if (form.pri_dev_contr_per === '') errors.pri_dev_contr_per = 'Primary Contribution is required';
    if (form.add_dev_contr_per === '') errors.add_dev_contr_per = 'Additional Contribution is required';
    const pri = parseFloat(form.pri_dev_contr_per);
    const add = parseFloat(form.add_dev_contr_per);
    if (form.pri_dev_contr_per !== '' && pri < 0) errors.pri_dev_contr_per = 'Cannot be negative';
    if (form.add_dev_contr_per !== '' && add < 0) errors.add_dev_contr_per = 'Cannot be negative';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        pri_dev_contr_per: pri,
        add_dev_contr_per: add
      };
      if (editingTeam) {
        await consultantService.updateTeam(editingTeam.id, payload);
        toast.success('Team updated successfully');
      } else {
        await consultantService.createTeam(payload);
        toast.success('Team added successfully');
      }
      setIsModalOpen(false);
      refetch();
      if (onTeamChanged) onTeamChanged();
    } catch (err) {
      console.error(err);
      toast.error('Failed to save team');
    } finally {
      setIsSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setIsSaving(true);
    try {
      await consultantService.deleteTeam(deleteTarget.id);
      toast.success('Team deleted successfully');
      setDeleteTarget(null);
      refetch();
      if (onTeamChanged) onTeamChanged();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete team');
    } finally {
      setIsSaving(false);
    }
  };

  const teamsData = teams || [];

  const dynamicTeamOptions = useMemo(() => {
    const options = teamsData.map(t => ({
      value: t.id,
      label: t.name || t.team_name || 'Unnamed Team'
    }));
    return [{ value: 'all', label: 'All Teams' }, ...options];
  }, [teamsData]);

  const filteredTeams = useMemo(() => {
    let result = teamsData;
    if (selectedTeam !== 'all') {
      result = result.filter(t => t.id === selectedTeam);
    }
    if (debouncedSearch) {
      const lowerSearch = debouncedSearch.toLowerCase();
      result = result.filter(t => {
        const teamName = (t.name || t.team_name || '').toLowerCase();
        return teamName.includes(lowerSearch);
      });
    }
    return result;
  }, [teamsData, selectedTeam, debouncedSearch]);

  if (error) {
    return <ErrorState title="Teams could not be loaded" description={error.message} onRetry={refetch} />;
  }

  if (isLoading && !teams) {
    return <Loader message="Loading teams..." />;
  }

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
      {/* Top Actions: Search, Filter, Add */}
      <div className="teams-tab-actions-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Dropdown */}
          <Select
            value={selectedTeam}
            onChange={setSelectedTeam}
            options={dynamicTeamOptions}
            width="190px"
          />
          {/* Search */}
          <div className="tv-search-wrap" style={{ margin: 0, position: 'relative' }}>
            <Search size={13} className="tv-search-icon" />
            <input
              type="text"
              placeholder="Search team…"
              className="tv-search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingRight: '32px' }}
            />
            {searchQuery && (
              <button type="button" className="search-clear-btn" onClick={() => setSearchQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            className="consultants-add-button" 
            onClick={() => { setSelectedTeam('all'); setSearchQuery(''); setExpandedTeamId(null); }}
            style={{ background: 'var(--surface-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-secondary)' }}
          >
            <RotateCcw size={16} />
            <span>Reset</span>
          </button>
          <button className="consultants-add-button" onClick={openAddModal}>
            <Plus size={16} />
            <span>Add Team</span>
          </button>
        </div>
      </div>

      {/* Top Summary Cards */}
      {!expandedTeamId && (
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {showSlider && (
            <button
              onClick={() => scrollStrip(-1)}
            className="tv-slider-btn"
            style={{ position: 'absolute', left: '-14px', zIndex: 2, background: 'var(--surface-primary)', border: '1px solid var(--border-secondary)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
          >
            <ChevronLeft size={18} />
          </button>
        )}

        <div className="tv-summary-strip" ref={stripRef} style={{ overflowX: 'auto', scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {filteredTeams.map((team) => {
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

          {showSlider && (
            <button
              onClick={() => scrollStrip(1)}
              className="tv-slider-btn"
              style={{ position: 'absolute', right: '-14px', zIndex: 2, background: 'var(--surface-primary)', border: '1px solid var(--border-secondary)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
      )}

      {/* Accordions */}
      <div className="tv-accordions-list">
        {filteredTeams.map((team) => (
          <div key={team.id} id={`team-acc-${team.id}`} className="tv-accordion-wrapper">
            <TeamAccordion
              team={team}
              isExpanded={expandedTeamId === team.id}
              onToggle={() => handleCardClick(team.id)}
              onProfileView={onProfileView}
              cache={teamMembersCache}
              setCache={setTeamMembersCache}
              headcountMap={headcountMap}
              onEdit={openEditModal}
              onDelete={setDeleteTarget}
              employeesData={employeesData}
            />
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      <AdminModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeam ? 'Edit Team' : 'Add Team'}
        size="md"
        footer={
          <>
            <button
              type="button"
              className="tv-btn cancel"
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tv-btn save"
              style={{ gap: '6px' }}
              onClick={handleSaveTeam}
              disabled={isSaving}
            >
              {isSaving ? <><Loader2 size={16} className="spin-animation" /> Saving...</> : (editingTeam ? 'Update' : 'Add Team')}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Team Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => { setForm({ ...form, name: e.target.value }); setFormErrors(prev => ({ ...prev, name: '' })); }}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${formErrors.name ? 'var(--c-danger)' : 'var(--border-secondary)'}`, outline: 'none' }}
            />
            {formErrors.name && <p style={{ color: 'var(--c-danger)', fontSize: '12px', marginTop: '4px' }}>{formErrors.name}</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Primary Developer Contribution(%)</label>
            <input
              type="number"
              step="0.01"
              value={form.pri_dev_contr_per}
              onChange={(e) => { setForm({ ...form, pri_dev_contr_per: e.target.value }); setFormErrors(prev => ({ ...prev, pri_dev_contr_per: '' })); }}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${formErrors.pri_dev_contr_per ? 'var(--c-danger)' : 'var(--border-secondary)'}`, outline: 'none' }}
            />
            {formErrors.pri_dev_contr_per && <p style={{ color: 'var(--c-danger)', fontSize: '12px', marginTop: '4px' }}>{formErrors.pri_dev_contr_per}</p>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Additional Developer Contribution(%)</label>
            <input
              type="number"
              step="0.01"
              value={form.add_dev_contr_per}
              onChange={(e) => { setForm({ ...form, add_dev_contr_per: e.target.value }); setFormErrors(prev => ({ ...prev, add_dev_contr_per: '' })); }}
              style={{ width: '100%', padding: '8px', borderRadius: '6px', border: `1px solid ${formErrors.add_dev_contr_per ? 'var(--c-danger)' : 'var(--border-secondary)'}`, outline: 'none' }}
            />
            {formErrors.add_dev_contr_per && <p style={{ color: 'var(--c-danger)', fontSize: '12px', marginTop: '4px' }}>{formErrors.add_dev_contr_per}</p>}
          </div>
        </div>
      </AdminModal>

      {/* Confirm Delete Modal */}
      <AdminModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Confirm Deletion"
        size="sm"
        footer={
          <>
            <button
              type="button"
              className="tv-btn cancel"
              onClick={() => setDeleteTarget(null)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="tv-btn danger"
              style={{ gap: '6px' }}
              onClick={executeDelete}
              disabled={isSaving}
            >
              {isSaving ? <><Loader2 size={16} className="spin-animation" /> Deleting...</> : 'Delete'}
            </button>
          </>
        }
      >
        <div style={{ padding: '16px 0', fontSize: '14px', color: 'var(--text-primary)' }}>
          Are you sure you want to delete the team <strong>{deleteTarget?.name || deleteTarget?.team_name}</strong>?
        </div>
      </AdminModal>

    </div>
  );
}

