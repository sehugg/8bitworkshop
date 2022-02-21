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
exports.Notebook = void 0;
const preact_1 = require("preact");
const env_1 = require("../env");
const util_1 = require("../../util");
const emu_1 = require("../../emu");
const ui_1 = require("../../../ide/ui");
const color = __importStar(require("../lib/color"));
const scriptui = __importStar(require("../lib/scriptui"));
const MAX_STRING_LEN = 100;
const DEFAULT_ASPECT = 1;
function sendInteraction(iobj, type, event, xtraprops) {
    let irec = iobj.$$interact;
    let ievent = Object.assign({ interactid: irec.interactid, type }, xtraprops);
    if (event instanceof PointerEvent) {
        const canvas = event.target;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        ievent.x = Math.floor(x);
        ievent.y = Math.floor(y);
        // TODO: pressure, etc.
    }
    else {
        console.log("Unknown event type", event);
    }
    // TODO: add events to queue?
    ui_1.current_project.updateDataItems([{
            key: scriptui.EVENT_KEY,
            value: ievent
        }]);
}
class ColorComponent extends preact_1.Component {
    render(virtualDom, containerNode, replaceNode) {
        let rgb = this.props.rgbavalue & 0xffffff;
        let bgr = (0, util_1.rgb2bgr)(rgb);
        var htmlcolor = `#${(0, util_1.hex)(bgr, 6)}`;
        var textcolor = (rgb & 0x008000) ? '#222' : '#ddd';
        var printcolor = (0, util_1.hex)(rgb & 0xffffff, 6); // TODO: show index instead?
        return (0, preact_1.h)('div', {
            class: 'scripting-item scripting-color',
            style: `background-color: ${htmlcolor}; color: ${textcolor}`,
            alt: htmlcolor, // TODO
        }, [
        //h('span', { }, printcolor )
        ]);
    }
}
class BitmapComponent extends preact_1.Component {
    constructor(props) {
        super(props);
        this.ref = (0, preact_1.createRef)(); // TODO: can we use the ref?
        this.pressed = false;
    }
    render(virtualDom, containerNode, replaceNode) {
        let props = {
            class: 'scripting-item',
            ref: this.ref,
            width: this.props.width,
            height: this.props.height,
            style: this.props.bitmap.style
        };
        let obj = this.props.bitmap;
        if (scriptui.isInteractive(obj)) {
            return (0, preact_1.h)('canvas', Object.assign({ onPointerMove: (e) => {
                    sendInteraction(obj, 'move', e, { pressed: this.pressed });
                }, onPointerDown: (e) => {
                    this.pressed = true;
                    this.canvas.setPointerCapture(e.pointerId);
                    sendInteraction(obj, 'down', e, { pressed: true });
                }, onPointerUp: (e) => {
                    this.pressed = false;
                    sendInteraction(obj, 'up', e, { pressed: false });
                }, onPointerOut: (e) => {
                    this.pressed = false;
                    sendInteraction(obj, 'out', e, { pressed: false });
                } }, props));
        }
        else {
            return (0, preact_1.h)('canvas', props);
        }
    }
    componentDidMount() {
        this.refresh();
    }
    componentWillUnmount() {
        this.canvas = null;
        this.imageData = null;
        this.datau32 = null;
    }
    componentDidUpdate(prevProps, prevState, snapshot) {
        this.refresh();
    }
    prepare() {
        this.canvas = this.base;
        this.ctx = this.canvas.getContext('2d');
        this.imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        this.datau32 = new Uint32Array(this.imageData.data.buffer);
    }
    refresh() {
        // preact can reuse this component but it can change shape :^P
        if (this.canvas !== this.base
            || this.imageData.width != this.props.width
            || this.imageData.height != this.props.height) {
            this.prepare();
        }
        this.updateCanvas(this.datau32, this.props.bitmap);
        this.ctx.putImageData(this.imageData, 0, 0);
    }
    updateCanvas(vdata, bmp) {
        if (bmp['palette']) {
            this.updateCanvasIndexed(vdata, bmp);
        }
        if (bmp['rgba']) {
            this.updateCanvasRGBA(vdata, bmp);
        }
    }
    updateCanvasRGBA(vdata, bmp) {
        vdata.set(bmp.rgba);
    }
    updateCanvasIndexed(vdata, bmp) {
        let pal = bmp.palette.colors;
        for (var i = 0; i < bmp.pixels.length; i++) {
            vdata[i] = pal[bmp.pixels[i]];
        }
    }
}
class ObjectKeyValueComponent extends preact_1.Component {
    render(virtualDom, containerNode, replaceNode) {
        let expandable = typeof this.props.object === 'object';
        let hdrclass = '';
        if (expandable)
            hdrclass = this.state.expanded ? 'tree-expanded' : 'tree-collapsed';
        let propName = this.props.name || null;
        return (0, preact_1.h)('div', {
            class: 'tree-content',
            key: `${this.props.objpath}__tree`
        }, [
            (0, preact_1.h)('div', {
                class: 'tree-header ' + hdrclass,
                onClick: expandable ? () => this.toggleExpand() : null
            }, [
                propName != null ? (0, preact_1.h)('span', { class: 'tree-key' }, [propName, expandable]) : null,
                (0, preact_1.h)('span', { class: 'tree-value scripting-item' }, [
                    getShortName(this.props.object)
                ])
            ]),
            this.state.expanded ? objectToContentsDiv(this.props.object, this.props.objpath) : null
        ]);
    }
    toggleExpand() {
        this.setState({ expanded: !this.state.expanded });
    }
}
function getShortName(object) {
    if (typeof object === 'object') {
        try {
            var s = object[env_1.PROP_CONSTRUCTOR_NAME] || Object.getPrototypeOf(object).constructor.name;
            if (object.length > 0) {
                s += `[${object.length}]`;
            }
            return s;
        }
        catch (e) {
            console.log(e);
            return e + "";
        }
    }
    else {
        return primitiveToString(object);
    }
}
function primitiveToString(obj) {
    var text = "";
    // is it a function? call it first, if we are expanded
    // TODO: only call functions w/ signature
    if (obj && obj.$$ && typeof obj.$$ == 'function' && this._content != null) {
        obj = obj.$$();
    }
    // check null first
    if (obj == null) {
        text = obj + "";
        // primitive types
    }
    else if (typeof obj == 'number') {
        if (obj != (obj | 0))
            text = obj.toString(); // must be a float
        else
            text = obj + "\t($" + (0, util_1.hex)(obj) + ")";
    }
    else if (typeof obj == 'string') {
        text = obj;
    }
    else {
        text = JSON.stringify(obj);
    }
    if (text.length > MAX_STRING_LEN)
        text = text.substring(0, MAX_STRING_LEN) + "...";
    return text;
}
function isIndexedBitmap(object) {
    return object['bpp'] && object['pixels'] && object['palette'];
}
function isRGBABitmap(object) {
    return object['rgba'] instanceof Uint32Array;
}
function objectToChildren(object) {
    if (color.isPalette(object)) {
        return new color.Palette(object.colors).chromas();
    }
    else if ((0, util_1.isArray)(object)) {
        return Array.from(object);
    }
    else if (object != null) {
        return [object];
    }
    else {
        return [];
    }
}
function objectToChild(object, index) {
    if (color.isPalette(object)) {
        return color.from(object.colors[index]);
    }
    else if ((0, util_1.isArray)(object)) {
        return object[index];
    }
    else if (object != null) {
        return object;
    }
    else {
        return null;
    }
}
function objectToDiv(object, name, objpath) {
    // don't view any keys that start with "$"
    if (name && name.startsWith("$")) {
        // don't view any values that start with "$$"
        if (name.startsWith("$$"))
            return;
        // don't print if null or undefined
        if (object == null)
            return;
        // don't print key in any case
        name = null;
    }
    // TODO: limit # of items
    // TODO: detect table
    if (object == null) {
        return (0, preact_1.h)('span', {}, object + "");
    }
    else if (object['uitype']) {
        let cons = UI_COMPONENTS[object['uitype']];
        if (!cons)
            throw new Error(`Unknown UI component type: ${object['uitype']}`);
        return (0, preact_1.h)(cons, { iokey: objpath, uiobject: object });
    }
    else if (object['literaltext']) {
        return (0, preact_1.h)("pre", {}, [object['literaltext']]);
    }
    else if (isIndexedBitmap(object) || isRGBABitmap(object)) {
        return (0, preact_1.h)(BitmapComponent, { bitmap: object, width: object.width, height: object.height });
    }
    else if (color.isChroma(object)) {
        return (0, preact_1.h)(ColorComponent, { rgbavalue: color.rgb(object) });
    }
    else if (color.isPalette(object)) {
        // TODO?
        if (object.colors.length <= 256) {
            let children = [];
            let props = { class: '', key: `${objpath}__obj` };
            props.class += ' scripting-flex ';
            object.colors.forEach((val) => {
                children.push((0, preact_1.h)(ColorComponent, { rgbavalue: val }));
            });
            return (0, preact_1.h)('div', props, children);
        }
        else {
            let { a, b } = (0, util_1.findIntegerFactors)(object.colors.length, 1, 1, DEFAULT_ASPECT);
            return objectToDiv({ rgba: object.colors, width: a, height: b }, name, objpath);
        }
    }
    else {
        return (0, preact_1.h)(ObjectKeyValueComponent, { name, object, objpath }, []);
    }
}
function fixedArrayToDiv(tyarr, bpel, objpath) {
    const maxBytes = 0x100;
    if (tyarr.length <= maxBytes) {
        // TODO
        let dumptext = (0, emu_1.dumpRAM)(tyarr, 0, tyarr.length);
        return (0, preact_1.h)('pre', {}, dumptext);
    }
    else {
        let children = [];
        for (var ofs = 0; ofs < tyarr.length; ofs += maxBytes) {
            children.push(objectToDiv(tyarr.slice(ofs, ofs + maxBytes), '$' + (0, util_1.hex)(ofs), `${objpath}.${ofs}`));
        }
        return (0, preact_1.h)('div', {}, children);
    }
}
function objectToContentsDiv(object, objpath) {
    // is typed array?
    let bpel = object['BYTES_PER_ELEMENT'];
    if (typeof bpel === 'number') {
        return fixedArrayToDiv(object, bpel, objpath);
    }
    let objectEntries = Object.entries(object);
    let objectDivs = objectEntries.map(entry => objectToDiv(entry[1], entry[0], `${objpath}.${entry[1]}`));
    return (0, preact_1.h)('div', { class: 'scripting-flex' }, objectDivs);
}
class UISliderComponent extends preact_1.Component {
    render(virtualDom, containerNode, replaceNode) {
        let slider = this.props.uiobject;
        return (0, preact_1.h)('div', {}, [
            this.props.iokey,
            (0, preact_1.h)('input', {
                type: 'range',
                min: slider.min / slider.step,
                max: slider.max / slider.step,
                value: slider.value / slider.step,
                onInput: (ev) => {
                    let newUIValue = { value: parseFloat(ev.target.value) * slider.step };
                    this.setState(this.state);
                    ui_1.current_project.updateDataItems([{ key: this.props.iokey, value: newUIValue }]);
                }
            }),
            (0, preact_1.h)('span', {}, getShortName(slider.value)),
        ]);
    }
}
class UISelectComponent extends preact_1.Component {
    constructor() {
        super(...arguments);
        this.ref = (0, preact_1.createRef)();
    }
    render(virtualDom, containerNode, replaceNode) {
        let select = this.props.uiobject;
        let children = objectToChildren(select.options);
        this.props.dropdown = children.length > 16;
        let showselections = !this.props.dropdown || this.state.expanded;
        let seldiv = null;
        if (showselections) {
            seldiv = (0, preact_1.h)('div', {
                class: 'scripting-select scripting-flex',
                ref: this.ref,
                onClick: (e) => {
                    // select object -- iterate parents until we find select div, then find index of child
                    let target = e.target;
                    while (target.parentElement && target.parentElement != this.ref.current) {
                        target = target.parentElement;
                    }
                    if (target.parentElement) {
                        const selindex = Array.from(target.parentElement.children).indexOf(target);
                        if (selindex >= 0 && selindex < children.length) {
                            let newUIValue = { value: children[selindex], index: selindex };
                            this.setState({ expanded: false });
                            ui_1.current_project.updateDataItems([{ key: this.props.iokey, value: newUIValue }]);
                        }
                        else {
                            throw new Error(`Could not find click target of ${this.props.iokey}`);
                        }
                    }
                }
            }, children.map((child, index) => {
                let div = objectToDiv(child, null, `${this.props.iokey}__select_${index}`);
                let selected = (index == select.index);
                return (0, preact_1.h)('div', { class: selected ? 'scripting-selected' : '' }, [div]);
            }));
        }
        if (this.props.dropdown) {
            let selectedDiv = objectToDiv(objectToChild(select.options, select.index), null, `${this.props.iokey}__selected`);
            return (0, preact_1.h)('div', {
                class: 'tree-content',
                key: `${this.props.iokey}__tree`
            }, [
                (0, preact_1.h)('div', {
                    class: 'tree-header ' + (this.state.expanded ? 'tree-expanded' : 'tree-collapsed'),
                    onClick: () => this.toggleExpand()
                }, [
                    this.props.iokey,
                    (0, preact_1.h)('span', { class: 'tree-value scripting-item' }, [
                        selectedDiv,
                        //getShortName(select.options)
                    ])
                ]),
                seldiv
            ]);
        }
        else {
            return seldiv;
        }
    }
    toggleExpand() {
        this.setState({ expanded: !this.state.expanded });
    }
}
class UIButtonComponent extends preact_1.Component {
    render(virtualDom, containerNode, replaceNode) {
        let button = this.props.uiobject;
        return (0, preact_1.h)('button', {
            class: button.enabled ? 'scripting-button scripting-enabled' : 'scripting-button',
            onClick: (e) => {
                sendInteraction(button, 'click', e, {});
            },
        }, [
            button.label
        ]);
    }
}
class UIShortcutComponent extends preact_1.Component {
    render(virtualDom, containerNode, replaceNode) {
        let shortcut = this.props.uiobject;
        // TODO: needs to fire on container node
        return (0, preact_1.h)('div', {
            onKeyDown: (e) => {
                sendInteraction(shortcut, 'key', e, {});
            },
        }, []);
    }
}
const UI_COMPONENTS = {
    'slider': UISliderComponent,
    'select': UISelectComponent,
    'button': UIButtonComponent,
    'shortcut': UIShortcutComponent,
};
///
class Notebook {
    constructor(maindoc, maindiv) {
        this.maindoc = maindoc;
        this.maindiv = maindiv;
        maindiv.classList.add('vertical-scroll');
    }
    updateCells(cells) {
        let hTree = cells.map(cell => {
            return (0, preact_1.h)('div', {
                class: 'scripting-cell',
                key: `${cell.id}__cell`
            }, [
                objectToDiv(cell.object, cell.id, cell.id)
            ]);
        });
        (0, preact_1.render)(hTree, this.maindiv);
    }
}
exports.Notebook = Notebook;
//# sourceMappingURL=notebook.js.map