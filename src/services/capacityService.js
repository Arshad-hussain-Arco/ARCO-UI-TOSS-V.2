import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';
// import * as capacityMocks from '@mocks/handlers/capacityHandlers'; // legacy mock

export const capacityService = {
  getCapacityPlanning: async () => {
    const response = await httpClient.get(endpoints.projectMonitoring.capacityPlanning);
    return response.data;
  },
};

export default capacityService;
