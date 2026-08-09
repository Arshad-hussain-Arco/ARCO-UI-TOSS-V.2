import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const settingsService = {
  // Environment Config
  getEnvironmentConfig: async () => {
    const response = await httpClient.get(endpoints.systemSettings.environmentConfig);
    return response.data;
  },

  // Shared Config Update
  updateConfig: async (configPayload) => {
    const response = await httpClient.post(endpoints.systemSettings.updateConfig, configPayload);
    return response.data;
  },

  // Import File Config
  getImportFileConfig: async () => {
    const response = await httpClient.get(endpoints.systemSettings.importFileConfig);
    return response.data;
  },

  uploadFile: async (formData) => {
    const response = await httpClient.post(endpoints.systemSettings.uploadFile, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // CR File Matching Columns
  getCrColumns: async () => {
    const response = await httpClient.get(endpoints.systemSettings.crColumns);
    return response.data;
  },

  updateCrColumn: async (id, data) => {
    const response = await httpClient.put(endpoints.systemSettings.updateCrColumn(id), data);
    return response.data;
  },

  // WO File Matching Columns
  getWoColumns: async () => {
    const response = await httpClient.get(endpoints.systemSettings.woColumns);
    return response.data;
  },

  updateWoColumn: async (id, data) => {
    const response = await httpClient.put(endpoints.systemSettings.updateWoColumn(id), data);
    return response.data;
  },

  // Weekend Configuration
  getWeekendConfig: async () => {
    const response = await httpClient.get(endpoints.systemSettings.weekendConfig);
    return response.data;
  },

  updateWeekendConfig: async (data) => {
    const response = await httpClient.put(endpoints.systemSettings.weekendConfig, data);
    return response.data;
  },

  // Home Management
  getHomeData: async () => {
    const response = await httpClient.get(endpoints.systemSettings.homeData);
    return response.data;
  },

  createHomeData: async (formData) => {
    const response = await httpClient.post(endpoints.systemSettings.createHomeData, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateHomeData: async (id, formData) => {
    const response = await httpClient.put(endpoints.systemSettings.updateHomeData(id), formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  deleteHomeData: async (id) => {
    const response = await httpClient.delete(endpoints.systemSettings.deleteHomeData(id), { data: {} });
    return response.data;
  }
};

export default settingsService;
