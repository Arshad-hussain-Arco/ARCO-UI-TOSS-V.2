import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const consultantService = {
  getEmployeesList: async () => {
    const response = await httpClient.get(endpoints.consultants.list);
    return response.data;
  },
  getConsultantInfo: async (id) => {
    const response = await httpClient.get(endpoints.consultants.info(id));
    return response.data;
  },
  createConsultant: async (payload) => {
    const data = {
      name: payload.name,
      user_name: payload.username || payload.userId,
      password: payload.password,
      designation: payload.designation_name || payload.designation,
      team_id: payload.teamId || payload.team_id || payload.team,
      joining_date: payload.joiningDate,
      mobile: payload.mobile || payload.phone,
      email: payload.email,
      landline: payload.landline,
      extension: payload.extension || null,
      address: payload.address,
      role_id: payload.roleId || payload.role_id || payload.role,
      webex_id: payload.webexId,
      include_in_cp: payload.includeInCp || false,
      visa: payload.visa,
      visa_expiry: payload.visaExpire,
      visa_renewal: payload.visaRenewal,
      next_visa_exit: payload.nextVisaExit,
      location: payload.location,
      status: payload.accountStatus ? payload.accountStatus.toUpperCase() : 'ACTIVE',
      computer_name: payload.computerName || '',
      computer_location: payload.computerLocation || '',
      computer_location_ref: payload.computerLocationReference || '',
      physical_pc_available: payload.physicalPcAvailable ? 1 : 0,
      remarks: payload.remarks || '',
    };
    const response = await httpClient.post(endpoints.consultants.create, data);
    return response.data;
  },
  updateConsultant: async (payload) => {
    const data = {
      emp_id: payload.id || payload.emp_id,
      name: payload.name,
      user_name: payload.username || payload.userId || payload.user_name,
      password: payload.password,
      designation: payload.designation_name || payload.designation,
      team_id: Number(payload.teamId || payload.team_id || payload.team),
      role_id: Number(payload.roleId || payload.role_id || payload.role),
      manager_id: payload.managerId || payload.manager_id ? Number(payload.managerId || payload.manager_id) : null,
      status: payload.accountStatus ? payload.accountStatus.toUpperCase() : 'ACTIVE',
      joining_date: payload.joiningDate || payload.joining_date,
      mobile: payload.mobile || payload.phone,
      email: payload.email,
      landline: payload.landline,
      extension: payload.extension || null,
      address: payload.address,
      webex_id: payload.webexId || payload.webex_id,
      include_in_cp: payload.includeInCp ?? payload.include_in_cp ?? false,
      visa: payload.visa,
      visa_expiry: payload.visaExpire || payload.visa_expiry,
      visa_renewal: payload.visaRenewal || payload.visa_renewal,
      next_visa_exit: payload.nextVisaExit || payload.next_visa_exit,
      location: payload.location,
      computer_name: payload.computerName || payload.computer_name || '',
      computer_location: payload.computerLocation || payload.computer_location || '',
      computer_location_ref: payload.computerLocationReference || payload.computer_location_ref || '',
      physical_pc_available: (payload.physicalPcAvailable || payload.physical_pc_available) ? 1 : 0,
      remarks: payload.remarks || '',
    };
    const response = await httpClient.put(endpoints.consultants.update, data);
    return response.data;
  },
  deleteConsultant: async (payload) => {
    const data = {
      emp_id: payload.id || payload.emp_id,
      status: 'INACTIVE',
      name: payload.name || payload.userId,
    };
    const response = await httpClient.post(endpoints.consultants.delete, data);
    return response.data;
  },
  getConsultants: async (params) => {
    const response = await httpClient.get(endpoints.consultants.list, { params });
    return response.data;
  },
  getInactiveConsultants: async (params) => {
    const response = await httpClient.get(endpoints.consultants.inactive, { params });
    return response.data;
  },
  getTeams: async () => {
    const response = await httpClient.get(endpoints.consultants.teams);
    return response.data;
  },
  createTeam: async (payload) => {
    const response = await httpClient.post(endpoints.consultants.teams, payload);
    return response.data;
  },
  updateTeam: async (id, payload) => {
    const response = await httpClient.patch(endpoints.consultants.teamDetail(id), payload);
    return response.data;
  },
  deleteTeam: async (id) => {
    const response = await httpClient.delete(endpoints.consultants.teamDetail(id));
    return response.data;
  },
  getDesignationsAndTeams: async () => {
    const response = await httpClient.get(endpoints.consultants.designationsTeams);
    return response.data;
  },
  getDesignations: async () => {
    const response = await httpClient.get(endpoints.consultants.designations);
    return response.data;
  },
  createDesignation: async (payload) => {
    const response = await httpClient.post(endpoints.consultants.designations, payload);
    return response.data;
  },
  updateDesignation: async (id, payload) => {
    const response = await httpClient.patch(endpoints.consultants.designationDetail(id), payload);
    return response.data;
  },
  deleteDesignation: async (id) => {
    const response = await httpClient.delete(endpoints.consultants.designationDetail(id));
    return response.data;
  },
  getLocations: async () => {
    const response = await httpClient.get(endpoints.consultants.locations);
    return response.data;
  },
  getRoles: async () => {
    const response = await httpClient.get(endpoints.consultants.roles);
    return response.data;
  },
  getComputerLocations: async () => {
    const response = await httpClient.get(endpoints.consultants.computerLocations);
    return response.data;
  },
  createComputerLocation: async (payload) => {
    const response = await httpClient.post(endpoints.consultants.computerLocations, payload);
    return response.data;
  },
  updateComputerLocation: async (id, payload) => {
    const response = await httpClient.patch(endpoints.consultants.computerLocationDetail(id), payload);
    return response.data;
  },
  deleteComputerLocation: async (id) => {
    const response = await httpClient.delete(endpoints.consultants.computerLocationDetail(id));
    return response.data;
  },
  getMyTeam: async (managerId) => {
    const response = await httpClient.get(endpoints.consultants.myTeam(managerId));
    return response.data;
  },
  activateConsultant: async (payload) => {
    const response = await httpClient.post(endpoints.consultants.activate, payload);
    return response.data;
  },
  uploadPhoto: async (id, base64Photo) => {
    const response = await httpClient.post(endpoints.consultants.photoUpload(id), { photo: base64Photo });
    return response.data;
  },
  deletePhoto: async (id) => {
    const response = await httpClient.delete(endpoints.consultants.photoDelete(id));
    return response.data;
  },
  getTeamHeadcount: async () => {
    const response = await httpClient.get(endpoints.consultants.teamHeadcount);
    return response.data;
  },
};

export default consultantService;
