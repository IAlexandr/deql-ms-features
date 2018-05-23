import Sequelize from 'sequelize';
import dbseedSchema from './dbseed-schema';
import { syncModels } from 'tools/db/sequelize/init/utils';
const localSyncForce = true;
const isNeedDbSeed = true;
const dbSeedOrderWeight = 30;

export default function(sequelize, syncForce) {
  const Feature = sequelize.define('Feature', {
    type: Sequelize.STRING,
    geometry: Sequelize.GEOMETRY,
    properties: Sequelize.JSON,
    props: Sequelize.JSON,
  });

  sequelize.Feature = Feature;
  sequelize.Layer.hasMany(sequelize.Feature, { as: 'Feature' });
  sequelize.Feature.belongsTo(sequelize.Layer, { as: 'Layer' });

  return syncModels({
    models: [Feature],
    force: syncForce || localSyncForce,
  }).then(() => {
    let schema = [];
    if (isNeedDbSeed) {
      schema = dbseedSchema;
    }

    return Promise.resolve({
      dbseedSchema: schema,
      orderWeight: dbSeedOrderWeight,
    });
  });
}
