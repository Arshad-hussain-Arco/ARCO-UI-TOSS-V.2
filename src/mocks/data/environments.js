/**
 * Environment dashboard fixtures: overview counters, tracked configuration files
 * and the per-environment feature matrix.
 */
export const ENVIRONMENT_OVERVIEW = {
  totalEnvironments: 8,
  activeEnvironments: 6,
  lastConfigUpdate: '2 hours ago',
  lastEnvRefresh: 'Today, 10:30 AM',
  environmentsWithIssues: 1,
};
export const ENVIRONMENT_CONFIG_FILES = [
  {
    id: 'cfg1',
    featureType: 'Infra',
    fileName: 'uat_infrastructure.csv',
    uploadedBy: 'Priya Sharma',
    createdDate: '2026-01-28',
    storageLocation: '/configs/infra/',
    version: 3,
    size: '45 KB',
  },
  {
    id: 'cfg2',
    featureType: 'Status',
    fileName: 'sit_status_config.csv',
    uploadedBy: 'Rahul Verma',
    createdDate: '2026-01-25',
    storageLocation: '/configs/status/',
    version: 2,
    size: '32 KB',
  },
  {
    id: 'cfg3',
    featureType: 'Infra',
    fileName: 'production_servers.csv',
    uploadedBy: 'Amit Kumar',
    createdDate: '2026-01-20',
    storageLocation: '/configs/infra/',
    version: 5,
    size: '78 KB',
  },
];
export const ENVIRONMENTS = [
  {
    id: 'env1',
    name: 'UAT',
    status: 'active',
    infra: {
      servers: [
        { name: 'UAT-APP-01', ip: '10.20.30.41', status: 'healthy', type: 'App' },
        { name: 'UAT-APP-02', ip: '10.20.30.42', status: 'healthy', type: 'App' },
        { name: 'UAT-BUS-01', ip: '10.20.30.51', status: 'healthy', type: 'Bus' },
        { name: 'UAT-GRID-01', ip: '10.20.30.61', status: 'warning', type: 'Grid' },
        { name: 'UAT-DB-01', ip: '10.20.30.71', status: 'healthy', type: 'DB' },
        { name: 'UAT-DB-02', ip: '10.20.30.72', status: 'healthy', type: 'DB' },
      ],
      appDirectory: '/opt/techcorp/uat/applications',
      dbHosts: ['uat-db-primary.techcorp.in', 'uat-db-standby.techcorp.in'],
    },
    statusInfo: {
      owner: 'QA Team - Mumbai',
      lastDBRefresh: '2026-02-01 09:00',
      lastAppRefresh: '2026-02-02 14:30',
      lastEODRun: '2026-02-02 23:45',
      rtbsConnectivity: 'connected',
      systemVersion: '5.2.1',
      oracleVersion: '19c',
    },
  },
  {
    id: 'env2',
    name: 'SIT',
    status: 'active',
    infra: {
      servers: [
        { name: 'SIT-APP-01', ip: '10.20.31.41', status: 'healthy', type: 'App' },
        { name: 'SIT-BUS-01', ip: '10.20.31.51', status: 'healthy', type: 'Bus' },
        { name: 'SIT-GRID-01', ip: '10.20.31.61', status: 'healthy', type: 'Grid' },
        { name: 'SIT-DB-01', ip: '10.20.31.71', status: 'critical', type: 'DB' },
      ],
      appDirectory: '/opt/techcorp/sit/applications',
      dbHosts: ['sit-db.techcorp.in'],
    },
    statusInfo: {
      owner: 'Dev Team - Bangalore',
      lastDBRefresh: '2026-01-30 10:00',
      lastAppRefresh: '2026-02-01 11:20',
      lastEODRun: '2026-02-02 23:30',
      rtbsConnectivity: 'connected',
      systemVersion: '5.3.0-beta',
      oracleVersion: '19c',
    },
  },
  {
    id: 'env3',
    name: 'PRODUCTION',
    status: 'active',
    infra: {
      servers: [
        { name: 'PROD-APP-01', ip: '10.10.10.41', status: 'healthy', type: 'App' },
        { name: 'PROD-APP-02', ip: '10.10.10.42', status: 'healthy', type: 'App' },
        { name: 'PROD-APP-03', ip: '10.10.10.43', status: 'healthy', type: 'App' },
        { name: 'PROD-BUS-01', ip: '10.10.10.51', status: 'healthy', type: 'Bus' },
        { name: 'PROD-BUS-02', ip: '10.10.10.52', status: 'healthy', type: 'Bus' },
        { name: 'PROD-GRID-01', ip: '10.10.10.61', status: 'healthy', type: 'Grid' },
        { name: 'PROD-GRID-02', ip: '10.10.10.62', status: 'healthy', type: 'Grid' },
        { name: 'PROD-DB-01', ip: '10.10.10.71', status: 'healthy', type: 'DB' },
        { name: 'PROD-DB-02', ip: '10.10.10.72', status: 'healthy', type: 'DB' },
      ],
      appDirectory: '/opt/techcorp/prod/applications',
      dbHosts: [
        'prod-db-primary.techcorp.in',
        'prod-db-standby.techcorp.in',
        'prod-db-dr.techcorp.in',
      ],
    },
    statusInfo: {
      owner: 'Operations - Delhi',
      lastDBRefresh: '2026-02-01 02:00',
      lastAppRefresh: '2026-02-02 03:00',
      lastEODRun: '2026-02-02 23:59',
      rtbsConnectivity: 'connected',
      systemVersion: '5.2.1',
      oracleVersion: '19c',
    },
  },
  {
    id: 'env4',
    name: 'DEV',
    status: 'maintenance',
    infra: {
      servers: [
        { name: 'DEV-APP-01', ip: '10.20.32.41', status: 'healthy', type: 'App' },
        { name: 'DEV-DB-01', ip: '10.20.32.71', status: 'healthy', type: 'DB' },
      ],
      appDirectory: '/opt/techcorp/dev/applications',
      dbHosts: ['dev-db.techcorp.in'],
    },
    statusInfo: {
      owner: 'Dev Team - Pune',
      lastDBRefresh: '2026-01-28 08:00',
      lastAppRefresh: '2026-01-29 09:00',
      lastEODRun: '2026-02-01 23:30',
      rtbsConnectivity: 'disconnected',
      systemVersion: '5.4.0-alpha',
      oracleVersion: '19c',
    },
  },
];
