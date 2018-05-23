import GraphQLJSON from 'graphql-type-json';

export default pubsub => ({
  JSON: GraphQLJSON,

  Query: {
    layers: (layers, args, { db }) => {
      return db.Layer.findAll();
    },
    layer: (layer, { name }, { db }) => {
      //debug('RootResolvers layer name', args.name);
      return db.Layer.findOne({ where: { name } });
    },
    groups: (groups, args, { db }) => {
      return db.Group.findAll();
    },
    group: (group, { name }, { db }) => {
      //debug('RootResolvers group name', args.name);
      return db.Group.findOne({ where: { name } });
    },
  },
  Subscription: {
    layerCreated: {
      subscribe: () => {
        return pubsub.asyncIterator('LAYER_CREATED');
      },
    },
    layerUpdated: {
      subscribe: () => {
        return pubsub.asyncIterator('LAYER_UPDATED');
      },
    },
    layerDeleted: {
      subscribe: () => {
        return pubsub.asyncIterator('LAYER_DELETED');
      },
    },
    groupCreated: {
      subscribe: () => {
        return pubsub.asyncIterator('GROUP_CREATED');
      },
    },
    groupUpdated: {
      subscribe: () => {
        return pubsub.asyncIterator('GROUP_UPDATED');
      },
    },
    groupDeleted: {
      subscribe: () => {
        return pubsub.asyncIterator('GROUP_DELETED');
      },
    },
  },
  Mutation: {
    createLayer: (parent, { name, type, props }, { db }) => {
      const layer = { name, type, props };
      return db.Layer.create(layer)
        .then(result => {
          pubsub.publish('LAYER_CREATED', {
            layerAdded: layer,
          });
          return layer;
        })
        .catch(err => {
          throw new Error('Ошибка создания слоя!');
        });
    },
    deleteLayer: (parent, { name }, { db }) => {
      const layer = { name };
      return db.Layer.destroy({ where: { name } })
        .then(result => {
          if (result === 0) {
            throw new Error(`Слоя ${layer.name} не существует!`);
          } else {
            pubsub.publish('LAYER_DELETED', { layerDeleted: layer.name });
          }
          return layer.name;
        })
        .catch(err => {
          throw new Error('Ошибка удаления слоя!');
        });
    },
    createGroup: (parent, { name, groupName, layers }, { db }) => {
      const group = {
        name,
        props: {
          displayName: groupName,
        },
      };
      return db.Group.create(group)
        .then(newGroup => {
          return newGroup
            .setLayers(layers)
            .then(result => {
              group.id = newGroup.id;
              group.layers = [...layers];
              pubsub.publish('GROUP_CREATED', {
                groupCreated: group,
              });
              return group;
            })
            .catch(err => {
              errDebug('Error associating layers with group!', err);
              throw new Error('Error associating layers with group!');
            });
        })
        .catch(err => {
          errDebug('Error on creating group!', err);
          throw new Error('Error on creating group!');
        });
    },
    updateGroup: (parent, { id, name, groupName, layers }, { db }) => {
      const group = {
        id,
        name,
        props: {
          displayName: groupName,
        },
        layers,
      };
      return db.Group.findOne({ where: { name } })
        .then(result => {
          if (result) {
            result.set('props.displayName', groupName);
            return result
              .save()
              .then(() => {
                return result.setLayers(layers).then(() => {
                  pubsub.publish('GROUP_UPDATED', {
                    groupUpdated: group,
                  });
                  return group;
                });
              })
              .catch(err => {
                errDebug('Error saving group!', err);
                throw new Error('Error saving group!');
              });
          } else {
            errDebug('Group not found!');
            throw new Error('Group not found!');
          }
        })
        .catch(err => {
          errDebug('Error searching group!', err);
          throw new Error('Error searching group!');
        });
    },
    deleteGroup: (parent, { name }, { db }) => {
      const group = { name };
      return db.Group.destroy({ where: { name } })
        .then(result => {
          if (result === 0) {
            throw new Error(`Группы ${group.name} не существует!`);
          } else {
            pubsub.publish('GROUP_DELETED', { groupDeleted: group.name });
          }
          return group.name;
        })
        .catch(err => {
          throw new Error('Ошибка удаления группы!');
        });
    },
  },
});
