export default mergeInfo => ({
  Project: {
    layers: {
      fragment: 'fragment ProjectFragment on Project {name}',
      resolve(parent, args, { db }, info) {
        return db.Project.findOne({ where: { name: parent.name } }).then(
          doc => {
            if (!doc) {
              throw new Error(`Project with '${parent.name}' not found`);
            }
            return doc.getLayers();
          }
        );
      },
    },
  },
  Group: {
    layers: {
      fragment: 'fragment GroupFragment on Group {name}',
      resolve(parent, args, { db }, info) {
        return db.Group.findOne({ where: { name: parent.name } }).then(
          doc => {
            if (!doc) {
              throw new Error(`Group with '${parent.name}' not found`);
            }
            return doc.getLayers();
          }
        );
      },
    },
  },
  Layer: {
    groups: {
      fragment: 'fragment LayerFragment on Layer {name}',
      resolve(parent, args, { db }, info) {
        return db.Layer.findOne({ where: { name: parent.name } }).then(
          doc => {
            if (!doc) {
              throw new Error(`Layer with '${parent.name}' not found`);
            }
            return doc.getGroups();
          }
        );
      },
    },
  },
  Organization: {
    groups: {
      fragment: 'fragment OrganizationFragment on Organization {name}',
      resolve(parent, args, { db }, info) {
        return db.Organization.findOne({
          where: { name: parent.name },
        }).then(doc => {
          if (!doc) {
            throw new Error(`Organization with '${parent.name}' not found`);
          }
          return doc.getGroup();
        });
      },
    },
    layers: {
      fragment: 'fragment OrganizationLayerFragment on Organization {name}',
      resolve(parent, args, { db }, info) {
        return db.Organization.findOne({
          where: { name: parent.name },
        }).then(doc => {
          if (!doc) {
            throw new Error(`Organization with '${parent.name}' not found`);
          }
          return doc.getLayer();
        });
      },
    },
  },
  Role: {
    layers: {
      fragment: 'fragment RoleFragment on Role{name}',
      resolve(parent, args, { db }, info) {
        return db.Role.findOne({ where: { name: parent.name } }).then(
          doc => {
            if (!doc) {
              throw new Error(`Role with '${parent.name}' not found`);
            }
            return doc.getLayers();
          }
        );
      },
    },
  },
  Feature: {
    layer: {
      fragment: 'fragment FeatureFragment on Feature{type}',
      resolve(parent, args, { db }, info) {
        return db.Feature.findOne({ where: { type: parent.type } }).then(
          doc => {
            if (!doc) {
              throw new Error(`Feature with '${parent.type}' not found`);
            }
            return doc.getLayer();
          }
        );
      },
    },
  },
});
