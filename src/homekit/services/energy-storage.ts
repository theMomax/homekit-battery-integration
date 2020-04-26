import { Service, Characteristic } from 'hap-nodejs';
import { EnergyCapacity } from '../characteristics/energy-capacity';

/**
 * Custom Service "Energy Storage Service"
 */
export class EnergyStorageService extends Service {
    static UUID: string = "00000003-0000-1000-8000-0036AC324978"

    constructor(displayName: string, subtype?: string) {
        super(displayName, EnergyStorageService.UUID, subtype)

        // Required Characteristics
        this.addCharacteristic(Characteristic.BatteryLevel);
        this.addCharacteristic(Characteristic.ChargingState);
        this.addCharacteristic(Characteristic.StatusLowBattery);

        // Optional Characteristics
        this.addOptionalCharacteristic(Characteristic.Name);
        this.addOptionalCharacteristic(EnergyCapacity)
    }
}