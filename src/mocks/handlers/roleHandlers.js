import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { PERMISSION_MATRIX, ROLES, ROLE_SUMMARY } from '../data/roles';

export const getRoles = async () => {
  await delay(env.mockDelay);

  return {
    roles: clone(ROLES),
    summary: clone(ROLE_SUMMARY),
  };
};

/**
 * @param {string} _roleId
 *   Ignored by the fixture — see the note on PERMISSION_MATRIX. The parameter is
 *   present so the mock matches the live signature.
 */
export const getPermissions = async (_roleId) => {
  await delay(env.mockDelay / 2);
  return clone(PERMISSION_MATRIX);
};
