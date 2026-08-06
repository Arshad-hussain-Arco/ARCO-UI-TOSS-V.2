import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Upload,
  Eye,
  EyeOff,
  Key,
  User,
  Info,
  Trash2,
  Camera,
  Mail,
  Phone,
  Briefcase,
  Shield,
  RefreshCw,
  Lock,
  Plus,
  Loader2,
} from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { Image } from '@components/common/Image/Image';
import { Select } from '@components/forms/Select/Select';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { useAsync } from '@hooks/useAsync';
import { consultantService } from '@services/consultantService';

import { ActiveConsultants } from './ActiveConsultants';
import { InactiveConsultants } from './InactiveConsultants';
import { TeamsView } from './TeamsView';
import { ConsultantProfileModal } from './ConsultantProfileModal';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import './ConsultantsPage.css';

const pageTabs = [
  { id: 'consultants', label: 'Consultants' },
  { id: 'inactive', label: 'Inactive Consultants' },
  { id: 'teams', label: 'Teams' },
];

const emptyForm = {
  name: '',
  username: '',
  password: '',
  designation: '',
  team: '',
  joiningDate: '',
  mobile: '',
  email: '',
  landline: '',
  extension: '',
  address: '',
  role: '',
  webexId: '',
  includeInCp: false,
  visaNumber: '',
  visa: '',
  visaExpire: '',
  visaRenewal: '',
  nextVisaExit: '',
  location: 'On Site',
  remarks: '',
  manager: '',
  gender: '',
  physicalPcAvailable: '',
  computerName: '',
  computerLocation: '',
  computerLocationReference: '',
  accountStatus: 'active',
};

const STATIC_DESIGNATIONS = ['CEO', 'HR', 'Developer', 'Engineer', 'Manager'];
const STATIC_GENDERS = ['Male', 'Female', 'Other'];
const STATIC_STATUSES = ['active', 'inactive', 'pending'];

// A simple local component to avoid huge file sizes for Drawer sections
const EfSection = ({ label }) => (
  <div className="ef-section">
    <h4 className="ef-section-title">{label}</h4>
    <div className="ef-section-divider" />
  </div>
);

const EfField = ({ label, required, children, className = '' }) => (
  <div className={`ef-field ${className}`}>
    <label className="ef-label">
      {label} {required && <span className="ef-required">*</span>}
    </label>
    {children}
  </div>
);

const EfSwitchRow = ({ checked, onChange, label }) => (
  <div className={`ef-switch-row ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
    <span className="ef-switch-text">{label}</span>
    <div className="ef-switch-track">
      <div className="ef-switch-thumb" />
    </div>
  </div>
);

export function ConsultantsPage() {
  useDocumentTitle('Consultants');
  const toast = useToast();

  const fetchEmployees = useCallback(() => consultantService.getEmployeesList(), []);

  const {
    data: employeesData,
    refetch: loadEmployees,
    isLoading: isEmployeesLoading,
    error: employeesError,
    setData: setEmployeesData,
  } = useAsync(fetchEmployees, { immediate: true });

  const dynamicEmployees = employeesData?.results || employeesData || [];

  const fetchRoles = useCallback(() => consultantService.getRoles(), []);
  const { data: rolesData } = useAsync(fetchRoles, { immediate: true });
  const dynamicRoles = Array.isArray(rolesData)
    ? rolesData.map((r) => ({ id: r.id, name: r.role_name || r.name || String(r.id) }))
    : [];

  const fetchRefData = useCallback(() => consultantService.getDesignationsAndTeams(), []);
  const { data: refData, refetch: loadRefData } = useAsync(fetchRefData, { immediate: true });
  const fetchLocations = useCallback(() => consultantService.getLocations(), []);
  const { data: locationsData } = useAsync(fetchLocations, { immediate: true });
  const fetchCompLocations = useCallback(() => consultantService.getComputerLocations(), []);
  const { data: compLocationsData, refetch: loadCompLocations } = useAsync(fetchCompLocations, {
    immediate: true,
  });

  const dynamicDesignations = Array.isArray(refData)
    ? refData
    : refData?.results || refData?.designations || [];
  const dynamicTeams = Array.isArray(refData)
    ? refData.flatMap((d) => d.teams || [])
    : refData?.teams || [];
  const dynamicLocations = Array.isArray(locationsData)
    ? locationsData
    : locationsData?.results || [];
  const dynamicCompLocations = Array.isArray(compLocationsData)
    ? compLocationsData
    : compLocationsData?.results || [];

  const fetchInactive = useCallback(() => consultantService.getInactiveConsultants(), []);
  const { data: inactiveData } = useAsync(fetchInactive, { immediate: true });
  const inactiveCount = Array.isArray(inactiveData)
    ? inactiveData.length
    : inactiveData?.results?.length || 0;

  const [activeTab, setActiveTab] = useState('consultants');
  const [drawerMode, setDrawerMode] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formTab, setFormTab] = useState('consultant-info');
  const [editingTarget, setEditingTarget] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [viewProfileId, setViewProfileId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [passwordData, setPasswordData] = useState({ newPassword: '', confirmPassword: '' });

  const [isAddDesignationModalOpen, setIsAddDesignationModalOpen] = useState(false);
  const [newDesignationName, setNewDesignationName] = useState('');

  const [isAddComputerLocationModalOpen, setIsAddComputerLocationModalOpen] = useState(false);
  const [newComputerLocationName, setNewComputerLocationName] = useState('');

  const patch = (delta) => setFormData((p) => ({ ...p, ...delta }));

  const handleAddDesignation = async () => {
    if (!newDesignationName.trim()) {
      toast.error('Designation name is required');
      return;
    }
    try {
      await consultantService.createDesignation({ designation: newDesignationName.trim() });
      toast.success('Designation added successfully');
      setNewDesignationName('');
      setIsAddDesignationModalOpen(false);
      await loadRefData();
      patch({
        designation: newDesignationName.trim(),
        designation_name: newDesignationName.trim(),
      });
    } catch (error) {
      toast.error('Failed to add designation');
    }
  };

  const handleAddComputerLocation = async () => {
    if (!newComputerLocationName.trim()) {
      toast.error('Computer location name is required');
      return;
    }
    try {
      await consultantService.createComputerLocation({ name: newComputerLocationName.trim() });
      toast.success('Computer location added successfully');
      setNewComputerLocationName('');
      setIsAddComputerLocationModalOpen(false);
      await loadCompLocations();
      patch({
        computerLocation: newComputerLocationName.trim(),
        computer_location: newComputerLocationName.trim(),
      });
    } catch (error) {
      toast.error('Failed to add computer location');
    }
  };

  // Refetch the main list whenever we switch back to the consultants tab
  useEffect(() => {
    if (activeTab === 'consultants') {
      loadEmployees();
    }
  }, [activeTab, loadEmployees]);

  const openDrawer = (mode) => {
    setDrawerMode(mode);
    if (mode === 'add-edit') {
      if (!employeesData) loadEmployees();
    }
    requestAnimationFrame(() => setDrawerOpen(true));
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => {
      setDrawerMode(null);
      setEditingTarget(null);
      setFormTab('consultant-info');
      setShowPw(false);
      setShowPwConfirm(false);
      setPasswordData({ newPassword: '', confirmPassword: '' });
    }, 240);
  };

  const handleAdd = () => {
    setEditingTarget(null);
    setFormData({ ...emptyForm });
    openDrawer('add-edit');
  };

  const handleEdit = (c) => {
    setEditingTarget(c);
    setFormData({ ...c });
    openDrawer('add-edit');
  };

  const handlePw = (c) => {
    setEditingTarget(c);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    openDrawer('password');
  };

  const handleDelete = (c) => {
    setEditingTarget(c);
    openDrawer('delete');
  };

  const genPassword = () => {
    const pw = Math.random().toString(36).slice(-6).toUpperCase() + '!a1';
    if (drawerMode === 'password') setPasswordData((p) => ({ ...p, newPassword: pw }));
    else patch({ password: pw });
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      const rawBase64 = base64String.split(',')[1];
      patch({
        avatar: base64String,
        photoUploadBase64: rawBase64,
        photo: rawBase64,
        photoDeleteFlag: false,
      });

      // If we are editing an existing consultant, upload immediately
      if (editingTarget?.id) {
        try {
          await consultantService.uploadPhoto(editingTarget.id, rawBase64);
          toast.success('Photo uploaded successfully');
          // Update locally to guarantee UI reflects the change even if fetch is cached
          setEmployeesData((prev) => {
            const list = prev?.results || prev || [];
            const mapped = list.map((c) =>
              (c.emp_id || c.id) === editingTarget.id
                ? { ...c, photo: rawBase64, avatar: rawBase64 }
                : c,
            );
            return prev?.results ? { ...prev, results: mapped } : mapped;
          });
          loadEmployees(); // Background refresh
        } catch (err) {
          toast.error('Failed to upload photo instantly');
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoRemove = async () => {
    patch({ avatar: null, photoUploadBase64: null, photo: null, photoDeleteFlag: true });

    // If we are editing an existing consultant, delete immediately
    if (editingTarget?.id) {
      try {
        await consultantService.deletePhoto(editingTarget.id);
        toast.success('Photo removed successfully');
        // Update locally to guarantee UI reflects the change
        setEmployeesData((prev) => {
          const list = prev?.results || prev || [];
          const mapped = list.map((c) =>
            (c.emp_id || c.id) === editingTarget.id ? { ...c, photo: null, avatar: null } : c,
          );
          return prev?.results ? { ...prev, results: mapped } : mapped;
        });
        loadEmployees(); // Background refresh
      } catch (err) {
        toast.error('Failed to remove photo instantly');
      }
    }
  };

  const handleSave = async () => {
    if (drawerMode === 'password') {
      if (!passwordData.newPassword?.trim()) return toast.error('New Password is required');
      if (passwordData.newPassword !== passwordData.confirmPassword)
        return toast.error('Passwords do not match');

      setIsSaving(true);
      try {
        await consultantService.updateConsultant({
          ...editingTarget,
          password: passwordData.newPassword,
        });
        toast.success('Password updated successfully');
        closeDrawer();
      } catch (e) {
        toast.error(e.message || 'Failed to update password');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Form Validation
    if (!formData.name?.trim()) return toast.error('Full Name is required');
    if (!formData.email?.trim() || !/^\S+@\S+\.\S+$/.test(formData.email))
      return toast.error('Valid Email Address is required');
    if (!formData.role || !formData.roleId) return toast.error('Role selection is required');
    if (!formData.designation && formData.designation !== 0)
      return toast.error('Designation is required');
    if (!formData.username?.trim() && !formData.userId?.trim())
      return toast.error('Username / Employee ID is required');
    if (!isEditing && !formData.password?.trim())
      return toast.error('Initial Password is required');

    setIsSaving(true);
    try {
      if (isEditing) {
        await consultantService.updateConsultant({ ...formData, id: editingTarget.id });
        toast.success('Consultant updated successfully');
        setEmployeesData((prev) => {
          const list = prev?.results || prev || [];
          const mapped = list.map((c) =>
            (c.emp_id || c.id) === editingTarget.id ? { ...c, ...formData } : c,
          );
          return prev?.results ? { ...prev, results: mapped } : mapped;
        });
      } else {
        const newConsultant = await consultantService.createConsultant(formData);

        // If they uploaded a photo during creation, we still need this here!
        const newId = newConsultant?.id || newConsultant?.emp_id;
        if (newId && formData.photoUploadBase64) {
          await consultantService.uploadPhoto(newId, formData.photoUploadBase64);
        }

        toast.success('Consultant added successfully');
      }
      closeDrawer();
      loadEmployees(); // Force a refresh of the list
    } catch (e) {
      toast.error(e.message || 'Failed to save consultant');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    setIsSaving(true);
    try {
      // Prompt asked for "api/employees/delete/". Assuming ID is passed.
      await consultantService.deleteConsultant({
        id: editingTarget.id,
        userId: editingTarget.userId,
        name: editingTarget.name,
      });
      toast.success('Consultant deactivated successfully');
      closeDrawer();
      loadEmployees();
    } catch (e) {
      toast.error(e.message || 'Failed to deactivate consultant');
    } finally {
      setIsSaving(false);
    }
  };

  const isEditing = !!editingTarget;
  const drawerTitle =
    drawerMode === 'add-edit'
      ? isEditing
        ? 'Edit Consultant'
        : 'Add Consultant'
      : drawerMode === 'password'
        ? 'Change Password'
        : 'Delete Consultant';

  return (
    <div className="consultants-page">
      {/* Page content — wrapped so it can be visually suppressed when drawer is open */}
      <div
        className="consultants-page-body"
        data-drawer-open={drawerOpen || undefined}
        inert={drawerOpen ? '' : undefined}
        aria-hidden={drawerOpen || undefined}
      >
        {/* Page tabs */}
        <div className="consultants-tabs">
          {pageTabs.map((t) => {
            let count = null;
            if (!isEmployeesLoading) {
              if (t.id === 'consultants' && employeesData) count = dynamicEmployees.length;
              if (t.id === 'inactive' && inactiveData) count = inactiveCount;
              if (t.id === 'teams') count = dynamicTeams.length;
            }

            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="consultants-tab"
                data-active={activeTab === t.id}
              >
                <span className="consultants-tab-label">
                  {t.label}
                  {count !== null && (
                    <span
                      style={{
                        marginLeft: '8px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="consultants-content">
          {activeTab === 'consultants' && (
            <ActiveConsultants
              onAdd={handleAdd}
              onEdit={handleEdit}
              onPassword={handlePw}
              onDelete={handleDelete}
              onProfileView={setViewProfileId}
              employeesData={employeesData}
              designationsData={dynamicDesignations}
              teamsData={dynamicTeams}
              isLoading={isEmployeesLoading}
              error={employeesError}
              refetch={loadEmployees}
            />
          )}
          {activeTab === 'inactive' && (
            <InactiveConsultants
              onEdit={handleEdit}
              onPassword={handlePw}
              onDelete={handleDelete}
              onProfileView={setViewProfileId}
              designationsData={dynamicDesignations}
              teamsData={dynamicTeams}
            />
          )}
          {activeTab === 'teams' && (
            <TeamsView onProfileView={setViewProfileId} onTeamChanged={loadRefData} />
          )}
        </div>
      </div>

      {viewProfileId && (
        <ConsultantProfileModal
          isOpen={!!viewProfileId}
          onClose={() => setViewProfileId(null)}
          consultantId={viewProfileId}
        />
      )}

      <AdminModal
        isOpen={isAddDesignationModalOpen}
        onClose={() => setIsAddDesignationModalOpen(false)}
        title="Add Designation"
      >
        <div style={{ padding: '16px' }}>
          <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
            If you want to Add Employee Designation
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              Add Designation
            </span>
            <input
              type="text"
              className="ef-input"
              style={{ flex: 1 }}
              placeholder="Enter Designation"
              value={newDesignationName}
              onChange={(e) => setNewDesignationName(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setIsAddDesignationModalOpen(false)}
              style={{
                padding: '6px 24px',
                backgroundColor: '#ef4444',
                color: '#fff',
                borderRadius: '4px',
                border: 'none',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddDesignation}
              style={{
                padding: '6px 32px',
                backgroundColor: '#10b981',
                color: '#fff',
                borderRadius: '4px',
                border: 'none',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        </div>
      </AdminModal>

      {/* ════════════════════════════════════════════════════════
       RIGHT-SIDE DRAWER
      ════════════════════════════════════════════════════════ */}
      {drawerMode !== null && (
        <>
          <div
            className={`con-drawer-backdrop${drawerOpen ? ' open' : ''}`}
            onClick={closeDrawer}
          />
          <div className={`con-drawer${drawerOpen ? ' open' : ''}`}>
            <div className="con-drawer-header">
              <div className="con-drawer-title-row">
                <p className="con-drawer-title">{drawerTitle}</p>
                {drawerMode === 'password' ? (
                  <p className="con-drawer-sub">Reset access for {editingTarget?.userId}</p>
                ) : isEditing ? (
                  <p className="con-drawer-sub">
                    {editingTarget?.userId} · {editingTarget?.team}
                  </p>
                ) : null}
              </div>
              <button className="con-drawer-close" onClick={closeDrawer}>
                <X size={14} />
              </button>
            </div>

            {drawerMode === 'add-edit' && (
              <>
                <div className="con-drawer-tabs">
                  {[
                    { id: 'consultant-info', label: 'Consultant Info', Icon: User },
                    { id: 'user-info', label: 'User Info', Icon: Shield },
                    { id: 'additional-info', label: 'Additional Info', Icon: Info },
                  ].map(({ id, label, Icon }) => (
                    <button
                      key={id}
                      className="con-drawer-tab"
                      data-active={formTab === id}
                      onClick={() => setFormTab(id)}
                    >
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>

                <div className="con-drawer-body">
                  {formTab === 'consultant-info' && (
                    <div className="ef-form">
                      <div className="ef-avatar-upload">
                        <div className="ef-avatar-circle">
                          <img
                            src={
                              formData.avatar ||
                              'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=100&h=100'
                            }
                            alt="Avatar"
                            className="ef-avatar-img"
                          />
                          <div className="ef-avatar-overlay">
                            <Camera size={16} color="white" />
                          </div>
                        </div>
                        <div className="ef-avatar-actions">
                          <span className="ef-avatar-name">
                            {formData.name || 'New Consultant'}
                          </span>
                          <div className="ef-avatar-btns">
                            <label className="ef-avatar-btn-sm" style={{ cursor: 'pointer' }}>
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handlePhotoUpload}
                              />
                              <Upload size={10} /> Upload
                            </label>
                            {formData.avatar && (
                              <button
                                type="button"
                                className="ef-avatar-btn-sm ef-avatar-btn-danger"
                                onClick={handlePhotoRemove}
                              >
                                <Trash2 size={10} /> Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <EfSection label="Personal Information" />
                      <div className="ef-grid">
                        <EfField label="Full Name" required>
                          <div className="ef-input-wrap">
                            <span className="ef-input-icon">
                              <User size={12} />
                            </span>
                            <input
                              type="text"
                              className={`ef-input${formData.name ? ' ef-input-filled' : ''}`}
                              value={formData.name || ''}
                              onChange={(e) => patch({ name: e.target.value })}
                              placeholder="Full legal name"
                            />
                          </div>
                        </EfField>

                        <EfField label="Gender">
                          <Select
                            value={formData.gender || ''}
                            onChange={(v) => patch({ gender: v })}
                            options={[
                              { value: '', label: 'Select gender' },
                              ...STATIC_GENDERS.map((g) => ({ value: g, label: g })),
                            ]}
                          />
                        </EfField>

                        <EfField label="Email Address" required>
                          <div className="ef-input-wrap">
                            <span className="ef-input-icon">
                              <Mail size={12} />
                            </span>
                            <input
                              type="email"
                              className="ef-input"
                              value={formData.email || ''}
                              onChange={(e) => patch({ email: e.target.value })}
                            />
                          </div>
                        </EfField>

                        <EfField label="Mobile Number">
                          <div className="ef-input-wrap">
                            <span className="ef-input-icon">
                              <Phone size={12} />
                            </span>
                            <input
                              type="tel"
                              className="ef-input"
                              value={formData.mobile || ''}
                              onChange={(e) => patch({ mobile: e.target.value })}
                            />
                          </div>
                        </EfField>

                        <EfField label="Landline">
                          <input
                            type="tel"
                            className="ef-input"
                            value={formData.landline || ''}
                            onChange={(e) => patch({ landline: e.target.value })}
                          />
                        </EfField>

                        <EfField label="Extension">
                          <input
                            type="text"
                            className="ef-input"
                            value={formData.extension || ''}
                            onChange={(e) => patch({ extension: e.target.value })}
                          />
                        </EfField>

                        <EfField label="Address" className="ef-col-span-2">
                          <input
                            type="text"
                            className="ef-input"
                            value={formData.address || ''}
                            onChange={(e) => patch({ address: e.target.value })}
                          />
                        </EfField>
                      </div>

                      <EfSection label="Organization" />
                      <div className="ef-grid">
                        <EfField label="Role" required>
                          <Select
                            value={String(
                              formData.roleId || formData.role_id || formData.role || '',
                            )}
                            onChange={(v) => {
                              const selectedRole = dynamicRoles.find(
                                (r) => String(r.id) === String(v),
                              );
                              patch({
                                roleId: v,
                                role_id: v,
                                role_name: selectedRole?.name || '',
                                role: selectedRole?.name || '',
                              });
                            }}
                            options={[
                              { value: '', label: 'Select role' },
                              ...dynamicRoles.map((r) => ({
                                value: String(r.id),
                                label: r.name || String(r.id),
                              })),
                            ]}
                          />
                        </EfField>
                        <EfField label="Designation" required>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <Select
                              value={String(
                                formData.designation_name || formData.designation || '',
                              )}
                              onChange={(v) => patch({ designation: v, designation_name: v })}
                              options={[
                                { value: '', label: 'Select designation' },
                                ...dynamicDesignations.map((d) => ({
                                  value: d.name || d.designation || '',
                                  label: d.name || d.designation || '',
                                })),
                              ]}
                            />
                            <button
                              type="button"
                              className="ef-input-action"
                              style={{
                                position: 'static',
                                padding: '0 12px',
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-primary)',
                              }}
                              onClick={() => setIsAddDesignationModalOpen(true)}
                              title="Add Designation"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </EfField>
                        <EfField label="Team">
                          <Select
                            value={String(
                              formData.teamId || formData.team_id || formData.team || '',
                            )}
                            onChange={(v) => {
                              const selectedTeam = dynamicTeams.find(
                                (t) => String(t.id) === String(v),
                              );
                              patch({
                                teamId: v,
                                team_id: v,
                                team_name: selectedTeam?.name || '',
                                team: selectedTeam?.name || '',
                              });
                            }}
                            options={[
                              { value: '', label: 'Select team' },
                              ...dynamicTeams.map((t) => ({
                                value: String(t.id),
                                label: t.name || String(t.id),
                              })),
                            ]}
                          />
                        </EfField>
                        <EfField label="Reporting Manager">
                          <Select
                            value={String(
                              formData.managerId || formData.manager_id || formData.manager || '',
                            )}
                            onChange={(v) => patch({ managerId: v, manager_id: v, manager: v })}
                            options={[
                              { value: '', label: 'Select manager' },
                              ...dynamicEmployees.map((e) => ({
                                value: String(e.emp_id || e.id),
                                label: e.name || e.employee_name || String(e.emp_id || e.id),
                              })),
                            ]}
                          />
                        </EfField>
                        <EfField label="Joining Date">
                          <DatePicker
                            value={formData.joiningDate ? new Date(formData.joiningDate) : null}
                            onChange={(d) =>
                              patch({ joiningDate: d ? d.toISOString().split('T')[0] : '' })
                            }
                          />
                        </EfField>
                      </div>
                    </div>
                  )}

                  {formTab === 'user-info' && (
                    <div className="ef-form">
                      <EfSection label="Account Identity" />
                      <div className="ef-grid">
                        <EfField label="Username / Employee ID" required>
                          <div className="ef-input-wrap">
                            <span className="ef-input-icon">
                              <Shield size={12} />
                            </span>
                            <input
                              type="text"
                              className="ef-input"
                              value={formData.username || ''}
                              onChange={(e) => patch({ username: e.target.value })}
                            />
                          </div>
                        </EfField>
                        <EfField label="Account Status">
                          <Select
                            value={formData.status || 'active'}
                            onChange={(v) => patch({ status: v })}
                            options={STATIC_STATUSES.map((s) => ({
                              value: s,
                              label: s.charAt(0).toUpperCase() + s.slice(1),
                            }))}
                          />
                        </EfField>
                        <EfField label="Role">
                          <Select
                            value={formData.role || ''}
                            onChange={(v) => patch({ role: v })}
                            options={[
                              { value: '', label: 'Select role' },
                              ...dynamicRoles.map((r) => ({
                                value: r.name || r.roleName,
                                label: r.name || r.roleName,
                              })),
                            ]}
                          />
                        </EfField>
                        {!isEditing && (
                          <EfField label="Initial Password" required>
                            <input
                              type="password"
                              className="ef-input"
                              value={formData.password || ''}
                              onChange={(e) => patch({ password: e.target.value })}
                            />
                          </EfField>
                        )}
                      </div>

                      <div style={{ marginTop: '24px' }}>
                        <EfSwitchRow
                          label="Include in CP"
                          checked={formData.includeInCp}
                          onChange={(v) => patch({ includeInCp: v })}
                        />
                      </div>
                    </div>
                  )}

                  {formTab === 'additional-info' && (
                    <div className="ef-form">
                      <EfSection label="VISA INFORMATION" />
                      <div className="ef-grid">
                        <EfField label="VISA NUMBER">
                          <input
                            type="text"
                            className="ef-input"
                            placeholder="Visa document number"
                            value={formData.visaNumber || ''}
                            onChange={(e) => patch({ visaNumber: e.target.value })}
                          />
                        </EfField>
                        <EfField label="VISA TYPE">
                          <input
                            type="text"
                            className="ef-input"
                            placeholder="e.g. H1-B, Work Permit"
                            value={formData.visa || ''}
                            onChange={(e) => patch({ visa: e.target.value })}
                          />
                        </EfField>
                        <EfField label="VISA EXPIRY">
                          <DatePicker
                            value={formData.visaExpire ? new Date(formData.visaExpire) : null}
                            onChange={(d) =>
                              patch({ visaExpire: d ? d.toISOString().split('T')[0] : '' })
                            }
                          />
                        </EfField>
                        <EfField label="VISA RENEWAL DATE">
                          <DatePicker
                            value={formData.visaRenewal ? new Date(formData.visaRenewal) : null}
                            onChange={(d) =>
                              patch({ visaRenewal: d ? d.toISOString().split('T')[0] : '' })
                            }
                          />
                        </EfField>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <EfField label="NEXT VISA EXIT">
                            <DatePicker
                              value={formData.nextVisaExit ? new Date(formData.nextVisaExit) : null}
                              onChange={(d) =>
                                patch({ nextVisaExit: d ? d.toISOString().split('T')[0] : '' })
                              }
                            />
                          </EfField>
                        </div>
                      </div>

                      <EfSection label="WORK ASSIGNMENT" />
                      <div className="ef-grid">
                        <EfField label="WEBEX / CHAT ID">
                          <input
                            type="text"
                            className="ef-input"
                            placeholder="username@chat.com"
                            value={formData.webexId || ''}
                            onChange={(e) => patch({ webexId: e.target.value })}
                          />
                        </EfField>
                        <EfField label="WORK LOCATION">
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => patch({ location: 'On Site' })}
                              style={{
                                flex: 1,
                                height: '36px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                border:
                                  formData.location === 'On Site'
                                    ? '1px solid #10b981'
                                    : '1px solid var(--border-primary)',
                                backgroundColor:
                                  formData.location === 'On Site'
                                    ? '#ecfdf5'
                                    : 'var(--surface-primary)',
                                color:
                                  formData.location === 'On Site'
                                    ? '#10b981'
                                    : 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              ● On Site
                            </button>
                            <button
                              type="button"
                              onClick={() => patch({ location: 'Off Site' })}
                              style={{
                                flex: 1,
                                height: '36px',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '500',
                                border:
                                  formData.location === 'Off Site'
                                    ? '1px solid #10b981'
                                    : '1px solid var(--border-primary)',
                                backgroundColor:
                                  formData.location === 'Off Site'
                                    ? '#ecfdf5'
                                    : 'var(--surface-primary)',
                                color:
                                  formData.location === 'Off Site'
                                    ? '#10b981'
                                    : 'var(--text-secondary)',
                                cursor: 'pointer',
                              }}
                            >
                              ○ Off Site
                            </button>
                          </div>
                        </EfField>
                      </div>

                      <div style={{ marginTop: '16px', marginBottom: '24px' }}>
                        <EfSwitchRow
                          label="Physical PC Available"
                          checked={formData.physicalPcAvailable}
                          onChange={(v) => patch({ physicalPcAvailable: v })}
                        />
                      </div>

                      {formData.physicalPcAvailable && (
                        <>
                          <EfSection label="EQUIPMENT INFORMATION" />
                          <div className="ef-grid">
                            <EfField label="COMPUTER NAME">
                              <input
                                type="text"
                                className="ef-input"
                                placeholder="e.g. PC-EMP001"
                                value={formData.computerName || ''}
                                onChange={(e) => patch({ computerName: e.target.value })}
                              />
                            </EfField>
                            <EfField label="COMPUTER LOCATION">
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <Select
                                  value={formData.computerLocation || ''}
                                  onChange={(v) => patch({ computerLocation: v })}
                                  options={[
                                    { value: '', label: 'e.g. Floor 3 - Zone B' },
                                    ...dynamicCompLocations.map((cl) => ({
                                      value: cl.name,
                                      label: cl.name,
                                    })),
                                  ]}
                                />
                                <button
                                  type="button"
                                  className="ef-input-action"
                                  style={{
                                    position: 'static',
                                    padding: '0 12px',
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-primary)',
                                  }}
                                  onClick={() => setIsAddComputerLocationModalOpen(true)}
                                  title="Add Computer Location"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            </EfField>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <EfField label="LOCATION REFERENCE">
                                <input
                                  type="text"
                                  className="ef-input"
                                  placeholder="Desk / bay reference number"
                                  value={formData.computerLocationReference || ''}
                                  onChange={(e) =>
                                    patch({ computerLocationReference: e.target.value })
                                  }
                                />
                              </EfField>
                            </div>
                          </div>
                        </>
                      )}

                      <EfSection label="REMARKS" />
                      <EfField label="Additional Notes">
                        <textarea
                          className="ef-input"
                          style={{ height: '80px', paddingTop: '8px', resize: 'vertical' }}
                          value={formData.remarks || ''}
                          onChange={(e) => patch({ remarks: e.target.value })}
                        />
                      </EfField>
                    </div>
                  )}
                </div>
                <div className="con-drawer-footer">
                  <button
                    className="con-drawer-btn con-drawer-btn-cancel"
                    onClick={closeDrawer}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="con-drawer-btn con-drawer-btn-primary"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="spin-animation" /> Saving...
                      </>
                    ) : (
                      'Save'
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Delete Confirmation Modal */}
            {drawerMode === 'delete' && (
              <>
                <div className="con-drawer-body delete-mode">
                  <p>
                    Are you sure you want to deactivate <strong>{editingTarget?.name}</strong>?
                  </p>
                </div>
                <div className="con-drawer-footer">
                  <button
                    className="con-drawer-btn con-drawer-btn-cancel"
                    onClick={closeDrawer}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="con-drawer-btn con-drawer-btn-danger"
                    onClick={handleConfirmDelete}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={16} className="spin-animation" /> Deactivating...
                      </>
                    ) : (
                      'Deactivate'
                    )}
                  </button>
                </div>
              </>
            )}

            {drawerMode === 'password' && (
              <>
                <div className="con-drawer-body">
                  <div className="ef-form" style={{ marginTop: '8px' }}>
                    <EfSection label="NEW CREDENTIALS" />
                    <div className="ef-grid">
                      <EfField label="NEW PASSWORD" required>
                        <div className="ef-input-wrap">
                          <span className="ef-input-icon">
                            <Lock size={12} />
                          </span>
                          <input
                            type={showPw ? 'text' : 'password'}
                            className="ef-input has-action"
                            placeholder="Enter new password"
                            value={passwordData.newPassword}
                            onChange={(e) =>
                              setPasswordData((p) => ({ ...p, newPassword: e.target.value }))
                            }
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="ef-input-action"
                            onClick={() => setShowPw(!showPw)}
                          >
                            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </EfField>
                      <EfField label="CONFIRM PASSWORD" required>
                        <div className="ef-input-wrap">
                          <span className="ef-input-icon">
                            <Lock size={12} />
                          </span>
                          <input
                            type={showPwConfirm ? 'text' : 'password'}
                            className="ef-input has-action"
                            placeholder="Re-enter password"
                            value={passwordData.confirmPassword}
                            onChange={(e) =>
                              setPasswordData((p) => ({ ...p, confirmPassword: e.target.value }))
                            }
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="ef-input-action"
                            onClick={() => setShowPwConfirm(!showPwConfirm)}
                          >
                            {showPwConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </EfField>
                    </div>
                  </div>
                </div>
                <div className="con-drawer-footer">
                  <button
                    className="con-drawer-btn con-drawer-btn-cancel"
                    onClick={closeDrawer}
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    className="con-drawer-btn con-drawer-btn-primary"
                    onClick={handleSave}
                    disabled={isSaving}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 size={14} className="spin-animation" /> Updating...
                      </>
                    ) : (
                      <>
                        <Key size={14} /> Update Password
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      <AdminModal
        isOpen={isAddComputerLocationModalOpen}
        onClose={() => setIsAddComputerLocationModalOpen(false)}
        title="Add Computer Location"
      >
        <div style={{ padding: '16px' }}>
          <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
            If you want to Add Computer Location
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              Computer Location
            </span>
            <input
              type="text"
              className="ef-input"
              style={{ flex: 1 }}
              placeholder="Enter Computer Location"
              value={newComputerLocationName}
              onChange={(e) => setNewComputerLocationName(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setIsAddComputerLocationModalOpen(false)}
              style={{
                padding: '6px 24px',
                backgroundColor: '#ef4444',
                color: '#fff',
                borderRadius: '4px',
                border: 'none',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddComputerLocation}
              style={{
                padding: '6px 32px',
                backgroundColor: '#10b981',
                color: '#fff',
                borderRadius: '4px',
                border: 'none',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Add
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
