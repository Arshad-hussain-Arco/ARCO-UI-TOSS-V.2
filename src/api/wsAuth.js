import { impersonationStorage } from '@utils/impersonationStorage';
import { IMPERSONATION_KEYS } from '@constants/storageKeys';

/**
 * Query string that authenticates a WebSocket connection.
 *
 * Normal tabs need nothing: the browser sends the HttpOnly session cookie
 * with the handshake. An impersonation tab must identify as its own
 * session instead of the admin's cookie, and browsers can't set headers on
 * a WebSocket handshake — so it passes its per-tab access token here.
 *
 * @returns {string} '' or '?token=…'
 */
export function wsAuthQuery() {
  const token = impersonationStorage.get(IMPERSONATION_KEYS.ACCESS_TOKEN);
  return token ? `?token=${encodeURIComponent(token)}` : '';
}

export default wsAuthQuery;
