
import { PLATFORMS, RasterVideo } from "../common/emu";
import { Platform } from "../common/baseplatform";
import { Cell } from "../common/script/env";
import { escapeHTML } from "../common/util";
import { BitmapType, IndexedBitmap, RGBABitmap } from "../common/script/bitmap";

abstract class TileEditor<T> {
    video: RasterVideo;

    constructor(
        public readonly tileWidth: number,
        public readonly tileHeight: number,
        public readonly numColumns: number,
        public readonly numRows: number,
    ) {
    }
    getPixelWidth() { return this.tileWidth * this.numColumns }
    getPixelHeight() { return this.tileHeight * this.numRows }
    attach(div: HTMLElement) {
        this.video = new RasterVideo(div, this.getPixelWidth(), this.getPixelHeight());
        this.video.create();
    }
    detach() {
        this.video = null;
    }
    update() {
        if (this.video) this.video.updateFrame();
    }
    abstract getTile(x: number, y: number): T;
    abstract renderTile(x: number, y: number): void;
}

class RGBABitmapEditor extends TileEditor<number> {
    constructor(
        public readonly bitmap: RGBABitmap
    ) {
        super(1, 1, bitmap.width, bitmap.height);
    }
    getTile(x: number, y: number) {
        return this.bitmap.getPixel(x, y);
    }
    renderTile(x: number, y: number): void {
        //TODO 
    }
}

function bitmap2image(doc: HTMLDocument, div: HTMLElement, bitmap: BitmapType): HTMLCanvasElement {
    var video = new RasterVideo(div, bitmap.width, bitmap.height);
    video.create(doc);
    video.canvas.className = 'pixelated';
    let vdata = video.getFrameData();
    if (bitmap['palette'] != null) {
        let bmp = bitmap as IndexedBitmap;
        let pal = bmp.palette.colors;
        for (var i = 0; i < bmp.pixels.length; i++) {
            vdata[i] = pal[bmp.pixels[i]];
        }
    } else {
        let bmp = bitmap as RGBABitmap;
        vdata.set(bmp.rgba);
    }
    video.updateFrame();
    return video.canvas;
}

class Notebook {
    constructor(
        public readonly maindoc: HTMLDocument,
        public readonly maindiv: HTMLElement
    ) {
        maindiv.classList.add('vertical-scroll');
        //maindiv.classList.add('container')
    }
    updateCells(cells: Cell[]) {
        let body = this.maindiv;
        body.innerHTML = '';
        //var body = $(this.iframe).contents().find('body');
        //body.empty();
        for (let cell of cells) {
            if (cell.object != null) {
                let div = this.objectToDiv(cell.object);
                div.id = cell.id;
                div.classList.add('scripting-cell')
                //div.classList.add('row')
                body.append(div);
            }
        }
    }
    objectToDiv(object: any) {
        let div = document.createElement('div');
        //div.classList.add('col-auto')
        //grid-template-columns: repeat(auto-fit, minmax(50px, 1fr));
        // TODO: tile editor
        if (Array.isArray(object) || object.BYTES_PER_ELEMENT) {
            object.forEach((obj) => {
                div.appendChild(this.objectToDiv(obj));
            });
        // TODO
        } else if (object['bitsPerPixel'] && object['pixels'] && object['palette']) {
            bitmap2image(this.maindoc, div, object as IndexedBitmap);
        } else if (object['rgba']) {
            bitmap2image(this.maindoc, div, object as RGBABitmap);
        } else if (object != null) {
            div.innerHTML = escapeHTML(JSON.stringify(object));
        }
        return div;
    }
}

class ScriptingPlatform implements Platform {
    mainElement: HTMLElement;
    iframe: HTMLIFrameElement;
    notebook: Notebook;

    constructor(mainElement: HTMLElement) {
        this.mainElement = mainElement;
        /*
        // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe
        this.iframe = $(`<iframe sandbox="allow-same-origin" width="100%" height="100%"/>`).appendTo(mainElement)[0] as HTMLIFrameElement;
        mainElement.classList.add("vertical-scroll"); //100% height
        mainElement.style.overflowY = 'auto';
        this.iframe.onload = (e) => {
            let head = this.iframe.contentDocument.head;
            head.appendChild($(`<link rel="stylesheet" href="css/script.css">`)[0]);
        };
        */
       this.notebook = new Notebook(document, mainElement);
    }
    start() {
    }
    reset() {
    }
    pause() {
    }
    resume() {
    }
    loadROM(title, cells: Cell[]) {
        this.notebook.updateCells(cells);
    }
    isRunning() {
        return false;
    }
    isDebugging(): boolean {
        return false;
    }
    getToolForFilename(fn: string): string {
        return "js";
    }
    getDefaultExtension(): string {
        return ".js";
    }
    getPresets() {
        return [
        ];
    }
    /*
    showHelp() {
      window.open("https://github.com/showdownjs/showdown/wiki/Showdown's-Markdown-syntax", "_help");
    }
    */
}

PLATFORMS['script'] = ScriptingPlatform;
