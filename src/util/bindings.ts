import { Characteristic } from "hap-nodejs";

export class Binding {

    constructor(private values: any, private characteristics: any, private mapAny: (values: any, characteristics: any) => void) {

    }

    public updateAny(name: string, value: any) {
        if (this.values[name] === value) {
            return
        }
        this.values[name] = value
        this.mapAny(this.values, this.characteristics)
    }
}

export class CombinedBinding extends Binding {

    constructor(value1: number, value2: number, characteristic: Characteristic, private mapper: (value1: number, value2: number) => number = (x,y) => x+y) {
        super({v1: value1, v2: value2 }, {c: characteristic }, (values: any, characteristics: any) => {
            characteristics.c.updateValue(mapper(values.v1, values.v2))
        })
    }

    public updateFirst(value: number) {
        this.updateAny('v1', value)
    }

    public updateSecond(value: number) {
        this.updateAny('v2', value)
    }
}

export class GenericBinding<T> extends Binding {

    constructor(value: T, characteristic: Characteristic, private mapper: (value: T) => T = v => v) {
        super({v: value}, {c: characteristic}, (values: any, characteristics: any) => {
            characteristics.c.updateValue(values.v)
        })
    }

    public update(value: T) {
        this.updateAny('v', this.mapper(value))
    }

}

export class StringBinding extends GenericBinding<String> {}

export class NumericBinding extends GenericBinding<Number> {}