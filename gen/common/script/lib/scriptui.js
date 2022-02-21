"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.key = exports.ScriptUIShortcut = exports.toggle = exports.ScriptUIToggle = exports.button = exports.ScriptUIButton = exports.ScriptUIButtonType = exports.select = exports.ScriptUISelect = exports.ScriptUISelectType = exports.slider = exports.ScriptUISlider = exports.ScriptUISliderType = exports.interact = exports.isInteractive = exports.InteractionRecord = exports.EVENT_KEY = void 0;
const io = __importStar(require("./io"));
// sequence counter
var $$seq = 0;
// if an event is specified, it goes here
exports.EVENT_KEY = "$$event";
// InteractionRecord maps a target object to an interaction ID
// the $$callback is used once per script eval, then gets nulled
// whether or not it's invoked
// event comes from $$data.$$event
class InteractionRecord {
    constructor(interacttarget, $$callback) {
        this.$$callback = $$callback;
        this.lastevent = null;
        this.interacttarget = interacttarget || this;
        this.interactid = ++$$seq;
    }
    $$setstate(newstate) {
        this.interactid = newstate.interactid;
        this.interacttarget.$$interact = this;
        let event = io.data.get(exports.EVENT_KEY);
        if (event && event.interactid == this.interactid) {
            if (this.$$callback) {
                this.$$callback(event);
            }
            this.lastevent = event;
            io.data.set(exports.EVENT_KEY, null);
        }
        this.$$callback = null;
    }
    $$getstate() {
        //TODO: this isn't always cleared before we serialize (e.g. if exception or move element)
        //and we do it in checkResult() too
        this.$$callback = null;
        return { interactid: this.interactid };
    }
}
exports.InteractionRecord = InteractionRecord;
function isInteractive(obj) {
    return !!(obj.$$interact);
}
exports.isInteractive = isInteractive;
function interact(object, callback) {
    // TODO: limit to Bitmap, etc
    if (typeof object === 'object') {
        return new InteractionRecord(object, callback);
    }
    throw new Error(`This object is not capable of interaction.`);
}
exports.interact = interact;
class ScriptUISliderType {
    constructor(min, max, step) {
        this.min = min;
        this.max = max;
        this.step = step;
        this.uitype = 'slider';
        this.value = min;
    }
}
exports.ScriptUISliderType = ScriptUISliderType;
class ScriptUISlider extends ScriptUISliderType {
    initial(value) {
        this.value = value;
        return this;
    }
    $$getstate() {
        return { value: this.value };
    }
}
exports.ScriptUISlider = ScriptUISlider;
function slider(min, max, step) {
    return new ScriptUISlider(min, max, step || 1);
}
exports.slider = slider;
///
class ScriptUISelectType {
    constructor(options) {
        this.options = options;
        this.uitype = 'select';
        this.index = 0;
        this.value = this.options[this.index];
    }
}
exports.ScriptUISelectType = ScriptUISelectType;
class ScriptUISelect extends ScriptUISelectType {
    initial(index) {
        this.index = index;
        this.value = this.options[index];
        return this;
    }
    $$getstate() {
        return { value: this.value, index: this.index };
    }
}
exports.ScriptUISelect = ScriptUISelect;
function select(options) {
    return new ScriptUISelect(options);
}
exports.select = select;
///
class ScriptUIButtonType extends InteractionRecord {
    constructor(label, callback) {
        super(null, callback);
        this.label = label;
        this.uitype = 'button';
        this.$$interact = this;
    }
}
exports.ScriptUIButtonType = ScriptUIButtonType;
class ScriptUIButton extends ScriptUIButtonType {
}
exports.ScriptUIButton = ScriptUIButton;
function button(name, callback) {
    return new ScriptUIButton(name, callback);
}
exports.button = button;
class ScriptUIToggle extends ScriptUIButton {
    // share with InteractionRecord
    $$getstate() {
        let state = super.$$getstate();
        state.enabled = this.enabled;
        return state;
    }
    $$setstate(newstate) {
        this.enabled = newstate.enabled;
        super.$$setstate(newstate);
    }
}
exports.ScriptUIToggle = ScriptUIToggle;
function toggle(name) {
    return new ScriptUIToggle(name, function (e) {
        this.enabled = !this.enabled;
    });
}
exports.toggle = toggle;
///
class ScriptUIShortcut extends InteractionRecord {
    constructor(key, callback) {
        super(null, callback);
        this.key = key;
        this.uitype = 'shortcut';
        this.$$interact = this;
    }
}
exports.ScriptUIShortcut = ScriptUIShortcut;
function key(key, callback) {
    return new ScriptUIShortcut(key, callback);
}
exports.key = key;
//# sourceMappingURL=scriptui.js.map