import httpClient from '@api/httpClient';
import endpoints from '@api/endpoints';

export const linkService = {
  getLinkCategories: async () => {
    const [groupsRes, linksRes] = await Promise.all([
      httpClient.get(endpoints.importantLinks.groups.listCreate),
      httpClient.get(endpoints.importantLinks.links.list),
    ]);

    const groups = groupsRes.data || [];
    const links = linksRes.data || [];

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
      files: l.file || l.file_name ? [{ name: l.file_name || l.file, url: l.file }] : [],
      groupId: l.group,
    }));

    const categories = groups.map(g => ({
      id: g.id,
      title: g.name,
      iconKey: null,
      links: uiLinks.filter(l => l.groupId === g.id)
    }));

    const unassignedLinks = uiLinks.filter(l => !l.groupId);
    if (unassignedLinks.length > 0) {
      categories.push({
        id: 'unassigned',
        title: 'Other Links',
        iconKey: null,
        links: unassignedLinks,
      });
    }

    return categories;
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
  }
};

export default linkService;
