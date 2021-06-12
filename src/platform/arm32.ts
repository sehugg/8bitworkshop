
import { BaseDebugPlatform, CpuState, EmuState, Platform, DisasmLine, Debuggable, Machine, BaseMachinePlatform } from "../common/baseplatform";
import { AnimationTimer, EmuHalt, padBytes, PLATFORMS, RasterVideo } from "../common/emu";
import { loadScript } from "../ide/ui";
import { hex, lpad } from "../common/util";
import { ARM32CPU } from "../common/cpu/ARM";
import { ARM32Machine } from "../machine/arm32";

declare var uc, cs : any; // Unicorn module

const ARM32_PRESETS = [
  { id: 'vidfill.vasm', name: 'Video Memory Fill' },
];

const SCREEN_WIDTH = 160;
const SCREEN_HEIGHT = 128;
const ROM_START_ADDR = 0x0;
const HIROM_START_ADDR = 0xff800000;
const ROM_SIZE = 512*1024;
const RAM_START_ADDR = 0x20000000;
const RAM_SIZE = 512*1024;
const CLOCKS_PER_FRAME = 10000;

interface ARM32State extends EmuState {
  r: Uint32Array; // registers
}

class ARM32UnicornPlatform extends BaseDebugPlatform implements Platform, Debuggable {

  u : any; // Unicorn
  d : any; // Capstone
  mainElement : HTMLElement;
  video : RasterVideo;
  timer : AnimationTimer;
  romSize = 0;
  halted = false;
  state : ARM32State;
  cpu : ARM32CPU;

  constructor(mainElement: HTMLElement) {
    super();
    this.mainElement = mainElement;
  }
  getPresets() { return ARM32_PRESETS };
  
  async start() {
    console.log("Loading Unicorn/Capstone");
    await loadScript('./lib/unicorn-arm.min.js');
    await loadScript('./lib/capstone-arm.min.js');

    this.cpu = new ARM32CPU();

    this.u = new uc.Unicorn(uc.ARCH_ARM, uc.MODE_ARM);
    this.u.mem_map(ROM_START_ADDR, ROM_SIZE, uc.PROT_READ | uc.PROT_EXEC);
    this.u.mem_map(HIROM_START_ADDR, ROM_SIZE, uc.PROT_READ | uc.PROT_EXEC);
    this.u.mem_map(RAM_START_ADDR, RAM_SIZE, uc.PROT_READ | uc.PROT_WRITE | uc.PROT_EXEC);
    
    this.d = new cs.Capstone(cs.ARCH_ARM, cs.MODE_ARM);

    this.video = new RasterVideo(this.mainElement, SCREEN_WIDTH, SCREEN_HEIGHT);
    this.video.create();

    this.timer = new AnimationTimer(60, this.nextFrame.bind(this));
  }
  reset() {
    this.cpu.reset();
    this.u.reg_write_i32(uc.ARM_REG_PC, 0);
    var cpsr = this.u.reg_read_i32(uc.ARM_REG_CPSR);
    this.u.reg_write_i32(uc.ARM_REG_CPSR, (cpsr & 0xffffff00) | 0b11010011);
    this.u.mem_write(RAM_START_ADDR, new Uint8Array(RAM_SIZE)); // clear RAM
    this.halted = false;
    this.state = null;
  }
  pause(): void {
    this.timer.stop();
  }
  resume(): void {
    this.timer.start();
    console.log('resume')
  }
  isRunning() {
    return this.timer.isRunning();
  }
  isBlocked() {
    return this.halted;
  }
  checkPCOverflow(pc) {

  }
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    try {
      var b = this.u.mem_read(pc, 4);
      var insns = this.d.disasm(b, pc, 4);
      var i0 = insns[0];
      return {
        nbytes: i0.size,
        line: i0.mnemonic + " " + i0.op_str,
        isaddr: i0.address > 0
      };
    } catch (e) {
      return {
        nbytes: 4,
        line: "???",
        isaddr: false
      };
    }
  }
  advance(novideo?: boolean): number {
    this.state = null;
    var pc = this.getPC();
    var endpc = this.romSize;
    if (pc >= endpc) {
      this.halted = true;
      this.haltAndCatchFire("ROM overrun at PC 0x" + hex(pc));
      this.pause();
      return 1;
    }
    var debugCond = this.getDebugCallback();
    try {
      if (debugCond != null) {
        for (var i=0; i<CLOCKS_PER_FRAME && pc <= endpc; i++) {
          if (debugCond()) {
            break;
          }
          this.u.emu_start(pc, endpc, 0, 1);
          pc = this.getPC();
        }
      } else {
        this.u.emu_start(pc, endpc, 0, CLOCKS_PER_FRAME); // TODO
      }
    } catch (e) {
      throw new EmuHalt(e + " at PC=0x" + hex(this.getPC()));
    }
    if (!novideo) {
      this.updateVideo();
    }
    return CLOCKS_PER_FRAME; //throw new Error("Method not implemented.");
  }
  updateVideo() {
    var vmem8 : Uint8Array = this.u.mem_read(RAM_START_ADDR, SCREEN_WIDTH * SCREEN_HEIGHT * 4);
    var vmem32 = new Uint32Array(vmem8.buffer);
    var pixels = this.video.getFrameData();
    for (var i=0; i<vmem32.length; i++)
      pixels[i] = vmem32[i] | 0xff000000;
    this.video.updateFrame();
  }
  getToolForFilename() {
    return "vasmarm";
  }
  getDefaultExtension() {
    return ".asm";
  }
  loadROM(title, data: Uint8Array) {
    this.romSize = data.length;
    data = padBytes(data, ROM_SIZE);
    this.u.mem_write(ROM_START_ADDR, data);
    this.u.mem_write(HIROM_START_ADDR, data);
    this.state = null;
    this.reset();
  }
  readAddress(addr: number) {
    // TODO: slow
    try {
      return this.u.mem_read(addr, 1)[0];
    } catch (e) {
      return 0;
    }
  }
  getCPUState(): CpuState {
    return {
      PC: this.getPC(),
      SP: this.getSP(),
    };
  }
  isStable(): boolean {
    return true;
  }
  getPC() {
    return this.u.reg_read_i32(uc.ARM_REG_PC);
  }
  getSP() {
    return this.u.reg_read_i32(uc.ARM_REG_SP);
  }
  loadState(state: ARM32State): void {
    for (var i=0; i<uc.ARM_REG_ENDING; i++) {
      this.u.reg_write_i32(i, state.r[i]);
    }
    this.u.mem_write(RAM_START_ADDR, state.b);
  }
  saveState(): ARM32State {
    var regs = new Uint32Array(uc.ARM_REG_ENDING);
    for (var i=0; i<uc.ARM_REG_ENDING; i++) {
      regs[i] = this.u.reg_read_i32(i);
    }
    this.state = {
      c: this.getCPUState(),
      b: this.u.mem_read(RAM_START_ADDR, RAM_SIZE),
      r: regs
    };
    return this.state;
  }
  showHelp(tool: string) {
    if (tool == 'vasmarm') {
      window.open('http://sun.hasenbraten.de/vasm/release/vasm.html');
    }
  }
  getDebugCategories() {
    return ["CPU"];
  }
  getDebugInfo?(category:string, state:ARM32State) : string {
    var s = '';
    for (var i=0; i<13; i++) {
      s += lpad('r'+i, 3) + '  ' + hex(state.r[i+uc.ARM_REG_R0],8) + '\n';
    }
    s += ' SP  ' + hex(state.r[uc.ARM_REG_SP],8) + '\n';
    s += ' LR  ' + hex(state.r[uc.ARM_REG_LR],8) + '\n';
    s += ' PC  ' + hex(state.r[uc.ARM_REG_PC],8) + '\n';
    s += 'CPSR ' + hex(state.r[uc.ARM_REG_CPSR],8) + '\n';
    return s;
  }
}

////

export abstract class BaseARMMachinePlatform<T extends Machine> extends BaseMachinePlatform<T> {

    //getOpcodeMetadata     = getOpcodeMetadata_z80;
    getToolForFilename(fn: string)  {
      if (fn.endsWith('.vasm')) return "vasmarm";
      else if (fn.endsWith('.armips')) return "armips";
      else return "vasmarm";
    }
    getPresets()          { return ARM32_PRESETS; }
    getDefaultExtension() { return ".vasm"; };
    
  }
  
class ARM32Platform extends BaseARMMachinePlatform<ARM32Machine> implements Platform {

  capstone_arm : any;
  capstone_thumb : any;

  async start() {
    super.start();
    console.log("Loading Capstone");
    await loadScript('./lib/capstone-arm.min.js');
    this.capstone_arm = new cs.Capstone(cs.ARCH_ARM, cs.MODE_ARM);
    this.capstone_thumb = new cs.Capstone(cs.ARCH_ARM, cs.MODE_THUMB);
  }

  newMachine()          { return new ARM32Machine(); }
  readAddress(a)        { return this.machine.read(a); }
  getMemoryMap = function() { return { main:[
    {name:'ROM',start:0x0000000,size:0x80000,type:'rom'},
    {name:'RAM',start:0x2000000,size:0x80000,type:'ram'},
  ] } };
  disassemble(pc:number, read:(addr:number)=>number) : DisasmLine {
    var is_thumb = this.machine.cpu.isThumb();
    var capstone = is_thumb ? this.capstone_thumb : this.capstone_arm;
    var buf = [];
    for (var i=0; i<4; i++) {
      buf[i] = read(pc+i);
    }
    var insns = capstone.disasm(buf, pc, 4);
    var i0 = insns && insns[0];
    if (i0) {
      return {
        nbytes: i0.size,
        line: i0.mnemonic + " " + i0.op_str,
        isaddr: i0.address > 0
      };
    } else {
      return {
        nbytes: 4,
        line: "???",
        isaddr: false
      };
    }
  }
}

////

PLATFORMS['arm32.u'] = ARM32UnicornPlatform;
PLATFORMS['arm32'] = ARM32Platform;
