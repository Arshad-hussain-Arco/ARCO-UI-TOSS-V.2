import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  X,
  Upload,
  Eye,
  EyeOff,
  Key,
  User,
  Info,
  Trash,
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
import { useAuth } from '@hooks/useAuth';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { Image } from '@components/common/Image/Image';
import { Select } from '@components/forms/Select/Select';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { useAsync } from '@hooks/useAsync';
import { useEmployeePhotos } from '@hooks/useEmployeePhotos';
import { consultantService } from '@services/consultantService';
import { authService } from '@services/authService';
import { ActiveConsultants } from './ActiveConsultants';
import { InactiveConsultants } from './InactiveConsultants';
import { TeamsView } from './TeamsView';
import { ConsultantProfileModal } from './ConsultantProfileModal';
import { AdminModal } from '@components/ui/AdminModal/AdminModal';
import './ConsultantsPage.css';

const ALL_PAGE_TABS = [
  { id: 'consultants', label: 'Consultants', permission: 'EMPLOYEE_VIEW' },
  { id: 'inactive', label: 'Inactive Consultants', permission: 'EMPLOYEE_VIEW_INACTIVE' },
  { id: 'teams', label: 'Teams', permission: 'TEAMS_VIEW' },
];

const emptyForm = {
  name: '',
  username: '',
  password: 'password123456*',
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
  location: '',
  remarks: '',
  manager: '',
  gender: '',
  physicalPcAvailable: false,
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
  const { hasPermission } = useAuth();
  const canActivateDeactivate = hasPermission('EMPLOYEE_ACTIVATE_DEACTIVATE');
  // Edit and Reset Password both ride on EMPLOYEE_EDIT — no separate code.
  const canEdit = hasPermission('EMPLOYEE_EDIT');
  const canCreate = hasPermission('EMPLOYEE_CREATE');

  const [activeFilteredCount, setActiveFilteredCount] = useState(null);
  const [inactiveFilteredCount, setInactiveFilteredCount] = useState(null);
  const { photoMap, getPhoto, refetch: refetchPhotos } = useEmployeePhotos({ includeInactive: true });
  // Optimistic per-employee photo state set right after an upload/delete, so
  // that consultant's row shows the new image immediately — before the
  // shared photo directory (GET /employees/photos/) has refetched. Keyed by
  // emp_id; value is the new base64 photo, or '' to mean "just removed".
  const [photoOverrides, setPhotoOverrides] = useState({});

  const fetchEmployees = useCallback(async () => {
    const employees = await consultantService.getEmployeesList();
    if (!employees) throw new Error('No employees data returned');
    return employees;
  }, []);

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

  const fetchInactive = useCallback(async () => {
    try {
      const employees = await consultantService.getInactiveConsultants();
      if (!employees) throw new Error('No inactive employees data returned');
      return employees;
    } catch (err) {
      throw err;
    }
  }, []);
  const { data: rawInactiveData, setData: setInactiveData, isLoading: isInactiveLoading, error: inactiveError, refetch: loadInactive } = useAsync(fetchInactive, { immediate: false });
  const inactiveCount = Array.isArray(rawInactiveData)
    ? rawInactiveData.length
    : rawInactiveData?.results?.length || 0;

  const mergedEmployeesData = useMemo(() => {
    if (!employeesData) return employeesData;
    const empList = Array.isArray(employeesData) ? employeesData : (employeesData.results || []);
    const merged = empList.map(e => {
      const id = e.emp_id || e.id;
      // An optimistic override (set right after upload/delete) always wins,
      // even when it's '' (just removed) — otherwise a stale cached photo
      // from the directory would flash back in until it refetches.
      if (Object.prototype.hasOwnProperty.call(photoOverrides, id)) {
        return { ...e, photo: photoOverrides[id] };
      }
      const photo = getPhoto(id);
      return photo ? { ...e, photo } : e;
    });
    return Array.isArray(employeesData) ? merged : { ...employeesData, results: merged };
  }, [employeesData, photoMap, getPhoto, photoOverrides]);

  const inactiveData = useMemo(() => {
    if (!rawInactiveData) return rawInactiveData;
    const empList = Array.isArray(rawInactiveData) ? rawInactiveData : (rawInactiveData.results || []);
    const merged = empList.map(e => {
      const id = e.emp_id || e.id;
      if (Object.prototype.hasOwnProperty.call(photoOverrides, id)) {
        return { ...e, photo: photoOverrides[id] };
      }
      const photo = getPhoto(id);
      return photo ? { ...e, photo } : e;
    });
    return Array.isArray(rawInactiveData) ? merged : { ...rawInactiveData, results: merged };
  }, [rawInactiveData, photoMap, getPhoto, photoOverrides]);

  const pageTabs = useMemo(
    () => ALL_PAGE_TABS.filter((t) => hasPermission(t.permission)),
    [hasPermission],
  );
  const [activeTab, setActiveTab] = useState(() => pageTabs[0]?.id ?? null);

  // Covers the case where permissions load in after first render, or the
  // active tab is no longer visible (e.g. permission revoked mid-session).
  useEffect(() => {
    if (!activeTab && pageTabs.length) {
      setActiveTab(pageTabs[0].id);
    } else if (activeTab && !pageTabs.some((t) => t.id === activeTab)) {
      setActiveTab(pageTabs[0]?.id ?? null);
    }
  }, [pageTabs, activeTab]);

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
    } else if (activeTab === 'inactive') {
      loadInactive();
    }
  }, [activeTab, loadEmployees, loadInactive]);

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

    let locName = c.location || c.location_name || '';
    if (locName && !isNaN(locName)) {
      const found = dynamicLocations.find(l => String(l.id) === String(locName));
      if (found) locName = found.name;
    }

    let compLocName = c.computerLocation || c.computer_location || '';
    if (compLocName && !isNaN(compLocName)) {
      const found = dynamicCompLocations.find(cl => String(cl.id) === String(compLocName));
      if (found) compLocName = found.name;
    }

    setFormData({
      ...c,
      username: c.username || c.user_name || c.userId || '',
      joiningDate: c.joiningDate || c.joining_date || '',
      webexId: c.webexId || c.webex_id || '',
      includeInCp: c.includeInCp !== undefined ? c.includeInCp : (c.include_in_cp === 1 || c.include_in_cp === true),
      visaExpire: c.visaExpire || c.visa_expiry || '',
      visaRenewal: c.visaRenewal || c.visa_renewal || '',
      nextVisaExit: c.nextVisaExit || c.next_visa_exit || '',
      computerName: c.computerName || c.computer_name || '',
      computerLocation: compLocName,
      location: locName,
      computerLocationReference: c.computerLocationReference || c.computer_location_ref || '',
      physicalPcAvailable: c.physicalPcAvailable !== undefined ? c.physicalPcAvailable : (c.physical_pc_available === 1 || c.physical_pc_available === true),
      accountStatus: c.accountStatus || c.status || 'active',
      roleId: c.roleId || c.role_id,
      teamId: c.teamId || c.team_id,
      managerId: c.managerId || c.manager_id,
    });
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
      const editingId = editingTarget?.id || editingTarget?.emp_id;
      if (editingId) {
        try {
          await consultantService.uploadPhoto(editingId, rawBase64);
          toast.success('Photo uploaded successfully');
          // Show the new photo for this consultant right away — don't wait
          // on the shared photo directory to refetch.
          setPhotoOverrides((prev) => ({ ...prev, [editingId]: rawBase64 }));
          loadEmployees(); // Background refresh
          refetchPhotos(); // Keep the shared photo directory (other pages) in sync
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
    const editingId = editingTarget?.id || editingTarget?.emp_id;
    if (editingId) {
      try {
        await consultantService.deletePhoto(editingId);
        toast.success('Photo removed successfully');
        // Clear the photo for this consultant right away — don't wait on the
        // shared photo directory to refetch (and don't let its stale cache
        // flash the old photo back in).
        setPhotoOverrides((prev) => ({ ...prev, [editingId]: '' }));
        loadEmployees(); // Background refresh
        refetchPhotos(); // Keep the shared photo directory (other pages) in sync
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
        await authService.adminUpdatePassword({
          emp_id: editingTarget.id || editingTarget.emp_id,
          new_password: passwordData.newPassword,
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
    if (!formData.gender?.trim()) return toast.error('Gender is required');
    if (!formData.email?.trim() || !/^\S+@\S+\.\S+$/.test(formData.email))
      return toast.error('Valid Email Address is required');
    if (!formData.mobile?.trim()) return toast.error('Mobile Number is required');
    if (!formData.role || !formData.roleId) return toast.error('Role selection is required');
    if (!formData.designation && formData.designation !== 0)
      return toast.error('Designation is required');
    if (!formData.team && !formData.teamId) return toast.error('Team is required');
    if (!formData.manager && !formData.managerId) return toast.error('Reporting Manager is required');
    if (!formData.joiningDate) return toast.error('Joining Date is required');
    if (!formData.username?.trim() && !formData.userId?.trim())
      return toast.error('Username / Employee ID is required');
    if (!isEditing && !formData.password?.trim())
      return toast.error('Initial Password is required');
    if (!formData.location) return toast.error('Work Location is required');

    if (formData.physicalPcAvailable) {
      if (!formData.computerLocation) return toast.error('Computer Location is required');
    }

    // Duplicate email/mobile check against currently loaded consultants — mirrors the
    // backend's "already exist with status active" rejection so the user finds out
    // before submitting instead of after.
    const currentId = editingTarget?.id || editingTarget?.emp_id;
    const normalizedEmail = formData.email.trim().toLowerCase();
    const normalizedMobile = formData.mobile.trim();
    const allConsultants = [
      ...(Array.isArray(dynamicEmployees) ? dynamicEmployees : []),
      ...(Array.isArray(rawInactiveData) ? rawInactiveData : rawInactiveData?.results || []),
    ];
    const isSelf = (c) => isEditing && String(c.emp_id || c.id) === String(currentId);
    const emailTaken = allConsultants.some(
      (c) => !isSelf(c) && (c.email || '').trim().toLowerCase() === normalizedEmail,
    );
    if (emailTaken) return toast.error('A consultant with this email address already exists');
    const mobileTaken = allConsultants.some(
      (c) => !isSelf(c) && (c.mobile || '').trim() === normalizedMobile,
    );
    if (mobileTaken) return toast.error('A consultant with this mobile number already exists');

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
        : 'Deactivate Consultant';

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
              if (t.id === 'consultants' && employeesData) {
                count = activeFilteredCount !== null ? activeFilteredCount : dynamicEmployees.length;
              }
              if (t.id === 'inactive' && inactiveData) {
                count = inactiveFilteredCount !== null ? inactiveFilteredCount : inactiveCount;
              }
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
                    <span className='tc-lab-count'
                      style={{
                        marginLeft: '8px',
                        background:
                          activeTab === t.id
                            ? '#e6f4ed'
                            : 'var(--bg-secondary)',
                        color:
                          activeTab === t.id
                            ? 'var(--c-primary)'
                            : 'var(--text-secondary)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
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
              onAdd={canCreate ? handleAdd : undefined}
              onEdit={canEdit ? handleEdit : undefined}
              onPassword={canEdit ? handlePw : undefined}
              onDelete={canActivateDeactivate ? handleDelete : undefined}
              onProfileView={setViewProfileId}
              onFilteredCountChange={setActiveFilteredCount}
              employeesData={mergedEmployeesData}
              designationsData={dynamicDesignations}
              teamsData={dynamicTeams}
              isLoading={isEmployeesLoading}
              error={employeesError}
              refetch={loadEmployees}
            />
          )}
          {activeTab === 'inactive' && (
            <InactiveConsultants
              onEdit={canEdit ? handleEdit : undefined}
              onPassword={canEdit ? handlePw : undefined}
              onDelete={handleDelete}
              onProfileView={setViewProfileId}
              onFilteredCountChange={setInactiveFilteredCount}
              designationsData={dynamicDesignations}
              teamsData={dynamicTeams}
              inactiveData={inactiveData}
              isLoading={isInactiveLoading}
              error={inactiveError}
              refetch={loadInactive}
            />
          )}
          {activeTab === 'teams' && (
            <TeamsView 
              onProfileView={setViewProfileId} 
              onTeamChanged={loadRefData} 
              employeesData={mergedEmployeesData}
              getPhoto={getPhoto} 
            />
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
                backgroundColor: 'var(--c-danger)',
                color: 'var(--surface-primary)',
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
                backgroundColor: 'var(--c-success)',
                color: 'var(--surface-primary)',
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
                              'https://static.vecteezy.com/system/resources/previews/024/766/958/non_2x/default-male-avatar-profile-icon-social-media-user-free-vector.jpg'
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
                              <Upload size={10} /> {formData.avatar ? 'Replace' : 'Upload'}
                            </label>
                            {formData.avatar && (
                              <button
                                type="button"
                                className="ef-avatar-btn-sm ef-avatar-btn-danger"
                                onClick={handlePhotoRemove}
                              >
                                <Trash size={10} /> Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

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

                        <EfField label="Gender" required>
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

                        <EfField label="Mobile Number" required>
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

                        <EfField label="Team" required>
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

                        <EfField label="Reporting Manager" required>
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

                        <EfField label="Joining Date" required>
                          <DatePicker
                            value={formData.joiningDate ? new Date(formData.joiningDate) : null}
                            onChange={(d) =>
                              patch({ joiningDate: d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' })
                            }
                          />
                        </EfField>
                      </div>
                    </div>
                  )}

                  {formTab === 'user-info' && (
                    <div className="ef-form">
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
                        <EfField label="Account Status" required>
                          <Select
                            value={formData.accountStatus || 'active'}
                            onChange={(v) => patch({ accountStatus: v })}
                            options={STATIC_STATUSES.map((s) => ({
                              value: s,
                              label: s.charAt(0).toUpperCase() + s.slice(1),
                            }))}
                          />
                        </EfField>
                        {!isEditing && (
                          <EfField label="Initial Password" required>
                            <div className="ef-input-wrap">
                              <span className="ef-input-icon">
                                <Key size={12} />
                              </span>
                              <input
                                type={showPw ? 'text' : 'password'}
                                className="ef-input has-action"
                                value={formData.password || ''}
                                onChange={(e) => patch({ password: e.target.value })}
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
                        )}
                        <EfField label="WORK LOCATION" required>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {dynamicLocations
                              .filter((loc) => loc.name && loc.name.toLowerCase() !== 'hybrid')
                              .map((loc) => {
                                const isSelected =
                                  formData.location?.toLowerCase() === loc.name.toLowerCase();
                                return (
                                  <button
                                    key={loc.id}
                                    type="button"
                                    onClick={() => patch({ location: loc.name })}
                                    style={{
                                      flex: 1,
                                      minWidth: '100px',
                                      height: '36px',
                                      borderRadius: '6px',
                                      fontSize: '13px',
                                      fontWeight: '500',
                                      border: isSelected
                                        ? '1px solid var(--c-success)'
                                        : '1px solid var(--border-primary)',
                                      backgroundColor: isSelected
                                        ? '#ecfdf5'
                                        : 'var(--surface-primary)',
                                      color: isSelected
                                        ? 'var(--c-success)'
                                        : 'var(--text-secondary)',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {isSelected ? '● ' : '○ '}
                                    {loc.name}
                                  </button>
                                );
                              })}
                          </div>
                        </EfField>
                      </div>

                      <div style={{ marginTop: '24px' }}>
                        <EfSwitchRow
                          label="Include in Capacity Planning"
                          checked={formData.includeInCp}
                          onChange={(v) => patch({ includeInCp: v })}
                        />
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
                            <EfField label="COMPUTER LOCATION" required>
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
                    </div>
                  )}

                  {formTab === 'additional-info' && (
                    <div className="ef-form">
                      <div className="ef-grid">
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
                              patch({ visaExpire: d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' })
                            }
                          />
                        </EfField>
                        <EfField label="VISA RENEWAL DATE">
                          <DatePicker
                            value={formData.visaRenewal ? new Date(formData.visaRenewal) : null}
                            onChange={(d) =>
                              patch({ visaRenewal: d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' })
                            }
                          />
                        </EfField>
                        <div style={{ gridColumn: '1 / -1' }}>
                          <EfField label="NEXT VISA EXIT">
                            <DatePicker
                              value={formData.nextVisaExit ? new Date(formData.nextVisaExit) : null}
                              onChange={(d) =>
                                patch({ nextVisaExit: d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0] : '' })
                              }
                            />
                          </EfField>
                        </div>
                      </div>

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
                      </div>

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
                backgroundColor: 'var(--c-danger)',
                color: 'var(--surface-primary)',
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
                backgroundColor: 'var(--c-success)',
                color: 'var(--surface-primary)',
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
