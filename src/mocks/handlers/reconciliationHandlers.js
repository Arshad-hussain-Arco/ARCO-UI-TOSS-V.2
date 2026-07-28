import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { RECONCILIATION_SOURCES, RECONCILIATION_TRANSACTIONS } from '../data/reconciliation';

export const getReconciliation = async () => {
  await delay(env.mockDelay);

  return {
    sources: clone(RECONCILIATION_SOURCES),
    transactions: clone(RECONCILIATION_TRANSACTIONS),
  };
};
