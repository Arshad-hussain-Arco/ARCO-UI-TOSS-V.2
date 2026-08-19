import { useCallback, useMemo } from 'react';
import { consultantService } from '@services/consultantService';
import { toDataUri } from '@utils/photo';
import { useAsync } from './useAsync';

/**
 * Single source of truth for fetching employee photos, shared by the
 * Consultants and Leave Management pages (previously org-photos/team-photos,
 * each with their own fetch + merge logic).
 *
 * @param {Object}  [options]
 * @param {number|string} [options.managerId]      Scope to this manager's direct
 *                                                  reports + the manager themself.
 *                                                  Omit for the full org directory.
 * @param {boolean} [options.includeInactive=false] Only applies when managerId
 *                                                  is omitted.
 * @param {boolean} [options.enabled=true]          Set false to skip fetching
 *                                                  (e.g. while a prerequisite
 *                                                  id is still resolving).
 */
export function useEmployeePhotos({ managerId, includeInactive = false, enabled = true } = {}) {
  const fetchPhotos = useCallback(() => {
    if (!enabled) return Promise.resolve([]);
    return consultantService.getEmployeePhotos({ managerId, includeInactive });
  }, [managerId, includeInactive, enabled]);

  const { data, isLoading, error, refetch } = useAsync(fetchPhotos, {
    immediate: enabled,
    initialData: [],
  });

  const photoMap = useMemo(() => {
    const map = new Map();
    (data || []).forEach((entry) => {
      const empId = entry?.emp_id ?? entry?.id;
      if (empId == null) return;
      map.set(String(empId), toDataUri(entry.photo));
    });
    return map;
  }, [data]);

  const getPhoto = useCallback((empId) => photoMap.get(String(empId)) ?? null, [photoMap]);

  return { photos: data || [], photoMap, getPhoto, isLoading, error, refetch };
}

export default useEmployeePhotos;
