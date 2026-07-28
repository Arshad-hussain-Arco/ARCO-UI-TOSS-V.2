import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { CAPACITY_CONSULTANTS, CAPACITY_SOURCES } from '../data/capacity';

export const getCapacityPlan = async () => {
  await delay(env.mockDelay);

  return {
    sources: clone(CAPACITY_SOURCES),
    consultants: clone(CAPACITY_CONSULTANTS),
  };
};
