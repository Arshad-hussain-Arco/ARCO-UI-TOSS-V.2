import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const projectService = {
  getWorkOrderStatus: async () => {
    const response = await httpClient.get(endpoints.projectMonitoring.workOrderStatus);
    return response.data;
  },
  getFileUpdates: async () => {
    try {
      const response = await httpClient.get('/getallfilesupdate');
      return response.data;
    } catch (err) {
      console.warn('File update timestamp endpoint not available:', err);
      return null;
    }
  },
};

export default projectService;
