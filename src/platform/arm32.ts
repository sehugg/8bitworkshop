
import { BaseDebugPlatform, CpuState, EmuState, Platform, DisasmLine, Debuggable, Machine, BaseMachinePlatform } from "../common/baseplatform";
import { AnimationTimer, EmuHalt, padBytes, PLATFORMS, RasterVideo } from "../common/emu";
import { hex, lpad, loadScript } from "../common/util";
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
    {name:'I/O',start:0x4000000,size:0x100,type:'io'},
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

PLATFORMS['arm32'] = ARM32Platform;
