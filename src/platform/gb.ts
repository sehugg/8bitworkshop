import { GameBoyMachine } from "../machine/gb";
import { BaseMachinePlatform, cpuStateToLongString_SM83, getToolForFilename_z80, Platform, Preset, dumpStackToString, isDebuggable, EmuState, DisasmLine } from "../common/baseplatform";
import { PLATFORMS } from "../common/emu";
import { disassembleSM83 } from "../common/cpu/disasmSM83";

const GB_PRESETS: Preset[] = [
  { id: 'hello.c', name: 'Hello World (C)' },
  { id: 'testdrawing.c', name: 'Drawing Routines (C)' },
  { id: 'testphys.c', name: 'Sprite Test (C)' },
  { id: 'hello.sgb', name: 'Hello World (ASM)' },
  { id: 'main.wiz', name: 'Snake Game (Wiz)' },
];

class GameBoyPlatform extends BaseMachinePlatform<GameBoyMachine> implements Platform {

  newMachine()          { return new GameBoyMachine(); }
  getPresets()          { return GB_PRESETS; }
  getDefaultExtensions() { return [".c", ".ns", ".s", ".scc", ".sgb", ".z", ".wiz"]; }
  getToolForFilename    = getToolForFilename_z80;
  readAddress(a)        { return this.machine.read(a); }
  readVRAMAddress(a)    { return this.machine.readVRAMAddress(a); }

  getOriginPC() {
    return 0x100;
  }

  getROMExtension() {
    return ".gb";
  }

  getMemoryMap() {
    return {
      main: [
        { name: 'ROM Bank 0', start: 0x0000, size: 0x4000, type: 'rom' },
        { name: 'ROM Bank 1+', start: 0x4000, size: 0x4000, type: 'rom' },
        { name: 'Video RAM', start: 0x8000, size: 0x2000, type: 'ram' },
        { name: 'External RAM', start: 0xA000, size: 0x2000, type: 'ram' },
        { name: 'Work RAM', start: 0xC000, size: 0x2000, type: 'ram' },
        { name: 'OAM', start: 0xFE00, size: 0xA0, type: 'ram' },
        { name: 'I/O Registers', start: 0xFF00, size: 0x80, type: 'io' },
        { name: 'High RAM', start: 0xFF80, size: 0x7F, type: 'ram' },
      ]
    };
  }

  getDebugCategories() {
    if (isDebuggable(this.machine))
      return this.machine.getDebugCategories();
    else
      return ['CPU', 'Stack', 'PPU'];
  }

  getDebugInfo(category: string, state: EmuState): string {
    switch (category) {
      case 'CPU': return cpuStateToLongString_SM83(state.c);
      case 'Stack': {
        var sp = (state.c.SP - 1) & 0xFFFF;
        var start = sp & 0xFF00;
        var end = start + 0xFF;
        if (sp == 0) sp = 0x10000;
        return dumpStackToString(<Platform><any>this, [], start, end, sp, 0xCD);
      }
      default: return isDebuggable(this.machine) && this.machine.getDebugInfo(category, state);
    }
  }

  disassemble(pc: number, read: (addr: number) => number): DisasmLine {
    return disassembleSM83(pc, read(pc), read(pc + 1), read(pc + 2));
  }

  showHelp() {
    return "https://8bitworkshop.com/docs/platforms/gameboy/";
  }
}

PLATFORMS['gb'] = GameBoyPlatform;
PLATFORMS['gameboy'] = GameBoyPlatform;