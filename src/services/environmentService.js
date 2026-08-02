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
      fileData: cfg.file_data,
    }));
    
    // envList requires .id in UI for mapping and toggling
    let environments = (data.env_details || []).map(env => ({
      ...env,
      id: env.name, 
    }));

    // Auto-generate environments from config file data if backend doesn't provide env_details
    if (environments.length === 0 && configFiles.length > 0) {
      const envMap = new Map();
      configFiles.forEach(cfg => {
        if (cfg.fileData && cfg.fileData.records) {
          cfg.fileData.records.forEach(r => {
            if (r.ENV_NAME && !envMap.has(r.ENV_NAME)) {
              envMap.set(r.ENV_NAME, {
                id: r.ENV_NAME,
                name: r.ENV_NAME,
                status: 'ACTIVE', // default fallback
                team: 'N/A',
                servers_count: 0,
                db_hosts_count: 0,
                rtbs_status: 'Connected',
                components: []
              });
            }
          });
        }
      });
      environments = Array.from(envMap.values());
    }
    
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
