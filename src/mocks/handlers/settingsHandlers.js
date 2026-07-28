import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { SYSTEM_SETTINGS } from '../data/systemSettings';

let settings = clone(SYSTEM_SETTINGS);

export const getSettings = async () => {
  await delay(env.mockDelay);
  return clone(settings);
};

export const updateSettings = async (patch) => {
  await delay(env.mockDelay * 2);
  settings = { ...settings, ...clone(patch) };
  return clone(settings);
};
