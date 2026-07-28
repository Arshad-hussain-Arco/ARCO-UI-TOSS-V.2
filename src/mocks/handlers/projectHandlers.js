import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { PROJECTS, PROJECT_SOURCES } from '../data/projects';

export const getProjects = async () => {
  await delay(env.mockDelay);

  return {
    sources: clone(PROJECT_SOURCES),
    projects: clone(PROJECTS),
  };
};
