import Sequelize from 'sequelize';
import dbseedSchema from './dbseed-schema';
import { syncModels } from 'tools/db/sequelize/init/utils';
var conf = require('config');

const localSyncForce = true;
const isNeedDbSeed = true;
const dbSeedOrderWeight = 20;

export default function(sequelize, syncForce) {
  const Layer = sequelize.define('Layer', {
    name: {
      type: Sequelize.STRING,
      primaryKey: true,
    },
    type: Sequelize.STRING,
    props: Sequelize.JSON,
  });

  sequelize.Layer = Layer;

  const Group = sequelize.define('Group', {
    name: Sequelize.STRING,
    props: Sequelize.JSON,
  });

  sequelize.Group = Group;

  /*
  status - разрешение на действие
  where - функция в виде строки для фильтрации фичеров к которым можно применять действие
  fields - объекты полей
    blocked -нужно ли блокировать изменение
    defaultValue(для create) изначальное значение если было блокированно

  {"read":{"status":true,"fields":{"objType1":{"field1":{"blocked":false}},{"objType2":{"field1":{}}},"where":"(a-b)<5", },
  update:{"status":true,"where":"(a-b)<5", "fields":{}},
  create:{"status":true,"where":"(a-b)<5", "fields":{"field1":{"blocked":false,"defaultValue":35}},
  delete:{"status":true,"where":"(a-b)<5", "fields":{}}
  administrate:{"status":true,"where":"true", "fields":{}},// разрешение на редактирование фичеров
  */

  sequelize.LayerGroup = sequelize.define('LayerGroup', {});

  sequelize.Layer.belongsToMany(sequelize.Group, {
    through: sequelize.LayerGroup,
  });
  sequelize.Group.belongsToMany(sequelize.Layer, {
    through: sequelize.LayerGroup,
  });

  return syncModels({
    models: [Layer, Group, sequelize.LayerGroup],
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
