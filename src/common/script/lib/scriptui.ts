
import * as io from "./io";

// sequence counter
var $$seq : number = 0;

// if an event is specified, it goes here
export const EVENT_KEY = "$$event";

// an object that can become interactive, identified by ID
export interface Interactive {
    $$interact: InteractionRecord;
}

export interface InteractEvent {
    interactid : number;
    type: string;
    x?: number;
    y?: number;
    button?: boolean;
}

export type InteractCallback = (event: InteractEvent) => void;

// InteractionRecord maps a target object to an interaction ID
// the $$callback is used once per script eval, then gets nulled
// whether or not it's invoked
// event comes from $$data.$$event
export class InteractionRecord implements io.Loadable {
    readonly interacttarget: Interactive;
    interactid : number;
    lastevent : {} = null;
    constructor(
        interacttarget: Interactive,
        private $$callback: InteractCallback
    ) {
        this.interacttarget = interacttarget || (<any>this as Interactive);
        this.interactid = ++$$seq;
    }
    $$setstate(newstate: {interactid: number}) {
        this.interactid = newstate.interactid;
        this.interacttarget.$$interact = this;
        let event : InteractEvent = io.data.get(EVENT_KEY);
        if (event && event.interactid == this.interactid) {
            if (this.$$callback) {
                this.$$callback(event);
            }
            this.lastevent = event;
            io.data.set(EVENT_KEY, null);
        }
        this.$$callback = null;
    }
    $$getstate() {
        //TODO: this isn't always cleared before we serialize (e.g. if exception or move element)
        //and we do it in checkResult() too
        this.$$callback = null;
        return {interactid: this.interactid};
    }
}

export function isInteractive(obj: object): obj is Interactive {
    return !!((obj as Interactive).$$interact);
}

export function interact(object: any, callback) : InteractionRecord {
    // TODO: limit to Bitmap, etc
    if (typeof object === 'object') {
        return new InteractionRecord(object, callback);
    }
    throw new Error(`This object is not capable of interaction.`);
}

///

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
        this.index = 0;
        this.value = this.options[this.index];
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

///

export class ScriptUIButtonType extends InteractionRecord implements ScriptUIType, Interactive {
    readonly uitype = 'button';
    $$interact: InteractionRecord;
    enabled?: boolean;

    constructor(
        readonly label: string,
        callback: InteractCallback
    ) {
        super(null, callback);
        this.$$interact = this;
    }
}

export class ScriptUIButton extends ScriptUIButtonType {
}

export function button(name: string, callback: InteractCallback) {
    return new ScriptUIButton(name, callback);
}

export class ScriptUIToggle extends ScriptUIButton implements io.Loadable {
    // share with InteractionRecord
    $$getstate() {
        let state = super.$$getstate() as any;
        state.enabled = this.enabled;
        return state;
    }
    $$setstate(newstate: any) {
        this.enabled = newstate.enabled;
        super.$$setstate(newstate);
    }
}

export function toggle(name: string) {
    return new ScriptUIToggle(name, function(e) {
        this.enabled = !this.enabled;
    });
}

///

export class ScriptUIShortcut extends InteractionRecord implements ScriptUIType, Interactive {
    readonly uitype = 'shortcut';
    $$interact: InteractionRecord;

    constructor(
        readonly key: string,
        callback: InteractCallback
    ) {
        super(null, callback);
        this.$$interact = this;
    }
}

export function key(key: string, callback: InteractCallback) {
    return new ScriptUIShortcut(key, callback);
}
