import {init, Accessory, Service, Characteristic, CharacteristicEventTypes, uuid, CharacteristicGetCallback, CharacteristicSetCallback, CharacteristicValue, Bridge, Categories} from "hap-nodejs";
import { Subscriber } from "./subscriber"
import { BatteryService, Door } from "hap-nodejs/dist/lib/gen/HomeKit";
import { AccessoryInfo } from "hap-nodejs/dist/lib/model/AccessoryInfo";
import { ControllerService } from "../../homekit/services/controller"
import { ElectricityMeterService } from "../../homekit/services/electricity-meter"
import { CurrentPower } from "../../homekit/characteristics/current-power";

var debug = require('debug')('openems:edge:debug')
var info = require('debug')('openems:edge:info')
var warn = require('debug')('openems:edge:warn')
var error = require('debug')('openems:edge:error')

// const { program } = require('commander');

export class EdgeIntegration extends Bridge {

    constructor(openems: Subscriber, displayName: string, edgeId: string) {
        super(displayName, uuid.generate("homekit-battery-integration-openems-" + edgeId))
        this.addBridgedAccessory(new EMSIntegration(openems, 'Sum', edgeId, '_sum'))
        this.category = Categories.BRIDGE
    }
}

class EMSIntegration extends Accessory {

    constructor(openems: Subscriber, displayName: string, edgeId: string, componentId: string) {
        super(displayName, uuid.generate("homekit-battery-integration-openems-" + edgeId + '-' + componentId))

        let ai = this.getService(Service.AccessoryInformation)

        ai.setCharacteristic(Characteristic.Manufacturer, "OpenEMS")

        this.addService(new BatteryIntegration(openems, 'Battery', edgeId, componentId))
        this.addService(new ControllerIntegration(openems, 'OpenEMS', edgeId, componentId))
        this.addService(new MeterIntegration(openems, 'Ess', edgeId, componentId, 'Ess'))
        this.addService(new MeterIntegration(openems, 'Production', edgeId, componentId, 'Production'))
        this.addService(new MeterIntegration(openems, 'Consumption', edgeId, componentId, 'Consumption'))
        this.addService(new MeterIntegration(openems, 'Grid', edgeId, componentId, 'Grid'))
    }

}

class BatteryIntegration extends BatteryService {

    constructor(openems: Subscriber, displayName: string, edgeId: string, componentId: string) {
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
        debug(`update values: essSoc=${this.essSoc}; essActivePower=${this.essActivePower}`)
        this.getCharacteristic(Characteristic.BatteryLevel).updateValue(this.essSoc)
        this.getCharacteristic(Characteristic.StatusLowBattery).updateValue(this.essSoc <= 20)
        this.getCharacteristic(Characteristic.ChargingState).updateValue(this.essSoc === 100 && this.essActivePower === 0 ? 2 : this.essActivePower < 0 ? 1 : 0)
    }
}

class ControllerIntegration extends ControllerService {
    constructor(openems: Subscriber, displayName: string, edgeId: string, componentId: string) {
        super(displayName)

        openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'State'), (channelId, value) => {
            this.state = Number(value)
            this.update()
        })
    }

    private state = 1

    private update() {
        debug(`update values: state=${this.state}`)
        this.getCharacteristic(Characteristic.StatusFault).updateValue(this.state <= 1 ? 0 : 1)
    }
}

class MeterIntegration extends ElectricityMeterService {
    constructor(openems: Subscriber, displayName: string, edgeId: string, componentId: string, channelPrefix: string = '') {
        super(displayName)
        this.subtype = channelPrefix.toLowerCase()

        openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'ActivePower'), (channelId, value) => {
            this.activePower = Number(value)
            this.update()
        })
    }

    private activePower = 0

    private update() {
        debug(`update values: activePower=${this.activePower}`)
        this.getCharacteristic(CurrentPower).updateValue(this.activePower)
    }
}