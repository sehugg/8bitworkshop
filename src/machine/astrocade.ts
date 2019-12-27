
import { Z80, Z80State } from "../common/cpu/ZilogZ80";
import { BasicScanlineMachine, AcceptsPaddleInput, Bus } from "../common/devices";
import { KeyFlags, newAddressDecoder, padBytes, Keys, makeKeycodeMap, newKeyboardHandler } from "../common/emu";
import { TssChannelAdapter, MasterAudio, AY38910_Audio } from "../common/audio";
import { hex, rgb2bgr, lzgmini, stringToByteArray } from "../common/util";

// http://metopal.com/projects/ballybook/doku.php

// TODO: fix keys, more controllers, vibrato/noise, border color
// http://atariage.com/forums/topic/251416-programming-the-bally-arcadeastrocade/
// https://ballyalley.com/faqs/BPA%20Video%20Hardware%20FAQ/Bally_Professional_Arcade_Video_Hardware%20(2001)(Tony%20Miller).pdf
// https://atariage.com/forums/topic/290858-notes-from-a-2019-interview-with-jamie-fenton/ (http://www.fentonia.com/bio/)
// https://thehistoryofhowweplay.wordpress.com/2018/04/03/interview-tom-mchugh/
// https://ballyalley.com/faqs/Programmers%20of%20the%20Astrocade%20Built-In%20Programs.txt

const ASTROCADE_KEYCODE_MAP = makeKeycodeMap([
  // player 1
  [Keys.UP, 0x10, 0x1],
  [Keys.DOWN, 0x10, 0x2],
  [Keys.LEFT, 0x10, 0x4],
  [Keys.RIGHT, 0x10, 0x8],
  [Keys.A, 0x10, 0x10],
  // player 2
  [Keys.P2_UP, 0x11, 0x1],
  [Keys.P2_DOWN, 0x11, 0x2],
  [Keys.P2_LEFT, 0x11, 0x4],
  [Keys.P2_RIGHT, 0x11, 0x8],
  [Keys.P2_A, 0x11, 0x10],
  // keypad $14
  [Keys.VK_P, 0x14, 0x1],
  [Keys.VK_SLASH, 0x14, 0x2],
  [Keys.VK_X, 0x14, 0x4],
  [Keys.VK_MINUS, 0x14, 0x8],
  [Keys.VK_COMMA, 0x14, 0x10],
  [Keys.VK_EQUALS, 0x14, 0x20],
  // keypad $15
  [Keys.VK_O, 0x15, 0x1],
  [Keys.VK_L, 0x15, 0x2],
  [Keys.VK_9, 0x15, 0x4],
  [Keys.VK_6, 0x15, 0x8],
  [Keys.VK_3, 0x15, 0x10],
  [Keys.VK_PERIOD, 0x15, 0x20],
  // keypad $16
  [Keys.VK_I, 0x16, 0x1],
  [Keys.VK_K, 0x16, 0x2],
  [Keys.VK_8, 0x16, 0x4],
  [Keys.VK_5, 0x16, 0x8],
  [Keys.VK_2, 0x16, 0x10],
  [Keys.VK_0, 0x16, 0x20],
  // keypad $17
  [Keys.VK_U, 0x17, 0x1],
  [Keys.VK_J, 0x17, 0x2],
  [Keys.VK_7, 0x17, 0x4],
  [Keys.VK_4, 0x17, 0x8],
  [Keys.VK_1, 0x17, 0x10],
  [Keys.VK_BACK_SLASH, 0x17, 0x20],
]);

const audioOversample = 2;

const _BallyAstrocade = function(arcade:boolean) {

  var cpu : Z80;
  var ram : Uint8Array;
  var membus, iobus : Bus;
  var rom, bios;
  var pixels;
  var psg;
  //var watchdog_counter;
  const swidth = arcade ? 320 : 160;
  const sheight = arcade ? 204 : 102;
  const swbytes = swidth >> 2;
  const INITIAL_WATCHDOG = 256;
  const PIXEL_ON = 0xffeeeeee;
  const PIXEL_OFF = 0xff000000;

  // state variables
  var inputs = new Uint8Array(0x20);
  var magicop = 0;
  var xpand = 0;
  var xplower = false;
  var shift2 = 0;
  var horcb = 0;
  var inmod = 0;
  var inlin = 0;
  var infbk = 0;
  var verbl = sheight;
  var palette = new Uint32Array(8);
  var palinds = new Uint8Array(8);
  var refreshlines = 0;
  var dirtylines = new Uint8Array(arcade ? 262 : 131);
  var vidactive = false;
  var rotdata = new Uint8Array(4);
  var rotcount = 0;
  var intst = 0;
  var waitstates = 0;


  function ramwrite(a: number, v: number) {
    // set RAM
    ram[a] = v;
    waitstates++;
    // mark scanline as dirty
    dirtylines[((a & 0xfff) / swbytes) | 0] = 1;
    // this was old behavior where we updated instantly
    // but it had problems if we had mid-screen palette changes
    //ramupdate(a, v);
  }

  function ramupdate(a: number, v: number) {
    var ofs = a * 4 + 3; // 4 pixels per byte
    for (var i = 0; i < 4; i++) {
      var lr = ((a % swbytes) >= (horcb & 0x3f)) ? 0 : 4;
      pixels[ofs--] = palette[lr + (v & 3)];
      v >>= 2;
    }
  }

  function refreshline(y: number) {
    var ofs = y * swidth / 4;
    for (var i = 0; i < swidth / 4; i++)
      ramupdate(ofs + i, ram[ofs + i]);
  }

  function magicwrite(a: number, v: number) {
    // expand
    if (magicop & 0x8) {
      var v2 = 0;
      if (!xplower)
        v >>= 4;
      for (var i = 0; i < 4; i++) {
        var pix = (v & 1) ? ((xpand >> 2) & 3) : (xpand & 3);
        v2 |= pix << (i * 2);
        v >>= 1;
      }
      v = v2;
      xplower = !xplower;
    }
    // rotate
    if (magicop & 0x4) {
      if (rotcount & 4) {
        // drain buffer
        var sh = 2 * (~rotcount & 3);
        v = (((rotdata[3] >> sh) & 3) << 6) |
          (((rotdata[2] >> sh) & 3) << 4) |
          (((rotdata[1] >> sh) & 3) << 2) |
          (((rotdata[0] >> sh) & 3) << 0);
      } else {
        // fill buffer
        rotdata[rotcount & 3] = v;
      }
      rotcount++;
    } else {
      // shift
      var sh = (magicop & 3) << 1;
      var v2 = (v >> sh) | shift2;
      shift2 = (v << (8 - sh)) & 0xff;
      v = v2;
    }
    // flop
    if (magicop & 0x40) {
      v =
        ((v & 0x03) << 6) |
        ((v & 0x0c) << 2) |
        ((v & 0x30) >> 2) |
        ((v & 0xc0) >> 6);
    }
    // or/xor
    if (magicop & 0x30) {
      var oldv = ram[a];
      // collision detect
      var icpt = 0;
      if ((oldv & 0xc0) && (v & 0xc0)) icpt |= 0x1;
      if ((oldv & 0x30) && (v & 0x30)) icpt |= 0x2;
      if ((oldv & 0x0c) && (v & 0x0c)) icpt |= 0x4;
      if ((oldv & 0x03) && (v & 0x03)) icpt |= 0x8;
      // apply op
      if (magicop & 0x10)
        v |= oldv;
      if (magicop & 0x20)
        v ^= oldv; // TODO: what if both?
      // upper 4 bits persist, lower are just since last write
      intst = (intst & 0xf0) | icpt | (icpt << 4);
    }
    // commit write to ram/screen
    ramwrite(a, v);
  }

  function setpalette(a: number, v: number) {
    palinds[a & 7] = v & 0xff;
    palette[a & 7] = ASTROCADE_PALETTE[v & 0xff];
    refreshall();
  }

  function setbordercolor() {
    var col = horcb >> 6;
    // TODO
  }

  function refreshall() {
    refreshlines = sheight;
  }
  
  this.drawScanline = (sl:number) => {
    // interrupt
    if (sl == inlin && (inmod & 0x8)) {
      cpu.retryInterrupts = !(inmod & 0x4);
      this.probe && this.probe.logInterrupt(infbk);
      cpu.interrupt(infbk);
    }
    // refresh this line in frame buffer?
    if (sl < sheight && refreshlines > 0) {
      dirtylines[sl] = 0;
      refreshline(sl);
      refreshlines--;
    }
    else if (dirtylines[sl]) {
      dirtylines[sl] = 0;
      refreshline(sl);
    }
  }
  
  this.init = (machine:BallyAstrocade, c:Z80, r:Uint8Array, inp:Uint8Array, psgg) => {
    cpu = c;
    ram = r;
    inputs = inp;
    psg = psgg;
    //bios = padBytes(ASTROCADE_MINIMAL_BIOS, 0x2000);
    bios = padBytes(new lzgmini().decode(stringToByteArray(atob(ASTROLIBRE_BIOS_LZG))), 0x2000);
    if (!arcade) {
      // game console
      membus = {
        read: newAddressDecoder([
          [0x0000, 0x1fff, 0x1fff, function(a) { return bios[a]; }],
          [0x2000, 0x3fff, 0x1fff, function(a) { return rom ? rom[a] : 0; }],
          [0x4000, 0x4fff, 0xfff, function(a) { waitstates++; return ram[a]; }],
        ]),
        write: newAddressDecoder([
          [0x4000, 0x4fff, 0xfff, ramwrite],
          [0x0000, 0x3fff, 0xfff, magicwrite],
        ]),
      }
    } else {
      // arcade game (TODO: wait states 1/4 of the time)
      membus = {
        read: newAddressDecoder([
          [0x4000, 0x7fff, 0x3fff, function(a) { return ram[a]; }],	// screen RAM
          [0xd000, 0xdfff, 0xfff, function(a) { return ram[a + 0x4000]; }], // static RAM
          [0x0000, 0xafff, 0xffff, function(a) { return rom ? rom[a] : 0; }], // ROM (0-3fff,8000-afff)
        ]),
        write: newAddressDecoder([
          [0x4000, 0x7fff, 0x3fff, ramwrite],
          [0xd000, 0xdfff, 0xfff, function(a, v) { ramwrite(a + 0x4000, v); }], // static RAM
          [0x0000, 0x3fff, 0x3fff, magicwrite],
        ]),
      }
    }
    iobus = {
      read: function(addr) {
        addr &= 0x1f;
        var rtn;
        switch (addr) {
          case 8:
            rtn = intst;
            intst = 0;
            break;
          default:
            rtn = inputs[addr];
            break;
          // $10 = watchdog
        }
        return rtn;
      },
      write: function(addr, val) {
        addr &= 0x1f;
        val &= 0xff;
        switch (addr) {
          case 0:
          case 1:
          case 2:
          case 3:
          case 4:
          case 5:
          case 6:
          case 7:
            setpalette(addr, val);
            break;
          case 9:   // HORCB (horizontal boundary byte)
            horcb = val;
            setbordercolor();
            refreshall();
            break;
          case 0xa: // VERBL (vertical blank)
            verbl = arcade ? val : val >> 1;
            refreshall();
            break;
          case 0xb: // OTIR (set palette)
            var c = cpu.saveState();
            //console.log(c.BC>>8, c.HL);
            setpalette((c.BC >> 8) - 1, membus.read(c.HL));
            break;
          case 0xc: // magic register
            magicop = val;
            shift2 = 0;
            rotcount = 0;
            xplower = false;
            break;
          case 0xd: // INFBK (interrupt feedback)
            infbk = val;
            break;
          case 0xe: // INMOD (interrupt enable)
            inmod = val;
            break;
          case 0xf: // INLIN (interrupt line)
            inlin = arcade ? val : val >> 1;
            break;
          case 0x10:
          case 0x11:
          case 0x12:
          case 0x13:
          case 0x14:
          case 0x15:
          case 0x16:
          case 0x17:
            psg.setACRegister(addr, val);
            break;
          case 0x18:
            var c = cpu.saveState();
            psg.setACRegister((c.BC >> 8) - 1, membus.read(c.HL));
            break;
          case 0x19: // XPAND
            xpand = val;	
            break;
          default:
            console.log('IO write', hex(addr, 4), hex(val, 2));
            break;
        }
      }
    }
    machine.connectCPUMemoryBus(membus);
    machine.connectCPUIOBus(iobus);
    this.membus = membus;
    this.iobus = iobus;
    // default palette
    for (var i = 0; i < 8; i++) {
      setpalette(i,i);
    }
  };

  this.resetWaitStates = function(sl) {
    var n = sl < verbl ? waitstates : 0; // only wait if video active
    waitstates = 0;
    return n;
  }

  this.loadState = (state) => {
    cpu.loadState(state.c);
    ram.set(state.ram);
    palette.set(state.palette);
    palinds.set(state.palinds);
    magicop = state.magicop;
    xpand = state.xpand;
    xplower = state.xplower;
    shift2 = state.shift2;
    horcb = state.horcb;
    inmod = state.inmod;
    inlin = state.inlin;
    infbk = state.infbk;
    verbl = state.verbl;
    rotcount = state.rotcount;
    rotdata.set(state.rotdata);
    intst = state.intst;
    inputs.set(state.inputs);
    refreshall();
  }
    
  this.saveState = () => {
    return {
      c: cpu.saveState(),
      ram: ram.slice(0),
      inputs: inputs.slice(0),
      palette: palette.slice(0),
      palinds: palinds.slice(0),
      magicop: magicop,
      xpand: xpand,
      xplower: xplower,
      shift2: shift2,
      horcb: horcb,
      inmod: inmod,
      inlin: inlin,
      infbk: infbk,
      verbl: verbl,
      rotcount: rotcount,
      rotdata: rotdata.slice(0),
      intst: intst
    };
  }
  this.reset = () => {
    // TODO?
    magicop = xpand = inmod = inlin = infbk = shift2 = horcb = 0;
    verbl = sheight;
    xplower = false;
    //watchdog_counter = INITIAL_WATCHDOG;
  }
  
  this.toLongString = (st) =>  {
    var s = "";
    //s += " Scan Y: " + st.sl;
    s += "\n  INLIN: " + st.inlin;
    s += "\n  VERBL: " + st.verbl;
    s += "\nMAGICOP: $" + hex(st.magicop);
    s += "\n  XPAND: $" + hex(st.xpand);
    s += "\nXPLOWER: " + st.xplower;
    s += "\n SHIFT2: $" + hex(st.shift2);
    s += "\n  HORCB: $" + hex(st.horcb);
    s += "\n  INMOD: $" + hex(st.inmod);
    s += "\n  INFBK: $" + hex(st.infbk);
    s += "\n  INTST: $" + hex(st.intst); // intercept status
    s += "\nPalette: ";
    for (var i = 0; i < 8; i++)
      s += hex(palinds[i]);
    s += "\n";
    return s;
  }
  
  this.connectVideo = function(pix) {
    pixels = pix;
  }
  this.loadROM = function(data) {
    rom = data;
  }
  this.loadBIOS = function(data) {
    bios = data;
  }
  this.getVisiblePixelWords = function() {
    return verbl * swidth;
  }
}

export class BallyAstrocade extends BasicScanlineMachine implements AcceptsPaddleInput {
  
  cpuFrequency = 1789000;
  numTotalScanlines = 262;
  numVisibleScanlines : number;
  cpuCyclesPerLine : number;
  defaultROMSize : number;
  canvasWidth : number;
  sampleRate = 60 * 262 * audioOversample;
  ram : Uint8Array;
  cpu : Z80;
  m; // _BallyAstrocade

  psg: AstrocadeAudio;
  audioadapter;
  backbuffer : Uint32Array;
  frontbuffer : Uint32Array;

  constructor(arcade:boolean) {
    super();
    this.cpu = new Z80();
    this.psg = new AstrocadeAudio(new MasterAudio());
    this.audioadapter = new TssChannelAdapter(this.psg.psg, audioOversample, this.sampleRate);
    this.handler = newKeyboardHandler(this.inputs, ASTROCADE_KEYCODE_MAP);
    this.defaultROMSize = arcade ? 0xb000 : 0x2000;
    this.ram = new Uint8Array(arcade ? 0x5000 : 0x1000);
    this.numVisibleScanlines = arcade ? 204 : 102;
    this.canvasWidth = arcade ? 320 : 160;
    this.cpuCyclesPerLine = (this.cpuFrequency / (60 * this.numVisibleScanlines * 1.286)) | 0;
    //this.cpuCyclesPerHBlank = Math.floor(this.cpuCyclesPerLine * 0.33);
    //this.cpuCyclesPerVisible = this.cpuCyclesPerLine - this.cpuCyclesPerHBlank;
    this.m = new _BallyAstrocade(arcade);
    this.m.init(this, this.cpu, this.ram, this.inputs, this.psg);
  }
  
  read(a:number) : number {
    return this.m.membus.read(a);
  }
  write(a:number, v:number) : void {
    this.m.membus.write(a,v);
  }
  
  connectVideo(pixels:Uint32Array) : void {
    super.connectVideo(pixels);
    this.frontbuffer = pixels;
    this.backbuffer = new Uint32Array(pixels.length);
    this.m.connectVideo(this.backbuffer);
  }
  preFrame() {
    this.m.resetWaitStates(0);
  }
  postFrame() {
    // copy back buffer to front buffer, omitting bottom non-visible pixels
    var nbytes = this.m.getVisiblePixelWords();
    this.frontbuffer.set(this.backbuffer.slice(0, nbytes), 0);
    this.frontbuffer.fill(0, nbytes);
  }

  setPaddleInput(controller:number, value:number) : void {
    switch (controller) {
      case 0: this.inputs[0x1c] = value & 0xff; break;
      case 1: this.inputs[0x1d] = value & 0xff; break;
    }
  }

  startScanline() {
    this.audio && this.audioadapter.generate(this.audio);
  }
  
  drawScanline() {
    var sl = this.scanline;
    this.m.drawScanline(sl);
    /*
    if (watchdog_counter-- <= 0) {
      console.log("WATCHDOG FIRED"); // TODO: alert on video
      this.reset();
    }
    */
  }

  advanceCPU() {
    var clk = super.advanceCPU();
    // TODO: disable 33% of the time (hblank)
    var xtra = this.m.resetWaitStates(this.scanline);
    if (xtra) {
      clk += xtra;
      this.probe.logClocks(xtra);
    }
    return clk;
  }

  loadROM(data) {
    super.loadROM(data);
    this.m.loadROM(this.rom);
    this.reset();
  }
  loadBIOS(data) {
    this.m.loadBIOS(padBytes(data, 0x2000));
    this.reset();
  }
  reset() {
    super.reset();
    this.m.reset();
  }
  loadState(state) {
    this.m.loadState(state);
  }
  saveState() {
    return this.m.saveState();
  }
  getDebugCategories() {
    return ['CPU','Stack','Astro'];
  }
  getDebugInfo(category, state) {
    switch (category) {
      case 'Astro': return this.m.toLongString(state);
    }
  }

}

/////

// TODO: https://github.com/mamedev/mame/blob/master/src/devices/sound/astrocde.cpp
class AstrocadeAudio extends AY38910_Audio {
  setACRegister(addr: number, val: number) {
    addr &= 0x7;
    val &= 0xff;
    switch (addr) {
      case 0:
        this.psg.setClock(1789000 * 16 / (val + 1));
        this.psg.writeRegisterAY(7, 0x7 ^ 0xff); // disable noise
        break;
      case 1:
      case 2:
      case 3:
        var i = (addr - 1) * 2;
        var j = val * 2 + 1;
        this.psg.writeRegisterAY(i, j & 0xff); // freq lo
        this.psg.writeRegisterAY(i + 1, (j >> 8) & 0xff); // freq hi
        break;
      case 5:
        this.psg.writeRegisterAY(10, val & 0xf); // tone c vol
        break;
      case 6:
        this.psg.writeRegisterAY(8, val & 0xf);	// tone a vol
        this.psg.writeRegisterAY(9, (val >> 4) & 0xf); // tone b vol
        break;
    }
  }
}

export const _BallyArcade = function() {
  this.__proto__ = new (_BallyAstrocade as any)(true);
  // TODO: inputs[0x13] = 0xfe; // dip switch on arcade
  // TODO: arcade controls, bit blit
  var _in = this.saveControlsState();
  _in.in[0x10] = 0xff; // switches
  _in.in[0x13] = 0xfe; // dip switches
  this.loadControlsState(_in);
}

/////

//http://glankonian.com/~lance/astrocade_palette.html
var ASTROCADE_PALETTE = [0x000000, 0x242424, 0x484848, 0x6D6D6D, 0x919191, 0xB6B6B6, 0xDADADA, 0xFFFFFF, 0x2500BB, 0x4900E0, 0x6E11FF, 0x9235FF, 0xB75AFF, 0xDB7EFF, 0xFFA3FF, 0xFFC7FF, 0x4900B0, 0x6D00D5, 0x9201F9, 0xB625FF, 0xDA4AFF, 0xFF6EFF, 0xFF92FF, 0xFFB7FF, 0x6A009F, 0x8E00C3, 0xB300E7, 0xD718FF, 0xFB3CFF, 0xFF61FF, 0xFF85FF, 0xFFA9FF, 0x870087, 0xAB00AB, 0xD000D0, 0xF40EF4, 0xFF32FF, 0xFF56FF, 0xFF7BFF, 0xFF9FFF, 0x9F006A, 0xC3008E, 0xE700B3, 0xFF07D7, 0xFF2CFB, 0xFF50FF, 0xFF74FF, 0xFF99FF, 0xB00049, 0xD5006D, 0xF90092, 0xFF05B6, 0xFF29DA, 0xFF4DFF, 0xFF72FF, 0xFF96FF, 0xBB0025, 0xE00049, 0xFF006E, 0xFF0692, 0xFF2AB7, 0xFF4FDB, 0xFF73FF, 0xFF98FF, 0xBF0000, 0xE30024, 0xFF0048, 0xFF0B6D, 0xFF3091, 0xFF54B6, 0xFF79DA, 0xFF9DFF, 0xBB0000, 0xE00000, 0xFF0023, 0xFF1447, 0xFF396C, 0xFF5D90, 0xFF82B5, 0xFFA6D9, 0xB00000, 0xD50000, 0xF90000, 0xFF2124, 0xFF4548, 0xFF6A6C, 0xFF8E91, 0xFFB3B5, 0x9F0000, 0xC30000, 0xE70C00, 0xFF3003, 0xFF5527, 0xFF794B, 0xFF9E70, 0xFFC294, 0x870000, 0xAB0000, 0xD01E00, 0xF44200, 0xFF670A, 0xFF8B2E, 0xFFAF53, 0xFFD477, 0x6A0000, 0x8E0D00, 0xB33100, 0xD75600, 0xFB7A00, 0xFF9E17, 0xFFC33B, 0xFFE75F, 0x490000, 0x6D2100, 0x924500, 0xB66A00, 0xDA8E00, 0xFFB305, 0xFFD729, 0xFFFC4E, 0x251100, 0x493500, 0x6E5A00, 0x927E00, 0xB7A300, 0xDBC700, 0xFFEB1E, 0xFFFF43, 0x002500, 0x244900, 0x486D00, 0x6D9200, 0x91B600, 0xB6DB00, 0xDAFF1B, 0xFFFF3F, 0x003700, 0x005B00, 0x238000, 0x47A400, 0x6CC900, 0x90ED00, 0xB5FF1E, 0xD9FF43, 0x004700, 0x006C00, 0x009000, 0x24B400, 0x48D900, 0x6CFD05, 0x91FF29, 0xB5FF4E, 0x005500, 0x007900, 0x009D00, 0x03C200, 0x27E600, 0x4BFF17, 0x70FF3B, 0x94FF5F, 0x005F00, 0x008300, 0x00A800, 0x00CC00, 0x0AF00A, 0x2EFF2E, 0x53FF53, 0x77FF77, 0x006500, 0x008A00, 0x00AE00, 0x00D203, 0x00F727, 0x17FF4B, 0x3BFF70, 0x5FFF94, 0x006800, 0x008C00, 0x00B100, 0x00D524, 0x00F948, 0x05FF6C, 0x29FF91, 0x4EFFB5, 0x006600, 0x008B00, 0x00AF23, 0x00D447, 0x00F86C, 0x00FF90, 0x1EFFB5, 0x43FFD9, 0x006100, 0x008524, 0x00AA48, 0x00CE6D, 0x00F391, 0x00FFB6, 0x1BFFDA, 0x3FFFFE, 0x005825, 0x007C49, 0x00A16E, 0x00C592, 0x00EAB7, 0x00FFDB, 0x1EFFFF, 0x43FFFF, 0x004B49, 0x00706D, 0x009492, 0x00B9B6, 0x00DDDA, 0x05FFFF, 0x29FFFF, 0x4EFFFF, 0x003C6A, 0x00608E, 0x0085B3, 0x00A9D7, 0x00CEFB, 0x17F2FF, 0x3BFFFF, 0x5FFFFF, 0x002A87, 0x004FAB, 0x0073D0, 0x0097F4, 0x0ABCFF, 0x2EE0FF, 0x53FFFF, 0x77FFFF, 0x00179F, 0x003BC3, 0x0060E7, 0x0384FF, 0x27A8FF, 0x4BCDFF, 0x70F1FF, 0x94FFFF, 0x0002B0, 0x0027D5, 0x004BF9, 0x2470FF, 0x4894FF, 0x6CB9FF, 0x91DDFF, 0xB5FFFF, 0x0000BB, 0x0013E0, 0x2337FF, 0x475BFF, 0x6C80FF, 0x90A4FF, 0xB5C9FF, 0xD9EDFF];
// swap palette RGB to BGR
for (var i = 0; i < 256; i++) {
  var x = ASTROCADE_PALETTE[i];
  ASTROCADE_PALETTE[i] = rgb2bgr(x) | 0xff000000;
}

/*
0000 F3            [ 4]  196 	DI	; disable interrupts
0001 21 00 20      [10]  197 	LD	HL,#0x2000
0004 7E            [ 7]  198 	LD	A,(HL) ; A <- mem[0x2000]
0005 FE 55         [ 7]  199 	CP	#0x55 ; found sentinel byte? ($55)
0007 CA 0D 00      [10]  200 	JP	Z,FoundSentinel ; yes, load program
000A C3 00 20      [10]  201 	JP	_main ; jump to test program
000D                     202 	FoundSentinel:
000D 31 CE 4F      [10]  203 	LD	SP,#0x4fce ; position stack below BIOS vars
0010 CD 84 02      [17]  204 	CALL	_bios_init ; misc. bios init routines
0013 21 05 20      [10]  205 	LD	HL,#0x2005 ; cartridge start vector
0016 7E            [ 7]  206 	LD	A,(HL)
0017 23            [ 6]  207 	INC	HL
0018 66            [ 7]  208 	LD	H,(HL)
0019 6F            [ 4]  209 	LD	L,A
001A E9            [ 4]  210 	JP	(HL) ; jump to cart start vector
*/
var ASTROCADE_MINIMAL_BIOS = [
  0xf3, 0x21, 0x00, 0x20, 0x7e, 0xfe, 0x55, 0xca, 0x0d, 0x00, 0xc3, 0x00, 0x20,
  0x31, 0xce, 0x4f,
  0x21, 0x05, 0x20, 0x7e, 0x23, 0x66, 0x6f,
  0xe9,
];

var ASTROLIBRE_BIOS_LZG = `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`;

