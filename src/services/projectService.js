import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';
// import * as projectMocks from '@mocks/handlers/projectHandlers'; // legacy mock

export const projectService = {
  getWorkOrderStatus: async () => {
    const response = await httpClient.get(endpoints.projectMonitoring.workOrderStatus);
    return response.data;
  },
};

export default projectService;
