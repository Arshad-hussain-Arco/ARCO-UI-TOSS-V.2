import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const environmentService = {
  getEnvironments: async () => {
    const response = await httpClient.get(endpoints.envAdmin.dashboard);
    const data = response.data;
    
    // Map backend config properties to UI expected properties
    const configFiles = (data.configs || []).map(cfg => ({
      id: cfg.id,
      featureType: cfg.feature,
      fileName: cfg.file_name,
      storageLocation: cfg.file_location,
      uploadedBy: cfg.user_name,
      createdDate: cfg.modified_date,
    }));
    
    // envList requires .id in UI for mapping and toggling
    const environments = (data.env_details || []).map(env => ({
      ...env,
      id: env.name, 
    }));
    
    return { configFiles, environments };
  },

  getEnvDetails: async (envName) => {
    const response = await httpClient.get(endpoints.envAdmin.details(envName));
    return response.data;
  },

  createConfig: async ({ feature, file_name, file_location }) => {
    const response = await httpClient.post(endpoints.envAdmin.createConfig, {
      feature,
      file_name,
      file_location,
    });
    return response.data;
  },

  updateConfig: async (id, { feature, file_name, file_location }) => {
    const response = await httpClient.put(endpoints.envAdmin.updateConfig(id), {
      feature,
      file_name,
      file_location,
    });
    return response.data;
  },

  deleteConfig: async (id) => {
    const response = await httpClient.delete(endpoints.envAdmin.deleteConfig(id));
    return response.data;
  },
};

export default environmentService;
