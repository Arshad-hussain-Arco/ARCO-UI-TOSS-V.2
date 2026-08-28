import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const leaveService = {
  // Shift Management APIs
  listShifts: async () => {
    const response = await httpClient.get(endpoints.hr.shifts.list);
    return response.data;
  },

  // Holiday Management APIs
  listHolidays: async (params) => {
    const response = await httpClient.get(endpoints.hr.holidaysManagement.list, { params });
    return response.data;
  },
  addHoliday: async (payload) => {
    const response = await httpClient.post(endpoints.hr.holidaysManagement.add, payload);
    return response.data;
  },
  editHoliday: async (id, payload) => {
    const response = await httpClient.patch(endpoints.hr.holidaysManagement.edit(id), payload);
    return response.data;
  },
  deleteHoliday: async (id, payload) => {
    const response = await httpClient.delete(endpoints.hr.holidaysManagement.delete(id), { data: payload });
    return response.data;
  },

  getLeaveBalance: async (empId) => {
    try {
      const response = await httpClient.get(endpoints.me.balance(empId));
      return response.data;
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      throw error;
    }
  },
  getEligibleLeaveTypes: async (empId) => {
    try {
      const response = await httpClient.get(endpoints.me.eligibleLeaveTypes(empId));
      return response.data;
    } catch (error) {
      console.error('Error fetching eligible leave types:', error);
      throw error;
    }
  },
  getMyLeaves: async (empId, params = {}) => {
    try {
      const response = await httpClient.get(endpoints.me.leaves(empId), { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching leaves:', error);
      throw error;
    }
  },
  // The employee's own pending/approved/rejected requests to modify an
  // already-APPROVED leave — shown alongside getMyLeaves() in the Leaves
  // tab so a pending edit awaiting manager re-approval is visible.
  getMyModRequests: async (empId, params = {}) => {
    try {
      const response = await httpClient.get(endpoints.me.modRequests(empId), { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching modification requests:', error);
      throw error;
    }
  },
  // Employee withdraws their own pending request to modify an already-
  // approved leave, before the manager reviews it. The original leave is
  // untouched by this — only the pending request itself is cancelled.
  cancelModRequest: async (modId, payload) => {
    const response = await httpClient.post(endpoints.me.cancelModRequest(modId), payload);
    return response.data;
  },
  getTeamLeaves: async (managerId) => {
    try {
      const response = await httpClient.get(endpoints.me.teamLeaves(managerId));
      return response.data;
    } catch (error) {
      console.error('Error fetching team leaves:', error);
      throw error;
    }
  },
  applyLeave: async (payload) => {
    try {
      const response = await httpClient.post(endpoints.me.applyLeave, payload);
      return response.data;
    } catch (error) {
      console.error('Error applying leave:', error);
      throw error;
    }
  },
  getEmployeeLeaveByYear: async (empId) => {
    const response = await httpClient.get(endpoints.me.employeeLeaveByYear(empId));
    return response.data;
  },
  getCalendar: async (empId, params) => {
    const response = await httpClient.get(endpoints.me.calendar(empId), { params });
    return response.data;
  },
  modifyLeave: async (leaveId, payload) => {
    const response = await httpClient.put(endpoints.me.modifyLeave(leaveId), payload);
    return response.data;
  },
  cancelLeave: async (leaveId, payload) => {
    const response = await httpClient.post(endpoints.me.cancelLeave(leaveId), payload);
    return response.data;
  },
  getLeaveHistory: async (leaveId) => {
    const response = await httpClient.get(endpoints.me.leaveHistory(leaveId));
    return response.data;
  },
  // Deprecated — kept for backward compatibility only. Use claimSubmit
  // instead, which works for any Claim-category leave type.
  claimWeekend: async (payload) => {
    const response = await httpClient.post(endpoints.me.claimWeekend, payload);
    return response.data;
  },
  claimCompOff: async (payload) => {
    const response = await httpClient.post(endpoints.me.claimCompOff, payload);
    return response.data;
  },
  // Generic claim submission — payload: { emp_id, leave_type_code, dates: [...], reason }.
  // `dates` is an explicit list of individual dates (not a range) — see
  // ClaimSubmitSerializer on the backend for why.
  claimSubmit: async (payload) => {
    const response = await httpClient.post(endpoints.me.claimSubmit, payload);
    return response.data;
  },
  // Which dates in [start, end] qualify as claimable for a given Claim leave
  // type, per its configured claim_date_rule. Returns { eligible_dates: [...] }.
  getClaimEligibleDates: async ({ emp_id, leave_type_code, start, end }) => {
    const response = await httpClient.get(endpoints.me.claimEligibleDates, {
      params: { emp_id, leave_type_code, start, end },
    });
    return response.data;
  },
  requestWfh: async (payload) => {
    const response = await httpClient.post(endpoints.me.wfh, payload);
    return response.data;
  },
  partialCancelLeave: async (leaveId, payload) => {
    const response = await httpClient.post(endpoints.me.partialCancel(leaveId), payload);
    return response.data;
  },
  applyOwLeave: async (payload) => {
    const response = await httpClient.post(endpoints.me.owApply, payload);
    return response.data;
  },
  modifyOwLeave: async (leaveId, payload) => {
    const response = await httpClient.patch(endpoints.me.owModify(leaveId), payload);
    return response.data;
  },
  remindManager: async (leaveId, payload) => {
    const response = await httpClient.post(endpoints.me.remindManager(leaveId), payload);
    return response.data;
  },
  exportLeaves: async (empId, params) => {
    const response = await httpClient.get(endpoints.me.exportLeaves(empId), { params, responseType: 'blob' });
    return response.data;
  },
  importLeaves: async (empId, formData) => {
    const response = await httpClient.post(endpoints.me.importLeaves(empId), formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  getNotifications: async (params) => {
    const response = await httpClient.get(endpoints.me.notifications, { params });
    return response.data;
  },
  getNotificationsUnreadCount: async (params) => {
    const response = await httpClient.get(endpoints.me.notificationsUnreadCount, { params });
    return response.data;
  },
  markAllNotificationsRead: async (payload) => {
    const response = await httpClient.post(endpoints.me.notificationsMarkAllRead, payload);
    return response.data;
  },
  markNotificationRead: async (notificationId, payload) => {
    const response = await httpClient.patch(endpoints.me.notificationMarkRead(notificationId), payload);
    return response.data;
  },

  // --- Manager Endpoints ---
  getManagerPendingLeaves: async (managerId) => {
    const response = await httpClient.get(endpoints.manager.pending(managerId));
    return response.data;
  },
  getTeamBalances: async (managerId, params) => {
    const response = await httpClient.get(endpoints.manager.teamBalances(managerId), { params });
    return response.data;
  },
  getTeamHeadcount: async (managerId, params) => {
    const response = await httpClient.get(endpoints.manager.headcount(managerId), { params });
    return response.data;
  },
  getPendingModRequests: async (managerId) => {
    const response = await httpClient.get(endpoints.manager.modRequests(managerId));
    return response.data;
  },
  getLeaveConflicts: async (params) => {
    const response = await httpClient.get(endpoints.manager.conflicts, { params });
    return response.data;
  },
  applyLeaveOnBehalf: async (payload) => {
    const response = await httpClient.post(endpoints.manager.applyOnBehalf, payload);
    return response.data;
  },
  editLeaveOnBehalf: async (leaveId, payload) => {
    const response = await httpClient.patch(endpoints.manager.editOnBehalf(leaveId), payload);
    return response.data;
  },
  approveLeave: async (leaveId, payload) => {
    const response = await httpClient.post(endpoints.manager.approveLeave(leaveId), payload);
    return response.data;
  },
  rejectLeave: async (leaveId, payload) => {
    const response = await httpClient.post(endpoints.manager.rejectLeave(leaveId), payload);
    return response.data;
  },
  approveModRequest: async (modId, payload) => {
    const response = await httpClient.post(endpoints.manager.approveModRequest(modId), payload);
    return response.data;
  },
  rejectModRequest: async (modId, payload) => {
    const response = await httpClient.post(endpoints.manager.rejectModRequest(modId), payload);
    return response.data;
  },
  getOwExcessList: async (params) => {
    const response = await httpClient.get(endpoints.manager.owExcess, { params });
    return response.data;
  },
  approveOwExcess: async (excessId, payload) => {
    const response = await httpClient.post(endpoints.manager.approveOwExcess(excessId), payload);
    return response.data;
  },
  rejectOwExcess: async (excessId, payload) => {
    const response = await httpClient.post(endpoints.manager.rejectOwExcess(excessId), payload);
    return response.data;
  },
  modApproveOwExcess: async (excessId, payload) => {
    const response = await httpClient.post(endpoints.manager.modApproveOwExcess(excessId), payload);
    return response.data;
  },
  modRejectOwExcess: async (excessId, payload) => {
    const response = await httpClient.post(endpoints.manager.modRejectOwExcess(excessId), payload);
    return response.data;
  },
  exportTeamLeaves: async (managerId, params) => {
    const response = await httpClient.get(endpoints.manager.exportLeaves(managerId), { params, responseType: 'blob' });
    return response.data;
  },
  importTeamLeaves: async (managerId, formData) => {
    const response = await httpClient.post(endpoints.manager.importLeaves(managerId), formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
  getTeamCalendar: async (managerId, params) => {
    const response = await httpClient.get(endpoints.manager.teamCalendar(managerId), { params });
    return response.data;
  },
  getTeamEmployeeCalendars: async (managerId, params) => {
    const response = await httpClient.get(endpoints.manager.teamEmployeeCalendars(managerId), { params });
    return response.data;
  },
  getTeamPresentToday: async (managerId) => {
    const response = await httpClient.get(endpoints.manager.teamPresentToday(managerId));
    return response.data;
  },
  getTeamOnLeaveToday: async (managerId) => {
    const response = await httpClient.get(endpoints.manager.teamOnLeaveToday(managerId));
    return response.data;
  },
  getTeamOnWfhToday: async (managerId) => {
    const response = await httpClient.get(endpoints.manager.teamOnWfhToday(managerId));
    return response.data;
  },
  getLeaveTypesReference: async () => {
    const response = await httpClient.get(endpoints.manager.leaveTypesReference);
    return response.data;
  },
  getAllLeaveTypes: async () => {
    const response = await httpClient.get(endpoints.hr.allLeaveTypes);
    return response.data;
  },

  // --- HR / Policy / Reports Endpoints ---
  getLeaveTypes: async (params) => {
    const response = await httpClient.get(endpoints.hr.leaveTypes, { params });
    return response.data;
  },
  getLeaveType: async (id) => {
    const response = await httpClient.get(endpoints.hr.leaveTypeDetail(id));
    return response.data;
  },
  createLeaveType: async (payload) => {
    const response = await httpClient.post(endpoints.hr.leaveTypes, payload);
    return response.data;
  },
  updateLeaveType: async (id, payload) => {
    const response = await httpClient.put(endpoints.hr.leaveTypeDetail(id), payload);
    return response.data;
  },
  deactivateLeaveType: async (id) => {
    const response = await httpClient.delete(endpoints.hr.leaveTypeDetail(id));
    return response.data;
  },
  activateLeaveType: async (id) => {
    const response = await httpClient.put(endpoints.hr.leaveTypeDetail(id), { is_active: true });
    return response.data;
  },

  // Leave Type + Policy (combined) — one save creates/updates both rows
  getLeaveTypesWithPolicy: async (params) => {
    const response = await httpClient.get(endpoints.hr.leaveTypesWithPolicy, { params });
    return response.data;
  },
  getLeaveTypeWithPolicy: async (code) => {
    const response = await httpClient.get(endpoints.hr.leaveTypeWithPolicyDetail(code));
    return response.data;
  },
  createLeaveTypeWithPolicy: async (payload) => {
    const response = await httpClient.post(endpoints.hr.leaveTypesWithPolicy, payload);
    return response.data;
  },
  updateLeaveTypeWithPolicy: async (code, payload) => {
    const response = await httpClient.put(endpoints.hr.leaveTypeWithPolicyDetail(code), payload);
    return response.data;
  },
  deleteLeaveTypeWithPolicy: async (code) => {
    const response = await httpClient.delete(endpoints.hr.leaveTypeWithPolicyDetail(code));
    return response.data;
  },

  // Work locations, for the "Requires Work Location" leave-type setting
  getWorkLocations: async () => {
    const response = await httpClient.get(endpoints.consultants.locations);
    return response.data;
  },

  // Standalone Organization Leave Policy CRUD (kept for other consumers; the
  // admin Leave Configurations page uses the combined functions above)
  getPolicies: async (params) => {
    const response = await httpClient.get(endpoints.hr.policies, { params });
    return response.data;
  },
  getPolicy: async (id) => {
    const response = await httpClient.get(endpoints.hr.policyDetail(id));
    return response.data;
  },
  createPolicy: async (payload) => {
    const response = await httpClient.post(endpoints.hr.policies, payload);
    return response.data;
  },
  updatePolicy: async (id, payload) => {
    const response = await httpClient.put(endpoints.hr.policyDetail(id), payload);
    return response.data;
  },
  deactivatePolicy: async (id) => {
    const response = await httpClient.delete(endpoints.hr.policyDetail(id));
    return response.data;
  },
  activatePolicy: async (id) => {
    const response = await httpClient.put(endpoints.hr.policyDetail(id), { is_active: true });
    return response.data;
  },
  // Overlap Adjustment Policy CRUD — configures which leave type(s) get
  // pushed/pulled/split/rejected when another leave type is applied for
  // (e.g. AL -> WFH, Any -> OW). Source blank = "any leave type".
  getOverlapPolicies: async (params) => {
    const response = await httpClient.get(endpoints.hr.overlapPolicies, { params });
    return response.data;
  },
  createOverlapPolicy: async (payload) => {
    const response = await httpClient.post(endpoints.hr.overlapPolicies, payload);
    return response.data;
  },
  updateOverlapPolicy: async (id, payload) => {
    const response = await httpClient.put(endpoints.hr.overlapPolicyDetail(id), payload);
    return response.data;
  },
  deleteOverlapPolicy: async (id) => {
    const response = await httpClient.delete(endpoints.hr.overlapPolicyDetail(id));
    return response.data;
  },
  getWorkScheduleOptions: async () => {
    const response = await httpClient.get(endpoints.hr.workScheduleOptions);
    return response.data;
  },
  getWorkScheduleSummary: async () => {
    const response = await httpClient.get(endpoints.hr.workScheduleSummary);
    return response.data;
  },
  getGradePolicies: async () => {
    const response = await httpClient.get(endpoints.hr.gradePolicies);
    return response.data;
  },
  createGradePolicy: async (payload) => {
    const response = await httpClient.post(endpoints.hr.gradePolicies, payload);
    return response.data;
  },
  updateGradePolicy: async (pk, payload) => {
    const response = await httpClient.patch(endpoints.hr.gradePolicyDetail(pk), payload);
    return response.data;
  },
  deleteGradePolicy: async (pk) => {
    const response = await httpClient.delete(endpoints.hr.gradePolicyDetail(pk));
    return response.data;
  },
  getEmployeeProfile: async (empId) => {
    const response = await httpClient.get(endpoints.hr.employeeProfile(empId));
    return response.data;
  },
  updateEmployeeProfile: async (empId, payload) => {
    const response = await httpClient.post(endpoints.hr.employeeProfile(empId), payload);
    return response.data;
  },
  bulkUpdateEmployeeProfiles: async (payload, params) => {
    const response = await httpClient.post(endpoints.hr.bulkUpdateProfile, payload, { params });
    return response.data;
  },
  adjustLeaveBalance: async (payload) => {
    const response = await httpClient.post(endpoints.hr.balanceAdjust, payload);
    return response.data;
  },
  getBlackoutPeriods: async () => {
    const response = await httpClient.get(endpoints.hr.blackout);
    return response.data;
  },
  createBlackoutPeriod: async (payload) => {
    const response = await httpClient.post(endpoints.hr.blackout, payload);
    return response.data;
  },
  getBlackoutPeriodDetail: async (pk) => {
    const response = await httpClient.get(endpoints.hr.blackoutDetail(pk));
    return response.data;
  },
  updateBlackoutPeriod: async (pk, payload) => {
    const response = await httpClient.patch(endpoints.hr.blackoutDetail(pk), payload);
    return response.data;
  },
  deleteBlackoutPeriod: async (pk) => {
    const response = await httpClient.delete(endpoints.hr.blackoutDetail(pk));
    return response.data;
  },
  getAuditTrail: async (params) => {
    const response = await httpClient.get(endpoints.hr.audit, { params });
    return response.data;
  },
  getStalePendingLeaves: async (params) => {
    const response = await httpClient.get(endpoints.hr.stalePending, { params });
    return response.data;
  },
  getDepartmentLeaveReport: async (params) => {
    const response = await httpClient.get(endpoints.hr.departmentReport, { params });
    return response.data;
  },
  getLeaveUtilizationReport: async (params) => {
    const response = await httpClient.get(endpoints.hr.utilizationReport, { params });
    return response.data;
  },
  getHolidays: async () => {
    const response = await httpClient.get(endpoints.hr.holidays);
    return response.data;
  },
  exportHrLeaves: async (params) => {
    const response = await httpClient.get(endpoints.hr.exportLeaves, { params, responseType: 'blob' });
    return response.data;
  },
  importHrLeaves: async (formData) => {
    const response = await httpClient.post(endpoints.hr.importLeaves, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default leaveService;
