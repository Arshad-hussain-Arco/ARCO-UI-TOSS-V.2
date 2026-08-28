import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const toDataUri = (photo) => {
  if (!photo) return null;
  return photo.startsWith('data:') ? photo : `data:image/jpeg;base64,${photo}`;
};

/**
 * Fetches one employee's photo (GET /employees/emp-photo/:id/) and resolves
 * it to a `data:` URI, or null if there's no photo / the request fails.
 * Shared by the login flow and session-restore flow so both stay in sync.
 *
 * @param {number|string} empId
 * @param {import('axios').AxiosRequestConfig} [config]
 */
export async function resolveAvatarDataUri(empId, config) {
  if (!empId) return null;
  try {
    const res = await httpClient.get(endpoints.consultants.photo(empId), config);
    return toDataUri(res.data?.photo);
  } catch (err) {
    console.warn('Failed to fetch user photo', err);
    return null;
  }
}
