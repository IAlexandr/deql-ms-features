import dbmodels from './dbmodels';
//import crud from './crud';
import typeDefs from './type-defs';
import resolvers from './resolvers';
import schemaStitching from './schema-stitching';

export default {
  moduleName: 'features',
  dbmodels,
  graphql: {
    typeDefs,
    resolvers,
    // schemaStitching,
  },
};
