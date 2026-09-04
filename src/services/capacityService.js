import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const capacityService = {
  getCapacityPlanning: async (params) => {
    const response = await httpClient.get(endpoints.projectMonitoring.capacityPlanning, { params });
    return response.data;
  },
};

export default capacityService;
