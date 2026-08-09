const nodes = [
  { id: 4, manager_id: 4, team: 'Project Management' },
  { id: 5, manager_id: 4, team: 'Engineering' },
  { id: 6, manager_id: 5, team: 'Consulting' }
];

const nodeMap = {};
nodes.forEach(n => { n.children = []; nodeMap[n.id] = n; });

const orphans = [];
nodes.forEach(n => {
  const parentId = n.manager_id;
  if (parentId && parentId !== n.id && nodeMap[parentId]) {
      nodeMap[parentId].children.push(n);
  } else {
      orphans.push(n);
  }
});

const rootNodes = [];
const trueOrphans = [];

orphans.forEach(o => {
  // If it has children, it's a natural root of a subtree
  if (o.children.length > 0) {
      rootNodes.push(o);
  } else {
      trueOrphans.push(o);
  }
});

const teamsMap = {};
trueOrphans.forEach(n => {
  if (!teamsMap[n.team]) teamsMap[n.team] = [];
  teamsMap[n.team].push(n);
});

Object.keys(teamsMap).forEach(team => {
  const members = teamsMap[team];
  const dummyTeamParent = {
      id: \dummy-team-\\,
      name: \\ Manager\,
      children: members,
      _isDummy: true
  };
  rootNodes.push(dummyTeamParent);
});

console.log(JSON.stringify(rootNodes, null, 2));
