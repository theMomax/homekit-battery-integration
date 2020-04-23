import {init, Accessory, Service, Characteristic, CharacteristicEventTypes, uuid, CharacteristicGetCallback, CharacteristicSetCallback, CharacteristicValue, Bridge, Categories} from "hap-nodejs";
import {Subscriber} from './integrations/openems/subscriber'
import { EdgeIntegration } from "./integrations/openems/edge";
var debug = require('debug')('custom:accessory:debug')
var info = require('debug')('custom:accessory:info')
var warn = require('debug')('custom:accessory:warn')
var error = require('debug')('custom:accessory:error')

init();

// const accessoryUUID = uuid.generate("homekit-battery-integration1");
// const accessory = new Accessory("MyCoolAccessory", accessoryUUID);

// const switchService = new Service.Switch("MySwitch", '');

// let switchValue = false;
// switchService.getCharacteristic(Characteristic.On)!
//     .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
//         callback(undefined, switchValue);
//     })
//     .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
//         switchValue = value as boolean;
//         callback();
//     });

// accessory.addService(switchService);



// accessory.publish({
//     username: "43:CF:2C:27:2A:1D",
//     pincode: "123-45-678",
//     port: 58234,
//     category: Categories.SWITCH,
// });

let openems = new Subscriber('ws://192.168.1.105/websocket', 'user')
openems.init().then(value => {
    let edge0 = new EdgeIntegration('FENECON Pro 9-12', '00000030-0000-1000-8000-0016BA665292', 'edge0', openems)
    edge0.publish({
        username: "43:CF:2C:27:2A:1D",
        pincode: "123-45-678",
        port: 58234,
        category: Categories.BRIDGE,
    })
})



// openems.init().then(value => {
//     warn(openems.getEdges())
//     warn(openems.getEdgeComponents('edge0'))
//     warn(openems.getComponentChannels('edge0', '_sum'))

//     openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY('edge0', '_sum', 'EssActivePower'), (channelId: string, value: any) => {
//         debug(channelId, value)
//     }).then((channels: String[]) => {
//         info(channels)
//         openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY('edge0', '_sum', 'EssSoc'), (channelId: string, value: any) => {
//             debug(channelId, value)
//         }).then((channels: String[]) => {
//             info(channels)
//         }, (reason: any) => {
//             error(reason)
//         })
//     }, (reason: any) => {
//         error(reason)
//     })
// })

