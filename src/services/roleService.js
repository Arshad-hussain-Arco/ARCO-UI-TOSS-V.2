import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const roleService = {
  getRoles: async () => {
    const response = await httpClient.get(endpoints.roles.list);
    return response?.data || [];
  },

  createRole: async (data) => {
    // Backend serializer expects permissions to be a list/array
    const payload = {
      role_name: data.name,
      permissions: [data.permissions], // Wrap dict in array
      isadmin: data.isAdmin,
    };
    const response = await httpClient.post(endpoints.roles.create, payload);
    return response?.data;
  },

  updateRole: async (id, data) => {
    // Backend serializer expects permissions to be a list/array
    const payload = {
      role_name: data.name,
      permissions: [data.permissions], // Wrap dict in array
      isadmin: data.isAdmin,
    };
    const response = await httpClient.put(endpoints.roles.update(id), payload);
    return response?.data;
  },

  deleteRole: async (id) => {
    const response = await httpClient.delete(endpoints.roles.delete(id));
    return response?.data;
  },
};

export default roleService;
