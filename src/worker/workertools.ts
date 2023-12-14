
import * as misc from './tools/misc'
import * as cc65 from './tools/cc65'
import * as dasm from './tools/dasm'
import * as sdcc from './tools/sdcc'
import * as verilog from './tools/verilog'
import * as m6809 from './tools/m6809'
import * as m6502 from './tools/m6502'
import * as z80 from './tools/z80'
import * as x86 from './tools/x86'
import * as arm from './tools/arm'
import * as ecs from './tools/ecs'
import * as remote from './tools/remote'
import * as acme from './tools/acme'
import * as cc7800 from './tools/cc7800'
import * as bataribasic from './tools/bataribasic'
import { PLATFORM_PARAMS } from "./platforms";

export const TOOLS = {
  'dasm': dasm.assembleDASM,
  'acme': acme.assembleACME,
  'cc65': cc65.compileCC65,
  'ca65': cc65.assembleCA65,
  'ld65': cc65.linkLD65,
  //'z80asm': assembleZ80ASM,
  //'sccz80': compileSCCZ80,
  'sdasz80': sdcc.assembleSDASZ80,
  'sdldz80': sdcc.linkSDLDZ80,
  'sdcc': sdcc.compileSDCC,
  'xasm6809': m6809.assembleXASM6809,
  'cmoc': m6809.compileCMOC,
  'lwasm': m6809.assembleLWASM,
  'lwlink': m6809.linkLWLINK,
  //'naken': assembleNAKEN,
  'verilator': verilog.compileVerilator,
  'yosys': verilog.compileYosys,
  'jsasm': verilog.compileJSASMStep,
  'zmac': z80.assembleZMAC,
  'nesasm': m6502.assembleNESASM,
  'smlrc': x86.compileSmallerC,
  'yasm': x86.assembleYASM,
  'bataribasic': bataribasic.compileBatariBasic,
  'markdown': misc.translateShowdown,
  'inform6': misc.compileInform6,
  'merlin32': m6502.assembleMerlin32,
  'fastbasic': m6502.compileFastBasic,
  'basic': misc.compileBASIC,
  'silice': verilog.compileSilice,
  'wiz': misc.compileWiz,
  'armips': arm.assembleARMIPS,
  'vasmarm': arm.assembleVASMARM,
  'ecs': ecs.assembleECS,
  'remote': remote.buildRemote,
  'cc7800': cc7800.compileCC7800,
}

export const TOOL_PRELOADFS = {
  'cc65-apple2': '65-apple2',
  'ca65-apple2': '65-apple2',
  'cc65-c64': '65-c64',
  'ca65-c64': '65-c64',
  'cc65-vic20': '65-vic20',
  'ca65-vic20': '65-vic20',
  'cc65-nes': '65-nes',
  'ca65-nes': '65-nes',
  'cc65-atari8': '65-atari8',
  'ca65-atari8': '65-atari8',
  'cc65-vector': '65-none',
  'ca65-vector': '65-none',
  'cc65-atari7800': '65-none',
  'ca65-atari7800': '65-none',
  'cc65-devel': '65-none',
  'ca65-devel': '65-none',
  'cc65-vcs': '65-atari2600',
  'ca65-vcs': '65-atari2600',
  'cc65-pce': '65-pce',
  'ca65-pce': '65-pce',
  'cc65-exidy': '65-none',
  'ca65-exidy': '65-none',
  'sdasz80': 'sdcc',
  'sdcc': 'sdcc',
  'sccz80': 'sccz80',
  'bataribasic': '2600basic',
  'inform6': 'inform',
  'fastbasic': '65-atari8',
  'silice': 'Silice',
  'wiz': 'wiz',
  'ecs-vcs': '65-atari2600', // TODO: support multiple platforms
  'ecs-nes': '65-nes', // TODO: support multiple platforms
  'ecs-c64': '65-c64', // TODO: support multiple platforms
}

