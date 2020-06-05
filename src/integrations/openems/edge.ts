import { Accessory, Service, Characteristic, uuid, Bridge, Categories} from "hap-nodejs";
import { Subscriber } from "./subscriber"
import { ControllerService } from "../../homekit/services/controller"
import { EnergyStorageService } from "../../homekit/services/energy-storage"
import { ElectricityMeterService } from "../../homekit/services/electricity-meter"
import { CurrentPower, CurrentPowerL1, CurrentPowerL2, CurrentPowerL3 } from "../../homekit/characteristics/current-power";
import { NumericBinding, Binding, CombinedBinding } from "../../util/bindings"
import { EnergyCapacity } from "../../homekit/characteristics/energy-capacity";
import { ElectricityMeterType, ElectricityMeterTypes } from "../../homekit/characteristics/electricity-meter-type";

var debug = require('debug')('openems:edge:debug')
var info = require('debug')('openems:edge:info')
var warn = require('debug')('openems:edge:warn')
var error = require('debug')('openems:edge:error')

export class EdgeIntegration extends Bridge {

    constructor(openems: Subscriber, displayName: string, edgeId: string) {
        super(displayName, uuid.generate("homekit-battery-integration-openems-" + edgeId))
        this.category = Categories.BRIDGE

        let ai = this.getService(Service.AccessoryInformation)
        ai.getCharacteristic(Characteristic.Manufacturer).updateValue("OpenEMS Association")
        ai.getCharacteristic(Characteristic.Model).updateValue("OpenEMS")
        openems.get(Subscriber.CHANNELFILTER_EXACTLY(edgeId, '_meta','Version')).then(values => {
            ai.getCharacteristic(Characteristic.FirmwareRevision).updateValue(String((values.get(edgeId + '/_meta/Version'))))
        })

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

        const config = openems.getEdgeConfig(edgeId)

        let ai = this.getService(Service.AccessoryInformation)
        if (!!config.factories[config.components[componentId].factoryId]) {
            ai.getCharacteristic(Characteristic.Model).updateValue(config.factories[config.components[componentId].factoryId].name)
        }


        this.addService(new ControllerIntegration(openems, 'OpenEMS', edgeId, componentId))

        if (componentId === '_sum' || componentId.startsWith('ess')) {
            this.addService(new BatteryIntegration(openems, 'Battery', edgeId, componentId, componentId === '_sum' ? 'Ess' : ''))
        }

        if (componentId === '_sum') {
            this.addService(new MeterIntegration(openems, 'Ess', edgeId, componentId, 'Ess'))
            this.addService(new MeterIntegration(openems, 'Production', edgeId, componentId, 'Production'))
            this.addService(new MeterIntegration(openems, 'Consumption', edgeId, componentId, 'Consumption'))
            this.addService(new MeterIntegration(openems, 'Grid', edgeId, componentId, 'Grid'))
            this.addService(new CombinedMeterIntegration(openems, 'Excess', edgeId, componentId, 'Excess'))
        }

        if (componentId.startsWith('meter') || componentId.startsWith('ess')) {
            this.addService(new MeterIntegration(openems, componentId, edgeId, componentId))
        }
    }

}

class BatteryIntegration extends EnergyStorageService {

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

        openems.get(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'Capacity')).then(values => {
            this.getCharacteristic(EnergyCapacity).updateValue(Number((values.get(edgeId + '/' + componentId + '/' + channelPrefix + 'Capacity'))) / 1000.0)
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

class CombinedMeterIntegration extends ElectricityMeterService {
    constructor(openems: Subscriber, displayName: string, edgeId: string, componentId: string, type: string) {
        super(displayName)
        this.subtype = type.toLowerCase()

        if (componentId === '_sum' && type == 'Excess') {
            this.getCharacteristic(ElectricityMeterType).updateValue(ElectricityMeterTypes.EXCESS)

            const powerBinding = new CombinedBinding(0, 0, this.getCharacteristic(CurrentPower), (grid, ess) => -1 * (grid + ess))
            openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'GridActivePower'), (channelId, value) => {
                powerBinding.updateFirst(Number(value))
            })
            openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'EssActivePower'), (channelId, value) => {
                powerBinding.updateSecond(Number(value))
            })

            if (openems.getComponentChannels(edgeId, componentId).includes('GridActivePowerL1')
            && openems.getComponentChannels(edgeId, componentId).includes('GridActivePowerL2')
            && openems.getComponentChannels(edgeId, componentId).includes('GridActivePowerL3')
            && openems.getComponentChannels(edgeId, componentId).includes('EssActivePowerL1')
            && openems.getComponentChannels(edgeId, componentId).includes('EssActivePowerL2')
            && openems.getComponentChannels(edgeId, componentId).includes('EssActivePowerL3')) {
                const powerBindingL1 = new CombinedBinding(0, 0, this.getCharacteristic(CurrentPowerL1), (grid, ess) => -1 * (grid + ess))
                openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'GridActivePowerL1'), (channelId, value) => {
                    powerBindingL1.updateFirst(Number(value))
                })
                openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'EssActivePowerL1'), (channelId, value) => {
                    powerBindingL1.updateSecond(Number(value))
                })
                const powerBindingL2 = new CombinedBinding(0, 0, this.getCharacteristic(CurrentPowerL2), (grid, ess) => -1 * (grid + ess))
                openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'GridActivePowerL2'), (channelId, value) => {
                    powerBindingL2.updateFirst(Number(value))
                })
                openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'EssActivePowerL2'), (channelId, value) => {
                    powerBindingL2.updateSecond(Number(value))
                })
                const powerBindingL3 = new CombinedBinding(0, 0, this.getCharacteristic(CurrentPowerL3), (grid, ess) => -1 * (grid + ess))
                openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'GridActivePowerL3'), (channelId, value) => {
                    powerBindingL3.updateFirst(Number(value))
                })
                openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, 'EssActivePowerL3'), (channelId, value) => {
                    powerBindingL3.updateSecond(Number(value))
                })
            }
        }
    }
}

class MeterIntegration extends ElectricityMeterService {
    constructor(openems: Subscriber, displayName: string, edgeId: string, componentId: string, channelPrefix: string = '') {
        super(displayName)
        this.subtype = channelPrefix.toLowerCase()

        if (componentId === '_sum') {
            switch (channelPrefix) {
            case 'Ess':
                this.getCharacteristic(ElectricityMeterType).updateValue(ElectricityMeterTypes.STORAGE)
                break
            case 'Production':
                this.getCharacteristic(ElectricityMeterType).updateValue(ElectricityMeterTypes.PRODUCTION)
                break
            case 'Consumption':
                this.getCharacteristic(ElectricityMeterType).updateValue(ElectricityMeterTypes.CONSUMPTION)
                break
            case 'Grid':
                this.getCharacteristic(ElectricityMeterType).updateValue(ElectricityMeterTypes.GRID)
                break
            default:
                this.getCharacteristic(ElectricityMeterType).updateValue(ElectricityMeterTypes.OTHER)
                break
            }
        } else {
            const config = openems.getEdgeConfig(edgeId)

            switch (config.components[componentId].properties['type']) {
            case 'GRID':
                this.getCharacteristic(ElectricityMeterType).updateValue(ElectricityMeterTypes.GRID)
                break
            case 'PRODUCTION':
                this.getCharacteristic(ElectricityMeterType).updateValue(ElectricityMeterTypes.PRODUCTION)
                break
            default:
                this.getCharacteristic(ElectricityMeterType).updateValue(ElectricityMeterTypes.OTHER)
                break
            }
        }

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
        } else if (openems.getComponentChannels(edgeId, componentId).includes(channelPrefix + 'AcActivePowerL1')
        && openems.getComponentChannels(edgeId, componentId).includes(channelPrefix + 'AcActivePowerL2')
        && openems.getComponentChannels(edgeId, componentId).includes(channelPrefix + 'AcActivePowerL3')) {

            const powerBindingL1 = new NumericBinding(0, this.getCharacteristic(CurrentPowerL1))
            openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'AcActivePowerL1'), (channelId, value) => {
                powerBindingL1.update(Number(value))
            })
            const powerBindingL2 = new NumericBinding(0, this.getCharacteristic(CurrentPowerL2))
            openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'AcActivePowerL2'), (channelId, value) => {
                powerBindingL2.update(Number(value))
            })
            const powerBindingL3 = new NumericBinding(0, this.getCharacteristic(CurrentPowerL3))
            openems.subscribe(Subscriber.CHANNELFILTER_EXACTLY(edgeId, componentId, channelPrefix + 'AcActivePowerL3'), (channelId, value) => {
                powerBindingL3.update(Number(value))
            })
        }
    }
}