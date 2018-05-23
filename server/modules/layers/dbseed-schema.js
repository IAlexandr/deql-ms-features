/*import { configDbSeed } from '../../db/initial-data/utils';
import debug from 'debug';*/
const layers = {
  modelName: 'Layer',
  docs: [
    //
    //  {
    //    body: {
    //      /*
    //      * Этот слой сделан в качестве примера
    //      * Объект слоя может быть с любым типом геометрии (в данном примере Point, Polygon)
    //      * Желательно слой создавать под один тип геометрии
    //      * */
    //      "name": "template",
    //      /*
    //       * тип слоя
    //       * features - объекты слоя хранятся в бд таблице Features
    //       * cameras - слой для камер, так как это сложный слой мы выделили его в отдельный тип
    //       * TODO можно создавать сложные слои, на примере cameras
    //        * */
    //      "type": "features",
    //      "props": {
    //        displayName: "Тестовый слой #1 (шаблон)",
    //        editable: true, // можно запретить редактирование для всех
    //        visible: true, // можно выключить слой, не виден никому
    //        public: true,
    //        dynamicProps: { // todo сделать в админке доступным для изменения
    //          isDynamic: false
    //        },
    //        defaultSettings: {
    //          visible: true,
    //          filter: null, // 'feature.properties.class === 1'
    //          opacity: 1,
    //          orderWeight: 60,
    //        },
    //        geometryTypes: [  // модуль редактирования будет предоставлять эти типы для редактирования с соотвт. стилями
    //          {
    //            id: 'templ-marker',
    //            name: 'точка',
    //            geometryType: "Point",
    //            style: {
    //              defaultStyle: {
    //                iconUrl: 'marker-icon'//изображение хранится в /static/images/`+iconUrl+`.png
    //              },
    //              // "cases":{"simpleTypes":{"course":[{funcProps:{op:"равно",val:'Московский район'},style:{"color":"#ff0000","fillColor":"#ff0000"}}]},"advanced":"if( feature.properties && feature.properties.course){if(feature.properties.course>180){return {color:'#006666'}}else{return{color:'#666600'}}}else{return undefined;}"}}
    //            },
    //            propertiesSchema: {
    //              fields: {
    //                name: {
    //                  name: "Название",
    //                  type: "text",
    //                  maxLength: 50,
    //                  defaultValue: "default text",
    //                  showInTable: true,
    //                  showInPopup: false
    //                  editable: false,
    //                  hidden: false,
    //                },
    //                // field2: {
    //                //   id: 2,
    //                //   name: "test",
    //                //   type: "select",
    //                //   options: {
    //                //     key1: "value1",
    //                //     key2: "value2"
    //                //   },
    //                //   defaultOption: "key1"
    //                // },
    //                // field3: { // TODO
    //                //   id: 3,
    //                //   name: "test",
    //                //   type: "dynamicSelect",
    //                //   options: {
    //                //     restApi: "/api/gis-cht/layers/template/someRoute",
    //                //     fieldKey: "key1", // наименование поля которое будет использоваться в качестве ключа
    //                //     fieldValue: "value1" // в качестве значения
    //                //   },
    //                // },
    //                // field4: {
    //                //   id: 4,
    //                //   name: "test",
    //                //   type: "checkbox",
    //                //   defaultValue: true
    //                // },
    //                address: {
    //                  name: "Адрес",
    //                  type: "textArea",
    //                  maxLength: 500,
    //                  defaultValue: "default text",
    //                  showInTable: false,
    //                  showInPopup: false,
    //                  editable: false,
    //                  hidden: false,
    //                }
    //              }
    //            }
    //          },
    //          {
    //            id: 'templ-polygon',
    //            name: 'полигон',
    //            geometryType: "Polygon",
    //            style: {
    //              defaultStyle: {
    //                color: "#ff0000",
    //                weight: 1,
    //                opacity: 1.0
    //              },
    //             // "cases":{"simpleTypes":{"course":[{funcProps:{op:"равно",val:'Московский район'},style:{"color":"#ff0000","fillColor":"#ff0000"}}]},"advanced":"if( feature.properties && feature.properties.course){if(feature.properties.course>180){return {color:'#006666'}}else{return{color:'#666600'}}}else{return undefined;}"}}
    //            },
    //            propertiesSchema: {
    //              fields: {
    //                name: {
    //                  name: "Название",
    //                  type: "text",
    //                  maxLength: 50,
    //                  defaultValue: "default text",
    //                  showInTable: true,
    //                  showInPopup: false
    //                },
    //                address: {
    //                  name: "Адрес",
    //                  type: "textArea",
    //                  maxLength: 500,
    //                  defaultValue: "default text",
    //                  showInTable: false,
    //                  showInPopup: false
    //                },
    //              }
    //            }
    //          }
    //        ]
    //      }
    //    },
    //    addTo: [{
    //      modelName: "Role",
    //      where: {
    //        name: "administrator"
    //      }
    //    }
    //  ]
    //  },
    //
    // {
    //   body: {
    //     "name": "bd2016",
    //     "type": "cameras",
    //     "props": {
    //       displayName: "Камеры видеопортала",
    //       editable: true, // можно запретить редактирование для всех
    //       visible: true, // можно выключить слой, не виден никому
    //       public: 'false',
    //       defaultSettings: {
    //         visible: true,
    //         filter: null,
    //         opacity: 1,
    //         orderWeight: 100,
    //       },
    //       geometryTypes: [
    //         {
    //           geometryType: "Point",
    //           style: {
    //             defaultStyle: {
    //               iconUrl: 'marker-icon-red'//изображение хранится в /static/images/`+iconUrl+`.png
    //             },
    //             // "cases":{"simpleTypes":{"course":[{funcProps:{op:"равно",val:'Московский район'},style:{"color":"#ff0000","fillColor":"#ff0000"}}]},"advanced":"if( feature.properties && feature.properties.course){if(feature.properties.course>180){return {color:'#006666'}}else{return{color:'#666600'}}}else{return undefined;}"}}
    //           },
    //           propertiesSchema: {
    //             fields: {
    //               field1: {
    //                 type: "text",
    //                 maxLength: 50,
    //                 defaultValue: "default text"
    //               },
    //               field2: {
    //                 type: "select",
    //                 options: {
    //                   key1: "value1",
    //                   key2: "value2"
    //                 },
    //                 defaultOption: "key1"
    //               },
    //               field3: { // TODO
    //                 type: "dynamicSelect",
    //                 options: {
    //                   restApi: "/api/gis-cht/layers/template/someRoute",
    //                   fieldKey: "key1", // наименование поля которое будет использоваться в качестве ключа
    //                   fieldValue: "value1" // в качестве значения
    //                 },
    //               },
    //               field4: {
    //                 type: "checkbox",
    //                 defaultValue: true
    //               },
    //               field5: {
    //                 type: "textArea",
    //                 maxLength: 500,
    //                 defaultValue: "default text"
    //               },
    //               // TODO добавить необходимые типы полей
    //             }
    //           }
    //         }
    //       ]
    //     }
    //   }
    // },
    /*
    {
      body: {
        "name": "s1",
        "type": "features",
        "props": {
          displayName: "Снегоуборочная техника2",
          dynamicProps: { // todo сделать в админке доступным для изменения
            isDynamic: true,
            moduleName: 'wialon-tractors',
            "wialon-tractors": {
              connections: { // найстройки подключения и тип будут браться из выбранного модуля, адрес подключения будет введен во время редактирования (в админке слоя) динамических свойств.
                type: 'ws', // ws/postRequest будет подставляться из выбранного модуля
                ws: { // все необходимые свойства для модуля будут запрашиваться в модалке редактирования на первом шаге.
                  address: 'ws://10.157.1.16:8889',
                  // например схема связей аттрибутов полученного объекта с нашими будет предложен конструктор связей полей.
                }
              }
            }
          },
          editable: true, // можно запретить редактирование для всех
          visible: true, // можно выключить слой, не виден никому
          public: false,
          defaultSettings: {
            visible: true,
            filter: null,
            opacity: 1,
            orderWeight: 80,
          },
          geometryTypes: [
            {
              id: 1,
              name: 'маркер',
              geometryType: "Point",
              style: {
                defaultStyle: {
                  iconUrl: 'marker-icon-red'//изображение хранится в /static/images/`+iconUrl+`.png
                },
                // "cases":{"simpleTypes":{"course":[{funcProps:{op:"равно",val:'Московский район'},style:{"color":"#ff0000","fillColor":"#ff0000"}}]},"advanced":"if( feature.properties && feature.properties.course){if(feature.properties.course>180){return {color:'#006666'}}else{return{color:'#666600'}}}else{return undefined;}"}}
              },
              propertiesSchema: {
                fields: {
                  field1: {
                    type: "text",
                    maxLength: 50,
                    defaultValue: "default text"
                  },
                  field2: {
                    type: "select",
                    options: {
                      key1: "value1",
                      key2: "value2"
                    },
                    defaultOption: "key1"
                  },
                  field3: { // TODO
                    type: "dynamicSelect",
                    options: {
                      restApi: "/api/gis-snowplows/layers/main",
                      fieldKey: "key1", // наименование поля которое будет использоваться в качестве ключа
                      fieldValue: "value1" // в качестве значения
                    },
                  },
                  field4: {
                    type: "checkbox",
                    defaultValue: true
                  },
                  field5: {
                    type: "textArea",
                    maxLength: 500,
                    defaultValue: "default text"
                  },
                  // TODO добавить необходимые типы полей
                }
              }
            },
            {
              id: 2,
              name: 'полигон',
              geometryType: "Polygon",
              style: {
                defaultStyle: {
                  color: "#ff00ff",
                  weight: 1,
                  opacity: 1.0
                },
                cases: {
                  // TODO задаем стили относительно properties
                }
              }
            },
          ]
        }
      },
      addTo: [{
        modelName: "Role",
        where: {
          name: "administrator"
        }
      }
    ]
    }
    */
  ],
};

const groups = {
  modelName: 'Group',
  docs: [
    {
      body: {
        name: 'chebtelekom_maingroup',
        props: { displayName: 'ЧТ: Общая группа' },
      },
    },
    {
      body: {
        name: 'chebtelekom_graniciizbiratelnihuchastkov',
        props: { displayName: 'ЧТ: Границы избирательных участков' },
      },
    },
  ],
};

/*export default function() {
  debug('layers dbseed');
  return configDbSeed([groups]);
  // return new Promise((resolve) => {
  //   return resolve();
  // });
}*/
export default [groups];
