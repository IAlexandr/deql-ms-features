export default mergeInfo => ({
  Layer: {
    features: {
      fragment: 'fragment LayerFragment on Layer {name}',
      resolve(parent, args, { db }, info) {
        return db.Layer.findOne({ where: { name: parent.name } }).then(
          doc => {
            if (!doc) {
              throw new Error(`Layer with '${parent.name}' not found`);
            }
            return doc.getFeature();
          }
        );
      },
    },
  },
  File: {
    feature: {
      fragment: 'fragment FileFragment on File {id}',
      resolve(parent, args, { db }, info) {
        return db.File.findOne({ where: { id: parent.id } }).then(doc => {
          if (!doc) {
            throw new Error(`File with '${parent.id}' not found`);
          }
          return doc.getFeature();
        });
      },
    },
  },
});
