import { db } from '../../db/index';
import logger from '../logger';
import { valBy } from './../data-operations/utils';
import { serverWS } from '../../serverWS';
import { CheckFeaturesAccess } from './../features/router';
const { debug, errDebug } = logger('features.crud', false);

/*
//тестирование фичера 
var t=47.288288;
var r=false;
function em(tt,id){
  serverWS().emit("layers", {
    type: "features/update",
    body: [{ feature: { id: id,
      type: 'Feature',
      properties:
       { controllerId: '00735',
         time: '2017-11-08T05:59:04.000Z',
         height: 150,
         speed: tt,
         course: id,
         numSat: 18 },
      geometry: { type: 'Point', coordinates: [tt, 56.042244+(id*0.001)] },
      props: { objectType: 'tracktorPoint' },
      updatedAt: "2017-11-08T05:59:17.381Z",
      createdAt: "2017-11-08T05:59:17.381Z",
      LayerName: null }, layerName:"snowplows" }],
    message: ""
  });
}


setInterval(()=>{
  if(t>48){
    r=true;
  }
  if(t<47){
    r=false;
  }
  if(r){
    t-=0.001;
  }else{
    t+=0.001;
  }


if(serverWS()){
  for(var i=10;i!=11;i++){

    em(t,i)
  }
}

},1000)
*/

export function getHiddenFields(layerDoc) {
  var hiddenFields = {};
  if (layerDoc && layerDoc.props && layerDoc.props.geometryTypes) {
    layerDoc.props.geometryTypes.forEach(type => {
      Object.keys(type.propertiesSchema.fields).forEach(fieldName => {
        if (type.propertiesSchema.fields[fieldName].hidden) {
          if (!Array.isArray(hiddenFields[type.id])) {
            hiddenFields[type.id] = [];
          }
          hiddenFields[type.id].push(fieldName); //Создаем массив с названиями скрытых слоев
        }
      });
    });
    return hiddenFields;
  } else {
    console.error('не выполняется layerDoc && layerDoc.props && layerDoc.props.geometryTypes', layerDoc);
  }
}
export function filterHiddenFields(docs, hiddenFields) {
  return (hiddenFields = docs.map(item => {
    if (Array.isArray(hiddenFields[item.props.objectType]) && hiddenFields[item.props.objectType].length) {
      hiddenFields[item.props.objectType].forEach(fieldName => {
        if (item.properties.hasOwnProperty(fieldName)) {
          delete item.properties[fieldName];
        }
      });
    }
    return item;
  }));
}
export function filterHiddenFieldsForRoles(roles, hiddenFields) {
  //проходимся по ролям
  // проходимся по объектам которые в {read:{fields:{..}}
  // если там есть blocked=== false
  // если в массиве скрытых полей есть такой объект
  // убираем в массиве скрытых полей это поле

  roles.forEach(role => {
    if (role && role.LayerRole && role.LayerRole.layerMode && role.LayerRole.layerMode.read && role.LayerRole.layerMode.read.fields) {
      Object.keys(role.LayerRole.layerMode.read.fields).forEach(objType => {
        // проходимся по типам объектов
        Object.keys(role.LayerRole.layerMode.read.fields[objType]).forEach(field => {
          if (typeof role.LayerRole.layerMode.read.fields[objType][field].blocked === 'boolean') {
            if (
              Array.isArray(hiddenFields[objType]) && // если у нас есть спрятанные поля
              hiddenFields[objType].indexOf(field) > -1
            ) {
              // если в спрятанных полях есть поле которое мы смотрим
              if (!role.LayerRole.layerMode.read.fields[objType][field].blocked) {
                // если указано что для этой роли это поле не блокированно
                hiddenFields[objType].splice(hiddenFields[objType].indexOf(field), 1); // удаляем поле из скрытых
              }
            }
          }
        });
      });
    }
  });
  return hiddenFields;
}

/**
 * returns layer fetrures or error
 * @param {Object} req
 * @param {string} layerName
 * @param {Function} callback
 */
const getFeaturesByLayer = (req, layerName, callback) => {
  // debug("read");
  db.Layer.findOne({
    where: {
      name: layerName,
    },
    include: [
      {
        model: db.Role,
        attributes: ['id', 'name'],
      },
    ],
  })
    .then(layerDoc => {
      if (!layerDoc) {
        const error = new Error(`Get features. Layer ${layerName} not found.`);
        error.code = 404;
        debug('Features. Get layer. Empty response');
        return callback(new Error(error));
      } else {
        let hiddenFields = getHiddenFields(layerDoc);
        hiddenFields = filterHiddenFieldsForRoles(layerDoc.Roles, hiddenFields);
        //нужно проверить есть ли у пользователя разрешение на получение слоя и получить список фильтров
        let accessObj = CheckFeaturesAccess(req, layerDoc, 'read'); //accessObj={access:bool,filters:["...","..."]}
        if (accessObj.access) {
          layerDoc
            .getFeature({ include: [{ model: db.CatalogDoc, as: 'CatalogDoc' }] })
            .then(features => {
              var readAccess = true;
              //если есть фильтры на фичеры
              if (accessObj.filters.length) {
                readAccess = false;
                accessObj.filters.forEach(filter => {
                  let readfunction = new Function('feature', 'return ' + filter);
                  readAccess = readAccess || readfunction(features);
                });
              }
              if (readAccess) {
                return callback(null, filterHiddenFields(features, hiddenFields));
              } else {
                debug('Feature. no access filters.');
                return callback(new Error('Features. no access filters.'));
              }
            })
            .catch(err => {
              const error = new Error(`Get features. Error get features of ${layerName}.`);
              error.code = 400;
              errDebug(`Features. Get features ${layerName}.`, err.message);
              return callback(new Error(error));
            });
        } else {
          return callback(new Error('Features. layer not access.'));
        }
      }
    })
    .catch(err => {
      const error = new Error(`Get features. Error searching layer ${layerName}.`);
      error.code = 500;
      errDebug('Features. Get layer.', err.message);
      return callback(new Error(error));
    });
};

/**
 * updates data of the feature
 * @param {Object} req
 * @param {string} layerName
 * @param {Object} feature
 * @param {string} featureId
 * @param {Function} callback
 */
const updateFeatureById = (req, layerName, feature, featureId, callback) => {
  db.Layer.findOne({
    where: {
      name: layerName,
    },
    include: [
      {
        model: db.Role,
        attributes: ['id', 'name'],
      },
    ],
  })
    .then(layerDoc => {
      if (layerDoc) {
        let hiddenFields = getHiddenFields(layerDoc);
        hiddenFields = filterHiddenFieldsForRoles(layerDoc.Roles, hiddenFields);
        let accessObj = CheckFeaturesAccess(req, layerDoc, 'update'); //accessObj={access:bool,filters:["...","..."]}

        if (accessObj.access) {
          db.Feature.findOne({ where: { id: featureId }, include: [{ model: db.CatalogDoc, as: 'CatalogDoc' }] })
            .then(oldFeature => {
              if (oldFeature) {
                var updateAccess = true;
                //если есть фильтры на фичеры
                if (accessObj.filters.length) {
                  updateAccess = false;
                  accessObj.filters.forEach(filter => {
                    let updatefunction = new Function('feature', 'return ' + filter);
                    updateAccess = updateAccess || updatefunction(oldFeature);
                  });
                }
                if (updateAccess) {
                  feature.properties = Object.assign(oldFeature.properties, feature.properties);
                  feature.CatalogDoc = oldFeature.CatalogDoc;
                  db.Feature.update(feature, {
                    where: {
                      id: featureId,
                    },
                  })
                    .then(result => {
                      if (serverWS()) {
                        debug(feature.LayerName);
                        serverWS()
                          .in('layers/' + feature.LayerName)
                          .emit('layers', {
                            type: 'features/update',
                            body: [{ feature: filterHiddenFields([feature], hiddenFields)[0], layerName: feature.LayerName }],
                            message: '',
                          });
                      }
                      return callback(null, result);
                    })
                    .catch(err => {
                      debug('Feature. Find feature failed. ', err.message);
                      return callback(new Error('Features. Find feature failed. ', err.message));
                    });
                } else {
                  debug('Feature. no access filters.');
                  return callback(new Error('Features. no access filters.'));
                }
              } else {
                debug('Feature. Feature not found or no access. ');
                return callback(new Error('Features. Feature not found or no access. '));
              }
            })
            .catch(err => {
              debug('Feature. Find oldfeature failed. ', err.message);
              return callback(new Error('Features. Find oldfeature failed. ', err.message));
            });
        } else {
          return callback(new Error('Features. layer not access.'));
        }
      } else {
        debug('Feature. Layer not found');
        return callback(new Error('Features. Layer not found.'));
      }
    })
    .catch(err => {
      debug('Feature. Find feature layer failed. ', err.message);
      return callback(new Error('Features. Find feature layer failed. ', err.message));
    });
};

/**
 * updates data of the feature
 * @param {Object} req
 * @param {string} layerName
 * @param {Object} feature
 * @param {string} featureId
 * @param {Function} callback
 */
const deleteFeatureById = (req, layerName, featureId, callback) => {
  db.Layer.findOne({
    where: {
      name: layerName,
    },
    include: [
      {
        model: db.Role,
        attributes: ['id', 'name'],
      },
    ],
  })
    .then(layerDoc => {
      if (layerDoc) {
        let accessObj = CheckFeaturesAccess(req, layerDoc, 'delete'); //accessObj={access:bool,filters:["...","..."]}
        if (accessObj.access) {
          db.Feature.findOne({ where: { id: featureId }, include: [{ model: db.CatalogDoc, as: 'CatalogDoc' }] })
            .then(oldFeature => {
              if (oldFeature) {
                var deleteAccess = true;
                //если есть фильтры на фичеры
                if (accessObj.filters.length) {
                  deleteAccess = false;
                  accessObj.filters.forEach(filter => {
                    let deletefunction = new Function('feature', 'return ' + filter);
                    deleteAccess = deleteAccess || deletefunction(oldFeature);
                  });
                }
                if (deleteAccess) {
                  db.Feature.destroy({
                    where: {
                      id: featureId,
                    },
                  })
                    .then(result => {
                      if (serverWS()) {
                        serverWS()
                          .in('layers/' + layerName)
                          .emit('layers', {
                            type: 'features/delete',
                            body: [{ featureId: featureId, layerName: layerName }],
                            message: 'Слой ' + layerName + ' обновлен',
                          });
                      }
                      return callback(null, result);
                    })
                    .catch(err => {
                      debug('Feature. Find feature failed. ', err.message);
                      return callback(new Error('Features. Find feature failed. ', err.message));
                    });
                } else {
                  debug('Feature. no access filters.');
                  return callback(new Error('Features. no access filters.'));
                }
              } else {
                debug('Feature. Feature not found or no access. ');
                return callback(new Error('Features. Feature not found or no access. '));
              }
            })
            .catch(err => {
              debug('Feature. Find oldfeature failed. ', err.message);
              return callback(new Error('Features. Find oldfeature failed. ', err.message));
            });
        } else {
          return callback(new Error('Features. layer not access.'));
        }
      } else {
        debug('Feature. Layer not found');
        return callback(new Error('Features. Layer not found.'));
      }
    })
    .catch(err => {
      debug('Feature. Find feature layer failed. ', err.message);
      return callback(new Error('Features. Find feature layer failed. ', err.message));
    });
};

const upsert = ({ layerName, feature, uniqKey, objectType }, callback) => {
  const uniqValue = valBy(uniqKey, feature);
  // TODO расскоментировать и доделать связь со слоем
  db.Feature.findOne({
    where: { [uniqKey]: uniqValue, 'props.objectType': objectType },
    include: [
      {
        model: db.Layer,
        attributes: ['props'],
        as: 'Layer',
      },
      {
        model: db.CatalogDoc,
        as: 'CatalogDoc',
      },
    ],
  })
    .then(doc => {
      function clientsUpdate(updatedDoc) {
        if (layerName === null) {
          debug(layerName, feature, uniqKey, objectType, 'NULL!!!!!!!');
        }
        serverWS()
          .in('layers/' + layerName)
          .emit('layers', {
            type: 'features/update',
            body: [{ feature: updatedDoc, layerName: layerName }],
            message: '',
          });
      }

      if (doc) {
        // debug('updated feature: ', feature.featureId);
        doc
          .update(feature)
          .then(updatedDoc => {
            var hiddenFields = getHiddenFields(doc.Layer);
            doc.Layer.getRoles().then(roles => {
              hiddenFields = filterHiddenFieldsForRoles(roles, hiddenFields);
              var temp = filterHiddenFields([updatedDoc.toJSON()], hiddenFields)[0];
              delete temp.Layer;
              clientsUpdate(temp);
              return callback();
            });
          })
          .catch(err => {
            debug('Features. Error update feature: ', err.message);
            return callback(new Error('Features. Update feature.'));
          });
      } else {
        db.Layer.find({
          where: {
            name: layerName,
          },
          include: [
            {
              model: db.Catalog,
            },
          ],
        })
          .then(layer => {
            if (layer) {
              db.Feature.create(feature)
                .then(newDoc => {
                  layer.addFeature(newDoc).then(() => {
                    const catPromises = layer.Catalogs.map(catalog => {
                      return new Promise((resolve, reject) => {
                        const primaryKey = catalog.props.featurePrimaryKeyNames.reduce((p, v) => {
                          const uniqValue = valBy(v, feature);
                          if (p) {
                            p = p + '&&' + uniqValue;
                          } else {
                            p = uniqValue;
                          }
                          return p;
                        }, '');
                        db.CatalogDoc.findOne({
                          where: {
                            primaryKey,
                          },
                        })
                          .then(catDoc => {
                            if (catDoc) {
                              //debug('!!!newDoc: ', newDoc, '!!!', catDoc);
                              newDoc.addCatalogDoc(catDoc).then(result => {
                                //debug('newDoc: ', newDoc);
                                //debug('result: ', result);
                                return resolve(result);
                              });
                            } else {
                              return resolve();
                            }
                          })
                          .catch(err => {
                            debug('Feature. Find Catalog failed.', err.message);
                            return reject(err);
                          });
                      });
                    });
                    Promise.all(catPromises).then(() => {
                      var hiddenFields = getHiddenFields(layer);
                      db.Feature.findOne({
                        where: { id: newDoc.id },
                        include: [
                          {
                            model: db.Layer,
                            attributes: ['props'],
                            as: 'Layer',
                          },
                          {
                            model: db.CatalogDoc,
                            as: 'CatalogDoc',
                          },
                        ],
                      }).then(resDoc => {
                        layer.getRoles().then(roles => {
                          hiddenFields = filterHiddenFieldsForRoles(roles, hiddenFields);
                          clientsUpdate(filterHiddenFields([resDoc], hiddenFields)[0]);
                          return callback();
                        });
                      });
                    });
                  });
                })
                .catch(err => {
                  debug('Features. Error create feature. ', err.message);
                  return callback(new Error('Features. Error create feature.'));
                });
            }
          })
          .catch(err => {
            debug('Features. Error find layer. ', err.message);
            return callback(new Error('Features. Error find layer.'));
          });
      }
    })
    .catch(err => {
      debug('Features. Upsert error: ', err.message);
      return callback(new Error('Features. Find feature.'));
    });
};

const createFeature = ({ layerName, feature, callback }) => {
  db.Layer.find({
    where: {
      name: layerName,
    },
    include: [
      {
        model: db.Catalog,
      },
    ],
  })
    .then(layer => {
      if (layer) {
        db.Feature.create(feature)
          .then(newDoc => {
            layer.addFeature(newDoc).then(() => {
              const catPromises = layer.Catalogs.map(catalog => {
                return new Promise((resolve, reject) => {
                  const primaryKey = catalog.props.featurePrimaryKeyNames.reduce((p, v) => {
                    const uniqValue = valBy(v, feature);
                    if (p) {
                      p = p + '&&' + uniqValue;
                    } else {
                      p = uniqValue;
                    }
                    return p;
                  }, '');
                  db.CatalogDoc.findOne({
                    where: {
                      primaryKey,
                    },
                  })
                    .then(catDoc => {
                      //debug('!!!newDoc: ', newDoc, '!!!', catDoc);
                      newDoc.addCatalogDoc(catDoc).then(result => {
                        //debug('newDoc: ', newDoc);
                        //debug('result: ', result);
                        return resolve(result);
                      });
                    })
                    .catch(err => {
                      debug('Feature. Find Catalog failed.', err.message);
                      return reject(err);
                    });
                });
              });
              Promise.all(catPromises).then(() => {
                var hiddenFields = getHiddenFields(layer);
                layer.getRoles().then(roles => {
                  hiddenFields = filterHiddenFieldsForRoles(roles, hiddenFields);
                  // TODO !!! clientsUpdate(filterHiddenFields([newDoc], hiddenFields)[0]);
                  db.Feature.findOne({
                    where: { id: newDoc.id },
                    include: [
                      {
                        model: db.Layer,
                        attributes: ['props'],
                        as: 'Layer',
                      },
                      {
                        model: db.CatalogDoc,
                        as: 'CatalogDoc',
                      },
                    ],
                  }).then(doc => {
                    const feature = filterHiddenFields([doc], hiddenFields)[0];
                    serverWS()
                      .in('layers/' + layerName)
                      .emit('layers', {
                        type: 'features/update',
                        body: [{ feature, layerName: layerName }],
                        message: '',
                      });
                    return callback(null, feature);
                  });
                });
              });
            });
          })
          .catch(err => {
            debug('Features. Error create feature. ', err.message);
            return callback(new Error('Features. Error create feature.'));
          });
      }
    })
    .catch(err => {
      debug('Features. Error find layer. ', err.message);
      return callback(new Error('Features. Error find layer.'));
    });
};

export default {
  getFeaturesByLayer,
  updateFeatureById,
  deleteFeatureById,
  upsert,
  createFeature,
};
