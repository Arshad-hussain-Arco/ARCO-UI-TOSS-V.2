import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { LINK_CATEGORIES } from '../data/importantLinks';

export const getLinkCategories = async () => {
  await delay(env.mockDelay);
  return clone(LINK_CATEGORIES);
};
