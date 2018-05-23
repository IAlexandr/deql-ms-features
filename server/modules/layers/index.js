import dbmodels from './dbmodels';
import typeDefs from './type-defs';
import resolvers from './resolvers';
// import schemaStitching from './schema-stitching';

export default {
  moduleName: 'layers',
  dbmodels,
  graphql: {
    typeDefs,
    resolvers,
    // schemaStitching,
  },
};
