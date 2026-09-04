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

  /**
   * The FULL, unfiltered SystemConfig(module='app') blob — every key, not
   * just the ~8 a given settings tab's own GET exposes. updateConfig() does
   * a full replace of config_json, so a save built only from
   * getEnvironmentConfig()/getImportFileConfig() silently drops any key
   * neither of those covers (e.g. homeMediaFilePath, which has no
   * dedicated settings UI). Panels that save via updateConfig() should
   * spread this in first (lowest precedence) before their own known fields.
   */
  getAllConfigurations: async () => {
    const response = await httpClient.get(endpoints.systemSettings.allConfigurations);
    const row = Array.isArray(response.data) ? response.data[0] : response.data;
    if (!row?.config_json) return {};
    try {
      return JSON.parse(row.config_json);
    } catch {
      return {};
    }
  },

  uploadFile: async (formData) => {
    // Runtime-file uploads parse the whole CSV server-side (row-by-row state
    // machine over potentially months of daily logs) before the SFTP step
    // even starts - that can outlast the shared 30s default timeout on
    // large files, so give this call more room.
    const response = await httpClient.post(endpoints.systemSettings.uploadFile, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return response.data;
  },

  getUploadTimestamp: async (fileKey) => {
    const response = await httpClient.get(endpoints.systemSettings.uploadTimestamp, { params: { fileKey } });
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

  // Runtime Trends File Matching Columns
  getRuntimeColumns: async () => {
    const response = await httpClient.get(endpoints.systemSettings.runtimeColumns);
    return response.data;
  },

  updateRuntimeColumn: async (id, data) => {
    const response = await httpClient.put(endpoints.systemSettings.updateRuntimeColumn(id), data);
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
  // includeInactive: true also returns deactivated cards — only honored by
  // the backend for an actual admin (see HomeDataListView), so passing it
  // from a non-admin screen has no effect. The public Homepage must never
  // pass this; only Home Content Management does.
  getHomeData: async (includeInactive = false) => {
    const response = await httpClient.get(endpoints.systemSettings.homeData, {
      params: includeInactive ? { include_inactive: 'true' } : undefined,
    });
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
  },
};

export default settingsService;
