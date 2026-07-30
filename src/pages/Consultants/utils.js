export const normalizeConsultant = (c, isActive = true) => {
  if (!c) return null;

  let avatarUrl = c.photo || c.avatar || c.profile_image || '';
  if (avatarUrl && typeof avatarUrl === 'string') {
    avatarUrl = avatarUrl.replace(/\s+/g, ''); // strip newlines/spaces
    if (avatarUrl.startsWith('ZGF0Y') || 
        avatarUrl.startsWith('Lzlq') || 
        avatarUrl.startsWith('aVZCT') || 
        avatarUrl.startsWith('UjBs') ||
        avatarUrl.startsWith('VWtsR') ||
        avatarUrl.startsWith('UWtN')) {
      try {
        avatarUrl = atob(avatarUrl);
      } catch (e) {
        console.warn('Failed to decode base64 avatar');
      }
    }
    if (avatarUrl && !avatarUrl.startsWith('data:image')) {
      avatarUrl = `data:image/jpeg;base64,${avatarUrl}`;
    }
  }

  return {
    id: c.emp_id || c.id || Math.random().toString(),
    name: c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
    userId: c.userId || c.user_name || c.username || c.emp_id || '',
    designation: c.designation_name || c.designation || c.role?.name || 'Consultant',
    designationId: c.designation_id || (c.designation && !isNaN(Number(c.designation)) ? Number(c.designation) : '') || '',
    email: c.email || '',
    phone: c.mobile || c.phone || '',
    gender: c.gender || 'Not Specified',
    manager: c.manager_name || c.manager?.name || c.manager || 'No Manager',
    joiningDate: c.joining_date || c.joiningDate || c.date_joined || '',
    role: c.role_name || c.role?.name || c.role || 'Consultant',
    location: c.location || 'On Site',
    accountStatus: isActive ? 'active' : 'inactive',
    avatar: avatarUrl,
    roleId: c.role_id || (typeof c.role === 'object' ? c.role?.id : c.role) || '',
    teamId: c.team_id || (typeof c.team === 'object' ? c.team?.id : c.team) || '',
    team: c.team_name || c.team?.name || c.team || c.department || 'Unassigned',
    managerId: c.manager_id || c.manager_emp_id || (typeof c.manager === 'object' ? c.manager?.emp_id || c.manager?.id : c.manager) || '',
    
    // Additional Info & Assets
    webexId: c.webex_id || '',
    includeInCp: c.include_in_cp === 1 || c.include_in_cp === true || c.include_in_cp === '1',
    visa: c.visa || '',
    visaNumber: c.visa_number || '',
    visaExpire: c.visa_expiry || c.visa_expire || '',
    visaRenewal: c.visa_renewal || '',
    nextVisaExit: c.next_visa_exit || '',
    computerName: c.computer_name || '',
    computerLocation: c.computer_location || c.pc_location || '',
    computerLocationReference: c.computer_location_ref || c.location_reference || '',
    physicalPcAvailable: c.physical_pc_available === 'Yes' || c.physical_pc_available === 1 || c.physical_pc_available === true || c.physical_pc_available === '1',
    remarks: c.remarks || ''
  };
};
