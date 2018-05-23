const schema = `
  scalar JSON

  type Query{
    layers: [Layer]
    layer(name: String): Layer
    groups: [Group]
    group(name: String): Group
  },
  type Layer{
    name: String!
    type: String!
    props: JSON!
  },
  type Group{
    id: Int!
    name: String!
    props: JSON!
  },
  type Subscription{
    layerCreated: Layer!
    layerUpdated: Layer!
    layerDeleted: String!
    groupCreated: Group!
    groupUpdated: Group!
    groupDeleted: String!
  },
  type Mutation{
    createLayer(name: String!, type: String!, props: JSON): Layer!
    deleteLayer(name: String!): String!
    createGroup(name: String!, groupName: String!, layers: [String]): Group!
    updateGroup(id: Int!, name: String!, groupName: String!, layers: [String]): Group!
    deleteGroup(name: String!): String!
  },
`;
export default { schema };
