import { Characteristic, Formats, Perms } from 'hap-nodejs';
import { Units } from '../units/si'


/**
 * Custom Characteristic "Energy Capacity"
 */

export class EnergyCapacity extends Characteristic {

    static readonly UUID: string = '00000005-0001-1000-8000-0036AC324978';

    constructor() {
        super('Capacity', EnergyCapacity.UUID);
        this.setProps({
        format: Formats.FLOAT,
        // @ts-ignore
        unit: Units.KWH,
        perms: [Perms.READ, Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    }
}
