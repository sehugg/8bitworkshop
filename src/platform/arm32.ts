/*
 * Copyright (c) 2024 Steven E. Hugg
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Platform, DisasmLine, Machine, BaseMachinePlatform } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { loadScript } from "../common/util";
import { ARM32Machine } from "../machine/arm32";

declare var cs : any; // Unicorn module

const ARM32_PRESETS = [
  { id: 'vidfill.c', name: 'Video Memory Fill' },
];

export abstract class BaseARMMachinePlatform<T extends Machine> extends BaseMachinePlatform<T> {

    //getOpcodeMetadata     = getOpcodeMetadata_z80;
    getToolForFilename(fn: string)  {
      fn = fn.toLowerCase();
      if (fn.endsWith('.vasm')) return "vasmarm";
      if (fn.endsWith('.armips')) return "armips";
      if (fn.endsWith('.c')) return "armtcc";
      if (fn.endsWith('.s')) return "armtcc";
      return "armtcc";
    }
    getPresets()          { return ARM32_PRESETS; }
    getDefaultExtension() { return ".c"; };
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
    {name:'ROM',start:0x0000000,size:0x100000,type:'ram'},
    {name:'I/O',start:0x4000000,size:0x100,type:'io'},
  ] } };
  getPlatformName()     { return "ARM7"; }
  getDebugTree() {
    return {
      ...this.machine.cpu.getDebugTree(),
      dwarf: this.debugSymbols.debuginfo
    }
  }
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
