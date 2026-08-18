export const normalizeConsultant = (c, isActive = true) => {
  if (!c) return null;

  let avatarUrl = c.photo || c.avatar || c.profile_image || c.photo_url || '';
  if (avatarUrl && typeof avatarUrl === 'string') {
    avatarUrl = avatarUrl.replace(/\s+/g, ''); // strip newlines/spaces

    if (!avatarUrl) {
      avatarUrl = '';
    } else if (avatarUrl.startsWith('data:image')) {
      // Already a valid data URI — use as-is
    } else if (
      avatarUrl.startsWith('http://') ||
      avatarUrl.startsWith('https://') ||
      avatarUrl.startsWith('blob:')
    ) {
      // Absolute URL — use as-is
    } else if (avatarUrl.startsWith('/')) {
      // Relative URL path from the API server — prepend API origin
      const apiOrigin = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api')
        .replace(/\/api\/?$/, '');
      avatarUrl = `${apiOrigin}${avatarUrl}`;
    } else {
      // Assume it's raw base64 data — try to detect common base64 JPEG/PNG headers
      try {
        avatarUrl = `data:image/jpeg;base64,${avatarUrl}`;
      } catch (e) {
        console.warn('Invalid avatar data');
        avatarUrl = '';
      }
    }
  }

  // Map single-character gender to full string for the UI
  let mappedGender = c.gender || '';
  if (mappedGender === 'M') mappedGender = 'Male';
  else if (mappedGender === 'F') mappedGender = 'Female';
  else if (mappedGender === 'O') mappedGender = 'Other';
  else if (!mappedGender) mappedGender = '';

  return {
    id: c.emp_id || c.id || Math.random().toString(),
    name: c.name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
    userId: c.userId || c.user_name || c.username || c.emp_id || '',
    designation: c.designation_name || c.designation || c.role?.name || 'Consultant',
    designationId: c.designation_id || (c.designation && !isNaN(Number(c.designation)) ? Number(c.designation) : '') || '',
    email: c.email || '',
    phone: c.mobile || c.phone || '',
    mobile: c.mobile || c.phone || '',
    landline: c.landline || '',
    extension: c.extension || '',
    address: c.address || '',
    gender: mappedGender,
    manager: c.manager_name || c.manager?.name || c.manager || 'No Manager',
    joiningDate: c.joining_date || c.joiningDate || c.date_joined || '',
    role: c.role_name || c.role?.name || c.role || 'Consultant',
    location: c.location || 'On Site',
    accountStatus: isActive ? 'active' : 'inactive',
    avatar: avatarUrl,
    photo: c.photo || c.photo_url_base64 || '',
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
