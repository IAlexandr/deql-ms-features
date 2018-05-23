import GraphQLJSON from 'graphql-type-json';

export default pubsub => ({
  JSON: GraphQLJSON,

  Query: {
    features: (features, args, { db }) => {
      debug('Query features');
      return db.Feature.findAll();
    },
    feature: (feature, { type }, { db }) => {
      debug('Query feature');
      return db.Feature.findOne({ where: { type } });
    },
  },
  Subscription: {
    featureAdded: {
      subscribe: () => {
        return pubsub.asyncIterator('FEATURE_ADDED');
      },
    },
  },
  Mutation: {
    addFeature: (parent, { type, geometry, properties, props }, { db }) => {
      const feature = { type, geometry, properties, props };
      return db.Feature.create(feature)
        .then(result => {
          pubsub.publish('FEATURE_ADDED', { featureAdded: feature });
          return feature;
        })
        .catch(err => {
          throw new Error('Ошибка создания объекта!');
        });
    },
  },
});
