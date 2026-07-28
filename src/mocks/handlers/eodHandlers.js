import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { EOD_ENVIRONMENTS, EOD_SCHEDULES } from '../data/eod';

export const getEodStatus = async () => {
  await delay(env.mockDelay);

  return {
    environments: clone(EOD_ENVIRONMENTS),
    schedules: clone(EOD_SCHEDULES),
  };
};
