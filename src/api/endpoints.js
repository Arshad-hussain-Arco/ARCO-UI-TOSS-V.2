const endpoints = {
  auth: {
    login: '/auth/login/',
    refresh: '/auth/refresh/',
    verify: '/auth/verify/',
    logout: '/auth/logout/',
  },
  reconciliation: {
    preprocess: '/core/reconciliation/preprocess/',
    reconcile: '/core/reconciliation/reconcile/',
  },
  roles: {
    list: '/core/role-permissions/',
    create: '/core/role-permissions/create/',
    update: (id) => `/core/role-permissions/${id}/update/`,
    delete: (id) => `/core/role-permissions/${id}/delete/`,
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
