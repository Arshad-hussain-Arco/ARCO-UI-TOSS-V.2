import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const dashboardService = {
  getSummary: async () => {
    const response = await httpClient.get(endpoints.dashboard.summary);
    return response.data;
  },
  getLeaveUtilization: async () => {
    const response = await httpClient.get(endpoints.dashboard.leaveUtilization);
    return response.data;
  },
  getAnnouncements: async () => {
    const response = await httpClient.get(endpoints.dashboard.announcements);
    return response.data;
  },
  dismissAnnouncement: async (id) => {
    const response = await httpClient.post(endpoints.dashboard.dismissAnnouncement(id));
    return response.data;
  },
  getLeaveRequestsTrend: async (params) => {
    const response = await httpClient.get(endpoints.dashboard.leaveRequestsTrend, { params });
    return response.data;
  },
  getDepartmentStats: async () => {
    const response = await httpClient.get(endpoints.dashboard.departmentStats);
    return response.data;
  },
  getOnLeave: async (params) => {
    const response = await httpClient.get(endpoints.dashboard.onLeave, { params });
    return response.data;
  },
  getPendingApprovals: async (params) => {
    const response = await httpClient.get(endpoints.dashboard.pendingApprovals, { params });
    return response.data;
  }
};

export default dashboardService;
