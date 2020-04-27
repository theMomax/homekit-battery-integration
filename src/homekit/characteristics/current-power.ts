import { Characteristic, Formats, Perms } from 'hap-nodejs';
import { Units } from '../units/si'

/**
 * Generic custom Power Characteristic
 */

class Power extends Characteristic {

    constructor(displayName: string, uuid: string) {
        super(displayName, uuid);
        this.setProps({
        format: Formats.FLOAT,
        // @ts-ignore
        unit: Units.WATT,
        perms: [Perms.READ, Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    }
}

/**
 * Custom Characteristic "Current Power"
 */

export class CurrentPower extends Power {

    static readonly UUID: string = '00000001-0001-1000-8000-0036AC324978';

    constructor() {
        super('Current Power', CurrentPower.UUID);
    }
}

/**
 * Custom Characteristic "Current Power L1"
 */

export class CurrentPowerL1 extends Power {

    static readonly UUID: string = '00000002-0001-1000-8000-0036AC324978';

    constructor() {
        super('Current Power L1', CurrentPowerL1.UUID);
    }
}

/**
 * Custom Characteristic "Current Power L2"
 */

export class CurrentPowerL2 extends Power {

    static readonly UUID: string = '00000003-0001-1000-8000-0036AC324978';

    constructor() {
        super('Current Power L2', CurrentPowerL2.UUID);
    }
}

/**
 * Custom Characteristic "Current Power L3"
 */

export class CurrentPowerL3 extends Power {

    static readonly UUID: string = '00000004-0001-1000-8000-0036AC324978';

    constructor() {
        super('Current Power L3', CurrentPowerL3.UUID);
    }
}