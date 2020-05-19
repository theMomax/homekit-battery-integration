import { Service, Characteristic } from 'hap-nodejs';
import { CurrentPower, CurrentPowerL1, CurrentPowerL2, CurrentPowerL3 } from '../characteristics/current-power';
import { ElectricityMeterType } from '../characteristics/electricity-meter-type'

/**
 * Custom Service "Electricity Meter Service"
 */
export class ElectricityMeterService extends Service {
    static UUID: string = "00000002-0000-1000-8000-0036AC324978"
    constructor(displayName: string, subtype?: string) {
        super(displayName, ElectricityMeterService.UUID, subtype)

        // Required Characteristics
        this.addCharacteristic(CurrentPower);

        // Optional Characteristics
        this.addOptionalCharacteristic(Characteristic.Name);
        this.addOptionalCharacteristic(CurrentPowerL1)
        this.addOptionalCharacteristic(CurrentPowerL2)
        this.addOptionalCharacteristic(CurrentPowerL3)

        this.addOptionalCharacteristic(ElectricityMeterType)
    }
}