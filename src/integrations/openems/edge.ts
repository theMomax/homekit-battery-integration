import {init, Accessory, Service, Characteristic, CharacteristicEventTypes, uuid, CharacteristicGetCallback, CharacteristicSetCallback, CharacteristicValue, Bridge, Categories} from "hap-nodejs";
import { Subscriber } from "./subscriber"
import { BatteryService } from "hap-nodejs/dist/lib/gen/HomeKit";

var debug = require('debug')('openems:edge:debug')
var info = require('debug')('openems:edge:info')
var warn = require('debug')('openems:edge:warn')
var error = require('debug')('openems:edge:error')

// const { program } = require('commander');

export class EdgeIntegration extends Bridge {

    constructor(displayName: string, serialNumber: string, edgeId: string, openems: Subscriber) {
        super(displayName, serialNumber)
        this.addBridgedAccessory(new EMSIntegration('Sum', edgeId, '_sum', openems))
    }
}

class EMSIntegration extends Accessory {

    constructor(displayName: string, edgeId: string, componentId: string, openems: Subscriber) {
        super(displayName, uuid.generate("homekit-battery-integration-openems-" + edgeId + '-' + componentId))

        this.addService(new BatteryIntegration('Battery', edgeId, componentId, openems))
    }

}

class BatteryIntegration extends BatteryService {

    constructor(displayName: string, edgeId: string, componentId: string, openems: Subscriber) {
        super(displayName)
        openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'EssSoc'), (channelId, value) => {
            this.essSoc = Number(value)
            this.update()
        })

        openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'EssActivePower'), (channelId, value) => {
            this.essActivePower = Number(value)
            this.update()
        })
    }

    private essSoc: number = 0
    private essActivePower: number = 0

    private update() {
        debug('update values: essSoc=' + this.essSoc + '; essActivePower=' + this.essActivePower)
        this.getCharacteristic(Characteristic.BatteryLevel).updateValue(this.essSoc)
        this.getCharacteristic(Characteristic.StatusLowBattery).updateValue(this.essSoc <= 20)
        this.getCharacteristic(Characteristic.ChargingState).updateValue(this.essSoc === 100 && this.essActivePower === 0 ? 2 : this.essActivePower < 0 ? 1 : 0)
    }

}