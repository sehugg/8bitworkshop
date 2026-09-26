"use strict";
// toolselect - which tool builds a file, by platform and filename.
// The one table the IDE's platform objects, the CLI, and the VS Code
// extension all use. Keep this module free of emulator imports so build-only
// code can use it without pulling in CPU cores.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToolForFilename_6502 = getToolForFilename_6502;
exports.getToolForFilename_z80 = getToolForFilename_z80;
exports.getToolForFilename_6809 = getToolForFilename_6809;
exports.getToolForFilename_arm32 = getToolForFilename_arm32;
exports.getToolForFilename_vcs = getToolForFilename_vcs;
exports.getToolForFilename_atari7800 = getToolForFilename_atari7800;
exports.getToolForFilename_atari8 = getToolForFilename_atari8;
exports.getToolForFilename_apple2 = getToolForFilename_apple2;
exports.getToolForFilename_nes = getToolForFilename_nes;
exports.getToolForFilename_channelf = getToolForFilename_channelf;
exports.getToolForFilename_verilog = getToolForFilename_verilog;
exports.getToolForFilename_x86 = getToolForFilename_x86;
exports.getToolForFilename_zmachine = getToolForFilename_zmachine;
exports.getToolForFilename_basic = getToolForFilename_basic;
exports.getToolSelector = getToolSelector;
exports.getToolForPlatform = getToolForPlatform;
const util_1 = require("./util");
////// per architecture
function getToolForFilename_6502(fn) {
    if (fn.endsWith("-llvm.c"))
        return "remote:llvm-mos";
    if (fn.endsWith(".c"))
        return "cc65";
    if (fn.endsWith(".h"))
        return "cc65";
    if (fn.endsWith(".s"))
        return "ca65";
    if (fn.endsWith(".ca65"))
        return "ca65";
    if (fn.endsWith(".dasm"))
        return "dasm";
    if (fn.endsWith(".bb"))
        return "bataribasic";
    if (fn.endsWith(".acme"))
        return "acme";
    if (fn.endsWith(".xa"))
        return "xa";
    if (fn.endsWith(".wiz"))
        return "wiz";
    if (fn.endsWith(".ecs"))
        return "ecs";
    if (fn.endsWith(".cpp"))
        return "oscar64";
    if (fn.endsWith(".cc"))
        return "oscar64";
    if (fn.endsWith(".o64"))
        return "oscar64";
    return "dasm"; // .a
}
function getToolForFilename_z80(fn) {
    if (fn.endsWith(".c"))
        return "sdcc";
    if (fn.endsWith(".h"))
        return "sdcc";
    if (fn.endsWith(".s"))
        return "sdasz80";
    if (fn.endsWith(".sgb"))
        return "sdasgb";
    if (fn.endsWith(".ns"))
        return "naken";
    if (fn.endsWith(".scc"))
        return "sccz80";
    if (fn.endsWith(".z"))
        return "zmac";
    if (fn.endsWith(".wiz"))
        return "wiz";
    return "zmac";
}
function getToolForFilename_6809(fn) {
    if (fn.endsWith(".c"))
        return "cmoc";
    if (fn.endsWith(".h"))
        return "cmoc";
    if (fn.endsWith(".xasm"))
        return "xasm6809";
    if (fn.endsWith(".lwasm"))
        return "lwasm";
    return "cmoc";
}
function getToolForFilename_arm32(fn) {
    fn = fn.toLowerCase();
    if (fn.endsWith(".vasm"))
        return "vasmarm";
    if (fn.endsWith(".armips"))
        return "armips";
    return "armtcc";
}
////// per platform
function getToolForFilename_vcs(fn) {
    if (fn.endsWith(".cc2600"))
        return "cc2600";
    if (fn.endsWith("-llvm.c"))
        return "remote:llvm-mos";
    if (fn.endsWith(".wiz"))
        return "wiz";
    if (fn.endsWith(".bb") || fn.endsWith(".bas"))
        return "bataribasic";
    if (fn.endsWith(".ca65"))
        return "ca65";
    if (fn.endsWith(".acme"))
        return "acme";
    //if (fn.endsWith(".inc")) return "ca65";
    if (fn.endsWith(".c"))
        return "cc65";
    //if (fn.endsWith(".h")) return "cc65";
    if (fn.endsWith(".ecs"))
        return "ecs";
    return "dasm";
}
function getToolForFilename_atari7800(fn) {
    if (fn.endsWith(".cc7800"))
        return "cc7800";
    if (fn.endsWith(".c78"))
        return "cc7800";
    return getToolForFilename_6502(fn);
}
function getToolForFilename_atari8(fn) {
    if (fn.endsWith(".bas") || fn.endsWith(".fb") || fn.endsWith(".fbi"))
        return "fastbasic";
    return getToolForFilename_6502(fn);
}
function getToolForFilename_apple2(fn) {
    if (fn.endsWith(".lnk"))
        return "merlin32";
    return getToolForFilename_6502(fn);
}
function getToolForFilename_nes(fn) {
    //if (fn.endsWith(".asm")) return "ca65"; // .asm uses ca65
    if (fn.endsWith(".nesasm"))
        return "nesasm";
    return getToolForFilename_6502(fn);
}
function getToolForFilename_channelf(fn) {
    if (fn.endsWith(".c"))
        return "cc65";
    if (fn.endsWith(".s") || fn.endsWith(".ca65"))
        return "ca65";
    return "dasm";
}
function getToolForFilename_verilog(fn) {
    if (fn.endsWith(".asm"))
        return "jsasm";
    if (fn.endsWith(".ice"))
        return "silice";
    return "verilator";
}
function getToolForFilename_x86(fn) {
    if (fn.endsWith(".c"))
        return "smlrc";
    return "yasm";
}
function getToolForFilename_zmachine(fn) {
    return fn.endsWith(".dg") ? "dialog" : "inform6";
}
function getToolForFilename_basic(fn) {
    return "basic";
}
// Looked up by full platform id, then base id (no .suffix), then root id (no
// -specialization), so e.g. williams-z80 can differ from williams.
const PLATFORM_TOOLS = {
    // 6502
    'vcs': getToolForFilename_vcs,
    'atari7800': getToolForFilename_atari7800,
    'atari8': getToolForFilename_atari8,
    'apple2': getToolForFilename_apple2,
    'nes': getToolForFilename_nes,
    'c64': getToolForFilename_6502,
    'vic20': getToolForFilename_6502,
    'kim1': getToolForFilename_6502,
    'exidy': getToolForFilename_6502,
    'devel': getToolForFilename_6502,
    'pce': getToolForFilename_6502,
    'vector': getToolForFilename_6502,
    // Z80 and friends
    'vector-z80color': getToolForFilename_z80,
    'williams-z80': getToolForFilename_z80,
    'astrocade': getToolForFilename_z80,
    'coleco': getToolForFilename_z80,
    'cpc': getToolForFilename_z80,
    'galaxian': getToolForFilename_z80,
    'gb': getToolForFilename_z80,
    'mcr': getToolForFilename_z80,
    'msx': getToolForFilename_z80,
    'mw8080bw': getToolForFilename_z80,
    'pacman': getToolForFilename_z80,
    'sms': getToolForFilename_z80,
    'sound_konami': getToolForFilename_z80,
    'sound_williams': getToolForFilename_z80,
    'vicdual': getToolForFilename_z80,
    'zx': getToolForFilename_z80,
    // 6809
    'williams': getToolForFilename_6809,
    'vectrex': getToolForFilename_6809,
    // other
    'arm32': getToolForFilename_arm32,
    'channelf': getToolForFilename_channelf,
    'verilog': getToolForFilename_verilog,
    'x86': getToolForFilename_x86,
    'zmachine': getToolForFilename_zmachine,
    'basic': getToolForFilename_basic,
};
function getToolSelector(platform) {
    return PLATFORM_TOOLS[platform]
        || PLATFORM_TOOLS[(0, util_1.getBasePlatform)(platform)]
        || PLATFORM_TOOLS[(0, util_1.getRootBasePlatform)(platform)];
}
/** The tool that builds `fn` on `platform`. Unknown platforms get the Z80 tools. */
function getToolForPlatform(platform, fn) {
    return (getToolSelector(platform) || getToolForFilename_z80)(fn);
}
//# sourceMappingURL=toolselect.js.map