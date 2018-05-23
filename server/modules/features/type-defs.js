import { getRuleByModuleName } from 'tools/graphql/schema-rules';
const f = getRuleByModuleName('features');
const adm = getRuleByModuleName('administration');

const viewFeatureAndPermitAll = `@hasAccess(
  or: [auth, ${f('viewFeature')}, ${adm('permitAll')}])`;

const schema = `
  scalar JSON

  type Query{
    features: [Feature] 
    feature(type: String): Feature ${viewFeatureAndPermitAll}
  },
  type Feature{
    id: Int!
    type: String!
    geometry: JSON!
    properties: JSON!
    props: JSON!
  },
  type Subscription{
    featureAdded: Feature!
  },
  type Mutation{
    addFeature(type: String, geometry: JSON, properties: JSON, props: JSON): Feature! ${viewFeatureAndPermitAll}
  },
`;
export default { schema };
