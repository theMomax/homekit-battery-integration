import {Subscriber} from './subscriber'
import { EdgeIntegration } from "./edge";

var debug = require('debug')('openems:init:debug')
var info = require('debug')('openems:init:info')
var warn = require('debug')('openems:init:warn')
var error = require('debug')('openems:init:error')

const { program } = require('commander');

program
    .option('-oa, --openems-address <url>', 'address of your OpenEMS installation in your local network')
    .option('-op, --openems-password <plaintext>', 'password for your local OpenEMS frontend', 'user')
    .option('-oc, --openems-bridge-pincode <plaintext>', 'numeric pincode for the hosted openems bridges formatted as XXX-XX-XXX', '123-45-678')
    .option('-oc, --openems-bridge-port <plaintext>', 'host port for all openems bridges', '58234')


const MAC_PREFIX = "43:CF:2C:27:2A:1D"

export default async function init() {
    if (!program.openemsAddress) {
        info('openems integration not configured')
        return
    }

    info(program.openemsBridgePincode)
    info('starting openems integration')
    while (true) {
        try {
            let openems = new Subscriber('ws://' + program.openemsAddress + '/websocket', program.openemsPassword)
            await openems.init()

            debug('available channels:')
            openems.getEdges().forEach(edgeId => {
                openems.getEdgeComponents(edgeId).forEach(componentId => {
                    openems.getComponentChannels(edgeId, componentId).forEach(channelId => {
                        debug(`${edgeId}/${componentId}/${channelId}`)
                    })
                })
            })

            openems.getEdges().forEach(edgeId => {
                let edge = new EdgeIntegration(openems, edgeId, edgeId)

                edge.publish({
                    username: edgeIdToMAC(edgeId),
                    pincode: program.openemsBridgePincode,
                    port: program.openemsBridgePort,
                })
            })

            await never()
        } catch (err) {
            error(err)
            await delay(5000)
        }
    }
}

function edgeIdToMAC(edgeId: string): string {
    let edgeNr = Number(edgeId.replace('edge', ''))
    let edgeNrHex = edgeNr.toString(16).toUpperCase()
    for (let i = edgeNrHex.length-2; i > 0; i-=2) {
        edgeNrHex = edgeNrHex.slice(0, i) + ':' + edgeNrHex.slice(i)
    }
    return MAC_PREFIX.slice(0, MAC_PREFIX.length - edgeNrHex.length) + edgeNrHex
}

function delay(ms: number) {
    return new Promise( resolve => setTimeout(resolve, ms))
}

function never() {
    return new Promise( resolve => {} );
}