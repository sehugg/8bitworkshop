
import * as io from "./io";

export class ScriptUISliderType {
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
    reset() {
        this.value = this.initvalue != null ? this.initvalue : this.min;
    }
    $$getstate() {
        return { value: this.value };
    }
}

export function slider(min: number, max: number, step?: number) {
    return new ScriptUISlider(min, max, step || 1);
}
