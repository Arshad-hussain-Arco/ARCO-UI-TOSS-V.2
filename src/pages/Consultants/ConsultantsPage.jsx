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
  <div className="ef-switch-row">
    <span className="ef-switch-label">{label}</span>
    <button
      type="button"
      className={`ef-switch ${checked ? 'on' : 'off'}`}
      onClick={() => onChange(!checked)}
    >
      <span className="ef-switch-thumb" />
    </button>
  </div>
);

export function ConsultantsPage() {
  useDocumentTitle('Consultants');
  const toast = useToast();
  
  const fetchEmployees = useCallback(() => consultantService.getEmployeesList(), []);

  const { data: employeesData, refetch: loadEmployees, isLoading: isEmployeesLoading, error: employeesError, setData: setEmployeesData } = useAsync(fetchEmployees, { immediate: true });

  const dynamicEmployees = employeesData?.results || employeesData || [];
  
  // Extract unique roles and teams from the full employees list
  const dynamicRoles = Array.from(new Set(dynamicEmployees.map(e => e.role_id || e.role).filter(Boolean))).map(id => {
    const emp = dynamicEmployees.find(e => e.role_id === id || e.role === id);
    return { id, name: emp.role_name || emp.role || String(id) };
  });
  const fetchRefData = useCallback(() => consultantService.getDesignationsAndTeams(), []);
  const { data: refData } = useAsync(fetchRefData, { immediate: true });

  const dynamicTeams = refData?.teams || [];
  const dynamicDesignations = refData?.designations || [];
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

  const patch = (delta) => setFormData((p) => ({ ...p, ...delta }));

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
      {/* Page tabs */}
      <div className="consultants-tabs">
        {pageTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="consultants-tab"
            data-active={activeTab === t.id}
          >
            <span className="consultants-tab-label">{t.label}</span>
          </button>
        ))}
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
        )}{activeTab === 'teams' && <TeamsView onProfileView={setViewProfileId} />}
      </div>

      {viewProfileId && (
        <ConsultantProfileModal 
          consultantId={viewProfileId} 
          onClose={() => setViewProfileId(null)} 
        />
      )}

      {/* ════════════════════════════════════════════════════════
       RIGHT-SIDE DRAWER
      ════════════════════════════════════════════════════════ */}
      {drawerMode !== null && (
        <div className={`con-drawer${drawerOpen ? ' open' : ''}`}>
          <div className="con-drawer-header">
            <div className="con-drawer-title-row">
              <p className="con-drawer-title">{drawerTitle}</p>
              {isEditing && drawerMode === 'add-edit' && (
                <p className="con-drawer-sub">
                  {editingTarget.userId} · {editingTarget.team}
                </p>
              )}
              {drawerMode === 'password' && (
                <p className="con-drawer-sub">Reset access for {editingTarget?.userId}</p>
              )}
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
                        <span className="ef-avatar-name">{formData.name || 'New Consultant'}</span>
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
                            <button type="button" className="ef-avatar-btn-sm ef-avatar-btn-danger" onClick={handlePhotoRemove}>
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
                          <span className="ef-input-icon"><User size={12} /></span>
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
                          options={[{ value: '', label: 'Select gender' }, ...STATIC_GENDERS.map(g => ({ value: g, label: g }))]}
                        />
                      </EfField>

                      <EfField label="Email Address" required>
                        <div className="ef-input-wrap">
                          <span className="ef-input-icon"><Mail size={12} /></span>
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
                          <span className="ef-input-icon"><Phone size={12} /></span>
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
                          value={String(formData.roleId || formData.role_id || formData.role || '')}
                          onChange={(v) => {
                            const selectedRole = dynamicRoles.find(r => String(r.id) === String(v));
                            patch({ roleId: v, role_id: v, role_name: selectedRole?.name || '', role: selectedRole?.name || '' });
                          }}
                          options={[{ value: '', label: 'Select role' }, ...dynamicRoles.map(r => ({ value: String(r.id), label: r.name || String(r.id) }))]}
                        />
                      </EfField>
                      <EfField label="Designation" required>
                        <Select
                          value={String(formData.designationId || formData.designation_id || formData.designation || '')}
                          onChange={(v) => {
                            const selectedDesig = dynamicDesignations.find(d => String(d.id) === String(v));
                            patch({ designationId: Number(v), designation_id: Number(v), designation: Number(v), designation_name: selectedDesig?.name || '' });
                          }}
                          options={[{ value: '', label: 'Select designation' }, ...dynamicDesignations.map(d => ({ value: String(d.id), label: d.name }))]}
                        />
                      </EfField>
                      <EfField label="Team">
                        <Select
                          value={String(formData.teamId || formData.team_id || formData.team || '')}
                          onChange={(v) => {
                            const selectedTeam = dynamicTeams.find(t => String(t.id) === String(v));
                            patch({ teamId: v, team_id: v, team_name: selectedTeam?.name || '', team: selectedTeam?.name || '' });
                          }}
                          options={[{ value: '', label: 'Select team' }, ...dynamicTeams.map(t => ({ value: String(t.id), label: t.name || String(t.id) }))]}
                        />
                      </EfField>
                      <EfField label="Reporting Manager">
                        <Select
                          value={String(formData.managerId || formData.manager_id || formData.manager || '')}
                          onChange={(v) => patch({ managerId: v, manager_id: v, manager: v })}
                          options={[{ value: '', label: 'Select manager' }, ...dynamicEmployees.map(e => ({ value: String(e.emp_id || e.id), label: e.name || e.employee_name || String(e.emp_id || e.id) }))]}
                        />
                      </EfField>
                      <EfField label="Joining Date">
                        <DatePicker
                          value={formData.joiningDate ? new Date(formData.joiningDate) : null}
                          onChange={(d) => patch({ joiningDate: d ? d.toISOString().split('T')[0] : '' })}
                        />
                      </EfField>
                      <EfField label="Location">
                        <input
                           type="text"
                           className="ef-input"
                           value={formData.location || ''}
                           onChange={(e) => patch({ location: e.target.value })}
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
                          <span className="ef-input-icon"><Shield size={12} /></span>
                          <input
                            type="text"
                            className="ef-input"
                            value={formData.username || ''}
                            onChange={(e) => patch({ username: e.target.value })}
                          />
                        </div>
                      </EfField>
                      <EfField label="Webex ID">
                        <input
                          type="text"
                          className="ef-input"
                          value={formData.webexId || ''}
                          onChange={(e) => patch({ webexId: e.target.value })}
                        />
                      </EfField>
                      <EfField label="Account Status">
                        <Select
                          value={formData.accountStatus || 'active'}
                          onChange={(v) => patch({ accountStatus: v })}
                          options={STATIC_STATUSES.map(s => ({ value: s, label: s }))}
                        />
                      </EfField>
                      
                      {/* Only show password on Add */}
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
                    <EfSection label="Visa Information" />
                    <div className="ef-grid">
                      <EfField label="Visa Name/Type">
                        <input
                          type="text"
                          className="ef-input"
                          value={formData.visa || ''}
                          onChange={(e) => patch({ visa: e.target.value })}
                        />
                      </EfField>
                      <EfField label="Visa Number">
                        <input
                          type="text"
                          className="ef-input"
                          value={formData.visaNumber || ''}
                          onChange={(e) => patch({ visaNumber: e.target.value })}
                        />
                      </EfField>
                      <EfField label="Visa Expiry">
                        <DatePicker
                          value={formData.visaExpire ? new Date(formData.visaExpire) : null}
                          onChange={(d) => patch({ visaExpire: d ? d.toISOString().split('T')[0] : '' })}
                        />
                      </EfField>
                      <EfField label="Visa Renewal">
                        <DatePicker
                          value={formData.visaRenewal ? new Date(formData.visaRenewal) : null}
                          onChange={(d) => patch({ visaRenewal: d ? d.toISOString().split('T')[0] : '' })}
                        />
                      </EfField>
                      <EfField label="Next Visa Exit">
                        <DatePicker
                          value={formData.nextVisaExit ? new Date(formData.nextVisaExit) : null}
                          onChange={(d) => patch({ nextVisaExit: d ? d.toISOString().split('T')[0] : '' })}
                        />
                      </EfField>
                    </div>

                    <EfSection label="Assets & Remarks" />
                    <div className="ef-grid">
                      <EfField label="Computer Name">
                        <input
                          type="text"
                          className="ef-input"
                          value={formData.computerName || ''}
                          onChange={(e) => patch({ computerName: e.target.value })}
                        />
                      </EfField>
                      <EfField label="Computer Location">
                        <input
                          type="text"
                          className="ef-input"
                          value={formData.computerLocation || ''}
                          onChange={(e) => patch({ computerLocation: e.target.value })}
                        />
                      </EfField>
                      <EfField label="Computer Location Reference">
                        <input
                          type="text"
                          className="ef-input"
                          value={formData.computerLocationReference || ''}
                          onChange={(e) => patch({ computerLocationReference: e.target.value })}
                        />
                      </EfField>
                    </div>
                    
                    <div style={{ marginTop: '16px' }}>
                      <EfSwitchRow 
                        label="Physical PC Available" 
                        checked={formData.physicalPcAvailable} 
                        onChange={(v) => patch({ physicalPcAvailable: v })} 
                      />
                    </div>
                    
                    <div style={{ marginTop: '16px' }}>
                      <EfField label="Remarks">
                        <textarea
                          className="ef-input"
                          style={{ minHeight: '80px', padding: '12px' }}
                          value={formData.remarks || ''}
                          onChange={(e) => patch({ remarks: e.target.value })}
                        />
                      </EfField>
                    </div>
                  </div>
                )}
              </div>

              <div className="con-drawer-footer">
                <button className="con-drawer-btn-cancel" onClick={closeDrawer}>Cancel</button>
                <button className="con-drawer-btn-save" onClick={handleSave}>Save</button>
              </div>
            </>
          )}
          
          {drawerMode === 'delete' && (
            <div className="con-drawer-body delete-mode">
               <p>Are you sure you want to deactivate this consultant?</p>
               <div className="con-drawer-footer">
                <button className="con-drawer-btn-cancel" onClick={closeDrawer}>Cancel</button>
                <button className="con-drawer-btn-save danger" onClick={handleConfirmDelete}>Deactivate</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
