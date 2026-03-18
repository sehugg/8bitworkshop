// based on https://github.com/mamedev/mame/blob/master/src/devices/cpu/f8/f8.cpp
// license:BSD-3-Clause
// copyright-holders:Juergen Buchmueller
// and https://raw.githubusercontent.com/mamedev/mame/master/src/mame/fairchild/channelf.cpp
// license:GPL-2.0+
// copyright-holders:Juergen Buchmueller, Frank Palazzolo, Sean Riddle

import { Platform, BaseMachinePlatform, DisasmLine } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { ChannelF } from "../machine/channelf";
import { disassembleF8 } from "../common/cpu/disasmF8";
import { hex, printFlags } from "../common/util";

var CHANNELF_PRESETS = [
  { id: 'hello.dasm', name: 'Hello World (ASM)' },
];

function cpuStateToLongString_F8(c): string {
  return "PC0 = " + hex(c.PC0, 4) + "  PC1 = " + hex(c.PC1, 4) + "\n"
    + "DC0 = " + hex(c.DC0, 4) + "  DC1 = " + hex(c.DC1, 4) + "\n"
    + " A  = " + hex(c.A, 2) + "    W   = " + hex(c.W, 2) + "\n"
    + " IS = " + hex(c.IS, 2) + "\n"
    + printFlags(c.W, ['S', 'C', 'Z', 'O', 'I'], true) + "\n"
    + "  R0-R3: " + c.R.slice(0, 4).map(v => hex(v, 2)).join(' ') + "\n"
    + "  R4-R7: " + c.R.slice(4, 8).map(v => hex(v, 2)).join(' ') + "\n"
    + " R8/J/H: " + c.R.slice(8, 12).map(v => hex(v, 2)).join(' ') + "\n"
    + "  K/Q:   " + c.R.slice(12, 16).map(v => hex(v, 2)).join(' ') + "\n";
}

class ChannelFPlatform extends BaseMachinePlatform<ChannelF> implements Platform {

  newMachine() { return new ChannelF(); }
  getPresets() { return CHANNELF_PRESETS; }
  getDefaultExtensions() { return [".dasm"]; }
  getToolForFilename(fn: string): string {
    if (fn.endsWith(".c")) return "cc65";
    if (fn.endsWith(".s") || fn.endsWith(".ca65")) return "ca65";
    return "dasm";
  }
  readAddress(a) { return this.machine.readConst(a); }

  disassemble(pc: number, read: (addr: number) => number): DisasmLine {
    return disassembleF8(pc, read(pc), read(pc + 1), read(pc + 2));
  }

  getDebugCategories() {
    return ['CPU', 'I/O', 'VRAM'];
  }

  getDebugInfo(category: string, state): string {
    switch (category) {
      case 'CPU': return cpuStateToLongString_F8(state.c);
      case 'I/O':
        return "Port 0: " + hex(state.port0 || 0, 2) + "\n"
          + "Port 1: " + hex(state.port1 || 0, 2) + "\n"
          + "Port 4: " + hex(state.port4 || 0, 2) + "\n"
          + "Port 5: " + hex(state.port5 || 0, 2) + "\n"
          + "Row:    " + hex(state.row_reg || 0, 2) + "\n"
          + "Col:    " + hex(state.col_reg || 0, 2) + "\n";
      case 'VRAM': return '';
      default: return '';
    }
  }

  getMemoryMap() {
    return {
      main: [
        { name: 'BIOS', start: 0x0000, size: 0x0800, type: 'rom' },
        { name: 'Cart ROM', start: 0x0800, size: 0x7800, type: 'rom' },
      ]
    };
  }
}

PLATFORMS['channelf'] = ChannelFPlatform;
