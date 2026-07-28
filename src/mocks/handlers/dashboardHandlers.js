import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { DASHBOARD_SUMMARY } from '../data/dashboard';

/**
 * @param {{ dateFilter?: string }} [params]
 *   Accepted so the mock matches the live signature; the fixture is static.
 */
export const getSummary = async (_params) => {
  await delay(env.mockDelay);
  return clone(DASHBOARD_SUMMARY);
};
