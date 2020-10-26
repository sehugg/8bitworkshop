
import { Platform } from "../common/baseplatform";
import { EmuHalt, PLATFORMS } from "../common/emu";
import { Devel6502 } from "../machine/devel";
import { Base6502MachinePlatform } from "../common/baseplatform";
import { SerialIOInterface } from "../common/devices";
import { byteArrayToString, convertDataToUint8Array, hex } from "../common/util";
import { TeleType } from "../common/teletype";
import { haltEmulation, loadScript } from "../ide/ui";

var DEVEL_6502_PRESETS = [
  {id:'hello.dasm', name:'Hello World (ASM)'},
];

class SerialInOutViewer {
  div : HTMLElement;
  tty : TeleType;
  
  constructor(div: HTMLElement) {
    div.style.overflowY = 'auto';
    var gameport = $('<div id="gameport"/>').appendTo(div);
    $('<p class="transcript-header">Serial Output</p>').appendTo(gameport);
    var windowport = $('<div id="windowport" class="transcript"/>').appendTo(gameport);
    this.div = windowport[0];
  }
  start() {
    this.tty = new TeleType(this.div, false);
    //this.tty.ncols = 40;
  }
  reset() {
    this.tty.clear();
  }
  saveState() {
    return this.tty.saveState();
  }
  loadState(state) {
    this.tty.loadState(state);
  }
}

function byteToASCII(b: number) : string {
  if (b == 10) return '';
  if (b < 32)
    return String.fromCharCode(b + 0x2400);
  else
    return String.fromCharCode(b);
}

export class SerialTestHarness implements SerialIOInterface {

  viewer : SerialInOutViewer;
  bufferedRead : boolean = true;
  cyclesPerByte = 1000000/(57600/8); // 138.88888 cycles
  maxOutputBytes = 4096;
  inputBytes : Uint8Array;

  outputBytes : number[];
  inputIndex : number;
  clk : number;
  bufin : string;

  clearToSend(): boolean {
    return this.outputBytes.length < this.maxOutputBytes;
  }
  sendByte(b: number) {
    if (this.clearToSend()) {
      this.outputBytes.push(b);
      this.viewer.tty.addtext(byteToASCII(b), 2|32);
      if (b == 10) this.viewer.tty.newline();
      if (!this.clearToSend()) {
        this.viewer.tty.newline();
        this.viewer.tty.addtext("⚠️ OUTPUT BUFFER FULL ⚠️", 4);
      }
    }
  }
  byteAvailable(): boolean {
    return this.readIndex() > this.inputIndex;
  }
  recvByte(): number {
    var index = this.readIndex();
    this.inputIndex = index;
    var b = (this.inputBytes && this.inputBytes[index]) | 0;
    //this.bufin += byteToASCII(b);
    this.viewer.tty.addtext(byteToASCII(b), 2|16);
    if (b == 10) this.viewer.tty.newline();
    return b;
  }
  readIndex(): number {
    return this.bufferedRead ? (this.inputIndex+1) : Math.floor(this.clk / this.cyclesPerByte);
  }

  reset() {
    this.inputIndex = -1;
    this.clk = 0;
    this.outputBytes = [];
    this.bufin = '';
  }

  advance(clocks: number) {
    this.clk += clocks;
  }

  saveState() {
    return {
      clk: this.clk,
      idx: this.inputIndex,
      out: this.outputBytes.slice()
    }
  }
  loadState(state) {
    this.clk = state.clk;
    this.inputIndex = state.idx;
    this.outputBytes = state.out.slice();
  }
}

class Devel6502Platform extends Base6502MachinePlatform<Devel6502> implements Platform {

  serial : SerialTestHarness;
  serview : SerialInOutViewer;

  constructor(mainElement: HTMLElement) {
    super(mainElement);
    this.serview = new SerialInOutViewer(mainElement);
  }

  async start() {
    super.start();
    await loadScript('./gen/common/teletype.js');
    this.serial = new SerialTestHarness();
    this.serial.viewer = this.serview;
    this.serview.start();
    this.machine.connectSerialIO(this.serial);
  }

  reset() {
    this.serial.inputBytes = convertDataToUint8Array(this.internalFiles['serialin.dat']);
    super.reset();
    this.serview.reset();
  }

  isBlocked() {
    return this.machine.isHalted();
  }

  advance(novideo: boolean) {
    if (this.isBlocked()) {
      this.internalFiles['serialout.dat'] = byteArrayToString(this.serial.outputBytes);
      haltEmulation();
      return 0;
    }
    return super.advance(novideo);
  }

  saveState() {
    var state : any = super.saveState();
    state.serial = this.serial.saveState();
    state.serview = this.serview.saveState();
    return state;
  }

  loadState(state) {
    super.loadState(state);
    this.serial.loadState(state.serial);
    this.serview.loadState(state.serview);
    // TODO: reload tty UI
  }

  newMachine()          { return new Devel6502(); }
  getPresets()          { return DEVEL_6502_PRESETS; }
  getDefaultExtension() { return ".dasm"; };
  readAddress(a)        { return this.machine.readConst(a); }

  getMemoryMap = function() { return { main:[
      {name:'RAM',          start:0x0000,size:0x4000,type:'ram'},
      {name:'ROM',          start:0x8000,size:0x8000,type:'rom'},
  ] } };
}

///

PLATFORMS['devel-6502'] = Devel6502Platform;
