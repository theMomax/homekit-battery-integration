import { Service, Characteristic } from 'hap-nodejs';

/**
 * Custom Service "Controller Service"
 */
export class ControllerService extends Service {
    static UUID: string = "00000001-0000-1000-8000-0036AC324978"
    constructor(displayName: string, subtype?: string) {
        super(displayName, ControllerService.UUID, subtype)

        // Required Characteristics
        this.addCharacteristic(Characteristic.StatusFault);

        // Optional Characteristics
        this.addOptionalCharacteristic(Characteristic.Name);
    }
}