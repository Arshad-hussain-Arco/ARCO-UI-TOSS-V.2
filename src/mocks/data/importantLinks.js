/**
 * Curated link directory, grouped by category.
 *
 * `iconKey` keeps the fixture free of React components — the page maps it to a
 * concrete icon, so this shape is exactly what a backend would return.
 */
export const LINK_CATEGORIES = [
  {
    id: 'banking-systems',
    title: 'Banking Systems',
    iconKey: 'server',
    links: [
      {
        id: 'murex-environment',
        label: 'Murex Environment',
        url: '#',
        description: 'Access to Murex v3.1 production environment',
        tag: 'Internal',
      },
      {
        id: 'swift-gateway',
        label: 'SWIFT Gateway',
        url: '#',
        description: 'Global messaging system for financial transactions',
        tag: 'Critical',
      },
      {
        id: 'core-ledger-api',
        label: 'Core Ledger API',
        url: '#',
        description: 'Documentation for the central banking ledger',
        tag: 'Docs',
      },
    ],
  },
  {
    id: 'dev-devops',
    title: 'Dev & DevOps',
    iconKey: 'code',
    links: [
      {
        id: 'jenkins',
        label: 'Jenkins CI/CD',
        url: '#',
        description: 'Build and deployment pipelines',
      },
      {
        id: 'sonarqube',
        label: 'SonarQube',
        url: '#',
        description: 'Code quality and security analysis',
      },
      {
        id: 'grafana',
        label: 'Grafana Dashboards',
        url: '#',
        description: 'Real-time system monitoring and alerts',
      },
    ],
  },
  {
    id: 'compliance-security',
    title: 'Compliance & Security',
    iconKey: 'shield',
    links: [
      {
        id: 'security-policy',
        label: 'Security Policy',
        url: '#',
        description: 'Information security guidelines and protocols',
        tag: 'Mandatory',
      },
      {
        id: 'audit-logs',
        label: 'Audit Logs',
        url: '#',
        description: 'Centralized access for compliance audits',
      },
      {
        id: 'password-vault',
        label: 'Password Vault',
        url: '#',
        description: 'Secure storage for shared credentials',
      },
    ],
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    iconKey: 'chat',
    links: [
      {
        id: 'team-slack',
        label: 'Team Slack',
        url: '#',
        description: 'Primary communication channel for the TOSS team',
      },
      {
        id: 'jira-board',
        label: 'Jira Board',
        url: '#',
        description: 'Task tracking and project management',
      },
      {
        id: 'confluence-wiki',
        label: 'Confluence Wiki',
        url: '#',
        description: 'Shared documentation and knowledge base',
      },
    ],
  },
  {
    id: 'resources',
    title: 'Resources',
    iconKey: 'book',
    links: [
      {
        id: 'employee-handbook',
        label: 'Employee Handbook',
        url: '#',
        description: 'HR policies and company benefits',
      },
      {
        id: 'learning-portal',
        label: 'Learning Portal',
        url: '#',
        description: 'Internal training and certification programs',
      },
      {
        id: 'support-desk',
        label: 'Support Desk',
        url: '#',
        description: 'IT support and hardware requests',
      },
    ],
  },
];
