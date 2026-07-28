import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { LEAVE_CONFIG_SUMMARY, LEAVE_CONFIG_TEAMS } from '../data/leaveConfiguration';

/** Mutable copy so mock writes persist for the lifetime of the page session. */
let teams = clone(LEAVE_CONFIG_TEAMS);

export const getConfiguration = async () => {
  await delay(env.mockDelay);

  return {
    teams: clone(teams),
    summary: clone(LEAVE_CONFIG_SUMMARY),
  };
};

/**
 * Persists edited allocations for one consultant.
 *
 * @param {{ teamId: string, consultantId: string, metrics: Object }} payload
 */
export const updateConsultantMetrics = async ({ teamId, consultantId, metrics }) => {
  await delay(env.mockDelay / 2);

  teams = teams.map((team) =>
    team.id !== teamId
      ? team
      : {
          ...team,
          consultants: team.consultants.map((consultant) =>
            consultant.id !== consultantId ? consultant : { ...consultant, metrics },
          ),
        },
  );

  return { success: true, metrics: clone(metrics) };
};
