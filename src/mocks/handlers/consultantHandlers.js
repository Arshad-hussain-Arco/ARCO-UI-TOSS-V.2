import { env } from '@config/env';
import { clone, delay } from '@utils/async';

let mockConsultants = [
  {
    id: 1,
    userId: 'u-1001',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'Admin',
    designation: 'Senior Consultant',
    team: 'Frontend',
    accountStatus: 'active',
  },
  {
    id: 2,
    userId: 'u-1002',
    name: 'Jane Smith',
    email: 'jane@example.com',
    role: 'User',
    designation: 'Consultant',
    team: 'Backend',
    accountStatus: 'active',
  },
  {
    id: 3,
    userId: 'u-1003',
    name: 'Inactive Guy',
    email: 'inactive@example.com',
    role: 'User',
    designation: 'Consultant',
    team: 'QA',
    accountStatus: 'inactive',
  },
];

const MOCK_ROLES = [
  { id: 1, role_name: 'Admin' },
  { id: 2, role_name: 'User' },
];

const MOCK_TEAMS = [
  { id: 1, team_name: 'Frontend' },
  { id: 2, team_name: 'Backend' },
  { id: 3, team_name: 'QA' },
];

export const getRoles = async () => {
  await delay(env.mockDelay);
  return clone(MOCK_ROLES);
};

export const getTeams = async () => {
  await delay(env.mockDelay);
  return clone(MOCK_TEAMS);
};

export const getEmployeesList = async () => {
  await delay(env.mockDelay);
  return clone(mockConsultants.map(c => ({ emp_id: c.id, name: c.name })));
};

export const getConsultantInfo = async (id) => {
  await delay(env.mockDelay);
  const c = mockConsultants.find((c) => c.id == id);
  if (!c) throw new Error('Not found');
  return clone(c);
};

export const createConsultant = async (payload) => {
  await delay(env.mockDelay);
  const newConsultant = {
    ...payload,
    id: Date.now(),
    accountStatus: 'active',
  };
  mockConsultants.push(newConsultant);
  return clone(newConsultant);
};

export const updateConsultant = async (payload) => {
  await delay(env.mockDelay);
  const idx = mockConsultants.findIndex((c) => c.id == payload.id);
  if (idx === -1) throw new Error('Not found');
  mockConsultants[idx] = { ...mockConsultants[idx], ...payload };
  return clone(mockConsultants[idx]);
};

export const deleteConsultant = async (payload) => {
  await delay(env.mockDelay);
  const idx = mockConsultants.findIndex((c) => c.id == payload.id);
  if (idx !== -1) {
    mockConsultants[idx].accountStatus = 'inactive';
  }
  return { success: true };
};

export const getConsultants = async (params) => {
  await delay(env.mockDelay);
  return {
    results: clone(mockConsultants.filter(c => c.accountStatus !== 'inactive'))
  };
};

export const getInactiveConsultants = async (params) => {
  await delay(env.mockDelay);
  return {
    results: clone(mockConsultants.filter(c => c.accountStatus === 'inactive'))
  };
};

export const activateConsultant = async (payload) => {
  await delay(env.mockDelay);
  const idx = mockConsultants.findIndex((c) => c.id == payload.id);
  if (idx !== -1) {
    mockConsultants[idx].accountStatus = 'active';
  }
  return { success: true };
};
