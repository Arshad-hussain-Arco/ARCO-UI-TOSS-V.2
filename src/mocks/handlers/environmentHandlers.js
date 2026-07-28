import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { ENVIRONMENTS, ENVIRONMENT_CONFIG_FILES, ENVIRONMENT_OVERVIEW } from '../data/environments';

export const getEnvironments = async () => {
  await delay(env.mockDelay);

  return {
    overview: clone(ENVIRONMENT_OVERVIEW),
    configFiles: clone(ENVIRONMENT_CONFIG_FILES),
    environments: clone(ENVIRONMENTS),
  };
};
