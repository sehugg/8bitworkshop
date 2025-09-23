"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_PRELOADFS = exports.TOOLS = void 0;
const misc = __importStar(require("./tools/misc"));
const cc65 = __importStar(require("./tools/cc65"));
const dasm = __importStar(require("./tools/dasm"));
const sdcc = __importStar(require("./tools/sdcc"));
const verilog = __importStar(require("./tools/verilog"));
const m6809 = __importStar(require("./tools/m6809"));
const m6502 = __importStar(require("./tools/m6502"));
const z80 = __importStar(require("./tools/z80"));
const x86 = __importStar(require("./tools/x86"));
const arm = __importStar(require("./tools/arm"));
const ecs = __importStar(require("./tools/ecs"));
const remote = __importStar(require("./tools/remote"));
const acme = __importStar(require("./tools/acme"));
const cc7800 = __importStar(require("./tools/cc7800"));
const cc2600 = __importStar(require("./tools/cc2600"));
const bataribasic = __importStar(require("./tools/bataribasic"));
const oscar64 = __importStar(require("./tools/oscar64"));
exports.TOOLS = {
    'dasm': dasm.assembleDASM,
    'acme': acme.assembleACME,
    'cc65': cc65.compileCC65,
    'ca65': cc65.assembleCA65,
    'ld65': cc65.linkLD65,
    //'z80asm': assembleZ80ASM,
    //'sccz80': compileSCCZ80,
    'sdasz80': sdcc.assembleSDASZ80,
    'sdasgb': sdcc.assembleSDASGB,
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
    'cc2600': cc2600.compilecc2600,
    'armtcc': arm.compileARMTCC,
    'armtcclink': arm.linkARMTCC,
    'oscar64': oscar64.compileOscar64,
};
exports.TOOL_PRELOADFS = {
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
    'sdasgb': 'sdcc',
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
};
//# sourceMappingURL=workertools.js.map