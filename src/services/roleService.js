import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const roleService = {
  getRoles: async () => {
    const response = await httpClient.get(endpoints.consultants.roles);
    return response.data;
  },
};

export default roleService;
