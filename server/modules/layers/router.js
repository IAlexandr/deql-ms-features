import { Router } from 'express';
import { db } from '../../db/index';
import logger from '../logger';
import Transliterate from 'transliterate';
import { getUserOrganizations } from '../manage/router';
import { routerWS } from './../../serverWS';
import { getHiddenFields, filterHiddenFieldsForRoles, filterHiddenFields } from './../features/crud';
import arcgisPgFeatures from './../synchronizer/operations/arcgis-pg-features';

routerWS('connection', function(socket) {
  socket.on('error', error => {
    console.error('err', error);
  });

  socket.on('unsubscribeLayers', () => {
    Object.keys(socket.rooms).forEach(room => {
      if (room.indexOf('layers/') > -1) {
        socket.leave(room);
      }
    });
  });

  //подписываемся на слои
  //вызывается при переподключении
  socket.on('updateLayers', params => {
    if (!params || (!params.organizationId && !params.projectId)) {
      //в этом случае пользователь скорее всего робот
      return socket.emit('layers', { message: { type: 'notificationError', body: 'Не удалось подписатся на обновление слоев' } });
    }
    socket.updateSocketSession(() => {
      if (params.projectId === 'common') {
        db.Organization.findOne({ where: { name: params.organizationId } })
          .then(organization => {
            if (organization) {
              db.Role.findAll({
                include: [{ model: db.Layer, attributes: ['name'], where: { props: { visible: true }, OrganizationName: params.organizationId } }],
                where: { OrganizationName: organization.name, name: { [db.Op.in]: socket.session.roles } },
              })
                .then(roles => {
                  //складываем названия слоев в один массив
                  let tempRolesLayerArrayForQuery = [];
                  roles.forEach(role => {
                    role.Layers.forEach(layer => {
                      if (tempRolesLayerArrayForQuery.indexOf(layer.name) < 0) {
                        tempRolesLayerArrayForQuery.push(layer.name);
                      }
                    });
                  });
                  db.Project.findAll({
                    where: { OrganizationName: organization.name, public: true }, //публичные проекты
                    include: [
                      {
                        model: db.Layer,
                        where: {
                          [db.Op.or]: [
                            { name: { [db.Op.in]: tempRolesLayerArrayForQuery }, props: { visible: true } },
                            { props: { visible: true, public: true }, OrganizationName: params.organizationId },
                          ],
                        }, //публичные слои в публичных проектах
                        include: [
                          {
                            model: db.Role,
                            where: { OrganizationName: params.organizationId },
                            attributes: ['id', 'name'],
                          },
                          {
                            model: db.Group,
                            attributes: ['id', 'name', 'props'],
                          },
                        ],
                      },
                    ],
                  })
                    .then(projects => {
                      var publicLayers = {};
                      var layersNameForFeatures = [];
                      projects.forEach(project => {
                        if (project.Layers) {
                          project.Layers.forEach(layer => {
                            publicLayers[layer.name] = layer;
                            layersNameForFeatures.push(layer.name);
                          });
                        }
                      });
                      //подписываемся на получение слоев
                      subscribeTolayers(socket, layersNameForFeatures);

                      db.Feature.findAll({
                        where: { LayerName: { [db.Op.in]: layersNameForFeatures } },
                      })
                        .then(features => {
                          var featuresTemp = {};
                          features.forEach(feature => {
                            if (featuresTemp[feature.LayerName]) {
                              featuresTemp[feature.LayerName].push(feature.toJSON());
                            } else {
                              featuresTemp[feature.LayerName] = [feature.toJSON()];
                            }
                          });

                          //фильтрация props у фичеров
                          Object.keys(publicLayers).forEach(layerName => {
                            let hiddenFields = getHiddenFields(publicLayers[layerName]);
                            hiddenFields = filterHiddenFieldsForRoles(roles, hiddenFields);
                            if (featuresTemp[layerName]) {
                              featuresTemp[layerName] = filterHiddenFields(featuresTemp[layerName], hiddenFields);
                            }
                          });

                          return socket.emit('layers', {
                            type: 'layers/get',
                            body: { layers: publicLayers, features: featuresTemp, message: { type: 'success', body: 'Слои успешно перезагруженны' } },
                          });
                        })
                        .catch(e => {
                          errDebug('Error db features', e);
                          return socket.emit('layers', { message: { type: 'notificationError', body: 'При загрузке объектов произошла ошибка' } });
                        });
                    })
                    .catch(err => {
                      errDebug('Layers. Get layers.', err.message);
                      return socket.emit('layers', { message: { type: 'notificationError', body: 'Произошла ошибка при загрузке списка проектов' } });
                    });
                })
                .catch(err => {
                  errDebug('Layers. Get layers.', err.message);
                  return socket.emit('layers', { message: { type: 'notificationError', body: 'Произошла ошибка при поиске ролей' } });
                });
            } else {
              return socket.emit('layers', { message: { type: 'notificationError', body: 'Не удалось найти организацию' } });
            }
          })
          .catch(err => {
            errDebug('Layers. Get layers.', err.message);
            return socket.emit('layers', { message: { type: 'notificationError', body: 'Произошла ошибка при поиске организации' } });
          });
      } else {
        db.Project.findOne({ attributes: ['name'], where: { name: params.projectId } })
          .then(project => {
            if (project && project.OrganizationName === params.organizationId) {
              //получить все роли с слоями из этой организации
              db.Role.findAll({
                include: [{ model: db.Layer, where: { props: { visible: true }, OrganizationName: params.organizationId } }],
                where: { OrganizationName: project.OrganizationName, name: { [db.Op.in]: socket.session.roles } },
              })
                .then(roles => {
                  //складываем названия слоев в один массив
                  let tempRolesLayerArrayForQuery = [];
                  roles.forEach(role => {
                    role.Layers.forEach(layer => {
                      if (tempRolesLayerArrayForQuery.indexOf(layer.name) < 0) {
                        tempRolesLayerArrayForQuery.push(layer.name);
                      }
                    });
                  });
                  var query = {
                    name: { [db.Op.in]: tempRolesLayerArrayForQuery },
                    props: { visible: true },
                  };

                  if (project.public) {
                    query = {
                      [db.Op.or]: [{ name: { [db.Op.in]: tempRolesLayerArrayForQuery }, props: { visible: true } }, { props: { visible: true, public: true } }],
                    };
                  }
                  project
                    .getLayers({
                      where: query,
                      include: [
                        {
                          model: db.Role,
                          where: { OrganizationName: project.OrganizationName },
                          attributes: ['id', 'name'],
                        },
                        {
                          model: db.Group,
                          attributes: ['id', 'name', 'props'],
                        },
                      ],
                    })
                    .then(layers => {
                      var getLayers = {};
                      var layersNameForFeatures = [];
                      layers.forEach(layer => {
                        //если слой не привязан к роли (значит она публичная), то проверить на публичность в промежуточном слое
                        if (tempRolesLayerArrayForQuery.indexOf(layer.name) < 0) {
                          if (layer.ProjectLayer.public) {
                            getLayers[layer.name] = layer;
                            layersNameForFeatures.push(layer.name);
                          }
                        } else {
                          getLayers[layer.name] = layer;
                          layersNameForFeatures.push(layer.name);
                        }
                        return layer.name;
                      });
                      db.Feature.findAll({
                        where: { LayerName: { [db.Op.in]: layersNameForFeatures } },
                        include: [{ model: db.CatalogDoc, as: 'CatalogDoc' }],
                      })
                        .then(features => {
                          var featuresTemp = {};
                          features.forEach(feature => {
                            if (featuresTemp[feature.LayerName]) {
                              featuresTemp[feature.LayerName].push(feature);
                            } else {
                              featuresTemp[feature.LayerName] = [feature];
                            }
                          });
                          //фильтрация props у фичеров
                          Object.keys(getLayers).forEach(layerName => {
                            let hiddenFields = getHiddenFields(getLayers[layerName]);
                            hiddenFields = filterHiddenFieldsForRoles(roles, hiddenFields);

                            if (featuresTemp[layerName]) {
                              featuresTemp[layerName] = filterHiddenFields(featuresTemp[layerName], hiddenFields);
                            }
                          });
                          //подписываемся на получение слоев
                          subscribeTolayers(socket, layersNameForFeatures);

                          socket.emit('layers', {
                            type: 'layers/get',
                            body: { layers: getLayers, features: featuresTemp },
                            message: { type: 'success', body: 'Слои успешно перезагруженны' },
                          });
                        })
                        .catch(e => {
                          errDebug('Error db features', e);
                          socket.emit('layers', { message: { type: 'errorMessage', body: 'При загрузке объектов произошла ошибка' } });
                        });
                    });
                })
                .catch(err => {
                  errDebug('Layers. Get layers.', err.message);
                  return socket.emit('layers', { message: { type: 'notificationError', body: 'Произошла ошибка при поиске ролей' } });
                });
            } else {
              return socket.emit('layers', { message: { type: 'notificationError', body: 'Не удалось найти проект' } });
            }
          })
          .catch(err => {
            errDebug('Layers. Get layers.', err.message);
            return socket.emit('layers', { message: { type: 'notificationError', body: 'Не удалось найти проект.' } });
          });
      }
    });
  });
});

//пример
//req.io// получение сервера сокетов
//var socket=req.io.sockets.server.socket;//получение сокета

const { errDebug, time, debug } = logger('layers');
const router = Router();

/* returns all layers for snowplows/admin */
router.post('/l/list', (req, res) => {
  let orgIds = getUserOrganizations(req);
  let query = {
    attributes: ['type', 'name', 'props'],
    order: [['type', 'ASC']],
    where: { [db.Op.or]: [{ props: { visible: true } }, { props: { [db.Op.and]: [{ visible: true }, { public: true }] } }] },
    include: [
      {
        model: db.Role,
        attributes: ['id', 'name'],
      },
      {
        model: db.Group,
        attributes: ['id', 'name', 'props'],
      },
      {
        model: db.Catalog,
        attributes: ['name', 'props'],
      },
      {
        model: db.Organization,
        as: 'Organization',
        attributes: ['name', 'props'],
        where: {
          name: {
            [db.Op.in]: orgIds,
          },
        },
      },
    ],
  };
  /* условие выобрки не распространяется на администратора */
  if (req.session && req.session.roles && (req.session.roles.indexOf('administrator') > -1 || req.session.roles.indexOf('system') > -1)) {
    delete query.where;
  }
  db.Layer.findAll(query)
    .then(layers => {
      var temp = {};
      layers.forEach(item => {
        if (checkAccessLayer(req, item.Roles.map(role => role.name), item, 'layerRead')) {
          temp[item.name] = item;
          temp[item.name].Roles = temp[item.name].Roles.map(item => {
            var itemTemp = item.LayerRole.layerMode.update;
            return { LayerRole: { layerMode: itemTemp } };
          });
        }
      });
      return res.status(200).json({
        response: 'ok',
        layers: temp,
      });
    })
    .catch(err => {
      errDebug('Administration. List Layers.', err.message);
      return res.status(500).json({
        response: 'error',
        err: 'Не удалось получить список слоев',
      });
    });
});

/* returns all layers for project */
router.post('/l/org/:org/:project', (req, res) => {
  if (req.params.project === 'common') {
    db.Organization.findOne({ where: { name: req.params.org } })
      .then(organization => {
        if (organization) {
          db.Role.findAll({
            //находим
            include: [{ model: db.Layer, where: { props: { visible: true }, OrganizationName: req.params.org } }],
            where: { OrganizationName: organization.name, name: { [db.Op.in]: req.session.roles } },
          })
            .then(roles => {
              //складываем названия слоев в один массив
              let tempRolesLayerArrayForQuery = [];
              roles.forEach(role => {
                role.Layers.forEach(layer => {
                  if (tempRolesLayerArrayForQuery.indexOf(layer.name) < 0) {
                    tempRolesLayerArrayForQuery.push(layer.name);
                  }
                });
              });

              db.Project.findAll({
                where: { OrganizationName: organization.name, public: true }, //публичные проекты
                include: [
                  {
                    model: db.Layer,
                    where: {
                      [db.Op.or]: [{ name: { [db.Op.in]: tempRolesLayerArrayForQuery }, props: { visible: true } }, { props: { visible: true, public: true }, OrganizationName: req.params.org }],
                    }, //публичные слои в публичных проектах
                    include: [
                      {
                        model: db.Role,
                        where: { OrganizationName: req.params.org },
                        attributes: ['id', 'name'],
                      },
                      {
                        model: db.Group,
                        attributes: ['id', 'name', 'props'],
                      },
                    ],
                  },
                ],
              })
                .then(projects => {
                  var publicLayers = {};
                  var layersNameForFeatures = [];
                  projects.forEach(project => {
                    if (project.Layers) {
                      project.Layers.forEach(layer => {
                        publicLayers[layer.name] = layer;
                        layersNameForFeatures.push(layer.name);
                      });
                    }
                  });

                  if (req.socketio) {
                    db.Feature.findAll({
                      where: { LayerName: { [db.Op.in]: layersNameForFeatures } },
                      include: [{ model: db.CatalogDoc, as: 'CatalogDoc' }],
                    })
                      .then(features => {
                        var featuresTemp = {};
                        features.forEach(feature => {
                          if (featuresTemp[feature.LayerName]) {
                            featuresTemp[feature.LayerName].push(feature.toJSON());
                          } else {
                            featuresTemp[feature.LayerName] = [feature.toJSON()];
                          }
                        });

                        //фильтрация props у фичеров
                        Object.keys(publicLayers).forEach(layerName => {
                          let hiddenFields = getHiddenFields(publicLayers[layerName]);
                          hiddenFields = filterHiddenFieldsForRoles(roles, hiddenFields);

                          if (featuresTemp[layerName]) {
                            featuresTemp[layerName] = filterHiddenFields(featuresTemp[layerName], hiddenFields);
                          }
                        });

                        //подписываемся на получение слоев
                        subscribeTolayers(req.socketio, layersNameForFeatures);

                        req.socketio.emit('layers', {
                          type: 'layers/get',
                          body: { layers: publicLayers, features: featuresTemp },
                        });
                      })
                      .catch(e => {
                        errDebug('Error db features', e);
                        req.socketio.emit('layers', { message: { type: 'errorMessage', body: 'При загрузке объектов произошла ошибка' } });
                      });
                  }

                  return res.status(200).json({
                    response: 'ok',
                    layers: {},
                  });
                })
                .catch(err => {
                  errDebug('List Layers for project. Org. ', err.message);
                  return res.status(500).json({
                    response: 'error',
                    err: 'Не удалось получить список публичных слоев',
                  });
                });
            })
            .catch(err => {
              errDebug('List Layers for project. Roles. ', err.message);
              return res.status(500).json({
                response: 'error',
                err: 'Не удалось найти роли',
              });
            });
        } else {
          return res.status(500).json({
            response: 'error',
            err: 'Не удалось найти организацию',
          });
        }
      })
      .catch(err => {
        errDebug('List Layers for project. Org. ', err.message);
        return res.status(500).json({
          response: 'error',
          err: 'Не удалось получить организацию',
        });
      });
  } else {
    db.Project.findOne({ where: { name: req.params.project } })
      .then(project => {
        if (project && project.OrganizationName === req.params.org) {
          //получить все роли с слоями из этой организации
          db.Role.findAll({
            include: [{ model: db.Layer, where: { props: { visible: true }, OrganizationName: req.params.org } }],
            where: { OrganizationName: project.OrganizationName, name: { [db.Op.in]: req.session.roles } },
          })
            .then(roles => {
              //складываем названия слоев в один массив
              let tempRolesLayerArrayForQuery = [];
              roles.forEach(role => {
                role.Layers.forEach(layer => {
                  if (tempRolesLayerArrayForQuery.indexOf(layer.name) < 0) {
                    tempRolesLayerArrayForQuery.push(layer.name);
                  }
                });
              });

              var query = {
                name: { [db.Op.in]: tempRolesLayerArrayForQuery },
                props: { visible: true },
              };

              if (project.public) {
                query = {
                  [db.Op.or]: [{ name: { [db.Op.in]: tempRolesLayerArrayForQuery }, props: { visible: true } }, { props: { visible: true, public: true } }],
                };
              }
              project
                .getLayers({
                  where: query,
                  include: [
                    {
                      model: db.Role,
                      where: { OrganizationName: project.OrganizationName },
                      attributes: ['id', 'name'],
                    },
                    {
                      model: db.Group,
                      attributes: ['id', 'name', 'props'],
                    },
                  ],
                })
                .then(layers => {
                  if (req.socketio) {
                    var getLayers = {};
                    var layersNameForFeatures = [];
                    layers.forEach(layer => {
                      //если слой не привязан к роли (значит она публичная), то проверить на публичность в промежуточном слое
                      if (tempRolesLayerArrayForQuery.indexOf(layer.name) < 0) {
                        if (layer.ProjectLayer.public) {
                          getLayers[layer.name] = layer;
                          layersNameForFeatures.push(layer.name);
                        }
                      } else {
                        getLayers[layer.name] = layer;
                        layersNameForFeatures.push(layer.name);
                      }
                    });
                    db.Feature.findAll({
                      where: { LayerName: { [db.Op.in]: layersNameForFeatures } },
                      include: [{ model: db.CatalogDoc, as: 'CatalogDoc' }],
                    })
                      .then(features => {
                        var featuresTemp = {};
                        features.forEach(feature => {
                          if (featuresTemp[feature.LayerName]) {
                            featuresTemp[feature.LayerName].push(feature);
                          } else {
                            featuresTemp[feature.LayerName] = [feature];
                          }
                        });

                        //фильтрация props у фичеров
                        Object.keys(getLayers).forEach(layerName => {
                          let hiddenFields = getHiddenFields(getLayers[layerName]);
                          hiddenFields = filterHiddenFieldsForRoles(roles, hiddenFields);

                          if (featuresTemp[layerName]) {
                            featuresTemp[layerName] = filterHiddenFields(featuresTemp[layerName], hiddenFields);
                          }
                        });

                        //подписываемся на получение слоев
                        subscribeTolayers(req.socketio, layersNameForFeatures);

                        req.socketio.emit('layers', {
                          type: 'layers/get',
                          body: { layers: getLayers, features: featuresTemp },
                        });
                        return res.status(200).json({
                          response: 'ok',
                          layers: {},
                        });
                      })
                      .catch(e => {
                        errDebug('Error db features', e);
                        req.socketio.emit('layers', { message: { type: 'errorMessage', body: 'При загрузке объектов произошла ошибка' } });
                        return res.status(400).json({
                          response: 'error',
                          message: 'При загрузке объектов произошла ошибка',
                        });
                      });
                  } else {
                    var temp = {};
                    layers.forEach(layer => {
                      temp[layer.name] = layer;
                    });

                    return res.status(200).json({
                      response: 'ok',
                      layers: temp,
                    });
                  }
                })
                .catch(err => {
                  errDebug('List Layers for project. Get Layers. ', err.message);
                  return res.status(500).json({
                    response: 'error',
                    err: 'Не удалось получить список слоев',
                  });
                });
            })
            .catch(err => {
              errDebug('List Layers for project. Get Roles', err.message);
              return res.status(500).json({
                response: 'error',
                err: 'Не удалось получить список слоев',
              });
            });
        } else {
          errDebug('List Layers for project. project not found');
          return res.status(500).json({
            response: 'error',
            err: 'Не удалось получить список слоев',
          });
        }
      })
      .catch(err => {
        errDebug('List Layers for project.', err.message);
        return res.status(500).json({
          response: 'error',
          err: 'Не удалось получить список слоев',
        });
      });
  }
});

const layerCreate = ({ values, features, catalogs, properties, cases, orgId }) => {
  /* transliterates cyrillic symbols to latin */
  debug('layer Creating');
  let name = transliterateString(values.displayName);
  /* prepares received data for saving to db */
  let data = prepareData(values, features, properties, cases);
  let type = 'features';
  if (data.type) {
    type = data.type;
    delete data.type;
  }
  /* search for layer */
  return db.Layer.findOne({
    where: {
      name: name,
      type: type,
    },
  })
    .then(layer => {
      if (!layer) {
        /* search for main group */
        return db.Group.findOne({ where: { name: orgId + '_maingroup' }})
          .then(group => {
            return db.Role.findOne({ where: { name: orgId + '_all_layers' }})
              .then(role => {
              /* transaction start */
                return db.transaction(t => {
                  /* creates new layer */
                  return db.Layer.create({
                    name,
                    type: type,
                    props: data,
                  }).then(newLayer => {
                    if (orgId) {
                      return newLayer.setOrganization(orgId, { transaction: t }).then(() => {
                        if (catalogs) {
                          return newLayer.setCatalogs(catalogs, { transaction: t }).then(() => {
                            if (group) {
                              return newLayer.setGroups([group], { transaction: t }).then(() => {
                                if (role) {
                                  return newLayer.addRole(role, { transaction: t }).then(() => {
                                    return newLayer;
                                  });
                                } else {
                                  return newLayer;
                                }
                              });
                            } else {
                              if (role) {
                                return newLayer.addRole(role, { transaction: t }).then(() => {
                                  return newLayer;
                                });
                              } else {
                                return newLayer;
                              }
                            }
                          });
                        } else {
                          if (group) {
                            return newLayer.setGroups([group], { transaction: t }).then(() => {
                              if (role) {
                                return newLayer.addRole(role, { transaction: t }).then(() => {
                                  return newLayer;
                                });
                              } else {
                                return newLayer;
                              }
                            });
                          } else {
                            if (role) {
                              return newLayer.addRole(role, { transaction: t }).then(() => {
                                return newLayer;
                              });
                            } else {
                              return newLayer;
                            }
                          }
                        }
                      });
                    } else {
                      if (catalogs) {
                        return newLayer.setCatalogs(catalogs, { transaction: t }).then(() => {
                          if (group) {
                            return newLayer.setGroups([group], { transaction: t }).then(() => {
                              if (role) {
                                return newLayer.addRole(role, { transaction: t }).then(() => {
                                  return newLayer;
                                });
                              } else {
                                return newLayer;
                              }
                            });
                          } else {
                            if (role) {
                              return newLayer.addRole(role, { transaction: t }).then(() => {
                                return newLayer;
                              });
                            } else {
                              return newLayer;
                            }
                          }
                        });
                      } else {
                        if (group) {
                          return newLayer.setGroups([group], { transaction: t }).then(() => {
                            if (role) {
                              return newLayer.addRole(role, { transaction: t }).then(() => {
                                return newLayer;
                              });
                            } else {
                              return newLayer;
                            }
                          });
                        } else {
                          if (role) {
                            return newLayer.addRole(role, { transaction: t }).then(() => {
                              return newLayer;
                            });
                          } else {
                            return newLayer;
                          }
                        }
                      }
                    }
                  });
                })
                  .then(result => {
                    /* возвращаем id созданной роли */
                    return result;
                  })
                  .catch(err => {
                    /* если транзакция не удалась */
                    const errMsg = 'Administration. Create layer. Transaction failed.';
                    errDebug(errMsg, err.message);
                    throw new Error(errMsg);
                  });
              /* конец транзакции */
              }).catch(err => {
                const errMsg = 'Administration. Create layer. Role searching failed.';
                errDebug(errMsg, err.message);
                throw new Error(errMsg);
              });
          })
          .catch(err => {
            const errMsg = 'Administration. Create layer. Group searching failed.';
            errDebug(errMsg, err.message);
            throw new Error(errMsg);
          });
      } else {
        /* если слой с таким именем существует */
        const errMsg = 'Administration. Create layer. Layer with the name is exist.';
        errDebug(errMsg);
        throw new Error(errMsg);
      }
    })
    .catch(err => {
      /* если поиск не удалась */
      const errMsg = 'Administration. Create layer. Error searching layer.';
      errDebug(errMsg, err.message);
      throw new Error(errMsg);
    });
};

/* creates new layer and returns it */
router.post('/l/create', (req, res) => {
  /* checking access for user role */
  req.checkAccess(req, res, { roles: ['administrator', 'system'], isElevated: true }, () => {
    const createLayerDataTime = time('createLayerDataTime');
    /* get vars from request body */
    const { values, features, catalogs, properties, cases, orgId } = req.body;
    layerCreate({ values, features, catalogs, properties, cases, orgId })
      .then(layer => {
        createLayerDataTime('done.');
        res.status(200).json({
          response: 'ok',
          layer,
        });
      })
      .catch(err => {
        createLayerDataTime('done with err.', err.message);
        res.status(500).json({ response: 'error', err: err.message });
      });
  });
});

/* updates layer */
router.post('/l/update', (req, res) => {
  const updateLayerDataTime = time('updateLayerDataTime');
  /* get vars from request body */
  const { id, values, features, catalogs, properties, cases } = req.body;
  let data = prepareData(values, features, properties, cases);
  db.Layer.findOne({
    where: {
      name: id,
    },
    include: [
      {
        model: db.Role,
        attributes: ['id', 'name'],
      },
    ],
  })
    .then(layer => {
      /* checking access for user role */
      if (layer && checkAccessLayer(req, layer.Roles.map(role => role.name), layer, 'layerUpdate')) {
        /* transaction start */
        return db
          .transaction(t => {
            return layer
              .update(
                {
                  props: data,
                },
                {
                  include: [
                    {
                      where: { OrganizationName: req.session.organizations },
                      model: db.Role,
                      attributes: ['id', 'name'],
                    },
                    {
                      model: db.Group,
                      attributes: ['id', 'name', 'props'],
                    },
                  ],
                }
              )
              .then(updatedLayer => {
                if (catalogs) {
                  return layer.setCatalogs(catalogs, { transaction: t }).then(() => {
                    return updatedLayer;
                  });
                } else {
                  return updatedLayer;
                }
              });
          })
          .then(updatedLayer => {
            updateLayerDataTime('done.');
            if (updatedLayer) {
              /* sends information about update to subscribers */
              req.io.in('layers/' + id).emit('layers', {
                type: 'layers/update',
                body: [updatedLayer],
                message: 'слой ' + data.displayName + ' обновлен',
              });
            }
            return res.status(200).json({
              response: 'ok',
              layer: updatedLayer,
            });
          })
          .catch(err => {
            errDebug('Administration. Layer Update.', err.message);
            return res.status(500).json({
              response: 'error',
              err: 'Ошибка при изменения слоя.',
            });
          });
      } else {
        errDebug('Administration. No access for update layer.');
        return res.status(500).json({
          response: 'error',
          err: 'Ошибка доступа к изменению слоя.',
        });
      }
    })
    .catch(err => {
      errDebug('Administration. Error searching the layer.', err.message);
      return res.status(500).json({
        response: 'error',
        err: 'Ошибка при поиске слоя.',
      });
    });
});

/* deletes layer */
router.post('/l/delete', (req, res) => {
  /* checking access for user role */
  req.checkAccess(req, res, { roles: ['administrator', 'system'], isElevated: true }, () => {
    const deleteLayerDataTime = time('deleteLayerDataTime');
    /* get vars from request body */
    const { id } = req.body;
    db.Layer.destroy({
      where: {
        name: id,
      },
    })
      .then(() => {
        deleteLayerDataTime('done.');
        return res.status(200).json({
          response: 'ok',
        });
      })
      .catch(err => {
        errDebug('Administration. Layer Delete.', err.message);
        return res.status(500).json({
          response: 'error',
          err: 'Ошибка при удалении слоя.',
        });
      });
  });
});

/* deletes layer */
router.post('/l/from-arcgis', (req, res) => {
  req.checkAccess(req, res, { roles: ['administrator', 'system'], isElevated: true }, () => {
    const layersFromArcgisTime = time('layersFromArcgis');
    const { arcGisLayersProps } = req.body;
    /*{
      arcGisLayersProps: {
        'http://10.2.0.10:6080/arcgis/rest/services': ['Hosted/Инвестиционные_площадки/FeatureServer/0', 'Hosted/ЕТК/FeatureServer/0'],
      },
    }; */ 
    // TODO arcGisLayersProps
    const arcGisLayersUrls = Object.keys(arcGisLayersProps).reduce((p, v) => {
      const layersUrls = arcGisLayersProps[v];
      Object.keys(layersUrls).forEach(layerUrlTail => {
        p.push({ layerUrl: `${v}/${layerUrlTail}`, arcGisUrl: v, latestWkid: layersUrls[layerUrlTail].latestWkid });
      });
      return p;
    }, []);
    const fetchLayerInfo = arcGisLayerUrlInfo => {
      return fetch(`${arcGisLayerUrlInfo.layerUrl}?f=pjson`)
        .then(response => {
          return response.json();
        })
        .then(layerInfo => {
          const { name, geometryType, fields, objectIdField } = layerInfo;

          const values = {
            displayName: name,
            editable: false,
            modules: [],
            opacity: 1,
            orderWeight: 1,
            public: false,
            type: 'features',
            visible: true,
          };

          function getGeometryType (esriGeometryType) {
            let result;
            switch (esriGeometryType) {
            case 'esriGeometryPoint':
              result = 'Point';
              break ;
            default:
              result = 'Point';
              break;
            }
            return result;
          }

          const features = {
            [name]: {
              color: '#9c27b0',
              fill: true,
              fillColor: '#3388ff',
              fillOpacity: 0.4,
              iconUrl: 'home.png',
              geometryType: getGeometryType(geometryType),
              name: name, // Подпись типа объекта
              opacity: 1,
              weight: 3,
            },
          };

          const orgId = 'chebtelekom';

          const properties = {
            [name]: {},
          };

          const mergeSchemaFields = {
            type: 'type',
            geometry: 'geometry',
          };
          fields.forEach(esriField => {

            properties[name][esriField.alias] = {
              name: esriField.alias,
              type: 'text', // TODO getType from esriField.type
              maxLength: 500, // TODO from esriField.length (if TypeString)
              defaultValue: '',
              showInTable: false,
              showInPopup: false,
              editable: true,
              hidden: esriField.name === objectIdField,
            }

            mergeSchemaFields[`properties.${esriField.alias}`] = `properties.${esriField.alias}`;
          });
          const catalogs = [];
          const cases = {};

          const coordSystemConvertOperation = arcGisLayerUrlInfo.latestWkid === 3857 ? 'inverse' : 'forward';
          return layerCreate({ values, features, catalogs, properties, cases, orgId })
            .then(newLayer => {
              return arcgisPgFeatures({
                layerName: newLayer.name,
                mergeSchema: {
                  objectType: name,
                  fields: mergeSchemaFields,
                },
                props: {
                  featureServerUrl: arcGisLayerUrlInfo.layerUrl,
                  coordSystemConvertOperation,
                },
              });
            });
        });
    };
    Promise.all(arcGisLayersUrls.map(fetchLayerInfo))
      .then(results => {
        layersFromArcgisTime('results:', results);
      })
      .catch(err => {
        layersFromArcgisTime('err', err.message);
        res.status(500).json({ response: 'error', err: err.message });
      });
  });
});

/* returns array of layer types */
router.post('/l/types', (req, res) => {
  /* КОСТЫЛЬ! переделать! */
  return res.status(200).json({
    response: 'ok',
    layerTypes: {
      features: 'Объекты',
      cameras: 'Камеры',
    },
  });
});

/* returns all groups for snowplows/admin */
router.post('/g/list', (req, res) => {
  /* checking access for user role */
  req.checkAccess(req, res, { roles: ['administrator', 'system'], isElevated: true }, () => {
    const getGroupDataTime = time('getGroupDataTime');
    let orgIds = getUserOrganizations(req);
    db.Group.findAll({
      attributes: ['id', 'name', 'props'],
      order: [['id', 'ASC']],
      include: [
        {
          model: db.Layer,
          attributes: ['name', 'type', 'props'],
        },
        {
          model: db.Organization,
          as: 'Organization',
          attributes: ['name'],
          where: {
            name: {
              [db.Op.in]: orgIds,
            },
          },
        },
      ],
    })
      .then(groups => {
        getGroupDataTime('done.');
        return res.status(200).json({
          response: 'ok',
          groups,
        });
      })
      .catch(err => {
        errDebug('Administration. Layers.', err.message);
        return res.status(500).json({
          response: 'error',
          err: 'An error occurs during groups searching!',
        });
      });
  });
});

/* creates new group with layers for snowplows/admin */
router.post('/g/create', (req, res) => {
  /* checking access for user role */
  req.checkAccess(req, res, { roles: ['administrator', 'system'], isElevated: true }, () => {
    const createGroupDataTime = time('createGroupDataTime');
    /* выбираем из тела запроса полученные данные */
    const { displayName, layers, orgId } = req.body;
    /* transliterates cyrillic symbols to latin */
    const name = orgId + '_' + transliterateString(displayName);
    /* начало транзакции */
    return db
      .transaction(t => {
        /* создаем роль */
        return db.Group.create(
          {
            name: name,
            props: { displayName },
          },
          {
            transaction: t,
          }
        ).then(group => {
          if (layers.length && orgId) {
            return group.setOrganization(orgId, { transaction: t }).then(() => {
              return group.setLayers(layers, { transaction: t }).then(() => group);
            });
          } else if (!layers.length && orgId) {
            return group.setOrganization(orgId, { transaction: t }).then(() => group);
          } else if (layers.length && !orgId) {
            return group.setLayers(layers, { transaction: t }).then(() => group);
          } else {
            return group;
          }
        });
      })
      .then(result => {
        createGroupDataTime('done.');
        /* возвращаем id созданной роли */
        return res.status(200).json({
          response: 'ok',
          group: { id: result.id },
        });
      })
      .catch(err => {
        /* если транзакция не удалась */
        errDebug('Administration. Create group. Transaction.', err.message);
        return res.status(500).json({ err });
      });
    /* конец транзакции */
  });
});

/* updates group */
router.post('/g/update', (req, res) => {
  /* check user access */
  req.checkAccess(req, res, { roles: ['administrator', 'system'], isElevated: true }, () => {
    const updateGroupDataTime = time('updateGroupDataTime');
    if (req.body.id && req.body.displayName && req.body.layers) {
      const { id, displayName, layers } = req.body;
      /* search for Role*/
      db.Group.findOne({
        where: {
          id,
        },
      })
        .then(group => {
          /* transaction start */
          return db
            .transaction(t => {
              /* update role */
              return group
                .update(
                  {
                    props: { displayName },
                  },
                  {
                    transaction: t,
                  }
                )
                .then(() => {
                  /* update role associations with layers */
                  return group.setLayers(layers, { transaction: t }).then(() => group);
                });
            })
            .then(() => {
              updateGroupDataTime('done.');
              return res.status(200).json({
                response: 'ok',
              });
            })
            .catch(err => {
              errDebug('Administration. Update group. Transaction.', err.message);
              return res.status(500).json({ err });
            });
          /* transaction stop */
        })
        .catch(err => {
          errDebug('Administration. Update group. Error searching role.', err.message);
          return res.status(500).json({ err });
        });
    } else {
      return res.status(400).json({ message: 'Ошибка в параметрах' });
    }
  });
});

/* delete group by id */
router.post('/g/delete', (req, res) => {
  /* проверяем роль пользователя */
  req.checkAccess(req, res, { roles: ['administrator', 'system'], isElevated: true }, () => {
    const deleteGroupDataTime = time('deleteGroupDataTime');
    const { id } = req.body;
    db.Group.destroy({
      where: {
        id: id,
      },
    })
      .then(() => {
        deleteGroupDataTime('done.');
        return res.status(200).json({
          response: 'ok',
        });
      })
      .catch(err => {
        errDebug('Administration. Delete Group.', err.message);
        return res.status(500).json({
          response: 'error',
          err: 'Ошибка удаления группы.',
        });
      });
  });
});

/**
 * prepare received data for saving to db
 * @param { Object } values
 * @param { Object } features
 * @param { Object } properties
 * @param { Object } cases
 * @return { Object }
 */
function prepareData(values, features, properties, cases) {
  /* prepare defaultSettings block */
  const defaultSettings = {
    isCluster: false,
    visible: true,
    filter: null,
    isCluster: values.isCluster,
    opacity: values.opacity,
    orderWeight: values.orderWeight,
  };
  /* remove copied params */
  delete values.isCluster;
  delete values.opacity;
  delete values.orderWeight;
  /* add defaultSettings to result object */
  values.defaultSettings = Object.assign({},defaultSettings);
  /* prepares geometry objects of the layer */
  let geometryTypes = [];
  if (Object.keys(features).length) {
    Object.keys(features).forEach(item => {
      let tmpGT = Object.assign({},features[item])

      /* prepares main params of the geometry object */
      let gtParams = {
        id: item,
        name: tmpGT.name,
        geometryType: tmpGT.geometryType,
      };

      /* prepares properties of thegeometry object */
      let props = {
        propertiesSchema: {
          fields: {},
        },
      };

      if (Object.keys(properties).length) {
        Object.keys(properties).forEach(prop => {
          if (prop === item) {
            props.propertiesSchema.fields = properties[item];
          }
        });
      }

      let featureCases = {};
      /* structure of newCases
         *  { 
         *   featureId: {
         *     simpleTypes: {
         *       propertyId: { 
         *         caseId: { }
         *       }
         *     }, 
         *     simpleFunc: { 
         *       propertyId: {
         *         caseId: { }
         *       }
         *     }
         *   }
         * }
         */

      if (cases && Object.keys(cases).length && cases[item] && Object.keys(cases[item]).length) {
        const caseTypes =Object.assign({},cases[item]) 
        Object.keys(caseTypes).forEach(type => {
          featureCases[type] = Object.assign({},caseTypes[type]) 
        });
      }
      /* remove copied params */
      delete tmpGT.name;
      delete tmpGT.geometryType;
      /* prepare styles of geometry object */
      let gtStyle = {
        style: {
          defaultStyle: tmpGT,
          cases: featureCases,
        },
      };

      /* merge params and styles to one object */
      const gt =Object.assign(Object.assign(gtParams,gtStyle),props)  
      geometryTypes.push(gt);
    });
  }
  /* add geometry objects array to result object */
  values.geometryTypes = geometryTypes;
  return values;
}

/**
 * получение разрешение если слой привязан к роли, а у пользователя есть роль + слой публичный
 * @param {Object} req
 * @param {Array} roles
 * @param {Object} layer
 * @param {string} rule
 * @returns {boolean}
 */
export function checkAccessLayer(req, roles, layer, rule) {
  if (!req) {
    errDebug('Administration. Check Access to Layers. User is Guest. (No req.)');
    return false;
  } else {
    /* пользователю с ролью администратор сразу возвращаем true */
    if (req.session && req.session.roles && Array.isArray(req.session.roles) && (req.session.roles.indexOf('administrator') > -1 || req.session.roles.indexOf('system') > -1)) {
      return true;
    }

    if (roles && roles.length && layer && layer.props) {
      let accessRoles = false;
      roles.forEach(role => {
        if (layer.Roles && layer.Roles.length) {
          if (req.session.roles.indexOf(role) > -1) {
            layer.Roles.forEach((r, i) => {
              if (r.name === role) {
                accessRoles = layer.Roles[i].LayerRole.layerMode[rule].status;
              }
            });
          }
        }
      });
      if (layer.props.public || accessRoles) {
        return true;
      } else {
        errDebug('Administration. Check Access Layer. No access.');
        return false;
      }
    } else {
      errDebug('Administration. Check Access Layer. No roles, No props.');
      return false;
    }
  }
}

/**
 * transliterates input string and removes backspaces
 * @param {string} str
 * @returns {string}
 */
export function transliterateString(str) {
  let result = Transliterate(str).toLowerCase();
  return result.replace(/[^a-zA-Z0-9]/g, '');
}

function subscribeTolayers(socket, layers) {
  //отписываемся
  if (socket.rooms) {
    Object.keys(socket.rooms).forEach(room => {
      if (room.indexOf('layers/') > -1) {
        socket.leave(room);
      }
    });
  }
  // переподключаемся к комнатам
  layers.forEach(room => {
    socket.join('layers/' + room);
  });
}

export default {
  route: '/layers',
  router,
};
