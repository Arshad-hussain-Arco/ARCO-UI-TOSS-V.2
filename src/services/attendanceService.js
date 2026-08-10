import api from '@api/httpClient';
import endpoints from '@api/endpoints';

export const attendanceService = {
  getAttendance: async (managerId, startDate, endDate) => {
    try {
      // Use endpoints.manager.teamLeaveQuota which returns team details
      const [quotaRes, calendarRes] = await Promise.all([
        api.get(endpoints.manager.teamLeaveQuota(managerId)),
        api.get(endpoints.manager.teamCalendar(managerId), { params: { start: startDate, end: endDate } })
      ]);
      
      const payload = quotaRes.data?.data || quotaRes.data;
      let teamMembers = Array.isArray(payload) ? payload : (payload?.results || []);
      if (calendarRes.data?.team_members && calendarRes.data.team_members.length > 0) {
        teamMembers = calendarRes.data.team_members;
      }
      const calendar = calendarRes.data?.calendar || [];

      return {
        teamMembers,
        calendar
      };
    } catch (e) {
      console.error('Error fetching attendance data:', e);
      throw e;
    }
  }
};

export default attendanceService;
