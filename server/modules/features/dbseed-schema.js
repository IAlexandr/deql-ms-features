/*import { configDbSeed } from '../../db/initial-data/utils';
import { debug } from 'debug';*/
// var randomTest=[]

// for(let i=0; i!=5; i++){
//   randomTest.push( {
//     body: {
//       "type": "Feature",
//       "geometry": {
//         "type": "Polygon",
//         "coordinates": [
//           [
//             ["" + (47.00 + i/50), "" + (56.20 + i/50)], ["" + (47.00 + i/50), "" + (56.25 + i/50)],
//             ["" + (47.00 + i/50), "" + (56.25 + i/50)], ["" + (47.05 + i/50), "" + (56.25 + i/50)],
//             ["" + (47.05 + i/50), "" + (56.25 + i/50)], ["" + (47.05 + i/50), "" + (56.20 + i/50)],
//             ["" + (47.05 + i/50), "" + (56.20 + i/50)], ["" + (47.00 + i/50), "" + (56.20 + i/50)]
//           ]
//         ],
//       },
//       "properties": {
//         name: "1"+i,
//         address: "Test",
//       }
//     },
//     addTo: {
//       modelName: "Layer",
//       where: { name: "s1" }
//     }
//   })
// }

// for(let i=0; i!=5; i++){
//   randomTest.push( {
//     body: {
//       "type": "Feature",
//       "geometry": {
//         "type": "Polygon",
//         "coordinates": [
//           [
//             ["" + (47.00 + i/50), "" + (56.00 + i/50)], ["" + (47.00 + i/50), "" + (56.05 + i/50)],
//             ["" + (47.00 + i/50), "" + (56.05 + i/50)], ["" + (47.05 + i/50), "" + (56.05 + i/50)],
//             ["" + (47.05 + i/50), "" + (56.05 + i/50)], ["" + (47.05 + i/50), "" + (56.00 + i/50)],
//             ["" + (47.05 + i/50), "" + (56.00 + i/50)], ["" + (47.00 + i/50), "" + (56.00 + i/50)]
//           ]
//         ],
//       },
//       "properties": {
//         name: "Полигон " + i,
//         address: "Адрес " + i
//       },
//       'props': {
//         "objectType": 'templ-polygon'
//       }
//     },
//     addTo: {
//       modelName: "Layer",
//       where: { name: "template" }
//     }
//   })
// }

const features = {
  modelName: 'Feature',
  docs: [
    {
      body: {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: ['47.21722304439545', '56.017280462991785'],
        },
        properties: {
          controllerId: '866104021988756',
          time: '2017-11-08T05:59:04.000Z',
          height: 150,
          speed: 0,
          course: 0,
          numSat: 18,
        },
        props: {
          objectType: 'tracktorPoint',
        },
      },
      addTo: {
        modelName: 'Layer',
        where: { name: 'snowplows' },
      },
    },
    {
      body: {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: ['47.22822304439545', '56.028280462991785'],
        },
        properties: {
          controllerId: '454086',
          time: '2017-11-08T05:59:04.000Z',
          height: 150,
          speed: 0,
          course: 0,
          numSat: 18,
        },
        props: {
          objectType: 'tracktorPoint',
        },
      },
      addTo: {
        modelName: 'Layer',
        where: { name: 'snowplows' },
      },
    },
  ],
};
/*
export default function() {
  //debug('features dbseed');
  return new Promise(resolve => {
    return resolve();
  });
  //return configDbSeed([features]);
}*/

export default [];
