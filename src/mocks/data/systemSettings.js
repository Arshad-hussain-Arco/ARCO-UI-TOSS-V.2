/** Environment configuration form definition and its default values. */
export const ENVIRONMENT_FIELDS = [
  {
    name: 'clientDirectory',
    label: 'Client Directory',
    helper: 'Absolute path to client root directory',
    type: 'text',
    iconKey: 'folder',
  },
  {
    name: 'importantLinks',
    label: 'Important Links FilePath',
    helper: 'JSON configuration file for important links',
    type: 'text',
    iconKey: 'folder',
  },
  {
    name: 'systemHealth',
    label: 'System Health Heartbeat (In Seconds)',
    helper: 'Interval in seconds for health checks',
    type: 'number',
    iconKey: 'clock',
  },
  {
    name: 'eodInterval',
    label: 'EOD Heartbeat Interval (In Seconds)',
    helper: 'Interval in seconds for EOD batch processes',
    type: 'number',
    iconKey: 'clock',
  },
  {
    name: 'serverIp',
    label: 'Environment Server IP',
    helper: 'IPv4 or IPv6 address of target environment',
    type: 'text',
    iconKey: 'drive',
  },
  {
    name: 'portNo',
    label: 'Environment Port No',
    helper: 'Communication port (default: 8443)',
    type: 'number',
    iconKey: 'hash',
  },
  {
    name: 'userName',
    label: 'Environment User Name',
    helper: 'Service account username',
    type: 'text',
    iconKey: 'user',
  },
  {
    name: 'password',
    label: 'Environment Password',
    helper: 'Secure credentials for environment access',
    type: 'password',
    iconKey: 'lock',
  },
];

export const SYSTEM_SETTINGS = {
  environment: {
    clientDirectory: '/var/lib/toss/clients',
    importantLinks: '/etc/toss/config/links.json',
    systemHealth: '30',
    eodInterval: '300',
    serverIp: '192.168.1.100',
    portNo: '8443',
    userName: 'admin_sys',
    password: 'super_secret_password_123',
  },

  importPaths: [
    { id: 'cr-daily', path: '/mnt/data/uploads/cr_daily' },
    { id: 'wo-daily', path: '/mnt/data/uploads/wo_daily' },
  ],

  /** Placeholder mapping rows; the design shows five generated examples. */
  columnMappings: Array.from({ length: 5 }, (_, index) => ({
    id: `mapping-${index + 1}`,
    source: `src_field_${index + 1}`,
    destination: `dest_column_${index + 1}`,
    dataType: 'VARCHAR',
  })),

  weekend: {
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    selectedDays: ['Sat', 'Sun'],
    runEodOnWeekends: true,
  },

  dashboardWidgets: [
    { id: 'system-health', label: 'System Health Overview', enabled: true },
    { id: 'recent-eod', label: 'Recent EOD Status', enabled: true },
    { id: 'active-users', label: 'Active Users', enabled: true },
    { id: 'error-logs', label: 'Error Logs', enabled: true },
  ],
};

export const COLUMN_DATA_TYPES = ['VARCHAR', 'INTEGER', 'DATE'];
