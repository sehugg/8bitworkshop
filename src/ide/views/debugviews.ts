
import { newDiv, ProjectView } from "./baseviews";
import { Segment } from "../../common/workertypes";
import { platform, compparams, current_project, projectWindows, runToPC, setupBreakpoint } from "../ui";
import { hex, lpad, rpad } from "../../common/util";
import { VirtualList } from "../../common/vlist";
import { getMousePos, getVisibleEditorLineHeight, VirtualTextLine, VirtualTextScroller } from "../../common/emu";
import { ProbeFlags, ProbeRecorder } from "../../common/probe";
import { BaseZ80MachinePlatform, BaseZ80Platform } from "../../common/baseplatform";

///

function ignoreSymbol(sym:string) {
  return sym.endsWith('_SIZE__') || sym.endsWith('_LAST__') || sym.endsWith('STACKSIZE__') || sym.endsWith('FILEOFFS__') 
  || sym.startsWith('l__') || sym.startsWith('s__') || sym.startsWith('.__.');
}

// TODO: make it use debug state
// TODO: make it safe (load/restore state?)
// TODO: refactor w/ VirtualTextLine
export class MemoryView implements ProjectView {
  memorylist;
  dumplines;
  maindiv : HTMLElement;
  recreateOnResize = true;
  totalRows = 0x1400;

  createDiv(parent : HTMLElement) {
    var div = document.createElement('div');
    div.setAttribute("class", "memdump");
    parent.appendChild(div);
    this.showMemoryWindow(parent, div);
    return this.maindiv = div;
  }

  showMemoryWindow(workspace:HTMLElement, parent:HTMLElement) {
    this.memorylist = new VirtualList({
      w: $(workspace).width(),
      h: $(workspace).height(),
      itemHeight: getVisibleEditorLineHeight(),
      totalRows: this.totalRows,
      generatorFn: (row : number) => {
        var s = this.getMemoryLineAt(row);
        var linediv = document.createElement("div");
        if (this.dumplines) {
          var dlr = this.dumplines[row];
          if (dlr) linediv.classList.add('seg_' + this.getMemorySegment(this.dumplines[row].a));
        }
        linediv.appendChild(document.createTextNode(s));
        return linediv;
      }
    });
    $(parent).append(this.memorylist.container);
    this.tick();
    if (compparams && this.dumplines)
      this.scrollToAddress(compparams.data_start);
  }

  scrollToAddress(addr : number) {
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
      $(this.maindiv).find('[data-index]').each( (i,e) => {
        var div = $(e);
        var row = parseInt(div.attr('data-index'));
        var oldtext = div.text();
        var newtext = this.getMemoryLineAt(row);
        if (oldtext != newtext)
          div.text(newtext);
      });
    }
  }

  getMemoryLineAt(row : number) : string {
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
      } else {
        return '.';
      }
    }
    var s = hex(offset+n1,4) + ' ';
    for (var i=0; i<n1; i++) s += '   ';
    if (n1 > 8) s += ' ';
    for (var i=n1; i<n2; i++) {
      var read = this.readAddress(offset+i);
      if (i==8) s += ' ';
      s += ' ' + (typeof read == 'number' ? hex(read,2) : '??');
    }
    for (var i=n2; i<16; i++) s += '   ';
    if (sym) s += '  ' + sym;
    return s;
  }

  readAddress(n : number) {
    return platform.readAddress(n);
  }

  getDumpLineAt(line : number) {
    var d = this.dumplines[line];
    if (d) {
      return d.a + " " + d.s;
    }
  }

  // TODO: addr2symbol for ca65; and make it work without symbols
  getDumpLines() {
    var addr2sym = (platform.debugSymbols && platform.debugSymbols.addr2symbol) || {};
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
            if (ofs2 > nextofs) ofs2 = nextofs;
            //if (ofs < 1000) console.log(ofs, ofs2, nextofs, sym);
            this.dumplines.push({a:ofs, l:ofs2-ofs, s:sym});
            ofs = ofs2;
          }
        }
        sym = nextsym;
      }
    }
    return this.dumplines;
  }

  // TODO: use segments list?
  getMemorySegment(a:number) : string {
    if (compparams) {
      if (a >= compparams.data_start && a < compparams.data_start+compparams.data_size) {
        if (platform.getSP && a >= platform.getSP() - 15)
          return 'stack';
        else
          return 'data';
      }
      else if (a >= compparams.code_start && a < compparams.code_start+(compparams.code_size||compparams.rom_size))
        return 'code';
    }
    var segments = current_project.segments;
    if (segments) {
      for (var seg of segments) {
        if (a >= seg.start && a < seg.start+seg.size) {
          if (seg.type == 'rom') return 'code';
          if (seg.type == 'ram') return 'data';
          if (seg.type == 'io') return 'io';
        }
      }
    }
    return 'unknown';
  }

  findMemoryWindowLine(a:number) : number {
    for (var i=0; i<this.dumplines.length; i++)
      if (this.dumplines[i].a >= a)
        return i;
  }
}

export class VRAMMemoryView extends MemoryView {
  totalRows = 0x800;
  readAddress(n : number) {
    return platform.readVRAMAddress(n);
  }
  getMemorySegment(a:number) : string {
    return 'video';
  }
  getDumpLines() {
    return null;
  }
}

///

export class BinaryFileView implements ProjectView {
  vlist : VirtualTextScroller;
  maindiv : HTMLElement;
  path:string;
  data:Uint8Array;
  recreateOnResize = true;

  constructor(path:string, data:Uint8Array) {
    this.path = path;
    this.data = data;
  }

  createDiv(parent : HTMLElement) {
    this.vlist = new VirtualTextScroller(parent);
    this.vlist.create(parent, ((this.data.length+15) >> 4), this.getMemoryLineAt.bind(this));
    return this.vlist.maindiv;
  }

  getMemoryLineAt(row : number) : VirtualTextLine {
    var offset = row * 16;
    var n1 = 0;
    var n2 = 16;
    var s = hex(offset+n1,4) + ' ';
    for (var i=0; i<n1; i++) s += '   ';
    if (n1 > 8) s += ' ';
    for (var i=n1; i<n2; i++) {
      var read = this.data[offset+i];
      if (i==8) s += ' ';
      s += ' ' + (read>=0?hex(read,2):'  ');
    }
    return {text:s};
  }

  refresh() {
    this.vlist.refresh();
  }
  
  getPath() { return this.path; }
}

///

export class MemoryMapView implements ProjectView {
  maindiv : JQuery;

  createDiv(parent : HTMLElement) {
    this.maindiv = newDiv(parent, 'vertical-scroll');
    this.maindiv.css('display', 'grid');
    this.maindiv.css('grid-template-columns', '5em 40% 40%');
    return this.maindiv[0];
  }

  // TODO: overlapping segments (e.g. ROM + LC)
  addSegment(seg : Segment, newrow : boolean) {
    if (newrow) {
      var offset = $('<div class="segment-offset" style="grid-column-start:1"/>');
      offset.text('$'+hex(seg.start,4));
      this.maindiv.append(offset);
    }
    var segdiv = $('<div class="segment"/>');
    if (!newrow)
      segdiv.css('grid-column-start', 3); // make sure it's on right side
    if (seg.last)
      segdiv.text(seg.name+" ("+(seg.last-seg.start)+" / "+seg.size+" bytes used)");
    else
      segdiv.text(seg.name+" ("+seg.size+" bytes)");
    if (seg.size >= 256) {
      var pad = (Math.log(seg.size) - Math.log(256)) * 0.5;
      segdiv.css('padding-top', pad+'em');
      segdiv.css('padding-bottom', pad+'em');
    }
    if (seg.type) {
      segdiv.addClass('segment-'+seg.type);
    }
    this.maindiv.append(segdiv);
    //var row = $('<div class="row"/>').append(offset, segdiv);
    //var container = $('<div class="container"/>').append(row);
    //this.maindiv.append(container);
    segdiv.click(() => {
      // TODO: what if memory browser does not exist?
      var memview = projectWindows.createOrShow('#memory') as MemoryView;
      memview.scrollToAddress(seg.start);
    });
  }

  refresh() {
    this.maindiv.empty();
    var segments = current_project.segments;
    if (segments) {
      var curofs = 0;
      var laststart = -1;
      for (var seg of segments) {
        //var used = seg.last ? (seg.last-seg.start) : seg.size;
        if (seg.start > curofs)
          this.addSegment({name:'',start:curofs, size:seg.start-curofs}, true);
        this.addSegment(seg, laststart != seg.start);
        laststart = seg.start;
        curofs = seg.start + seg.size;
      }
    }
  }

}

///

// TODO: clear buffer when scrubbing

const OPAQUE_BLACK = 0xff000000;

export abstract class ProbeViewBaseBase {
  probe : ProbeRecorder;
  tooldiv : HTMLElement;
  cumulativeData : boolean = false;
  cyclesPerLine : number;
  totalScanlines : number;
  sp : number; // stack pointer

  abstract tick() : void;

  constructor() {
    var width = 160;
    var height = 262; // TODO: PAL?
    try {
      width = Math.ceil(platform['machine']['cpuCyclesPerLine']) || width; // TODO
      height = Math.ceil(platform['machine']['numTotalScanlines']) || height; // TODO
    } catch (e) {
    }
    this.cyclesPerLine = width;
    this.totalScanlines = height;
  }

  addr2symbol(addr : number) : string {
    var _addr2sym = (platform.debugSymbols && platform.debugSymbols.addr2symbol) || {};
    return _addr2sym[addr];
  }

  addr2str(addr : number) : string {
    var sym = this.addr2symbol(addr);
    if (typeof sym === 'string')
      return '$' + hex(addr) + ' (' + sym + ')';
    else
      return '$' + hex(addr);
  }

  showTooltip(s:string) {
    if (s) {
      if (!this.tooldiv) {
        this.tooldiv = document.createElement("div");
        this.tooldiv.setAttribute("class", "tooltiptrack");
        document.body.appendChild(this.tooldiv);
      }
      $(this.tooldiv).text(s).show();
    } else {
      $(this.tooldiv).hide();
    }
  }

  setVisible(showing : boolean) : void {
    if (showing) {
      this.probe = platform.startProbing();
      this.probe.singleFrame = !this.cumulativeData;
      this.tick();
    } else {
      if (this.probe) this.probe.singleFrame = true;
      platform.stopProbing();
      this.probe = null;
    }
  }

  redraw( eventfn:(op,addr,col,row,clk,value) => void ) {
    var p = this.probe;
    if (!p || !p.idx) return; // if no probe, or if empty
    var row=0;
    var col=0;
    var clk=0;
    this.sp = 0;
    for (var i=0; i<p.idx; i++) {
      var word = p.buf[i];
      var addr = word & 0xffff;
      var value = (word >> 16) & 0xff;
      var op = word & OPAQUE_BLACK;
      switch (op) {
        case ProbeFlags.SCANLINE:	row++; col=0; break;
        case ProbeFlags.FRAME:		row=0; col=0; break;
        case ProbeFlags.CLOCKS:		col += addr; clk += addr; break;
        case ProbeFlags.SP_PUSH:
        case ProbeFlags.SP_POP:
          this.sp = addr;
        default:
          eventfn(op, addr, col, row, clk, value);
          break;
      }
    }
  }

  opToString(op:number, addr?:number, value?:number) {
    var s = "";
    switch (op) {
      case ProbeFlags.EXECUTE:		s = "Exec"; break;
      case ProbeFlags.MEM_READ:		s = "Read"; break;
      case ProbeFlags.MEM_WRITE:	s = "Write"; break;
      case ProbeFlags.IO_READ:		s = "IO Read"; break;
      case ProbeFlags.IO_WRITE:		s = "IO Write"; break;
      case ProbeFlags.VRAM_READ:	s = "VRAM Read"; break;
      case ProbeFlags.VRAM_WRITE:	s = "VRAM Write"; break;
      case ProbeFlags.DMA_READ:  	s = "DMA Read"; break;
      case ProbeFlags.DMA_WRITE:	s = "DMA Write"; break;
      case ProbeFlags.INTERRUPT:	s = "Interrupt"; break;
      case ProbeFlags.ILLEGAL:		s = "Error"; break;
      case ProbeFlags.WAIT:		    s = "Wait"; break;
      case ProbeFlags.SP_PUSH:		s = "Stack Push"; break;
      case ProbeFlags.SP_POP:     s = "Stack Pop"; break;
      default:				            return "";
    }
    if (typeof addr == 'number') s += " " + this.addr2str(addr);
    if ((op & ProbeFlags.HAS_VALUE) && typeof value == 'number') s += " = $" + hex(value,2);
    return s;
  }
  
  getOpRGB(op:number, addr:number) : number {
    switch (op) {
      case ProbeFlags.EXECUTE:		return 0x018001;
      case ProbeFlags.MEM_READ:		return 0x800101;
      case ProbeFlags.MEM_WRITE:	return 0x010180;
      case ProbeFlags.IO_READ:		return 0x018080;
      case ProbeFlags.IO_WRITE:		return 0xc00180;
      case ProbeFlags.DMA_READ:
      case ProbeFlags.VRAM_READ:	return 0x808001;
      case ProbeFlags.DMA_WRITE:
      case ProbeFlags.VRAM_WRITE:	return 0x4080c0;
      case ProbeFlags.INTERRUPT:	return 0x3fbf3f;
      case ProbeFlags.ILLEGAL:		return 0x3f3fff;
      case ProbeFlags.WAIT:	    	return 0xff3f3f;
      default:				            return 0;
    }
  }
}

abstract class ProbeViewBase extends ProbeViewBaseBase {

  maindiv : HTMLElement;
  canvas : HTMLCanvasElement;
  ctx : CanvasRenderingContext2D;
  recreateOnResize = true;
    
  abstract drawEvent(op, addr, col, row);

  createCanvas(parent:HTMLElement, width:number, height:number) {
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
      var pos = getMousePos(canvas, e);
      this.showTooltip(this.getTooltipText(pos.x, pos.y));
      $(this.tooldiv).css('left',e.pageX+10).css('top',e.pageY-30);
    }
    canvas.onmouseout = (e) => {
      $(this.tooldiv).hide();
    }
    parent.appendChild(div);
    div.appendChild(canvas);
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.initCanvas();
    return this.maindiv = div;
  }

  initCanvas() {
  }
  
  getTooltipText(x:number, y:number) : string {
    return null;
  }

  getOpAtPos(x:number, y:number, mask:number) : number {
    x = x|0;
    y = y|0;
    let result = 0;
    this.redraw( (op,addr,col,row,clk,value) => {
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

abstract class ProbeBitmapViewBase extends ProbeViewBase {

  imageData : ImageData;
  datau32 : Uint32Array;
  recreateOnResize = false;
  
  createDiv(parent : HTMLElement) {
    return this.createCanvas(parent, this.cyclesPerLine, this.totalScanlines);
  }
  initCanvas() {
    this.imageData = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    this.datau32 = new Uint32Array(this.imageData.data.buffer);
  }
  getTooltipText(x:number, y:number) : string {
    x = x|0;
    y = y|0;
    var s = "";
    var lastroutine = null;
    var symstack = [];
    var lastcol = -1;
    this.redraw( (op,addr,col,row,clk,value) => {
      switch (op) {
        case ProbeFlags.EXECUTE:
          lastroutine = this.addr2symbol(addr) || lastroutine;
          break;
        case ProbeFlags.SP_PUSH:
          symstack.push(lastroutine);
          break;
        case ProbeFlags.SP_POP:
          lastroutine = symstack.pop();
          break;
      }
      if (row == y && col <= x) {
        if (col != lastcol) {
          s = "";
          lastcol = col;
        }
        if (s == "" && lastroutine) { s += "\n" + lastroutine; }
        s += "\n" + this.opToString(op, addr, value);
      }
    } );
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

export class AddressHeatMapView extends ProbeBitmapViewBase implements ProjectView {

  createDiv(parent : HTMLElement) {
    return this.createCanvas(parent, 256, 256);
  }
  
  initCanvas() {
    super.initCanvas();
    this.canvas.onclick = (e) => {
      var pos = getMousePos(this.canvas, e);
      var opaddr = Math.floor(pos.x) + Math.floor(pos.y) * 256;
      var lastpc = -1;
      var runpc = -1;
      this.redraw( (op,addr) => {
        if (runpc < 0 && lastpc >= 0 && addr == opaddr) {
          runpc = lastpc;
        }
        if (op == ProbeFlags.EXECUTE) lastpc = addr;
      });
      if (runpc >= 0) runToPC(runpc);
    }
  }

  clear() {
    for (var i=0; i<=0xffff; i++) {
      var v = platform.readAddress(i);
      var rgb = (v >> 2) | (v & 0x1f);
      rgb |= (rgb<<8) | (rgb<<16);
      this.datau32[i] = rgb | OPAQUE_BLACK;
    }
  }

  // TODO: show current PC
  drawEvent(op, addr, col, row) {
    var rgb = this.getOpRGB(op, addr);
    if (!rgb) return;
    var x = addr & 0xff;
    var y = (addr >> 8) & 0xff;
    var data = this.datau32[addr & 0xffff];
    data = data | rgb | OPAQUE_BLACK;
    this.datau32[addr & 0xffff] = data;
  }
  
  getTooltipText(x:number, y:number) : string {
    var a = (x & 0xff) + (y << 8);
    var s = "";
    var pc = -1;
    var already = {};
    var lastroutine = null;
    var symstack = [];
    this.redraw( (op,addr,col,row,clk,value) => {
      switch (op) {
        case ProbeFlags.EXECUTE:
          pc = addr;
          lastroutine = this.addr2symbol(addr) || lastroutine;
          break;
        case ProbeFlags.SP_PUSH:
          symstack.push(lastroutine);
          break;
        case ProbeFlags.SP_POP:
          lastroutine = symstack.pop();
          break;
      }
      var key = op|pc;
      if (addr == a && !already[key]) {
        if (s == "" && lastroutine) { s += "\n" + lastroutine; }
        s += "\nPC " + this.addr2str(pc) + " " + this.opToString(op, null, value);
        already[key] = 1;
      }
    } );
    return this.addr2str(a) + s;
  }
}

export class RasterPCHeatMapView extends ProbeBitmapViewBase implements ProjectView {

  initCanvas() {
    super.initCanvas();
    // TODO: run to exact x/y position
    this.canvas.onclick = (e) => {
      var pos = getMousePos(this.canvas, e);
      var x = Math.floor(pos.x);
      var y = Math.floor(pos.y);
      var opaddr = this.getOpAtPos(pos.x, pos.y, ProbeFlags.EXECUTE);
      if (opaddr) {
        //runToPC(opaddr & 0xffff);
        setupBreakpoint("toline");
        platform.runEval(() => {
          let onrow = platform.getRasterScanline && platform.getRasterScanline() >= y;
          if (onrow && platform.getRasterLineClock) {
            return onrow && platform.getRasterLineClock() > x;
          } else return onrow;
        });
      }
    }
  }

  drawEvent(op, addr, col, row) {
    var rgb = this.getOpRGB(op, addr);
    if (!rgb) return;
    var iofs = col + row * this.canvas.width;
    var data = rgb | OPAQUE_BLACK;
    this.datau32[iofs] |= data;
  }

  drawImage() {
    // fill in the gaps
    let last = OPAQUE_BLACK;
    for (let i=0; i<this.datau32.length; i++) {
      if (this.datau32[i] == OPAQUE_BLACK) {
        this.datau32[i] = last;
      } else {
        last = this.datau32[i];
      }
    }
    super.drawImage();
  }
}

export class RasterStackMapView extends RasterPCHeatMapView implements ProjectView {

  interrupt: number = 0;
  rgb: number = 0;
  lastpc: number = 0;

  drawEvent(op, addr, col, row) {
    var iofs = col + row * this.canvas.width;
    // track interrupts
    if (op == ProbeFlags.INTERRUPT) this.interrupt = 1;
    if (this.interrupt == 1 && op == ProbeFlags.SP_PUSH) this.interrupt = addr;
    if (this.interrupt > 1 && this.sp > this.interrupt) this.interrupt = 0;
    // track writes
    if (op == ProbeFlags.MEM_WRITE) { this.rgb |= 0x00002f; }
    if (op == ProbeFlags.VRAM_WRITE) { this.rgb |= 0x003f80; }
    if (op == ProbeFlags.IO_WRITE) { this.rgb |= 0x1f3f80; }
    if (op == ProbeFlags.IO_READ) { this.rgb |= 0x001f00; }
    if (op == ProbeFlags.WAIT) { this.rgb = 0x008000; }
      // draw pixels?
    if (op == ProbeFlags.ILLEGAL || op == ProbeFlags.DMA_READ) {
      this.datau32[iofs] = 0xff0f0f0f;
    } else {
      let data = this.rgb;
      if (op == ProbeFlags.EXECUTE) {
        let sp = this.sp & 15;
        if (sp >= 8) sp = 16-sp;
        if (Math.abs(this.lastpc) - addr > 16) { sp += 1; }
        if (Math.abs(this.lastpc) - addr > 256) { sp += 1; }
        data = this.rgb = (0x080808 * sp) + 0x202020;
        this.lastpc = addr;
      }
      if (this.interrupt) { data |= 0x800040; }
      if (this.datau32[iofs] == OPAQUE_BLACK) {
        this.datau32[iofs] = data | OPAQUE_BLACK;
      }
    }
  }
}

export class ProbeLogView extends ProbeViewBaseBase {
  vlist : VirtualTextScroller;
  maindiv : HTMLElement;
  recreateOnResize = true;
  dumplines;

  createDiv(parent : HTMLElement) {
    this.vlist = new VirtualTextScroller(parent);
    this.vlist.create(parent, this.cyclesPerLine*this.totalScanlines, this.getMemoryLineAt.bind(this));
    return this.vlist.maindiv;
  }
  getMemoryLineAt(row : number) : VirtualTextLine {
    var s : string = "";
    var c : string = "seg_data";
    var line = this.dumplines && this.dumplines[row];
    if (line != null) {
      var xtra : string = line.info.join(", ");
      s = "(" + lpad(line.row,4) + ", " + lpad(line.col,4) + ")  " + rpad(line.asm||"",20) + xtra;
      if (xtra.indexOf("Write ") >= 0) c = "seg_io";
      // if (xtra.indexOf("Stack ") >= 0) c = "seg_code";
    }
    return {text:s, clas:c};
  }
  refresh() {
    this.tick();
  }
  tick() {
    const isz80 = platform instanceof BaseZ80MachinePlatform || platform instanceof BaseZ80Platform; // TODO?
    // cache each line in frame
    this.dumplines = {};
    this.redraw((op,addr,col,row,clk,value) => {
      if (isz80) clk >>= 2;
      var line = this.dumplines[clk];
      if (line == null) {
        line = {op:op, addr:addr, row:row, col:col, asm:null, info:[]};
        this.dumplines[clk] = line;
      }
      switch (op) {
        case ProbeFlags.EXECUTE:
          if (platform.disassemble) {
            var disasm = platform.disassemble(addr, platform.readAddress.bind(platform));
            line.asm = disasm && disasm.line;
          }
          break;
        default:
          var xtra = this.opToString(op, addr, value);
          if (xtra != "") line.info.push(xtra);
          break;
      }
    });
    this.vlist.refresh();
  }
}

export class ScanlineIOView extends ProbeViewBaseBase {
  vlist : VirtualTextScroller;
  maindiv : HTMLElement;
  recreateOnResize = true;
  dumplines;

  createDiv(parent : HTMLElement) {
    this.vlist = new VirtualTextScroller(parent);
    this.vlist.create(parent, this.totalScanlines, this.getMemoryLineAt.bind(this));
    return this.vlist.maindiv;
  }
  getMemoryLineAt(row : number) : VirtualTextLine {
    var s = lpad(row+"",3) + ' ';
    var c = 'seg_code';
    var line = (this.dumplines && this.dumplines[row]) || [];
    var hblankCycle = Math.round(this.cyclesPerLine/3.3);
    for (var i=0; i<this.cyclesPerLine; i++) {
      var opaddr = line[i];
      if (opaddr !== undefined) {
        var addr = opaddr & 0xffff;
        var op = op & OPAQUE_BLACK;
        if (op == ProbeFlags.EXECUTE) {
          s += ',';
        } else {
          var v = hex(addr);
          s += v;
          i += v.length - 1;
        }
      } else {
        s += (i==hblankCycle) ? '|' : '.';
      }
    }
    if (line[-1]) s += ' ' + line[-1]; // executing symbol
    return {text:s, clas:c};
  }
  refresh() {
    this.tick();
  }
  tick() {
    const isz80 = platform instanceof BaseZ80MachinePlatform || platform instanceof BaseZ80Platform; // TODO?
    // cache each line in frame
    this.dumplines = {};
    this.redraw((op,addr,col,row,clk,value) => {
      var line = this.dumplines[row];
      if (line == null) {
        this.dumplines[row] = line = [];
      }
      switch (op) {
        case ProbeFlags.EXECUTE:
          var sym = platform.debugSymbols.addr2symbol[addr];
          if (sym) line[-1] = sym;
          break;
        //case ProbeFlags.MEM_WRITE:
        case ProbeFlags.IO_READ:
        case ProbeFlags.IO_WRITE:
        case ProbeFlags.VRAM_READ:
        case ProbeFlags.VRAM_WRITE:
          line[col] = op | addr;
          break;
      }
    });
    this.vlist.refresh();
  }
}

///

export class ProbeSymbolView extends ProbeViewBaseBase {
  vlist : VirtualTextScroller;
  keys : string[];
  recreateOnResize = true;
  dumplines;
  cumulativeData = true;

  // TODO: auto resize
  createDiv(parent : HTMLElement) {
    // TODO: what if symbol list changes?
    if (platform.debugSymbols && platform.debugSymbols.symbolmap) {
      this.keys = Array.from(Object.keys(platform.debugSymbols.symbolmap).filter(sym => !ignoreSymbol(sym)));
    } else {
      this.keys = ['no symbols defined'];
    }
    this.vlist = new VirtualTextScroller(parent);
    this.vlist.create(parent, this.keys.length + 1, this.getMemoryLineAt.bind(this));
    return this.vlist.maindiv;
  }

  getMemoryLineAt(row : number) : VirtualTextLine {
    // header line
    if (row == 0) {
      return {text: lpad("Symbol",35)+lpad("Reads",8)+lpad("Writes",8)};
    }
    var sym = this.keys[row-1];
    var line = this.dumplines && this.dumplines[sym];
    function getop(op) {
      var n = line[op] | 0;
      return lpad(n ? n.toString() : "", 8);
    }
    var s : string;
    var c : string;
    if (line != null) {
      s = lpad(sym, 35) 
        + getop(ProbeFlags.MEM_READ)
        + getop(ProbeFlags.MEM_WRITE);
      if (line[ProbeFlags.EXECUTE])
        c = 'seg_code';
      else if (line[ProbeFlags.IO_READ] || line[ProbeFlags.IO_WRITE])
        c = 'seg_io';
      else
        c = 'seg_data';
    } else {
      s = lpad(sym, 35);
      c = 'seg_unknown';
    }
    return {text:s, clas:c};
  }

  refresh() {
    this.tick();
  }

  tick() {
    // cache each line in frame
    this.dumplines = {};
    this.redraw((op,addr,col,row,clk,value) => {
      var sym = platform.debugSymbols.addr2symbol[addr];
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
    if (this.probe) this.probe.clear(); // clear cumulative data (TODO: doesnt work with seeking or debugging)
  }
}

///

