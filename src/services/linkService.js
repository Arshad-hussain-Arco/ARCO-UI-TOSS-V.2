import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

// Keyed by scope so a page-scoped request (sees every group, for whoever
// manages group access) and the header widget's own restricted request
// never share a cached result with each other.
const categoriesPromises = {};

export const linkService = {
  /**
   * @param {Object} [opts]
   * @param {'admin'} [opts.scope] Pass 'admin' from the Important Links
   *   page so someone with IMPORTANT_LINKS_GROUP_ACCESS_CONTROL sees every
   *   group (needed to manage access for groups their own role can't
   *   otherwise see) — ignored server-side for anyone without that
   *   permission. Never pass this from the header widget: it must always
   *   show only what the viewer is actually allowed to see.
   */
  getLinkCategories: ({ scope } = {}) => {
    const cacheKey = scope || 'default';
    if (categoriesPromises[cacheKey]) return categoriesPromises[cacheKey];

    const params = scope ? { scope } : undefined;
    categoriesPromises[cacheKey] = (async () => {
      try {
        const [groupsRes, linksRes] = await Promise.all([
          httpClient.get(endpoints.importantLinks.groups.listCreate, { params }),
          httpClient.get(endpoints.importantLinks.links.list, { params }),
        ]);

        const groups = Array.isArray(groupsRes.data) ? groupsRes.data : Array.isArray(groupsRes.data?.results) ? groupsRes.data.results : [];
        const links = Array.isArray(linksRes.data) ? linksRes.data : Array.isArray(linksRes.data?.results) ? linksRes.data.results : [];

        const uiLinks = links.map(l => ({
          id: l.id,
          label: l.link || '',
          url: l.url || '',
          description: l.content || '',
          sharedFolder: null,
          comments: l.content || '',
          pinToHeader: l.isHeader === true || l.isHeader === 1 || String(l.isHeader) === '1' || String(l.isHeader).toLowerCase() === 'true' || 
                       l.is_header === true || l.is_header === 1 || String(l.is_header) === '1' || String(l.is_header).toLowerCase() === 'true',
          tag: null,
          files: l.file || l.file_name ? [{ name: l.file_name || (l.file ? l.file.split('/').pop() : ''), url: l.file }] : [],
          groupId: l.group,
        }));

        const categories = groups.map(g => ({
          id: g.id,
          title: g.name,
          iconKey: null,
          links: uiLinks.filter(l => l.groupId === g.id),
          // Whether this group is pinned to the header — group-wide, not
          // per-viewer (see GroupSerializer.is_pinned). Since this list is
          // already restricted to groups visible to the caller's role
          // (or, with scope=admin, every group), a pinned group here is
          // pinned for whichever role(s) it's actually assigned to.
          isPinned: !!g.is_pinned,
        }));

        const unassignedLinks = uiLinks.filter(l => !l.groupId);
        if (unassignedLinks.length > 0) {
          categories.push({
            id: 'unassigned',
            title: 'Other Links',
            iconKey: null,
            links: unassignedLinks,
            isPinned: false,
          });
        }

        return categories;
      } finally {
        // clear the cache so the next request after this batch fetches fresh data
        categoriesPromises[cacheKey] = null;
      }
    })();

    return categoriesPromises[cacheKey];
  },

  createGroup: async (name) => {
    const res = await httpClient.post(endpoints.importantLinks.groups.listCreate, { name });
    return res.data;
  },
  
  updateGroup: async (id, name) => {
    const res = await httpClient.put(endpoints.importantLinks.groups.detailUpdateDelete(id), { name });
    return res.data;
  },

  deleteGroup: async (id) => {
    const res = await httpClient.delete(endpoints.importantLinks.groups.detailUpdateDelete(id));
    return res.data;
  },

  // Group access control (which roles may see this group's links, on the
  // Important Links page and the header widget alike)
  getGroupAccess: async (id) => {
    const res = await httpClient.get(endpoints.importantLinks.groups.accessControl(id));
    return res.data;
  },

  updateGroupAccess: async (id, roleIds) => {
    const res = await httpClient.put(endpoints.importantLinks.groups.accessControl(id), { role_ids: roleIds });
    return res.data;
  },

  /**
   * Pins/unpins a group to the header for every role it's currently
   * assigned to via Manage Access (max 4 pinned groups per role —
   * enforced server-side for each assigned role). Rejects with a
   * backend-supplied message (err.response.data.message) when any
   * assigned role is already at its cap, or the group isn't assigned to
   * any role yet.
   */
  togglePin: async (id, pinned) => {
    const res = await httpClient.post(endpoints.importantLinks.groups.pin(id), { pinned });
    return res.data;
  },

  /** A single link's raw backend fields — used by the full-page content viewer. */
  getLinkDetail: async (id) => {
    const res = await httpClient.get(endpoints.importantLinks.links.detail(id));
    return res.data;
  },

  /** Raw file bytes attached to a link (Upload File content type), for in-page preview. */
  getLinkContent: async (id) => {
    const res = await httpClient.get(endpoints.importantLinks.links.content(id), {
      responseType: 'blob',
    });
    return res.data;
  },

  createLink: async (data) => {
    const res = await httpClient.post(endpoints.importantLinks.links.create, data);
    return res.data;
  },

  updateLink: async (id, data) => {
    const res = await httpClient.put(endpoints.importantLinks.links.update(id), data);
    return res.data;
  },

  deleteLink: async (id) => {
    const res = await httpClient.delete(endpoints.importantLinks.links.delete(id));
    return res.data;
  },
};

export default linkService;
