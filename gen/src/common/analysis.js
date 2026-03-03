"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeAnalyzer_apple2 = exports.CodeAnalyzer_nes = exports.CodeAnalyzer_vcs = void 0;
const util_1 = require("./util");
const debug = false;
/// VCS TIMING ANALYSIS
// [taken, not taken]
const BRANCH_CONSTRAINTS = [
    [{ N: 0 }, { N: 1 }],
    [{ N: 1 }, { N: 0 }],
    [{ V: 0 }, { V: 1 }],
    [{ V: 1 }, { V: 0 }],
    [{ C: 0 }, { C: 1 }],
    [{ C: 1 }, { C: 0 }],
    [{ Z: 0 }, { Z: 1 }],
    [{ Z: 1 }, { Z: 0 }]
];
function constraintEquals(a, b) {
    if (a == null || b == null)
        return null;
    for (var n in a) {
        if (b[n] !== 'undefined')
            return a[n] == b[n];
    }
    for (var n in b) {
        if (a[n] !== 'undefined')
            return a[n] == b[n];
    }
    return null;
}
class CodeAnalyzer6502 {
    constructor(platform) {
        this.pc2clockrange = {};
        this.jsrresult = {};
        this.MAX_CYCLES = 2000;
        this.platform = platform;
    }
    getClockCountsAtPC(pc) {
        var opcode = this.platform.readAddress(pc);
        var meta = this.platform.getOpcodeMetadata(opcode, pc);
        return meta; // minCycles, maxCycles
    }
    traceInstructions(pc, minclocks, maxclocks, subaddr, constraints) {
        if (debug)
            console.log("trace", (0, util_1.hex)(pc), minclocks, maxclocks);
        if (!constraints)
            constraints = {};
        var modified = true;
        var abort = false;
        for (let i = 0; modified && !abort; i++) {
            if (i >= this.MAX_CYCLES) {
                console.log("too many cycles @", (0, util_1.hex)(pc), "routine", (0, util_1.hex)(subaddr));
                break;
            }
            modified = false;
            if (this.WRAP_CLOCKS) {
                // wrap clocks
                minclocks = minclocks % this.MAX_CLOCKS;
                maxclocks = maxclocks % this.MAX_CLOCKS;
                if (maxclocks == minclocks - 1) {
                    if (debug)
                        console.log("0-75", (0, util_1.hex)(pc), minclocks, maxclocks);
                    minclocks = 0;
                    maxclocks = this.MAX_CLOCKS - 1;
                }
            }
            else {
                // truncate clocks
                minclocks = Math.min(this.MAX_CLOCKS, minclocks);
                maxclocks = Math.min(this.MAX_CLOCKS, maxclocks);
            }
            let meta = this.getClockCountsAtPC(pc);
            let lob = this.platform.readAddress(pc + 1);
            let hib = this.platform.readAddress(pc + 2);
            let addr = lob + (hib << 8);
            let pc0 = pc;
            let pcrange = this.pc2clockrange[pc0];
            if (pcrange == null) {
                this.pc2clockrange[pc0] = pcrange = { minclocks: minclocks, maxclocks: maxclocks };
                if (debug)
                    console.log("new", (0, util_1.hex)(pc), (0, util_1.hex)(pc0), (0, util_1.hex)(subaddr), minclocks, maxclocks);
                modified = true;
            }
            //console.log(hex(pc),minclocks,maxclocks, pcrange);
            if (pcrange.minclocks != minclocks || pcrange.maxclocks != maxclocks) {
                if (this.WRAP_CLOCKS && (minclocks <= maxclocks) != (pcrange.minclocks <= pcrange.maxclocks)) {
                    if (debug)
                        console.log("wrap", (0, util_1.hex)(pc), (0, util_1.hex)(pc0), (0, util_1.hex)(subaddr), minclocks, maxclocks, pcrange);
                    pcrange.minclocks = minclocks = 0;
                    pcrange.maxclocks = maxclocks = this.MAX_CLOCKS - 1;
                    modified = true;
                }
                if (minclocks < pcrange.minclocks) {
                    if (debug)
                        console.log("min", (0, util_1.hex)(pc), (0, util_1.hex)(pc0), (0, util_1.hex)(subaddr), minclocks, maxclocks, pcrange);
                    pcrange.minclocks = minclocks;
                    modified = true;
                }
                if (maxclocks > pcrange.maxclocks) {
                    if (debug)
                        console.log("max", (0, util_1.hex)(pc), (0, util_1.hex)(pc0), (0, util_1.hex)(subaddr), minclocks, maxclocks, pcrange);
                    pcrange.maxclocks = maxclocks;
                    modified = true;
                }
            }
            if (!meta.insnlength) {
                console.log("Illegal instruction!", (0, util_1.hex)(pc), (0, util_1.hex)(meta.opcode), meta);
                break;
            }
            pc += meta.insnlength;
            var oldconstraints = constraints;
            constraints = null;
            let syncMaxCycles = this.getMaxCyclesForSync(meta, lob, hib);
            if (typeof syncMaxCycles === 'number') {
                minclocks = 0;
                maxclocks = syncMaxCycles;
                meta.minCycles = meta.maxCycles = 0;
            }
            else {
                // TODO: if jump to zero-page, maybe assume RTS?
                switch (meta.opcode) {
                    case 0x19:
                    case 0x1d:
                    case 0x39:
                    case 0x3d:
                    case 0x59:
                    case 0x5d:
                    case 0x79:
                    case 0x7d:
                    case 0xb9:
                    case 0xbb:
                    case 0xbc:
                    case 0xbd:
                    case 0xbe:
                    case 0xbf:
                    case 0xd9:
                    case 0xdd:
                    case 0xf9:
                    case 0xfd:
                        if (lob == 0)
                            meta.maxCycles -= 1; // no page boundary crossed
                        break;
                    case 0x20: // JSR
                        // TODO: handle bare RTS case
                        minclocks += meta.minCycles;
                        maxclocks += meta.maxCycles;
                        this.traceInstructions(addr, minclocks, maxclocks, addr, constraints);
                        var result = this.jsrresult[addr];
                        if (result) {
                            minclocks = result.minclocks;
                            maxclocks = result.maxclocks;
                        }
                        else {
                            console.log("No JSR result!", (0, util_1.hex)(pc), (0, util_1.hex)(addr));
                            minclocks = maxclocks;
                            //return;
                        }
                        break;
                    case 0x4c: // JMP
                        pc = addr; // TODO: make sure in ROM space
                        break;
                    case 0x40: // RTI
                        abort = true;
                        break;
                    case 0x60: // RTS
                        if (subaddr) { // TODO: 0 doesn't work
                            // TODO: combine with previous result
                            var result = this.jsrresult[subaddr];
                            if (!result) {
                                result = { minclocks: minclocks, maxclocks: maxclocks };
                            }
                            else {
                                result = {
                                    minclocks: Math.min(minclocks, result.minclocks),
                                    maxclocks: Math.max(maxclocks, result.maxclocks)
                                };
                            }
                            this.jsrresult[subaddr] = result;
                            console.log("RTS", (0, util_1.hex)(pc), (0, util_1.hex)(subaddr), this.jsrresult[subaddr]);
                        }
                        return;
                    case 0x10:
                    case 0x30: // branch
                    case 0x50:
                    case 0x70:
                    case 0x90:
                    case 0xB0:
                    case 0xD0:
                    case 0xF0:
                        var newpc = pc + (0, util_1.byte2signed)(lob);
                        var crosspage = (pc >> 8) != (newpc >> 8);
                        if (!crosspage)
                            meta.maxCycles--;
                        // TODO: other instructions might modify flags too
                        var cons = BRANCH_CONSTRAINTS[Math.floor((meta.opcode - 0x10) / 0x20)];
                        var cons0 = constraintEquals(oldconstraints, cons[0]);
                        var cons1 = constraintEquals(oldconstraints, cons[1]);
                        // recursively trace the taken branch
                        if (true || cons0 !== false) { // TODO?
                            this.traceInstructions(newpc, minclocks + meta.maxCycles, maxclocks + meta.maxCycles, subaddr, cons[0]);
                        }
                        // abort if we will always take the branch
                        if (cons1 === false) {
                            console.log("branch always taken", (0, util_1.hex)(pc), oldconstraints, cons[1]);
                            abort = true;
                        }
                        constraints = cons[1]; // not taken
                        meta.maxCycles = meta.minCycles; // branch not taken, no extra clock(s)
                        break;
                    case 0x6c:
                        console.log("Instruction not supported!", (0, util_1.hex)(pc), (0, util_1.hex)(meta.opcode), meta); // TODO
                        return;
                }
            }
            // add min/max instruction time to min/max clocks bound
            if (debug)
                console.log("add", (0, util_1.hex)(pc), meta.minCycles, meta.maxCycles);
            minclocks += meta.minCycles;
            maxclocks += meta.maxCycles;
        }
    }
    showLoopTimingForPC(pc) {
        this.pc2clockrange = {};
        this.jsrresult = {};
        // recurse through all traces
        this.traceInstructions(pc | this.platform.getOriginPC(), this.START_CLOCKS, this.MAX_CLOCKS, 0, {});
    }
    getMaxCyclesForSync(meta, lob, hib) {
    }
}
// 76 cycles
class CodeAnalyzer_vcs extends CodeAnalyzer6502 {
    constructor(platform) {
        super(platform);
        this.MAX_CLOCKS = 76; // 1 scanline
        this.START_CLOCKS = 0; // TODO?
        this.WRAP_CLOCKS = true;
    }
    getMaxCyclesForSync(meta, lob, hib) {
        if (meta.opcode == 0x85) {
            if (lob == 0x2) { // STA WSYNC
                return 0;
            }
        }
    }
}
exports.CodeAnalyzer_vcs = CodeAnalyzer_vcs;
// https://wiki.nesdev.com/w/index.php/PPU_rendering#Line-by-line_timing
// TODO: sprite 0 hit, CPU stalls
class CodeAnalyzer_nes extends CodeAnalyzer6502 {
    constructor(platform) {
        super(platform);
        this.MAX_CLOCKS = 114; // 341 clocks for 3 scanlines
        this.START_CLOCKS = 0;
        this.WRAP_CLOCKS = true;
    }
    getMaxCyclesForSync(meta, lob, hib) {
        if (meta.opcode == 0x2c) {
            if (lob == 0x02 && hib == 0x20) { // BIT $2002
                return 4; // uncertainty b/c of assumed branch poll
            }
        }
    }
}
exports.CodeAnalyzer_nes = CodeAnalyzer_nes;
class CodeAnalyzer_apple2 extends CodeAnalyzer6502 {
    constructor(platform) {
        super(platform);
        this.MAX_CLOCKS = 65;
        this.START_CLOCKS = 0;
        this.WRAP_CLOCKS = true;
    }
    getMaxCyclesForSync(meta, lob, hib) {
        if (meta.opcode == 0xad) {
            if (lob == 0x61 && hib == 0xc0) { // LDA $C061
                return 4; // uncertainty b/c of assumed branch poll
            }
        }
    }
}
exports.CodeAnalyzer_apple2 = CodeAnalyzer_apple2;
//# sourceMappingURL=analysis.js.map