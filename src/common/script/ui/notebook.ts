
import { BitmapType, IndexedBitmap, RGBABitmap } from "../lib/bitmap";
import { Component, render, h, ComponentType } from 'preact';
import { Cell } from "../env";
import { rgb2bgr } from "../../util";
import { dumpRAM } from "../../emu";

interface ColorComponentProps {
    rgbavalue: number;
}

class ColorComponent extends Component<ColorComponentProps> {
    render(virtualDom, containerNode, replaceNode) {
        let rgb = this.props.rgbavalue & 0xffffff;
        var htmlcolor = `#${rgb2bgr(rgb).toString(16)}`;
        var textcol = (rgb & 0x008000) ? 'black' : 'white';
        return h('div', {
            class: 'scripting-color',
            style: `background-color: ${htmlcolor}; color: ${textcol}`,
            alt: htmlcolor, // TODO
        }, '\u00a0');
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
            class: 'pixelated',
            width: this.props.width,
            height: this.props.height
        });
    }
    componentDidMount() {
        this.canvas = this.base as HTMLCanvasElement;
        this.prepare();
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
        this.ctx = this.canvas.getContext('2d');
        this.imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        this.datau32 = new Uint32Array(this.imageData.data.buffer);
    }
    refresh() {
        // preact can reuse this component but it can change shape :^P
        if (this.imageData.width != this.props.width || this.imageData.height != this.props.height) {
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

interface ObjectTreeComponentProps {
    object: {} | [];
}

interface ObjectTreeComponentState {
    expanded : boolean;
}

class ObjectTreeComponent extends Component<ObjectTreeComponentProps, ObjectTreeComponentState> {
    render(virtualDom, containerNode, replaceNode) {
        if (this.state.expanded) {
            var minus = h('span', { onClick: () => this.toggleExpand() }, [ '-' ]);
            return h('minus', { }, [
                minus,
                getShortName(this.props.object),
                objectToContentsDiv(this.props.object)
            ]);
        } else {
            var plus = h('span', { onClick: () => this.toggleExpand() }, [ '+' ]);
            return h('div', { }, [
                plus,
                getShortName(this.props.object)
            ]);
        }
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
            return 'object';
        }
    } else {
        return object+"";
    }
}

// TODO: need id?
function objectToDiv(object: any) {
    var props = { class: '' };
    var children = [];
    // TODO: tile editor
    // TODO: limit # of items
    // TODO: detect table
    if (Array.isArray(object)) {
        return objectToContentsDiv(object);
    } else if (object['bitsPerPixel'] && object['pixels'] && object['palette']) {
        addBitmapComponent(children, object as IndexedBitmap);
    } else if (object['rgba'] instanceof Uint32Array) {
        addBitmapComponent(children, object as RGBABitmap);
    } else if (object['colors'] instanceof Uint32Array) {
        // TODO: make sets of 2/4/8/16/etc
        props.class += ' scripting-grid ';
        object['colors'].forEach((val) => {
            children.push(h(ColorComponent, { rgbavalue: val }));
        })
    } else if (typeof object === 'object') {
        children.push(h(ObjectTreeComponent, { object }));
    } else {
        children.push(JSON.stringify(object));
    }
    let div = h('div', props, children);
    return div;
}

function objectToContentsDiv(object: {} | []) {
    // is typed array?
    let bpel = object['BYTES_PER_ELEMENT'];
    if (typeof bpel === 'number') {
        const maxBytes = 0x100;
        let tyarr = object as Uint8Array;
        if (tyarr.length <= maxBytes) {
            // TODO
            let dumptext = dumpRAM(tyarr, 0, tyarr.length);
            return h('pre', { }, dumptext);
        } else {
            let children = [];
            for (var ofs=0; ofs<tyarr.length; ofs+=maxBytes) {
                children.push(objectToDiv(tyarr.slice(ofs, ofs+maxBytes)));
            }
            return h('div', { }, children);
        }
    }
    let objectEntries = Object.entries(object);
    // TODO: id?
    let objectDivs = objectEntries.map(entry => objectToDiv(entry[1]));
    return h('div', { }, objectDivs);
}

function addBitmapComponent(children, bitmap: BitmapType) {
    children.push(h(BitmapComponent, { bitmap: bitmap, width: bitmap.width, height: bitmap.height}));
}

export class Notebook {
    constructor(
        public readonly maindoc: HTMLDocument,
        public readonly maindiv: HTMLElement
    ) {
        maindiv.classList.add('vertical-scroll');
        //maindiv.classList.add('container')
    }
    updateCells(cells: Cell[]) {
        let hTree = cells.map(cell => {
            let cellDiv = objectToDiv(cell.object);
            cellDiv.props['class'] += ' scripting-cell ';
            return cellDiv;
        });
        render(hTree, this.maindiv);
    }
}
