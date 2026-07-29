const endpoints = {
  auth: {
    login: '/auth/login/',
    refresh: '/auth/refresh/',
    verify: '/auth/verify/',
    logout: '/auth/logout/',
  },
  reconciliation: {
    preprocess: '/reconciliation/reconciliation/preprocess/',
    reconcile: '/reconciliation/reconciliation/reconcile/',
  },
  roles: {
    list: '/auth/role-permissions/',
    create: '/auth/role-permissions/create/',
    update: (id) => `/auth/role-permissions/${id}/update/`,
    delete: (id) => `/auth/role-permissions/${id}/delete/`,
  },
  importantLinks: {
    groups: {
      listCreate: '/important-links/groups/',
      detailUpdateDelete: (id) => `/important-links/groups/${id}/`,
    },
    links: {
      list: '/important-links/link-data/',
      detail: (id) => `/important-links/link-data/${id}/`,
      create: '/important-links/link-data/create/',
      update: (id) => `/important-links/link-data/${id}/update/`,
      delete: (id) => `/important-links/link-data/${id}/delete/`,
    }
  },
  // Add other endpoints here as they get integrated
  consultants: {
    roles: '/employees/roles/',
    teams: '/employees/teams/',
    employeesList: '/employees/employees-list/',
    info: (id) => `/employees/employee-info/${id}/`,
    create: '/employees/create/',
    update: '/employees/update/',
    delete: '/employees/delete/',
    list: '/employees/full/',
    inactive: '/employees/inactive/',
    activate: '/employees/activate/',
  },
};

export default endpoints;
