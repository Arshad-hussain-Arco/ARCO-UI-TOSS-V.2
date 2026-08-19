import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import {
  MUREX_HOURLY_HEATMAP,
  MUREX_MONTHLY_HEATMAP,
  MUREX_RUNTIME_SUMMARY,
  MUREX_RUNTIME_TREND,
  MUREX_SCRIPTS,
  MUREX_OVERVIEW_AVAILABLE_DATES,
  MUREX_OVERVIEW_RUNS_BY_DATE,
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

export const getOverviewAvailableDates = async () => {
  await delay(env.mockDelay);
  return clone(MUREX_OVERVIEW_AVAILABLE_DATES);
};

export const getOverviewRuns = async (isoDate) => {
  await delay(env.mockDelay);
  return clone(MUREX_OVERVIEW_RUNS_BY_DATE[isoDate] || []);
};
