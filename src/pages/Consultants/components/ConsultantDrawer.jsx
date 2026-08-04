import {
  X,
  Upload,
  Key,
  User,
  Info,
  Trash2,
  Camera,
  Mail,
  Phone,
  Shield,
  Lock,
  Plus,
} from 'lucide-react';
import { Select } from '@components/forms/Select/Select';
import { DatePicker } from '@components/forms/DatePicker/DatePicker';
import { Button, Input, PasswordInput, Tabs, Textarea } from '@components/common';

import { EfSection, EfField, EfSwitchRow } from './DrawerFormControls';

const STATIC_GENDERS = ['Male', 'Female', 'Other'];
const STATIC_STATUSES = ['active', 'inactive', 'pending'];

function ConsultantInfoTab({ formData, patch, handlePhotoUpload, handlePhotoRemove, dynamicRoles, dynamicDesignations, dynamicTeams, dynamicEmployees, onAddDesignation }) {
  return (
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
              <Button variant="danger" size="sm" leadingIcon={Trash2} onClick={handlePhotoRemove}>
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      <EfSection label="Personal Information" />
      <div className="ef-grid">
        <EfField label="Full Name" required>
          <Input
            icon={User}
            value={formData.name || ''}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="Full legal name"
          />
        </EfField>

        <EfField label="Gender">
          <Select
            value={formData.gender || ''}
            onChange={(v) => patch({ gender: v })}
            options={[{ value: '', label: 'Select gender' }, ...STATIC_GENDERS.map(g => ({ value: g, label: g }))]}
          />
        </EfField>

        <EfField label="Email Address" required>
          <Input
            type="email"
            icon={Mail}
            value={formData.email || ''}
            onChange={(e) => patch({ email: e.target.value })}
          />
        </EfField>

        <EfField label="Mobile Number">
          <Input
            type="tel"
            icon={Phone}
            value={formData.mobile || ''}
            onChange={(e) => patch({ mobile: e.target.value })}
          />
        </EfField>

        <EfField label="Landline">
          <Input
            type="tel"
            value={formData.landline || ''}
            onChange={(e) => patch({ landline: e.target.value })}
          />
        </EfField>

        <EfField label="Extension">
          <Input
            value={formData.extension || ''}
            onChange={(e) => patch({ extension: e.target.value })}
          />
        </EfField>

        <EfField label="Address" className="ef-col-span-2">
          <Input
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
          <div className="ef-inline-select-row">
            <Select
              value={String(formData.designation_name || formData.designation || '')}
              onChange={(v) => patch({ designation: v, designation_name: v })}
              options={[{ value: '', label: 'Select designation' }, ...dynamicDesignations.map(d => ({ value: d.name || d.designation || '', label: d.name || d.designation || '' }))]}
            />
            <Button
              variant="outline"
              size="iconOnly"
              leadingIcon={Plus}
              onClick={onAddDesignation}
              title="Add Designation"
              aria-label="Add Designation"
            />
          </div>
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
      </div>
    </div>
  );
}

function UserInfoTab({ formData, patch, dynamicRoles, isEditing }) {
  return (
    <div className="ef-form">
      <EfSection label="Account Identity" />
      <div className="ef-grid">
        <EfField label="Username / Employee ID" required>
          <Input
            icon={Shield}
            value={formData.username || ''}
            onChange={(e) => patch({ username: e.target.value })}
          />
        </EfField>
        <EfField label="Account Status">
          <Select
            value={formData.status || 'active'}
            onChange={(v) => patch({ status: v })}
            options={STATIC_STATUSES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
          />
        </EfField>
        <EfField label="Role">
          <Select
            value={formData.role || ''}
            onChange={(v) => patch({ role: v })}
            options={[{ value: '', label: 'Select role' }, ...dynamicRoles.map(r => ({ value: r.name || r.roleName, label: r.name || r.roleName }))]}
          />
        </EfField>
        {!isEditing && (
          <EfField label="Initial Password" required>
            <PasswordInput
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
  );
}

function AdditionalInfoTab({ formData, patch, dynamicCompLocations, onAddComputerLocation }) {
  return (
    <div className="ef-form">
      <EfSection label="VISA INFORMATION" />
      <div className="ef-grid">
        <EfField label="VISA NUMBER">
          <Input
            placeholder="Visa document number"
            value={formData.visaNumber || ''}
            onChange={(e) => patch({ visaNumber: e.target.value })}
          />
        </EfField>
        <EfField label="VISA TYPE">
          <Input
            placeholder="e.g. H1-B, Work Permit"
            value={formData.visa || ''}
            onChange={(e) => patch({ visa: e.target.value })}
          />
        </EfField>
        <EfField label="VISA EXPIRY">
          <DatePicker
            value={formData.visaExpire ? new Date(formData.visaExpire) : null}
            onChange={(d) => patch({ visaExpire: d ? d.toISOString().split('T')[0] : '' })}
          />
        </EfField>
        <EfField label="VISA RENEWAL DATE">
          <DatePicker
            value={formData.visaRenewal ? new Date(formData.visaRenewal) : null}
            onChange={(d) => patch({ visaRenewal: d ? d.toISOString().split('T')[0] : '' })}
          />
        </EfField>
        <div style={{ gridColumn: '1 / -1' }}>
          <EfField label="NEXT VISA EXIT">
            <DatePicker
              value={formData.nextVisaExit ? new Date(formData.nextVisaExit) : null}
              onChange={(d) => patch({ nextVisaExit: d ? d.toISOString().split('T')[0] : '' })}
            />
          </EfField>
        </div>
      </div>

      <EfSection label="WORK ASSIGNMENT" />
      <div className="ef-grid">
        <EfField label="WEBEX / CHAT ID">
          <Input
            placeholder="username@chat.com"
            value={formData.webexId || ''}
            onChange={(e) => patch({ webexId: e.target.value })}
          />
        </EfField>
        <EfField label="WORK LOCATION">
          <div className="ef-segmented-row">
            <button
              type="button"
              className="ef-segmented-btn"
              data-active={formData.location === 'On Site'}
              onClick={() => patch({ location: 'On Site' })}
            >
              ● On Site
            </button>
            <button
              type="button"
              className="ef-segmented-btn"
              data-active={formData.location === 'Off Site'}
              onClick={() => patch({ location: 'Off Site' })}
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
              <Input
                placeholder="e.g. PC-EMP001"
                value={formData.computerName || ''}
                onChange={(e) => patch({ computerName: e.target.value })}
              />
            </EfField>
            <EfField label="COMPUTER LOCATION">
              <div className="ef-inline-select-row">
                <Select
                  value={formData.computerLocation || ''}
                  onChange={(v) => patch({ computerLocation: v })}
                  options={[{ value: '', label: 'e.g. Floor 3 - Zone B' }, ...dynamicCompLocations.map(cl => ({ value: cl.name, label: cl.name }))]}
                />
                <Button
                  variant="outline"
                  size="iconOnly"
                  leadingIcon={Plus}
                  onClick={onAddComputerLocation}
                  title="Add Computer Location"
                  aria-label="Add Computer Location"
                />
              </div>
            </EfField>
            <div style={{ gridColumn: '1 / -1' }}>
              <EfField label="LOCATION REFERENCE">
                <Input
                  placeholder="Desk / bay reference number"
                  value={formData.computerLocationReference || ''}
                  onChange={(e) => patch({ computerLocationReference: e.target.value })}
                />
              </EfField>
            </div>
          </div>
        </>
      )}

      <EfSection label="REMARKS" />
      <EfField label="Additional Notes">
        <Textarea
          rows={3}
          value={formData.remarks || ''}
          onChange={(e) => patch({ remarks: e.target.value })}
        />
      </EfField>
    </div>
  );
}

function PasswordModeBody({ passwordData, setPasswordData }) {
  return (
    <div className="con-drawer-body">
      <div className="ef-form" style={{ marginTop: '8px' }}>
        <EfSection label="NEW CREDENTIALS" />
        <div className="ef-grid">
          <EfField label="NEW PASSWORD" required>
            <PasswordInput
              icon={Lock}
              placeholder="Enter new password"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData(p => ({ ...p, newPassword: e.target.value }))}
              autoComplete="new-password"
            />
          </EfField>
          <EfField label="CONFIRM PASSWORD" required>
            <PasswordInput
              icon={Lock}
              placeholder="Re-enter password"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData(p => ({ ...p, confirmPassword: e.target.value }))}
              autoComplete="new-password"
            />
          </EfField>
        </div>
      </div>
    </div>
  );
}

const FORM_TABS = [
  { id: 'consultant-info', label: 'Consultant Info', Icon: User },
  { id: 'user-info', label: 'User Info', Icon: Shield },
  { id: 'additional-info', label: 'Additional Info', Icon: Info },
];

export function ConsultantDrawer({
  drawerMode, drawerOpen, closeDrawer, drawerTitle, editingTarget, isEditing,
  formTab, setFormTab, formData, patch,
  handlePhotoUpload, handlePhotoRemove,
  dynamicRoles, dynamicDesignations, dynamicTeams, dynamicEmployees, dynamicCompLocations,
  onAddDesignation, onAddComputerLocation,
  passwordData, setPasswordData,
  handleSave, handleConfirmDelete,
}) {
  if (drawerMode === null) return null;

  return (
    <>
      <div className={`con-drawer-backdrop${drawerOpen ? ' open' : ''}`} onClick={closeDrawer} />
      <div className={`con-drawer${drawerOpen ? ' open' : ''}`}>
        <div className="con-drawer-header">
          <div className="con-drawer-title-row">
            <p className="con-drawer-title">{drawerTitle}</p>
            {drawerMode === 'password' ? (
              <p className="con-drawer-sub">
                Reset access for {editingTarget?.userId}
              </p>
            ) : isEditing ? (
              <p className="con-drawer-sub">
                {editingTarget?.userId} · {editingTarget?.team}
              </p>
            ) : null}
          </div>
          <button className="con-drawer-close" onClick={closeDrawer} aria-label="Close drawer">
            <X size={14} />
          </button>
        </div>

        {drawerMode === 'add-edit' && (
          <>
            <Tabs
              tabs={FORM_TABS.map(({ id, label, Icon }) => ({ id, label, icon: Icon }))}
              activeTab={formTab}
              onChange={setFormTab}
              className="con-drawer-tabs"
            />

            <div className="con-drawer-body">
              {formTab === 'consultant-info' && (
                <ConsultantInfoTab
                  formData={formData}
                  patch={patch}
                  handlePhotoUpload={handlePhotoUpload}
                  handlePhotoRemove={handlePhotoRemove}
                  dynamicRoles={dynamicRoles}
                  dynamicDesignations={dynamicDesignations}
                  dynamicTeams={dynamicTeams}
                  dynamicEmployees={dynamicEmployees}
                  onAddDesignation={onAddDesignation}
                />
              )}
              {formTab === 'user-info' && (
                <UserInfoTab formData={formData} patch={patch} dynamicRoles={dynamicRoles} isEditing={isEditing} />
              )}
              {formTab === 'additional-info' && (
                <AdditionalInfoTab
                  formData={formData}
                  patch={patch}
                  dynamicCompLocations={dynamicCompLocations}
                  onAddComputerLocation={onAddComputerLocation}
                />
              )}
            </div>
            <div className="con-drawer-footer">
              <Button variant="outline" onClick={closeDrawer}>Cancel</Button>
              <Button variant="primary" onClick={handleSave}>Save</Button>
            </div>
          </>
        )}

        {drawerMode === 'delete' && (
          <>
            <div className="con-drawer-body delete-mode">
              <p>Are you sure you want to deactivate <strong>{editingTarget?.name}</strong>?</p>
            </div>
            <div className="con-drawer-footer">
              <Button variant="outline" onClick={closeDrawer}>Cancel</Button>
              <Button variant="danger" onClick={handleConfirmDelete}>Deactivate</Button>
            </div>
          </>
        )}

        {drawerMode === 'password' && (
          <>
            <PasswordModeBody
              passwordData={passwordData}
              setPasswordData={setPasswordData}
            />
            <div className="con-drawer-footer">
              <Button variant="outline" onClick={closeDrawer}>Cancel</Button>
              <Button variant="primary" leadingIcon={Key} onClick={handleSave}>Update Password</Button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default ConsultantDrawer;
