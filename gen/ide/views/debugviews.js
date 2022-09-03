"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProbeSymbolView = exports.ScanlineIOView = exports.ProbeLogView = exports.RasterStackMapView = exports.RasterPCHeatMapView = exports.AddressHeatMapView = exports.ProbeViewBaseBase = exports.MemoryMapView = exports.BinaryFileView = exports.VRAMMemoryView = exports.MemoryView = void 0;
const baseviews_1 = require("./baseviews");
const ui_1 = require("../ui");
const util_1 = require("../../common/util");
const vlist_1 = require("../../common/vlist");
const emu_1 = require("../../common/emu");
const probe_1 = require("../../common/probe");
const baseplatform_1 = require("../../common/baseplatform");
///
function ignoreSymbol(sym) {
    return sym.endsWith('_SIZE__') || sym.endsWith('_LAST__') || sym.endsWith('STACKSIZE__') || sym.endsWith('FILEOFFS__')
        || sym.startsWith('l__') || sym.startsWith('s__') || sym.startsWith('.__.');
}
// TODO: make it use debug state
// TODO: make it safe (load/restore state?)
// TODO: refactor w/ VirtualTextLine
class MemoryView {
    constructor() {
        this.recreateOnResize = true;
        this.totalRows = 0x1400;
    }
    createDiv(parent) {
        var div = document.createElement('div');
        div.setAttribute("class", "memdump");
        parent.appendChild(div);
        this.showMemoryWindow(parent, div);
        return this.maindiv = div;
    }
    showMemoryWindow(workspace, parent) {
        this.memorylist = new vlist_1.VirtualList({
            w: $(workspace).width(),
            h: $(workspace).height(),
            itemHeight: (0, emu_1.getVisibleEditorLineHeight)(),
            totalRows: this.totalRows,
            generatorFn: (row) => {
                var s = this.getMemoryLineAt(row);
                var linediv = document.createElement("div");
                if (this.dumplines) {
                    var dlr = this.dumplines[row];
                    if (dlr)
                        linediv.classList.add('seg_' + this.getMemorySegment(this.dumplines[row].a));
                }
                linediv.appendChild(document.createTextNode(s));
                return linediv;
            }
        });
        $(parent).append(this.memorylist.container);
        this.tick();
        if (ui_1.compparams && this.dumplines)
            this.scrollToAddress(ui_1.compparams.data_start);
    }
    scrollToAddress(addr) {
        if (this.dumplines) {
            this.memorylist.scrollToItem(this.findMemoryWindowLine(addr));
        }
    }
    refresh() {
        this.dumplines = null;
        this.tick();
    }
    tick() {
        if (this.memorylist) {
            $(this.maindiv).find('[data-index]').each((i, e) => {
                var div = $(e);
                var row = parseInt(div.attr('data-index'));
                var oldtext = div.text();
                var newtext = this.getMemoryLineAt(row);
                if (oldtext != newtext)
                    div.text(newtext);
            });
        }
    }
    getMemoryLineAt(row) {
        var offset = row * 16;
        var n1 = 0;
        var n2 = 16;
        var sym;
        if (this.getDumpLines()) {
            var dl = this.dumplines[row];
            if (dl) {
                offset = dl.a & 0xfff0;
                n1 = dl.a - offset;
                n2 = n1 + dl.l;
                sym = dl.s;
            }
            else {
                return '.';
            }
        }
        var s = (0, util_1.hex)(offset + n1, 4) + ' ';
        for (var i = 0; i < n1; i++)
            s += '   ';
        if (n1 > 8)
            s += ' ';
        for (var i = n1; i < n2; i++) {
            var read = this.readAddress(offset + i);
            if (i == 8)
                s += ' ';
            s += ' ' + (typeof read == 'number' ? (0, util_1.hex)(read, 2) : '??');
        }
        for (var i = n2; i < 16; i++)
            s += '   ';
        if (sym)
            s += '  ' + sym;
        return s;
    }
    readAddress(n) {
        return ui_1.platform.readAddress(n);
    }
    getDumpLineAt(line) {
        var d = this.dumplines[line];
        if (d) {
            return d.a + " " + d.s;
        }
    }
    // TODO: addr2symbol for ca65; and make it work without symbols
    getDumpLines() {
        var addr2sym = (ui_1.platform.debugSymbols && ui_1.platform.debugSymbols.addr2symbol) || {};
        if (this.dumplines == null) {
            this.dumplines = [];
            var ofs = 0;
            var sym;
            for (const _nextofs of Object.keys(addr2sym)) {
                var nextofs = parseInt(_nextofs); // convert from string (stupid JS)
                var nextsym = addr2sym[nextofs];
                if (sym) {
                    // ignore certain symbols
                    if (ignoreSymbol(sym)) {
                        sym = '';
                    }
                    while (ofs < nextofs && this.dumplines.length < 0x10000) {
                        var ofs2 = (ofs + 16) & 0xffff0;
                        if (ofs2 > nextofs)
                            ofs2 = nextofs;
                        //if (ofs < 1000) console.log(ofs, ofs2, nextofs, sym);
                        this.dumplines.push({ a: ofs, l: ofs2 - ofs, s: sym });
                        ofs = ofs2;
                    }
                }
                sym = nextsym;
            }
        }
        return this.dumplines;
    }
    // TODO: use segments list?
    getMemorySegment(a) {
        if (ui_1.compparams) {
            if (a >= ui_1.compparams.data_start && a < ui_1.compparams.data_start + ui_1.compparams.data_size) {
                if (ui_1.platform.getSP && a >= ui_1.platform.getSP() - 15)
                    return 'stack';
                else
                    return 'data';
            }
            else if (a >= ui_1.compparams.code_start && a < ui_1.compparams.code_start + (ui_1.compparams.code_size || ui_1.compparams.rom_size))
                return 'code';
        }
        var segments = ui_1.current_project.segments;
        if (segments) {
            for (var seg of segments) {
                if (a >= seg.start && a < seg.start + seg.size) {
                    if (seg.type == 'rom')
                        return 'code';
                    if (seg.type == 'ram')
                        return 'data';
                    if (seg.type == 'io')
                        return 'io';
                }
            }
        }
        return 'unknown';
    }
    findMemoryWindowLine(a) {
        for (var i = 0; i < this.dumplines.length; i++)
            if (this.dumplines[i].a >= a)
                return i;
    }
}
exports.MemoryView = MemoryView;
class VRAMMemoryView extends MemoryView {
    constructor() {
        super(...arguments);
        this.totalRows = 0x800;
    }
    readAddress(n) {
        return ui_1.platform.readVRAMAddress(n);
    }
    getMemorySegment(a) {
        return 'video';
    }
    getDumpLines() {
        return null;
    }
}
exports.VRAMMemoryView = VRAMMemoryView;
///
class BinaryFileView {
    constructor(path, data) {
        this.recreateOnResize = true;
        this.path = path;
        this.data = data;
    }
    createDiv(parent) {
        this.vlist = new emu_1.VirtualTextScroller(parent);
        this.vlist.create(parent, ((this.data.length + 15) >> 4), this.getMemoryLineAt.bind(this));
        return this.vlist.maindiv;
    }
    getMemoryLineAt(row) {
        var offset = row * 16;
        var n1 = 0;
        var n2 = 16;
        var s = (0, util_1.hex)(offset + n1, 4) + ' ';
        for (var i = 0; i < n1; i++)
            s += '   ';
        if (n1 > 8)
            s += ' ';
        for (var i = n1; i < n2; i++) {
            var read = this.data[offset + i];
            if (i == 8)
                s += ' ';
            s += ' ' + (read >= 0 ? (0, util_1.hex)(read, 2) : '  ');
        }
        return { text: s };
    }
    refresh() {
        this.vlist.refresh();
    }
    getPath() { return this.path; }
}
exports.BinaryFileView = BinaryFileView;
///
class MemoryMapView {
    createDiv(parent) {
        this.maindiv = (0, baseviews_1.newDiv)(parent, 'vertical-scroll');
        this.maindiv.css('display', 'grid');
        this.maindiv.css('grid-template-columns', '5em 40% 40%');
        return this.maindiv[0];
    }
    // TODO: overlapping segments (e.g. ROM + LC)
    addSegment(seg, newrow) {
        if (newrow) {
            var offset = $('<div class="segment-offset" style="grid-column-start:1"/>');
            offset.text('$' + (0, util_1.hex)(seg.start, 4));
            this.maindiv.append(offset);
        }
        var segdiv = $('<div class="segment"/>');
        if (!newrow)
            segdiv.css('grid-column-start', 3); // make sure it's on right side
        if (seg.last)
            segdiv.text(seg.name + " (" + (seg.last - seg.start) + " / " + seg.size + " bytes used)");
        else
            segdiv.text(seg.name + " (" + seg.size + " bytes)");
        if (seg.size >= 256) {
            var pad = (Math.log(seg.size) - Math.log(256)) * 0.5;
            segdiv.css('padding-top', pad + 'em');
            segdiv.css('padding-bottom', pad + 'em');
        }
        if (seg.type) {
            segdiv.addClass('segment-' + seg.type);
        }
        this.maindiv.append(segdiv);
        //var row = $('<div class="row"/>').append(offset, segdiv);
        //var container = $('<div class="container"/>').append(row);
        //this.maindiv.append(container);
        segdiv.click(() => {
            // TODO: what if memory browser does not exist?
            var memview = ui_1.projectWindows.createOrShow('#memory');
            memview.scrollToAddress(seg.start);
        });
    }
    refresh() {
        this.maindiv.empty();
        var segments = ui_1.current_project.segments;
        if (segments) {
            var curofs = 0;
            var laststart = -1;
            for (var seg of segments) {
                //var used = seg.last ? (seg.last-seg.start) : seg.size;
                if (seg.start > curofs)
                    this.addSegment({ name: '', start: curofs, size: seg.start - curofs }, true);
                this.addSegment(seg, laststart != seg.start);
                laststart = seg.start;
                curofs = seg.start + seg.size;
            }
        }
    }
}
exports.MemoryMapView = MemoryMapView;
///
// TODO: clear buffer when scrubbing
const OPAQUE_BLACK = 0xff000000;
class ProbeViewBaseBase {
    constructor() {
        this.cumulativeData = false;
        var width = 160;
        var height = 262; // TODO: PAL?
        try {
            width = Math.ceil(ui_1.platform['machine']['cpuCyclesPerLine']) || width; // TODO
            height = Math.ceil(ui_1.platform['machine']['numTotalScanlines']) || height; // TODO
        }
        catch (e) {
        }
        this.cyclesPerLine = width;
        this.totalScanlines = height;
    }
    addr2symbol(addr) {
        var _addr2sym = (ui_1.platform.debugSymbols && ui_1.platform.debugSymbols.addr2symbol) || {};
        return _addr2sym[addr];
    }
    addr2str(addr) {
        var sym = this.addr2symbol(addr);
        if (typeof sym === 'string')
            return '$' + (0, util_1.hex)(addr) + ' (' + sym + ')';
        else
            return '$' + (0, util_1.hex)(addr);
    }
    showTooltip(s) {
        if (s) {
            if (!this.tooldiv) {
                this.tooldiv = document.createElement("div");
                this.tooldiv.setAttribute("class", "tooltiptrack");
                document.body.appendChild(this.tooldiv);
            }
            $(this.tooldiv).text(s).show();
        }
        else {
            $(this.tooldiv).hide();
        }
    }
    setVisible(showing) {
        if (showing) {
            this.probe = ui_1.platform.startProbing();
            this.probe.singleFrame = !this.cumulativeData;
            this.tick();
        }
        else {
            if (this.probe)
                this.probe.singleFrame = true;
            ui_1.platform.stopProbing();
            this.probe = null;
        }
    }
    redraw(eventfn) {
        var p = this.probe;
        if (!p || !p.idx)
            return; // if no probe, or if empty
        var row = 0;
        var col = 0;
        var clk = 0;
        this.sp = 0;
        for (var i = 0; i < p.idx; i++) {
            var word = p.buf[i];
            var addr = word & 0xffff;
            var value = (word >> 16) & 0xff;
            var op = word & OPAQUE_BLACK;
            switch (op) {
                case probe_1.ProbeFlags.SCANLINE:
                    row++;
                    col = 0;
                    break;
                case probe_1.ProbeFlags.FRAME:
                    row = 0;
                    col = 0;
                    break;
                case probe_1.ProbeFlags.CLOCKS:
                    col += addr;
                    clk += addr;
                    break;
                case probe_1.ProbeFlags.SP_PUSH:
                case probe_1.ProbeFlags.SP_POP:
                    this.sp = addr;
                default:
                    eventfn(op, addr, col, row, clk, value);
                    break;
            }
        }
    }
    opToString(op, addr, value) {
        var s = "";
        switch (op) {
            case probe_1.ProbeFlags.EXECUTE:
                s = "Exec";
                break;
            case probe_1.ProbeFlags.MEM_READ:
                s = "Read";
                break;
            case probe_1.ProbeFlags.MEM_WRITE:
                s = "Write";
                break;
            case probe_1.ProbeFlags.IO_READ:
                s = "IO Read";
                break;
            case probe_1.ProbeFlags.IO_WRITE:
                s = "IO Write";
                break;
            case probe_1.ProbeFlags.VRAM_READ:
                s = "VRAM Read";
                break;
            case probe_1.ProbeFlags.VRAM_WRITE:
                s = "VRAM Write";
                break;
            case probe_1.ProbeFlags.DMA_READ:
                s = "DMA Read";
                break;
            case probe_1.ProbeFlags.DMA_WRITE:
                s = "DMA Write";
                break;
            case probe_1.ProbeFlags.INTERRUPT:
                s = "Interrupt";
                break;
            case probe_1.ProbeFlags.ILLEGAL:
                s = "Error";
                break;
            case probe_1.ProbeFlags.WAIT:
                s = "Wait";
                break;
            case probe_1.ProbeFlags.SP_PUSH:
                s = "Stack Push";
                break;
            case probe_1.ProbeFlags.SP_POP:
                s = "Stack Pop";
                break;
            default: return "";
        }
        if (typeof addr == 'number')
            s += " " + this.addr2str(addr);
        if ((op & probe_1.ProbeFlags.HAS_VALUE) && typeof value == 'number')
            s += " = $" + (0, util_1.hex)(value, 2);
        return s;
    }
    getOpRGB(op, addr) {
        switch (op) {
            case probe_1.ProbeFlags.EXECUTE: return 0x018001;
            case probe_1.ProbeFlags.MEM_READ: return 0x800101;
            case probe_1.ProbeFlags.MEM_WRITE: return 0x010180;
            case probe_1.ProbeFlags.IO_READ: return 0x018080;
            case probe_1.ProbeFlags.IO_WRITE: return 0xc00180;
            case probe_1.ProbeFlags.DMA_READ:
            case probe_1.ProbeFlags.VRAM_READ: return 0x808001;
            case probe_1.ProbeFlags.DMA_WRITE:
            case probe_1.ProbeFlags.VRAM_WRITE: return 0x4080c0;
            case probe_1.ProbeFlags.INTERRUPT: return 0x3fbf3f;
            case probe_1.ProbeFlags.ILLEGAL: return 0x3f3fff;
            case probe_1.ProbeFlags.WAIT: return 0xff3f3f;
            default: return 0;
        }
    }
}
exports.ProbeViewBaseBase = ProbeViewBaseBase;
class ProbeViewBase extends ProbeViewBaseBase {
    constructor() {
        super(...arguments);
        this.recreateOnResize = true;
    }
    createCanvas(parent, width, height) {
        var div = document.createElement('div');
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.classList.add('pixelated');
        canvas.style.width = '100%';
        canvas.style.height = '90vh'; // i hate css
        canvas.style.backgroundColor = 'black';
        canvas.style.cursor = 'crosshair';
        canvas.onmousemove = (e) => {
            var pos = (0, emu_1.getMousePos)(canvas, e);
            this.showTooltip(this.getTooltipText(pos.x, pos.y));
            $(this.tooldiv).css('left', e.pageX + 10).css('top', e.pageY - 30);
        };
        canvas.onmouseout = (e) => {
            $(this.tooldiv).hide();
        };
        parent.appendChild(div);
        div.appendChild(canvas);
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.initCanvas();
        return this.maindiv = div;
    }
    initCanvas() {
    }
    getTooltipText(x, y) {
        return null;
    }
    getOpAtPos(x, y, mask) {
        x = x | 0;
        y = y | 0;
        let result = 0;
        this.redraw((op, addr, col, row, clk, value) => {
            if (!result && row == y && col >= x && (op & mask) != 0) {
                result = op | addr;
            }
        });
        return result;
    }
    clear() {
    }
    tick() {
        this.clear();
        this.redraw(this.drawEvent.bind(this));
    }
}
class ProbeBitmapViewBase extends ProbeViewBase {
    constructor() {
        super(...arguments);
        this.recreateOnResize = false;
    }
    createDiv(parent) {
        return this.createCanvas(parent, this.cyclesPerLine, this.totalScanlines);
    }
    initCanvas() {
        this.imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
        this.datau32 = new Uint32Array(this.imageData.data.buffer);
    }
    getTooltipText(x, y) {
        x = x | 0;
        y = y | 0;
        var s = "";
        var lastroutine = null;
        var symstack = [];
        var lastcol = -1;
        this.redraw((op, addr, col, row, clk, value) => {
            switch (op) {
                case probe_1.ProbeFlags.EXECUTE:
                    lastroutine = this.addr2symbol(addr) || lastroutine;
                    break;
                case probe_1.ProbeFlags.SP_PUSH:
                    symstack.push(lastroutine);
                    break;
                case probe_1.ProbeFlags.SP_POP:
                    lastroutine = symstack.pop();
                    break;
            }
            if (row == y && col <= x) {
                if (col != lastcol) {
                    s = "";
                    lastcol = col;
                }
                if (s == "" && lastroutine) {
                    s += "\n" + lastroutine;
                }
                s += "\n" + this.opToString(op, addr, value);
            }
        });
        return 'X: ' + x + '  Y: ' + y + ' ' + s;
    }
    refresh() {
        this.tick();
        this.datau32.fill(OPAQUE_BLACK);
    }
    tick() {
        super.tick();
        this.drawImage();
    }
    drawImage() {
        this.ctx.putImageData(this.imageData, 0, 0);
    }
    clear() {
        this.datau32.fill(OPAQUE_BLACK);
    }
}
class AddressHeatMapView extends ProbeBitmapViewBase {
    createDiv(parent) {
        return this.createCanvas(parent, 256, 256);
    }
    initCanvas() {
        super.initCanvas();
        this.canvas.onclick = (e) => {
            var pos = (0, emu_1.getMousePos)(this.canvas, e);
            var opaddr = Math.floor(pos.x) + Math.floor(pos.y) * 256;
            var lastpc = -1;
            var runpc = -1;
            this.redraw((op, addr) => {
                if (runpc < 0 && lastpc >= 0 && addr == opaddr) {
                    runpc = lastpc;
                }
                if (op == probe_1.ProbeFlags.EXECUTE)
                    lastpc = addr;
            });
            if (runpc >= 0)
                (0, ui_1.runToPC)(runpc);
        };
    }
    clear() {
        for (var i = 0; i <= 0xffff; i++) {
            var v = ui_1.platform.readAddress(i);
            var rgb = (v >> 2) | (v & 0x1f);
            rgb |= (rgb << 8) | (rgb << 16);
            this.datau32[i] = rgb | OPAQUE_BLACK;
        }
    }
    // TODO: show current PC
    drawEvent(op, addr, col, row) {
        var rgb = this.getOpRGB(op, addr);
        if (!rgb)
            return;
        var x = addr & 0xff;
        var y = (addr >> 8) & 0xff;
        var data = this.datau32[addr & 0xffff];
        data = data | rgb | OPAQUE_BLACK;
        this.datau32[addr & 0xffff] = data;
    }
    getTooltipText(x, y) {
        var a = (x & 0xff) + (y << 8);
        var s = "";
        var pc = -1;
        var already = {};
        var lastroutine = null;
        var symstack = [];
        this.redraw((op, addr, col, row, clk, value) => {
            switch (op) {
                case probe_1.ProbeFlags.EXECUTE:
                    pc = addr;
                    lastroutine = this.addr2symbol(addr) || lastroutine;
                    break;
                case probe_1.ProbeFlags.SP_PUSH:
                    symstack.push(lastroutine);
                    break;
                case probe_1.ProbeFlags.SP_POP:
                    lastroutine = symstack.pop();
                    break;
            }
            var key = op | pc;
            if (addr == a && !already[key]) {
                if (s == "" && lastroutine) {
                    s += "\n" + lastroutine;
                }
                s += "\nPC " + this.addr2str(pc) + " " + this.opToString(op, null, value);
                already[key] = 1;
            }
        });
        return this.addr2str(a) + s;
    }
}
exports.AddressHeatMapView = AddressHeatMapView;
class RasterPCHeatMapView extends ProbeBitmapViewBase {
    initCanvas() {
        super.initCanvas();
        // TODO: run to exact x/y position
        this.canvas.onclick = (e) => {
            var pos = (0, emu_1.getMousePos)(this.canvas, e);
            var x = Math.floor(pos.x);
            var y = Math.floor(pos.y);
            var opaddr = this.getOpAtPos(pos.x, pos.y, probe_1.ProbeFlags.EXECUTE);
            if (opaddr) {
                //runToPC(opaddr & 0xffff);
                (0, ui_1.setupBreakpoint)("toline");
                ui_1.platform.runEval(() => {
                    let onrow = ui_1.platform.getRasterScanline && ui_1.platform.getRasterScanline() >= y;
                    if (onrow && ui_1.platform.getRasterLineClock) {
                        return onrow && ui_1.platform.getRasterLineClock() > x;
                    }
                    else
                        return onrow;
                });
            }
        };
    }
    drawEvent(op, addr, col, row) {
        var rgb = this.getOpRGB(op, addr);
        if (!rgb)
            return;
        var iofs = col + row * this.canvas.width;
        var data = rgb | OPAQUE_BLACK;
        this.datau32[iofs] |= data;
    }
    drawImage() {
        // fill in the gaps
        let last = OPAQUE_BLACK;
        for (let i = 0; i < this.datau32.length; i++) {
            if (this.datau32[i] == OPAQUE_BLACK) {
                this.datau32[i] = last;
            }
            else {
                last = this.datau32[i];
            }
        }
        super.drawImage();
    }
}
exports.RasterPCHeatMapView = RasterPCHeatMapView;
class RasterStackMapView extends RasterPCHeatMapView {
    constructor() {
        super(...arguments);
        this.interrupt = 0;
        this.rgb = 0;
        this.lastpc = 0;
    }
    drawEvent(op, addr, col, row) {
        var iofs = col + row * this.canvas.width;
        // track interrupts
        if (op == probe_1.ProbeFlags.INTERRUPT)
            this.interrupt = 1;
        if (this.interrupt == 1 && op == probe_1.ProbeFlags.SP_PUSH)
            this.interrupt = addr;
        if (this.interrupt > 1 && this.sp > this.interrupt)
            this.interrupt = 0;
        // track writes
        if (op == probe_1.ProbeFlags.MEM_WRITE) {
            this.rgb |= 0x00002f;
        }
        if (op == probe_1.ProbeFlags.VRAM_WRITE) {
            this.rgb |= 0x003f80;
        }
        if (op == probe_1.ProbeFlags.IO_WRITE) {
            this.rgb |= 0x1f3f80;
        }
        if (op == probe_1.ProbeFlags.IO_READ) {
            this.rgb |= 0x001f00;
        }
        if (op == probe_1.ProbeFlags.WAIT) {
            this.rgb = 0x008000;
        }
        // draw pixels?
        if (op == probe_1.ProbeFlags.ILLEGAL || op == probe_1.ProbeFlags.DMA_READ) {
            this.datau32[iofs] = 0xff0f0f0f;
        }
        else {
            let data = this.rgb;
            if (op == probe_1.ProbeFlags.EXECUTE) {
                let sp = this.sp & 15;
                if (sp >= 8)
                    sp = 16 - sp;
                if (Math.abs(this.lastpc) - addr > 16) {
                    sp += 1;
                }
                if (Math.abs(this.lastpc) - addr > 256) {
                    sp += 1;
                }
                data = this.rgb = (0x080808 * sp) + 0x202020;
                this.lastpc = addr;
            }
            if (this.interrupt) {
                data |= 0x800040;
            }
            if (this.datau32[iofs] == OPAQUE_BLACK) {
                this.datau32[iofs] = data | OPAQUE_BLACK;
            }
        }
    }
}
exports.RasterStackMapView = RasterStackMapView;
class ProbeLogView extends ProbeViewBaseBase {
    constructor() {
        super(...arguments);
        this.recreateOnResize = true;
    }
    createDiv(parent) {
        this.vlist = new emu_1.VirtualTextScroller(parent);
        this.vlist.create(parent, this.cyclesPerLine * this.totalScanlines, this.getMemoryLineAt.bind(this));
        return this.vlist.maindiv;
    }
    getMemoryLineAt(row) {
        var s = "";
        var c = "seg_data";
        var line = this.dumplines && this.dumplines[row];
        if (line != null) {
            var xtra = line.info.join(", ");
            s = "(" + (0, util_1.lpad)(line.row, 4) + ", " + (0, util_1.lpad)(line.col, 4) + ")  " + (0, util_1.rpad)(line.asm || "", 20) + xtra;
            if (xtra.indexOf("Write ") >= 0)
                c = "seg_io";
            // if (xtra.indexOf("Stack ") >= 0) c = "seg_code";
        }
        return { text: s, clas: c };
    }
    refresh() {
        this.tick();
    }
    tick() {
        const isz80 = ui_1.platform instanceof baseplatform_1.BaseZ80MachinePlatform || ui_1.platform instanceof baseplatform_1.BaseZ80Platform; // TODO?
        // cache each line in frame
        this.dumplines = {};
        this.redraw((op, addr, col, row, clk, value) => {
            if (isz80)
                clk >>= 2;
            var line = this.dumplines[clk];
            if (line == null) {
                line = { op: op, addr: addr, row: row, col: col, asm: null, info: [] };
                this.dumplines[clk] = line;
            }
            switch (op) {
                case probe_1.ProbeFlags.EXECUTE:
                    if (ui_1.platform.disassemble) {
                        var disasm = ui_1.platform.disassemble(addr, ui_1.platform.readAddress.bind(ui_1.platform));
                        line.asm = disasm && disasm.line;
                    }
                    break;
                default:
                    var xtra = this.opToString(op, addr, value);
                    if (xtra != "")
                        line.info.push(xtra);
                    break;
            }
        });
        this.vlist.refresh();
    }
}
exports.ProbeLogView = ProbeLogView;
class ScanlineIOView extends ProbeViewBaseBase {
    constructor() {
        super(...arguments);
        this.recreateOnResize = true;
    }
    createDiv(parent) {
        this.vlist = new emu_1.VirtualTextScroller(parent);
        this.vlist.create(parent, this.totalScanlines, this.getMemoryLineAt.bind(this));
        return this.vlist.maindiv;
    }
    getMemoryLineAt(row) {
        var s = (0, util_1.lpad)(row + "", 3) + ' ';
        var c = 'seg_code';
        var line = (this.dumplines && this.dumplines[row]) || [];
        var hblankCycle = Math.round(this.cyclesPerLine / 3.3);
        for (var i = 0; i < this.cyclesPerLine; i++) {
            var opaddr = line[i];
            if (opaddr !== undefined) {
                var addr = opaddr & 0xffff;
                var op = op & OPAQUE_BLACK;
                if (op == probe_1.ProbeFlags.EXECUTE) {
                    s += ',';
                }
                else {
                    var v = (0, util_1.hex)(addr);
                    s += v;
                    i += v.length - 1;
                }
            }
            else {
                s += (i == hblankCycle) ? '|' : '.';
            }
        }
        if (line[-1])
            s += ' ' + line[-1]; // executing symbol
        return { text: s, clas: c };
    }
    refresh() {
        this.tick();
    }
    tick() {
        const isz80 = ui_1.platform instanceof baseplatform_1.BaseZ80MachinePlatform || ui_1.platform instanceof baseplatform_1.BaseZ80Platform; // TODO?
        // cache each line in frame
        this.dumplines = {};
        this.redraw((op, addr, col, row, clk, value) => {
            var line = this.dumplines[row];
            if (line == null) {
                this.dumplines[row] = line = [];
            }
            switch (op) {
                case probe_1.ProbeFlags.EXECUTE:
                    var sym = ui_1.platform.debugSymbols.addr2symbol[addr];
                    if (sym)
                        line[-1] = sym;
                    break;
                //case ProbeFlags.MEM_WRITE:
                case probe_1.ProbeFlags.IO_READ:
                case probe_1.ProbeFlags.IO_WRITE:
                case probe_1.ProbeFlags.VRAM_READ:
                case probe_1.ProbeFlags.VRAM_WRITE:
                    line[col] = op | addr;
                    break;
            }
        });
        this.vlist.refresh();
    }
}
exports.ScanlineIOView = ScanlineIOView;
///
class ProbeSymbolView extends ProbeViewBaseBase {
    constructor() {
        super(...arguments);
        this.recreateOnResize = true;
        this.cumulativeData = true;
    }
    // TODO: auto resize
    createDiv(parent) {
        // TODO: what if symbol list changes?
        if (ui_1.platform.debugSymbols && ui_1.platform.debugSymbols.symbolmap) {
            this.keys = Array.from(Object.keys(ui_1.platform.debugSymbols.symbolmap).filter(sym => !ignoreSymbol(sym)));
        }
        else {
            this.keys = ['no symbols defined'];
        }
        this.vlist = new emu_1.VirtualTextScroller(parent);
        this.vlist.create(parent, this.keys.length + 1, this.getMemoryLineAt.bind(this));
        return this.vlist.maindiv;
    }
    getMemoryLineAt(row) {
        // header line
        if (row == 0) {
            return { text: (0, util_1.lpad)("Symbol", 35) + (0, util_1.lpad)("Reads", 8) + (0, util_1.lpad)("Writes", 8) };
        }
        var sym = this.keys[row - 1];
        var line = this.dumplines && this.dumplines[sym];
        function getop(op) {
            var n = line[op] | 0;
            return (0, util_1.lpad)(n ? n.toString() : "", 8);
        }
        var s;
        var c;
        if (line != null) {
            s = (0, util_1.lpad)(sym, 35)
                + getop(probe_1.ProbeFlags.MEM_READ)
                + getop(probe_1.ProbeFlags.MEM_WRITE);
            if (line[probe_1.ProbeFlags.EXECUTE])
                c = 'seg_code';
            else if (line[probe_1.ProbeFlags.IO_READ] || line[probe_1.ProbeFlags.IO_WRITE])
                c = 'seg_io';
            else
                c = 'seg_data';
        }
        else {
            s = (0, util_1.lpad)(sym, 35);
            c = 'seg_unknown';
        }
        return { text: s, clas: c };
    }
    refresh() {
        this.tick();
    }
    tick() {
        // cache each line in frame
        this.dumplines = {};
        this.redraw((op, addr, col, row, clk, value) => {
            var sym = ui_1.platform.debugSymbols.addr2symbol[addr];
            if (sym != null) {
                var line = this.dumplines[sym];
                if (line == null) {
                    line = {};
                    this.dumplines[sym] = line;
                }
                line[op] = (line[op] | 0) + 1;
            }
        });
        this.vlist.refresh();
        if (this.probe)
            this.probe.clear(); // clear cumulative data (TODO: doesnt work with seeking or debugging)
    }
}
exports.ProbeSymbolView = ProbeSymbolView;
///
//# sourceMappingURL=debugviews.js.map