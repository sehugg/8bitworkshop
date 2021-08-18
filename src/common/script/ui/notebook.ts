
import { BitmapType, IndexedBitmap, RGBABitmap } from "../lib/bitmap";
import { Component, render, h, ComponentType } from 'preact';
import { Cell } from "../env";
import { findIntegerFactors, hex, rgb2bgr, RGBA } from "../../util";
import { dumpRAM } from "../../emu";
// TODO: can't call methods from this end
import { Palette } from "../lib/color";
import { ScriptUISlider, ScriptUISliderType } from "../lib/scriptui";
import { current_project } from "../../../ide/ui";

const MAX_STRING_LEN = 100;
const DEFAULT_ASPECT = 1;

interface ObjectStats {
    type: 'prim' | 'complex' | 'bitmap'
    width: number
    height: number
    units: 'em' | 'px'
}

// TODO
class ObjectAnalyzer {
    recurse(obj: any) : ObjectStats {
        if (typeof obj === 'string') {
            return { type: 'prim', width: obj.length, height: 1, units: 'em' }
        } else if (obj instanceof Uint8Array) {
            return { type: 'complex', width: 60, height: Math.ceil(obj.length / 16), units: 'em' }
        } else if (typeof obj === 'object') {
            let stats : ObjectStats = { type: 'complex', width: 0, height: 0, units: 'em'};
            return stats; // TODO
        } else {
            return { type: 'prim', width: 12, height: 1, units: 'em' }
        }
    }
}

interface ColorComponentProps {
    rgbavalue: number;
}

class ColorComponent extends Component<ColorComponentProps> {
    render(virtualDom, containerNode, replaceNode) {
        let rgb = this.props.rgbavalue & 0xffffff;
        let bgr = rgb2bgr(rgb);
        var htmlcolor = `#${hex(bgr,6)}`;
        var textcolor =  (rgb & 0x008000) ? 'black' : 'white';
        var printcolor = hex(rgb & 0xffffff, 6); // TODO: show index instead?
        return h('div', {
            class: 'scripting-color',
            style: `background-color: ${htmlcolor}; color: ${textcolor}`,
            alt: htmlcolor, // TODO
        }, [
            h('span', { }, printcolor )
        ]);
    }
}

interface BitmapComponentProps {
    bitmap: BitmapType;
    width: number;
    height: number;
}

class BitmapComponent extends Component<BitmapComponentProps> {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    imageData: ImageData;
    datau32: Uint32Array;

    constructor(props: BitmapComponentProps) {
        super(props);
    }
    render(virtualDom, containerNode, replaceNode) {
        return h('canvas', {
            width: this.props.width,
            height: this.props.height,
            ...this.props
        });
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
        this.canvas = this.base as HTMLCanvasElement;
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
    updateCanvas(vdata: Uint32Array, bmp: BitmapType) {
        if (bmp['palette']) {
            this.updateCanvasIndexed(vdata, bmp as IndexedBitmap);
        }
        if (bmp['rgba']) {
            this.updateCanvasRGBA(vdata, bmp as RGBABitmap);
        }
    }
    updateCanvasRGBA(vdata: Uint32Array, bmp: RGBABitmap) {
        vdata.set(bmp.rgba);
    }
    updateCanvasIndexed(vdata: Uint32Array, bmp: IndexedBitmap) {
        let pal = bmp.palette.colors;
        for (var i = 0; i < bmp.pixels.length; i++) {
            vdata[i] = pal[bmp.pixels[i]];
        }
    }
}

interface BitmapEditorState {
    isEditing: boolean;
}

class BitmapEditor extends Component<BitmapComponentProps, BitmapEditorState> {
    render(virtualDom, containerNode, replaceNode) {
        // TODO: focusable?
        let bitmapProps = {
            onClick: (event) => {
                if (!this.state.isEditing) {
                    this.setState({ isEditing: true });
                } else {
                    // TODO: process click
                }
            },
            ...this.props
        }
        let bitmapRender = h(BitmapComponent, bitmapProps, []);
        let okCancel = null;
        if (this.state.isEditing) {
            okCancel = h('div', {}, [
                button('Ok', () => this.commitChanges()),
                button('Cancel', () => this.abandonChanges()),
            ]);
        }
        return h('div', {
            tabIndex: 0,
            class: this.state.isEditing ? 'scripting-editor' : '' // TODO
        }, [
            bitmapRender,
            okCancel,
        ])
    }
    commitChanges() {
        this.cancelEditing();
    }
    abandonChanges() {
        this.cancelEditing();
    }
    cancelEditing() {
        this.setState({ isEditing: false });
    }
}

function button(label: string, action: () => void) {
    return h('button', {
        onClick: action
    }, [label]);
}

interface ObjectTreeComponentProps {
    name?: string;
    object: {} | [];
    objpath: string;
}

interface ObjectTreeComponentState {
    expanded: boolean;
}

class ObjectKeyValueComponent extends Component<ObjectTreeComponentProps, ObjectTreeComponentState> {
    render(virtualDom, containerNode, replaceNode) {
        let expandable = typeof this.props.object === 'object';
        let hdrclass = '';
        if (expandable)
            hdrclass = this.state.expanded ? 'tree-expanded' : 'tree-collapsed'
        let propName = this.props.name || null;
        if (propName.startsWith("$$")) propName = null;
        return h('div', {
            class: 'tree-content',
            key: `${this.props.objpath}__tree`
        }, [
            h('div', {
                class: 'tree-header ' + hdrclass,
                onClick: expandable ? () => this.toggleExpand() : null
            }, [
                h('span', { class: 'tree-key' }, [ propName, expandable ]),
                h('span', { class: 'tree-value' }, [ getShortName(this.props.object) ])
            ]),
            this.state.expanded ? objectToContentsDiv(this.props.object, this.props.objpath) : null
        ]);
    }
    toggleExpand() {
        this.setState({ expanded: !this.state.expanded });
    }
}

function getShortName(object: any) {
    if (typeof object === 'object') {
        try {
            var s = Object.getPrototypeOf(object).constructor.name;
            if (object.length > 0) {
                s += `[${object.length}]`
            }
            return s;
        } catch (e) {
            console.log(e);
            return e + "";
        }
    } else {
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
    } else if (typeof obj == 'number') {
        if (obj != (obj | 0)) text = obj.toString(); // must be a float
        else text = obj + "\t($" + hex(obj) + ")";
    } else {
        text = JSON.stringify(obj);
        if (text.length > MAX_STRING_LEN)
            text = text.substring(0, MAX_STRING_LEN) + "...";
    }
    return text;
}

function isIndexedBitmap(object): object is IndexedBitmap {
    return object['bitsPerPixel'] && object['pixels'] && object['palette'];
}
function isRGBABitmap(object): object is RGBABitmap {
    return object['rgba'] instanceof Uint32Array;
}
function isPalette(object): object is Palette {
    return object['colors'] instanceof Uint32Array;
}

function objectToDiv(object: any, name: string, objpath: string) {
    var props = { class: '', key: `${objpath}__obj` };
    var children = [];
    // TODO: tile editor
    // TODO: limit # of items
    // TODO: detect table
    //return objectToContentsDiv(object);
    if (object == null) {
        return object + "";
    } else if (object['uitype']) {
        return h(UISliderComponent, { iokey: objpath, uiobject: object });
    } else if (object['literaltext']) {
        return h("pre", { }, [ object['literaltext'] ]);
    } else if (isIndexedBitmap(object) || isRGBABitmap(object)) {
        return h(BitmapEditor, { bitmap: object, width: object.width, height: object.height });
    } else if (isPalette(object)) {
        if (object.colors.length <= 64) {
            props.class += ' scripting-flex ';
            object.colors.forEach((val) => {
                children.push(h(ColorComponent, { rgbavalue: val }));
            })
            return h('div', props, children);
        } else {
            let {a,b} = findIntegerFactors(object.colors.length, 1, 1, DEFAULT_ASPECT);
            return objectToDiv({ rgba: object.colors, width: a, height: b }, name, objpath);
        }
    } else {
        return h(ObjectKeyValueComponent, { name, object, objpath }, []);
    }
}

function fixedArrayToDiv(tyarr: Array<number>, bpel: number, objpath: string) {
    const maxBytes = 0x100;
    if (tyarr.length <= maxBytes) {
        // TODO
        let dumptext = dumpRAM(tyarr, 0, tyarr.length);
        return h('pre', {}, dumptext);
    } else {
        let children = [];
        for (var ofs = 0; ofs < tyarr.length; ofs += maxBytes) {
            children.push(objectToDiv(tyarr.slice(ofs, ofs + maxBytes), '$' + hex(ofs), `${objpath}.${ofs}`));
        }
        return h('div', {}, children);
    }
}

function objectToContentsDiv(object: {} | [], objpath: string) {
    // is typed array?
    let bpel = object['BYTES_PER_ELEMENT'];
    if (typeof bpel === 'number') {
        return fixedArrayToDiv(object as Array<number>, bpel, objpath);
    }
    let objectEntries = Object.entries(object);
    let objectDivs = objectEntries.map(entry => objectToDiv(entry[1], entry[0], `${objpath}.${entry[1]}`));
    return h('div', { class: 'scripting-flex' }, objectDivs);
}

interface UISliderComponentProps {
    iokey: string;
    uiobject: ScriptUISliderType;
}

class UISliderComponent extends Component<UISliderComponentProps> {
    render(virtualDom, containerNode, replaceNode) {
        let slider = this.props.uiobject;
        return h('div', {}, [
            this.props.iokey,
            h('input', {
                type: 'range',
                min: slider.min / slider.step,
                max: slider.max / slider.step,
                value: this.props.uiobject.value / slider.step,
                onInput: (ev) => {
                    let newValue = { value: parseFloat(ev.target.value) * slider.step };
                    this.setState(this.state);
                    current_project.updateDataItems([{key: this.props.iokey, value: newValue}]);
                }
            }, []),
            getShortName(slider.value)
        ]);
    }
}

export class Notebook {
    constructor(
        public readonly maindoc: HTMLDocument,
        public readonly maindiv: HTMLElement
    ) {
        maindiv.classList.add('vertical-scroll');
    }
    updateCells(cells: Cell[]) {
        let hTree = cells.map(cell => {
            return h('div', {
                class: 'scripting-cell',
                key: `${cell.id}__cell`
            }, [
                objectToDiv(cell.object, cell.id, cell.id)
            ])
        });
        render(hTree, this.maindiv);
    }
}
