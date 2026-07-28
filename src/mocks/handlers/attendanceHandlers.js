import { env } from '@config/env';
import { clone, delay } from '@utils/async';

import { ON_DUTY_CONSULTANTS, ON_LEAVE_CONSULTANTS } from '../data/attendance';

export const getAttendance = async () => {
  await delay(env.mockDelay);

  return {
    onDuty: clone(ON_DUTY_CONSULTANTS),
    onLeave: clone(ON_LEAVE_CONSULTANTS),
  };
};
