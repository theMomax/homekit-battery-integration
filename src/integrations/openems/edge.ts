import { Accessory, Service, Characteristic, uuid, Bridge, Categories} from "hap-nodejs";
import { Subscriber } from "./subscriber"
import { BatteryService } from "hap-nodejs/dist/lib/gen/HomeKit";
import { AccessoryInfo } from "hap-nodejs/dist/lib/model/AccessoryInfo";
import { ControllerService } from "../../homekit/services/controller"
import { ElectricityMeterService } from "../../homekit/services/electricity-meter"
import { CurrentPower, CurrentPowerL1, CurrentPowerL2, CurrentPowerL3 } from "../../homekit/characteristics/current-power";
import { NumericBinding, Binding } from "../../util/bindings"

var debug = require('debug')('openems:edge:debug')
var info = require('debug')('openems:edge:info')
var warn = require('debug')('openems:edge:warn')
var error = require('debug')('openems:edge:error')

export class EdgeIntegration extends Bridge {

    constructor(openems: Subscriber, displayName: string, edgeId: string) {
        super(displayName, uuid.generate("homekit-battery-integration-openems-" + edgeId))
        this.category = Categories.BRIDGE

        let ai = this.getService(Service.AccessoryInformation)
        ai.setCharacteristic(Characteristic.Manufacturer, "OpenEMS")
        // TODO: add accessory information
        
        for (const componentId of openems.getEdgeComponents(edgeId)) {
            if (componentId === '_sum' || componentId.startsWith('meter') || componentId.startsWith('ess')) {
                this.addBridgedAccessory(new EMSIntegration(openems, componentId, edgeId, componentId))
            }
        }
    }
}

class EMSIntegration extends Accessory {

    constructor(openems: Subscriber, displayName: string, edgeId: string, componentId: string) {
        super(displayName, uuid.generate("homekit-battery-integration-openems-" + edgeId + '-' + componentId))

        let ai = this.getService(Service.AccessoryInformation)
        // TODO: add accessory information

        this.addService(new ControllerIntegration(openems, 'OpenEMS', edgeId, componentId))

        if (componentId === '_sum' || componentId.startsWith('ess')) {
            this.addService(new BatteryIntegration(openems, 'Battery', edgeId, componentId, componentId === '_sum' ? 'Ess' : ''))
        }

        if (componentId === '_sum') {
            this.addService(new MeterIntegration(openems, 'Ess', edgeId, componentId, 'Ess'))
            this.addService(new MeterIntegration(openems, 'Production', edgeId, componentId, 'Production'))
            this.addService(new MeterIntegration(openems, 'Consumption', edgeId, componentId, 'Consumption'))
            this.addService(new MeterIntegration(openems, 'Grid', edgeId, componentId, 'Grid'))
        }

        if (componentId.startsWith('meter')) {
            this.addService(new MeterIntegration(openems, componentId, edgeId, componentId))
        }
    }

}

class BatteryIntegration extends BatteryService {

    constructor(openems: Subscriber, displayName: string, edgeId: string, componentId: string, channelPrefix: string = '') {
        super(displayName)

        const binding = new Binding({
            essSoc: Number,
            essActivePower: Number,
        }, {
            batteryLevel: this.getCharacteristic(Characteristic.BatteryLevel),
            statusLowBattery: this.getCharacteristic(Characteristic.StatusLowBattery),
            chargingState: this.getCharacteristic(Characteristic.ChargingState),
        }, (values, characteristics) => {
            characteristics.batteryLevel.updateValue(values.essSoc)
            characteristics.statusLowBattery.updateValue(values.essSoc <= 20)
            characteristics.chargingState.updateValue(values.essSoc === 100 && values.essActivePower === 0 ? 2 : values.essActivePower < 0 ? 1 : 0)
        })

        openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'Soc'), (channelId, value) => {
            binding.updateAny('essSoc', value)
        })

        openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'ActivePower'), (channelId, value) => {
            binding.updateAny('essActivePower', value)
        })
    }
}

class ControllerIntegration extends ControllerService {
    constructor(openems: Subscriber, displayName: string, edgeId: string, componentId: string) {
        super(displayName)

        const faultBinding = new NumericBinding(1, this.getCharacteristic(Characteristic.StatusFault), (state) => state < 2 ? 0 : 1)
        openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'State'), (channelId, value) => {
            faultBinding.update(Number(value))
        })
    }
}

class MeterIntegration extends ElectricityMeterService {
    constructor(openems: Subscriber, displayName: string, edgeId: string, componentId: string, channelPrefix: string = '') {
        super(displayName)
        this.subtype = channelPrefix.toLowerCase()

        const powerBinding = new NumericBinding(0, this.getCharacteristic(CurrentPower))
        openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'ActivePower'), (channelId, value) => {
            powerBinding.update(Number(value))
        })

        if (openems.getComponentChannels(edgeId, componentId).includes(channelPrefix + 'ActivePowerL1')
        && openems.getComponentChannels(edgeId, componentId).includes(channelPrefix + 'ActivePowerL2')
        && openems.getComponentChannels(edgeId, componentId).includes(channelPrefix + 'ActivePowerL3')) {

            const powerBindingL1 = new NumericBinding(0, this.getCharacteristic(CurrentPowerL1))
            openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'ActivePowerL1'), (channelId, value) => {
                powerBindingL1.update(Number(value))
            })
            const powerBindingL2 = new NumericBinding(0, this.getCharacteristic(CurrentPowerL2))
            openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'ActivePowerL2'), (channelId, value) => {
                powerBindingL2.update(Number(value))
            })
            const powerBindingL3 = new NumericBinding(0, this.getCharacteristic(CurrentPowerL3))
            openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'ActivePowerL3'), (channelId, value) => {
                powerBindingL3.update(Number(value))
            })
        }
    }
}