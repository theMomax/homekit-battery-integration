import {init} from "hap-nodejs";
import {Subscriber} from './integrations/openems/subscriber'
import { EdgeIntegration } from "./integrations/openems/edge";
var debug = require('debug')('custom:accessory:debug')
var info = require('debug')('custom:accessory:info')
var warn = require('debug')('custom:accessory:warn')
var error = require('debug')('custom:accessory:error')

init();

let openems = new Subscriber('ws://192.168.1.105/websocket', 'user')
openems.init().then(() => {
    debug('available channels:')
    openems.getEdges().forEach(edgeId => {
        openems.getEdgeComponents(edgeId).forEach(componentId => {
            openems.getComponentChannels(edgeId, componentId).forEach(channelId => {
                debug(`${edgeId}/${componentId}/${channelId}`)
            })
        })
    })

    let edge0 = new EdgeIntegration(openems, 'FENECON Pro 9-12', 'edge0')
    edge0.publish({
        username: "43:CF:2C:27:2A:1D",
        pincode: "123-45-678",
        port: 58234,
    })
})