import { Characteristic, Formats, Perms } from 'hap-nodejs';

export enum ElectricityMeterTypes {
    OTHER = 0,
    PRODUCTION = 1,
    CONSUMPTION = 2,
    STORAGE = 3,
    GRID = 4,
}

/**
 * Custom Characteristic "Electricity Meter Type"
 * 
 * This characteristic helps the frontend to provide a more suitable
 * visualization for the meter. Implementations should conform to the following
 * rules:
 *  1. A meter without this type characteristic is assumed to be of type OTHER
 *  2. The meaning of a positive/negative CurrentPower depends on the type:
 *      - PRODUCTION, CONSUMPTION, OTHER: a positive value has a good
 *        connotation for the user
 *      - STORAGE, GRID: a negative value has a bad connotation for the user
 *     E.g.: A negative current power at the mains connection means the user is
 *     currently selling energy and thus earning money, which is considered 
 *     positive.
 */

export class ElectricityMeterType extends Characteristic {

    static readonly UUID: string = '00000006-0001-1000-8000-0036AC324978';

    constructor() {
        super('Type', ElectricityMeterType.UUID);
        this.setProps({
        format: Formats.UINT8,
        minValue: 0,
        maxValue: 4,
        perms: [Perms.READ]
        });
    }
}
