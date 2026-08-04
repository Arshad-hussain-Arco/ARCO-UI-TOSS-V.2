import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@hooks/useToast';
import { useDocumentTitle } from '@hooks/useDocumentTitle';
import { useAsync } from '@hooks/useAsync';
import { consultantService } from '@services/consultantService';

import { Tabs } from '@components/common';
import { ConsultantsTab } from './components/ConsultantsTab';
import { InactiveConsultantsTab } from './components/InactiveConsultantsTab';
import { TeamsTab } from './components/TeamsTab';
import { ConsultantDrawer } from './components/ConsultantDrawer';
import { AddQuickItemModal } from './components/AddQuickItemModal';
import { ConsultantProfileModal } from './ConsultantProfileModal';
import './ConsultantsPage.css';

const pageTabs = [
  { id: 'consultants', label: 'Consultants' },
  { id: 'inactive', label: 'Inactive Consultants' },
  { id: 'teams', label: 'Teams' },
];

const emptyForm = {
  name: '', username: '', password: '', designation: '', team: '', joiningDate: '',
  mobile: '', email: '', landline: '', extension: '', address: '', role: '',
  webexId: '', includeInCp: false, visaNumber: '', visa: '', visaExpire: '', visaRenewal: '',
  nextVisaExit: '', location: 'On Site', remarks: '', manager: '', gender: '',
  physicalPcAvailable: false, computerName: '', computerLocation: '', computerLocationReference: '',
  accountStatus: 'active'
};

export function ConsultantsPage() {
  useDocumentTitle('Consultants');
  const toast = useToast();

  const fetchEmployees = useCallback(() => consultantService.getEmployeesList(), []);

  const { data: employeesData, refetch: loadEmployees, isLoading: isEmployeesLoading, error: employeesError, setData: setEmployeesData } = useAsync(fetchEmployees, { immediate: true });

  const dynamicEmployees = employeesData?.results || employeesData || [];

  const fetchRoles = useCallback(() => consultantService.getRoles(), []);
  const { data: rolesData } = useAsync(fetchRoles, { immediate: true });
  const dynamicRoles = Array.isArray(rolesData)
    ? rolesData.map(r => ({ id: r.id, name: r.role_name || r.name || String(r.id) }))
    : [];

  const fetchRefData = useCallback(() => consultantService.getDesignationsAndTeams(), []);
  const { data: refData, refetch: loadRefData } = useAsync(fetchRefData, { immediate: true });
  const fetchLocations = useCallback(() => consultantService.getLocations(), []);
  const { data: locationsData } = useAsync(fetchLocations, { immediate: true });
  const fetchCompLocations = useCallback(() => consultantService.getComputerLocations(), []);
  const { data: compLocationsData, refetch: loadCompLocations } = useAsync(fetchCompLocations, { immediate: true });

  const dynamicDesignations = Array.isArray(refData) ? refData : (refData?.results || refData?.designations || []);
  const dynamicTeams = Array.isArray(refData)
    ? refData.flatMap(d => d.teams || [])
    : (refData?.teams || []);
  const dynamicLocations = Array.isArray(locationsData) ? locationsData : (locationsData?.results || []);
  const dynamicCompLocations = Array.isArray(compLocationsData) ? compLocationsData : (compLocationsData?.results || []);

  const [activeTab, setActiveTab] = useState('consultants');
  const [drawerMode, setDrawerMode] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formTab, setFormTab] = useState('consultant-info');
  const [editingTarget, setEditingTarget] = useState(null);
  const [showPw, setShowPw] = useState(false);
  const [showPwConfirm, setShowPwConfirm] = useState(false);

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
      patch({ designation: newDesignationName.trim(), designation_name: newDesignationName.trim() });
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
      patch({ computerLocation: newComputerLocationName.trim(), computer_location: newComputerLocationName.trim() });
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

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      const rawBase64 = base64String.split(',')[1];
      patch({ avatar: base64String, photoUploadBase64: rawBase64, photo: rawBase64, photoDeleteFlag: false });

      // If we are editing an existing consultant, upload immediately
      if (editingTarget?.id) {
        try {
          await consultantService.uploadPhoto(editingTarget.id, rawBase64);
          toast.success('Photo uploaded successfully');
          // Update locally to guarantee UI reflects the change even if fetch is cached
          setEmployeesData(prev => {
            const list = prev?.results || prev || [];
            const mapped = list.map(c => (c.emp_id || c.id) === editingTarget.id ? { ...c, photo: rawBase64, avatar: rawBase64 } : c);
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
        setEmployeesData(prev => {
          const list = prev?.results || prev || [];
          const mapped = list.map(c => (c.emp_id || c.id) === editingTarget.id ? { ...c, photo: null, avatar: null } : c);
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
      if (passwordData.newPassword !== passwordData.confirmPassword) return toast.error('Passwords do not match');

      try {
        await consultantService.updateConsultant({ ...editingTarget, password: passwordData.newPassword });
        toast.success('Password updated successfully');
        closeDrawer();
      } catch (e) {
        toast.error(e.message || 'Failed to update password');
      }
      return;
    }

    // Form Validation
    if (!formData.name?.trim()) return toast.error('Full Name is required');
    if (!formData.email?.trim() || !/^\S+@\S+\.\S+$/.test(formData.email)) return toast.error('Valid Email Address is required');
    if (!formData.role || !formData.roleId) return toast.error('Role selection is required');
    if (!formData.designation && formData.designation !== 0) return toast.error('Designation is required');
    if (!formData.username?.trim() && !formData.userId?.trim()) return toast.error('Username / Employee ID is required');
    if (!isEditing && !formData.password?.trim()) return toast.error('Initial Password is required');

    try {
      if (isEditing) {
        await consultantService.updateConsultant({ ...formData, id: editingTarget.id });
        toast.success('Consultant updated successfully');
        setEmployeesData(prev => {
          const list = prev?.results || prev || [];
          const mapped = list.map(c => (c.emp_id || c.id) === editingTarget.id ? { ...c, ...formData } : c);
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
    }
  };

  const handleConfirmDelete = async () => {
    try {
      // Prompt asked for "api/employees/delete/". Assuming ID is passed.
      await consultantService.deleteConsultant({
        id: editingTarget.id,
        userId: editingTarget.userId,
        name: editingTarget.name
      });
      toast.success('Consultant deactivated successfully');
      closeDrawer();
      loadEmployees();
    } catch (e) {
      toast.error(e.message || 'Failed to deactivate consultant');
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
        <Tabs tabs={pageTabs} activeTab={activeTab} onChange={setActiveTab} />

        {/* Content */}
        <div className="consultants-content">
          {activeTab === 'consultants' && (
            <ConsultantsTab
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
            <InactiveConsultantsTab
              onEdit={handleEdit}
              onPassword={handlePw}
              onDelete={handleDelete}
              onProfileView={setViewProfileId}
              designationsData={dynamicDesignations}
              teamsData={dynamicTeams}
            />
          )}
          {activeTab === 'teams' && <TeamsTab onProfileView={setViewProfileId} />}
        </div>
      </div>

      {viewProfileId && (
        <ConsultantProfileModal
          isOpen={!!viewProfileId}
          onClose={() => setViewProfileId(null)}
          consultantId={viewProfileId}
        />
      )}

      <AddQuickItemModal
        isOpen={isAddDesignationModalOpen}
        onClose={() => setIsAddDesignationModalOpen(false)}
        title="Add Designation"
        description="If you want to Add Employee Designation"
        fieldLabel="Add Designation"
        value={newDesignationName}
        onChange={setNewDesignationName}
        onSubmit={handleAddDesignation}
      />

      <ConsultantDrawer
        drawerMode={drawerMode}
        drawerOpen={drawerOpen}
        closeDrawer={closeDrawer}
        drawerTitle={drawerTitle}
        editingTarget={editingTarget}
        isEditing={isEditing}
        formTab={formTab}
        setFormTab={setFormTab}
        formData={formData}
        patch={patch}
        handlePhotoUpload={handlePhotoUpload}
        handlePhotoRemove={handlePhotoRemove}
        dynamicRoles={dynamicRoles}
        dynamicDesignations={dynamicDesignations}
        dynamicTeams={dynamicTeams}
        dynamicEmployees={dynamicEmployees}
        dynamicCompLocations={dynamicCompLocations}
        onAddDesignation={() => setIsAddDesignationModalOpen(true)}
        onAddComputerLocation={() => setIsAddComputerLocationModalOpen(true)}
        showPw={showPw}
        setShowPw={setShowPw}
        showPwConfirm={showPwConfirm}
        setShowPwConfirm={setShowPwConfirm}
        passwordData={passwordData}
        setPasswordData={setPasswordData}
        handleSave={handleSave}
        handleConfirmDelete={handleConfirmDelete}
      />

      <AddQuickItemModal
        isOpen={isAddComputerLocationModalOpen}
        onClose={() => setIsAddComputerLocationModalOpen(false)}
        title="Add Computer Location"
        description="If you want to Add Computer Location"
        fieldLabel="Computer Location"
        value={newComputerLocationName}
        onChange={setNewComputerLocationName}
        onSubmit={handleAddComputerLocation}
      />
    </div>
  );
}

export default ConsultantsPage;
