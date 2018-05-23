export default `
  extend type Project{
    layers:[Layer]
  }
  extend type Group{
    layers:[Layer]
  }
  extend type Layer{
    groups:[Group]
  }
  extend type Organization{
    groups:[Group]
  }
  extend type Role{
    layers:[Layer]
  }
  extend type Organization{
    layers:[Layer]
  }
  extend type Feature{
    layer:Layer
  }
`;
