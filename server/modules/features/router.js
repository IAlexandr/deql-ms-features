import { Router } from 'express';
import crud from './crud';
import logger from '../logger';
import { db } from '../../db/index';
var conf = require('config');

const { debug, errDebug, time } = logger('features.router');
const router = Router();
const orderWeight = 90;

/* возвращает все слои типа features */
switch (conf.projectName) {
case 'video-portal':
  {
    //videoportal
    router.get('/', (req, res) => {
      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      const getFeaturesDataTime = time('getFeaturesDataTime');
      db.Layer.findAll({ where: { type: 'features' } })
        .then(layers => {
          getFeaturesDataTime('done.');
          const result = layers.reduce((v, n) => {
            v[n['name']] = n;
            return v;
          }, {});
          return res.status(200).json(result);
        })
        .catch(err => {
          errDebug('Features. Get feature layers.', err.message);
          res.status(500).json({ errmessage: 'Features. Get feature layers.' });
        });
    });
  }
  break;
default:
  break;
}

/* возвращает заданный слой и связанные с ним features  */
switch (conf.projectName) {
case 'gis-snowplows':
  {
    //TODO или удалить или использовать на клиенте(в момент проверки не используется)
    router.get('/:layerName', (req, res) => {
      const getFeaturesByLayerTime = time('getFeaturesByLayer');
      crud.getFeaturesByLayer(req, req.params.layerName, (err, result) => {
        if (err) {
          getFeaturesByLayerTime('done with err:', err.message);
          return res.status(err.code || 500).json({ errmessage: err.message });
        }
        getFeaturesByLayerTime('done.');
        if (req.socketio) {
          //req.socketio.emit('map/progress', 10);

          req.socketio.emit('layers', {
            type: 'features/add',
            body: { features: result, layerName: req.params.layerName },
          });

          return res.status(200).json({});
        } else {
          return res.status(200).json({ result });
        }
      });
    });
    router.post('/:layerName/:id/update', (req, res) => {
      const updateFeatureByIdTime = time('updateFeatureByIdTime');
      crud.updateFeatureById(req, req.params.layerName, req.body.feature, req.params.id, err => {
        if (err) {
          updateFeatureByIdTime('done with err:', err.message);
          return res.status(500).json({ errmessage: err.message });
        }
        updateFeatureByIdTime('done.');
        return res.status(200).json({});
      });
    });
    router.post('/:layerName/:id/delete', (req, res) => {
      const deleteFeatureByIdTime = time('deleteFeatureByIdTime');
      crud.deleteFeatureById(req, req.params.layerName, req.params.id, err => {
        if (err) {
          deleteFeatureByIdTime('done with err:', err.message);
          return res.status(500).json({ errmessage: err.message });
        }
        deleteFeatureByIdTime('done.');
        return res.status(200).json({});
      });
    });
    router.post('/:layerName/create', (req, res) => {
      const createFeatureByIdTime = time('createFeatureByIdTime');
      crud.createFeature({
        layerName: req.params.layerName,
        feature: req.body.feature,
        callback: (err, result) => {
          if (err) {
            createFeatureByIdTime('done with err:', err.message);
            return res.status(500).json({ errmessage: err.message });
          }
          createFeatureByIdTime('done.');
          return res.status(200).json(result);
        },
      });
    });
  }
  break;
case 'video-portal':
  {
    router.get('/:layerName', (req, res) => {
      res.header('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      db.Layer.findOne({ where: { name: req.params.layerName } })
        .then(layerDoc => {
          if (!layerDoc) {
            debug('Features. Get layer. Empty response');
            res.status(500).json({ errmessage: `Слой "${req.params.layerName}" отсутствует.` });
          }
          layerDoc
            .getFeature()
            .then(docs => {
              return res.status(200).json(docs);
            })
            .catch(err => {
              errDebug('Features. Get layer features.', err.message);
              res.status(500).json({ errmessage: 'Features. Get layer features.' });
            });
        })
        .catch(err => {
          errDebug('Features. Get layer.', err.message);
          res.status(500).json({ errmessage: 'Features. Get layer.' });
        });
    });
  }
  break;

default:
  break;
}

/**
 * Проверить разрешен ли доступ на операцию и получить список фильтров которые нужно применить на фичеры
 * req - берутся список ролей из req.session.roles
 * layer - слой в котором включены Roles
 * rule - режим на который проверяют. пример: "read"
 * return:{access:bool,filters:["...","..."]}
 * @param {Object} req
 * @param {Object} layer
 * @param {string} rule
 * @returns {Object}
 */
export function CheckFeaturesAccess(req, layer, rule) {
  let result = {
    access: false,
    filters: [],
  };

  // пользователя с ролью системного администратора сразу возвращаем true
  if (req.session && req.session.roles.indexOf('system') > -1) {
    result.access = true;
    return result;
  }

  // пользователя с ролью администратора у организации сразу возвращаем true
  if (req.session && req.session.roles.indexOf('administrator') > -1 && req.session.organizations.indexOf(layer.OrganizationName) > -1) {
    result.access = true;
    return result;
  }

  /* проверяем наличие списка ролей и параметров слоя */
  if (req.session.roles && layer && layer.Roles && layer.props) {
    // проходимся по ролям у слоя и проверяем наличие ролей у пользователя

    // пользователи видят только фичеры у видимых слоев
    if (layer.props.visible) {
      //пользователю в организации отдаем все по ролям, а остальным только если публичный
      if (req.session.organizations.indexOf(layer.OrganizationName) > -1) {
        layer.Roles.forEach(role => {
          if (req.session.roles.indexOf(role.name) > -1) {
            //status отвечает отдавать ли пользователю
            if (role.LayerRole.layerMode[rule].status) {
              result.access = true;
              //добавляем фильтры которые мы будем применять
              if (role.LayerRole.layerMode[rule].where !== '' || role.LayerRole.layerMode[rule].where !== 'true') {
                result.filters.push(role.LayerRole.layerMode[rule].where);
              }
            }
          }
        });
      }
      if (rule === 'read') {
        if (layer.props.public) {
          result.access = true;
        }
      }

      return result;
    } else {
      result.access = false;
      return result;
    }
  } else {
    errDebug('CheckFeaturesAccess. No layer.Roles or req.session.roles.');
    result.access = false;
    return result;
  }
}

export default {
  route: '/layers/features',
  router,
  orderWeight,
};
