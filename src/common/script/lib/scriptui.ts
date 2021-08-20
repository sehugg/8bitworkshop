
import * as io from "./io";

export interface ScriptUIType {
    uitype : string;
}

export class ScriptUISliderType implements ScriptUIType {
    readonly uitype = 'slider';
    value: number;
    constructor(
        readonly min: number,
        readonly max: number,
        readonly step: number
    ) {
    }
}

export class ScriptUISlider extends ScriptUISliderType implements io.Loadable {
    initvalue: number;
    initial(value: number) {
        this.initvalue = value;
        return this;
    }
    $$reset() {
        this.value = this.initvalue != null ? this.initvalue : this.min;
    }
    $$getstate() {
        return { value: this.value };
    }
}

export function slider(min: number, max: number, step?: number) {
    return new ScriptUISlider(min, max, step || 1);
}

///

export class ScriptUISelectType<T> implements ScriptUIType {
    readonly uitype = 'select';
    value: T;
    index: number = -1;
    constructor(
        readonly options: T[]
    ) {
    }
}

export class ScriptUISelect<T> extends ScriptUISelectType<T> implements io.Loadable {
    initindex : number;
    initial(index: number) {
        this.initindex = index;
        return this;
    }
    $$reset() {
        this.index = this.initindex >= 0 ? this.initindex : -1;
        this.value = null;
    }
    $$getstate() {
        return { value: this.value, index: this.index };
    }
}

export function select(options: any[]) {
    return new ScriptUISelect(options);
}
