import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import {
  MUREX_HOURLY_HEATMAP,
  MUREX_MONTHLY_HEATMAP,
  MUREX_RUNTIME_SUMMARY,
  MUREX_RUNTIME_TREND,
  MUREX_SCRIPTS,
} from '../data/murex';

export const getRuntimeTrends = async () => {
  await delay(env.mockDelay);

  return {
    summary: clone(MUREX_RUNTIME_SUMMARY),
    trend: clone(MUREX_RUNTIME_TREND),
    hourlyHeatmap: clone(MUREX_HOURLY_HEATMAP),
    monthlyHeatmap: clone(MUREX_MONTHLY_HEATMAP),
    scripts: clone(MUREX_SCRIPTS),
  };
};
