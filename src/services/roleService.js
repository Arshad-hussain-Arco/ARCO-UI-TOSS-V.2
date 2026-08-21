import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const roleService = {
  getRoles: async () => {
    const response = await httpClient.get(endpoints.roles.list);
    return response?.data || [];
  },

  createRole: async (data) => {
    // Backend expects `permissions` as a flat list of permission codes
    // (e.g. ["EMPLOYEE_VIEW", "DOCUMENTS_EDIT"]) — see RolePermissionWriteSerializer.
    const payload = {
      role_name: data.name,
      permissions: data.permissions,
      isadmin: data.isAdmin,
      description: data.description,
    };
    const response = await httpClient.post(endpoints.roles.create, payload);
    return response?.data;
  },

  updateRole: async (id, data) => {
    const payload = {
      role_name: data.name,
      permissions: data.permissions,
      isadmin: data.isAdmin,
      description: data.description,
    };
    const response = await httpClient.put(endpoints.roles.update(id), payload);
    return response?.data;
  },

  deleteRole: async (id) => {
    const response = await httpClient.delete(endpoints.roles.delete(id));
    return response?.data;
  },

  // Sidebar Nav Order (Preferences > Sidebar Layout) — per-role, admin only
  getSidebarNavOrder: async (roleId) => {
    const response = await httpClient.get(endpoints.roles.sidebarNavOrder(roleId));
    return response?.data;
  },

  updateSidebarNavOrder: async (roleId, payload) => {
    const response = await httpClient.put(endpoints.roles.sidebarNavOrder(roleId), payload);
    return response?.data;
  },
};

export default roleService;
