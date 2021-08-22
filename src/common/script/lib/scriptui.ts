
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
        this.value = min;
    }
}

export class ScriptUISlider extends ScriptUISliderType implements io.Loadable {
    initvalue: number;
    initial(value: number) {
        this.value = value;
        return this;
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
    index: number;
    constructor(
        readonly options: T[]
    ) {
        this.value = null;
        this.index = -1;
    }
}

export class ScriptUISelect<T> extends ScriptUISelectType<T> implements io.Loadable {
    initial(index: number) {
        this.index = index;
        this.value = this.options[index];
        return this;
    }
    $$getstate() {
        return { value: this.value, index: this.index };
    }
}

export function select(options: any[]) {
    return new ScriptUISelect(options);
}
