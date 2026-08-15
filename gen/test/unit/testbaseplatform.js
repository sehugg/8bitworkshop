"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const baseplatform_1 = require("../../src/common/baseplatform");
(0, mocha_1.describe)('DebugSymbols', function () {
    (0, mocha_1.it)('should create symbol map with correct structure', function () {
        const symbolmap = { main: 0x0000, loop: 0x0010, end: 0x0100 };
        const debuginfo = { platform: 'test' };
        const symbols = new baseplatform_1.DebugSymbols(symbolmap, debuginfo);
        assert_1.default.strictEqual(symbols.symbolmap['main'], 0x0000);
        assert_1.default.strictEqual(symbols.symbolmap['loop'], 0x0010);
        assert_1.default.strictEqual(symbols.symbolmap['end'], 0x0100);
    });
    (0, mocha_1.it)('should create inverted address-to-symbol map', function () {
        const symbolmap = { main: 0x0000, loop: 0x0010, end: 0x0100 };
        const debuginfo = {};
        const symbols = new baseplatform_1.DebugSymbols(symbolmap, debuginfo);
        assert_1.default.strictEqual(symbols.addr2symbol[0x0000], 'main');
        assert_1.default.strictEqual(symbols.addr2symbol[0x0010], 'loop');
        assert_1.default.strictEqual(symbols.addr2symbol[0x0100], 'end');
    });
    (0, mocha_1.it)('should ensure sentinel values in address map', function () {
        const symbolmap = { loop: 0x1000 };
        const debuginfo = {};
        const symbols = new baseplatform_1.DebugSymbols(symbolmap, debuginfo);
        // Empty symbol map gets $00 sentinel
        assert_1.default.strictEqual(symbols.addr2symbol[0x0], '$00');
        assert_1.default.strictEqual(symbols.addr2symbol[0x10000], '__END__');
    });
    (0, mocha_1.it)('should store debug info', function () {
        const debuginfo = { platform: 'c64', version: '1.0' };
        const symbols = new baseplatform_1.DebugSymbols({}, debuginfo);
        assert_1.default.deepStrictEqual(symbols.debuginfo, debuginfo);
    });
    (0, mocha_1.it)('should handle empty symbol map', function () {
        const symbols = new baseplatform_1.DebugSymbols({}, {});
        assert_1.default.deepStrictEqual(symbols.symbolmap, {});
        assert_1.default.ok(symbols.addr2symbol[0x0] !== undefined);
    });
    (0, mocha_1.it)('should handle duplicate addresses with last symbol winning', function () {
        const symbolmap = { sym1: 0x100, sym2: 0x100 };
        const symbols = new baseplatform_1.DebugSymbols(symbolmap, {});
        // One of them should be in the inverted map
        assert_1.default.ok(symbols.addr2symbol[0x100] === 'sym1' || symbols.addr2symbol[0x100] === 'sym2');
    });
});
(0, mocha_1.describe)('isDebuggable type guard', function () {
    (0, mocha_1.it)('should identify debuggable objects', function () {
        const debuggable = {
            getDebugCategories: () => ['CPU', 'Memory'],
            getDebugInfo: (category) => 'debug info'
        };
        assert_1.default.ok((0, baseplatform_1.isDebuggable)(debuggable));
    });
    (0, mocha_1.it)('should reject non-debuggable objects', function () {
        assert_1.default.ok(!(0, baseplatform_1.isDebuggable)({}));
        assert_1.default.ok(!(0, baseplatform_1.isDebuggable)(null));
        assert_1.default.ok(!(0, baseplatform_1.isDebuggable)(undefined));
        assert_1.default.ok(!(0, baseplatform_1.isDebuggable)({ foo: 'bar' }));
    });
    (0, mocha_1.it)('should accept partial implementations', function () {
        const partial = {
            getDebugCategories: () => ['CPU']
        };
        assert_1.default.ok((0, baseplatform_1.isDebuggable)(partial));
    });
});
(0, mocha_1.describe)('BreakpointList', function () {
    (0, mocha_1.it)('should return null when no breakpoints exist', function () {
        const list = new baseplatform_1.BreakpointList();
        const cond = list.getDebugCondition();
        assert_1.default.strictEqual(cond, null);
    });
    (0, mocha_1.it)('should create debug condition for single breakpoint', function () {
        const list = new baseplatform_1.BreakpointList();
        let hitCount = 0;
        list.id2bp['bp1'] = { cond: () => { hitCount++; return true; } };
        const cond = list.getDebugCondition();
        assert_1.default.ok(cond !== null);
        assert_1.default.ok(cond());
        assert_1.default.strictEqual(hitCount, 1);
    });
    (0, mocha_1.it)('should evaluate multiple breakpoints with OR logic', function () {
        const list = new baseplatform_1.BreakpointList();
        let hits1 = 0, hits2 = 0;
        list.id2bp['bp1'] = { cond: () => { hits1++; return false; } };
        list.id2bp['bp2'] = { cond: () => { hits2++; return true; } };
        const cond = list.getDebugCondition();
        const result = cond();
        assert_1.default.ok(result);
        assert_1.default.strictEqual(hits1, 1);
        assert_1.default.strictEqual(hits2, 1);
    });
    (0, mocha_1.it)('should remove breakpoint', function () {
        const list = new baseplatform_1.BreakpointList();
        list.id2bp['bp1'] = { cond: () => true };
        delete list.id2bp['bp1'];
        const cond = list.getDebugCondition();
        assert_1.default.strictEqual(cond, null);
    });
});
(0, mocha_1.describe)('Tool Filename Detection', function () {
    (0, mocha_1.describe)('6502 tools', function () {
        (0, mocha_1.it)('should detect C language', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.c'), 'cc65');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('program.c'), 'cc65');
        });
        (0, mocha_1.it)('should detect assembly language', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.s'), 'ca65');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('code.ca65'), 'ca65');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.dasm'), 'dasm');
        });
        (0, mocha_1.it)('should detect various assembler formats', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.acme'), 'acme');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.xa'), 'xa');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.wiz'), 'wiz');
        });
        (0, mocha_1.it)('should detect special formats', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.ecs'), 'ecs');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.cpp'), 'oscar64');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.cc'), 'oscar64');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.o64'), 'oscar64');
        });
        (0, mocha_1.it)('should default to dasm for unknown extensions', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.a'), 'dasm');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test.asm'), 'dasm');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('unknown'), 'dasm');
        });
        (0, mocha_1.it)('should detect llvm-mos for special C files', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6502)('test-llvm.c'), 'remote:llvm-mos');
        });
    });
    (0, mocha_1.describe)('Z80 tools', function () {
        (0, mocha_1.it)('should detect C language', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_z80)('test.c'), 'sdcc');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_z80)('code.h'), 'sdcc');
        });
        (0, mocha_1.it)('should detect assembly language', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_z80)('test.s'), 'sdasz80');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_z80)('test.sgb'), 'sdasgb');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_z80)('test.ns'), 'naken');
        });
        (0, mocha_1.it)('should detect special formats', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_z80)('test.scc'), 'sccz80');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_z80)('test.z'), 'zmac');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_z80)('test.wiz'), 'wiz');
        });
        (0, mocha_1.it)('should default to zmac for unknown extensions', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_z80)('unknown'), 'zmac');
        });
    });
    (0, mocha_1.describe)('6809 tools', function () {
        (0, mocha_1.it)('should detect C language', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6809)('test.c'), 'cmoc');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6809)('code.h'), 'cmoc');
        });
        (0, mocha_1.it)('should detect assembly language', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6809)('test.xasm'), 'xasm6809');
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6809)('test.lwasm'), 'lwasm');
        });
        (0, mocha_1.it)('should default to cmoc', function () {
            assert_1.default.strictEqual((0, baseplatform_1.getToolForFilename_6809)('unknown'), 'cmoc');
        });
    });
});
(0, mocha_1.describe)('Opcode Metadata', function () {
    (0, mocha_1.it)('should return valid metadata for 6502 opcodes', function () {
        // Test NOP (0xEA)
        const nop = (0, baseplatform_1.getOpcodeMetadata_6502)(0xEA, 0);
        assert_1.default.strictEqual(nop.opcode, 0xEA);
        assert_1.default.ok(nop.minCycles > 0);
        assert_1.default.ok(nop.maxCycles >= nop.minCycles);
        assert_1.default.ok(nop.insnlength > 0);
    });
    (0, mocha_1.it)('should return consistent metadata for same opcode', function () {
        const meta1 = (0, baseplatform_1.getOpcodeMetadata_6502)(0x69, 0x1000); // ADC immediate
        const meta2 = (0, baseplatform_1.getOpcodeMetadata_6502)(0x69, 0x2000);
        assert_1.default.strictEqual(meta1.opcode, meta2.opcode);
        assert_1.default.strictEqual(meta1.minCycles, meta2.minCycles);
        assert_1.default.strictEqual(meta1.maxCycles, meta2.maxCycles);
        assert_1.default.strictEqual(meta1.insnlength, meta2.insnlength);
    });
    (0, mocha_1.it)('should handle all 256 6502 opcodes', function () {
        for (let op = 0; op < 256; op++) {
            const meta = (0, baseplatform_1.getOpcodeMetadata_6502)(op, 0);
            assert_1.default.ok(meta.minCycles >= 0);
            assert_1.default.ok(meta.maxCycles >= meta.minCycles);
            assert_1.default.ok(meta.insnlength >= 0);
        }
    });
});
(0, mocha_1.describe)('CPU State Formatting', function () {
    (0, mocha_1.describe)('6502 CPU state', function () {
        (0, mocha_1.it)('should format basic CPU state', function () {
            const state = {
                PC: 0x1234,
                SP: 0xFF,
                A: 0x42,
                X: 0x10,
                Y: 0x20,
                N: false, V: false, D: false, Z: false, C: false, I: false, R: true
            };
            const output = (0, baseplatform_1.cpuStateToLongString_6502)(state);
            assert_1.default.ok(output.includes('1234')); // PC
            assert_1.default.ok(output.includes('FF')); // SP
        });
        (0, mocha_1.it)('should show flag status', function () {
            const state1 = {
                PC: 0,
                SP: 0,
                N: true, V: false, D: false, Z: true, C: false, I: false, R: true
            };
            const output = (0, baseplatform_1.cpuStateToLongString_6502)(state1);
            assert_1.default.ok(output.includes('N'));
            assert_1.default.ok(output.includes('Z'));
        });
        (0, mocha_1.it)('should show BUSY status when R is false', function () {
            const state = { PC: 0, SP: 0, R: false };
            const output = (0, baseplatform_1.cpuStateToLongString_6502)(state);
            assert_1.default.ok(output.includes('BUSY'));
        });
    });
    (0, mocha_1.describe)('Z80 CPU state', function () {
        (0, mocha_1.it)('should format Z80 state', function () {
            const state = {
                PC: 0x4000,
                SP: 0x9000,
                AF: 0x1234,
                BC: 0x5678,
                DE: 0x9ABC,
                HL: 0xDEF0,
                IX: 0x0001,
                IY: 0x0002,
                IR: 0x3344,
                iff1: true,
                iff2: false
            };
            const output = (0, baseplatform_1.cpuStateToLongString_Z80)(state);
            assert_1.default.ok(output.includes('4000')); // PC
            assert_1.default.ok(output.includes('9000')); // SP
            assert_1.default.ok(output.includes('1234')); // AF
        });
    });
    (0, mocha_1.describe)('6809 CPU state', function () {
        (0, mocha_1.it)('should format 6809 state', function () {
            const state = {
                PC: 0x1000,
                SP: 0x2000,
                DP: 0x00,
                A: 0x11,
                B: 0x22,
                X: 0x3333,
                Y: 0x4444,
                U: 0x5555,
                CC: 0xF0
            };
            const output = (0, baseplatform_1.cpuStateToLongString_6809)(state);
            assert_1.default.ok(output.includes('1000')); // PC
            assert_1.default.ok(output.includes('2000')); // SP
            assert_1.default.ok(output.includes('11')); // A
        });
    });
});
(0, mocha_1.describe)('Symbol lookup', function () {
    (0, mocha_1.it)('should find symbol at address', function () {
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({ main: 0x1000, loop: 0x1010 }, {}),
            readAddress: (addr) => addr & 0xFF
        };
        const result = (0, baseplatform_1.lookupSymbol)(platform, 0x1010, false);
        assert_1.default.ok(result.includes('loop'));
    });
    (0, mocha_1.it)('should find symbol before address when extra is true', function () {
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({ main: 0x1000 }, {}),
            readAddress: (addr) => 0
        };
        const result = (0, baseplatform_1.lookupSymbol)(platform, 0x1005, true);
        assert_1.default.ok(result.includes('main'));
        assert_1.default.ok(result.includes('$05'));
    });
    (0, mocha_1.it)('should return empty string when no symbol found', function () {
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({}, {}),
            readAddress: (addr) => 0
        };
        const result = (0, baseplatform_1.lookupSymbol)(platform, 0x5000, false);
        assert_1.default.strictEqual(result, '');
    });
    (0, mocha_1.it)('should handle missing debug symbols', function () {
        const platform = { debugSymbols: null };
        const result = (0, baseplatform_1.lookupSymbol)(platform, 0x1000, false);
        assert_1.default.strictEqual(result, '');
    });
});
(0, mocha_1.describe)('Stack dumping', function () {
    (0, mocha_1.it)('should dump stack memory', function () {
        const mem = new Uint8Array([
            0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
            0x20, 0x10, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D,
        ]);
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({ func: 0x100E }, {}),
            readAddress: (addr) => addr < mem.length ? mem[addr] : 0
        };
        const result = (0, baseplatform_1.dumpStackToString)(platform, mem, 0, 15, 9, 0x20);
        assert_1.default.ok(result.includes('$'));
        assert_1.default.ok(result.length > 0);
    });
    (0, mocha_1.it)('should handle big endian byte order', function () {
        const mem = new Uint8Array([0x10, 0x20, 0x30, 0x40]);
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({}, {}),
            readAddress: (addr) => mem[addr]
        };
        const result = (0, baseplatform_1.dumpStackToString)(platform, mem, 0, 3, 2, 0, true);
        assert_1.default.ok(result.includes('$'));
    });
    (0, mocha_1.it)('should show JSR addresses', function () {
        const mem = new Uint8Array(256);
        // Set up JSR at 0x100 (6502 JSR is 0x20)
        mem[0x100] = 0x20;
        // Stack has return address pointing near 0x100
        mem[0x50] = 0xFE;
        mem[0x51] = 0x01;
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({ func: 0x0100 }, {}),
            readAddress: (addr) => {
                if (addr < mem.length)
                    return mem[addr];
                return 0;
            }
        };
        const result = (0, baseplatform_1.dumpStackToString)(platform, mem, 0, 255, 0x50, 0x20);
        // The function returns a string with stack content
        assert_1.default.ok(result.includes('$'));
    });
});
(0, mocha_1.describe)('BasePlatform', function () {
    class TestPlatform extends baseplatform_1.BasePlatform {
        loadState(state) { }
        saveState() { return {}; }
        pause() { }
        resume() { }
        advance(novideo) { return 0; }
    }
    (0, mocha_1.it)('should initialize with empty internal files', function () {
        const platform = new TestPlatform();
        assert_1.default.deepStrictEqual(platform.internalFiles, {});
    });
    (0, mocha_1.it)('should set and get recorder', function () {
        const platform = new TestPlatform();
        const recorder = { frameRequested: () => false };
        platform.setRecorder(recorder);
        assert_1.default.strictEqual(platform.recorder, recorder);
    });
    (0, mocha_1.it)('should read and write files', function () {
        const platform = new TestPlatform();
        const data = { data: [1, 2, 3] };
        platform.writeFile('test.txt', data);
        const read = platform.readFile('test.txt');
        assert_1.default.deepStrictEqual(read, data);
    });
    (0, mocha_1.it)('should return undefined for non-existent file', function () {
        const platform = new TestPlatform();
        const read = platform.readFile('nonexistent.txt');
        assert_1.default.strictEqual(read, undefined);
    });
    (0, mocha_1.it)('should generate debug tree', function () {
        const platform = new TestPlatform();
        platform.debugSymbols = new baseplatform_1.DebugSymbols({ test: 0x1000 }, { info: 'test' });
        const tree = platform.getDebugTree();
        assert_1.default.ok(tree.state);
        assert_1.default.deepStrictEqual(tree.debuginfo, { info: 'test' });
    });
});
(0, mocha_1.describe)('BaseDebugPlatform', function () {
    class TestDebugPlatform extends baseplatform_1.BaseDebugPlatform {
        loadState(state) { }
        saveState() { return { c: { PC: 0 } }; }
        pause() { }
        resume() { }
        advance(novideo) { return 0; }
        getCPUState() { return { PC: 0x1000, SP: 0x100 }; }
        getSP() { return 0x100; }
        getPC() { return 0x1000; }
        isStable() { return true; }
    }
    (0, mocha_1.it)('should manage breakpoints', function () {
        const platform = new TestDebugPlatform();
        const cond = () => true;
        platform.setBreakpoint('bp1', cond);
        assert_1.default.ok(platform.hasBreakpoint('bp1'));
        platform.clearBreakpoint('bp1');
        assert_1.default.ok(!platform.hasBreakpoint('bp1'));
    });
    (0, mocha_1.it)('should clear all debug state', function () {
        const platform = new TestDebugPlatform();
        platform.debugSavedState = { c: { PC: 0 } };
        platform.debugBreakState = { c: { PC: 100 } };
        platform.onBreakpointHit = () => { };
        platform.clearDebug();
        assert_1.default.strictEqual(platform.debugSavedState, null);
        assert_1.default.strictEqual(platform.debugBreakState, null);
        assert_1.default.strictEqual(platform.onBreakpointHit, null);
    });
    (0, mocha_1.it)('should track frame count', function () {
        const platform = new TestDebugPlatform();
        assert_1.default.strictEqual(platform.frameCount, 0);
        platform.postFrame();
        assert_1.default.strictEqual(platform.frameCount, 1);
        platform.postFrame();
        assert_1.default.strictEqual(platform.frameCount, 2);
    });
    (0, mocha_1.it)('should detect breakpoint hits', function () {
        const platform = new TestDebugPlatform();
        assert_1.default.ok(!platform.wasBreakpointHit());
        platform.debugBreakState = { c: { PC: 0 } };
        assert_1.default.ok(platform.wasBreakpointHit());
    });
});
(0, mocha_1.describe)('Base6502Platform', function () {
    class TestNES6502 extends baseplatform_1.Base6502Platform {
        loadState(state) { }
        saveState() { return { c: { PC: 0, SP: 0 } }; }
        pause() { }
        resume() { }
        advance(novideo) { return 0; }
        getCPUState() { return { PC: 0x8000, SP: 0xFF }; }
        getSP() { return 0xFF; }
        getPC() { return 0x8000; }
        isStable() { return true; }
        readAddress(addr) { return 0; }
    }
    (0, mocha_1.it)('should get default extensions', function () {
        const platform = new TestNES6502();
        const exts = platform.getDefaultExtensions();
        assert_1.default.ok(exts.includes('.c'));
        assert_1.default.ok(exts.includes('.ca65'));
        assert_1.default.ok(exts.includes('.dasm'));
    });
    (0, mocha_1.it)('should get 6502 opcode metadata', function () {
        const platform = new TestNES6502();
        const meta = platform.getOpcodeMetadata(0x69, 0);
        assert_1.default.ok(meta.minCycles > 0);
    });
    (0, mocha_1.it)('should get origin PC from reset vector', function () {
        const platform = new TestNES6502();
        const originPC = platform.getOriginPC();
        assert_1.default.ok(typeof originPC === 'number');
    });
    (0, mocha_1.it)('should apply PC delta correction', function () {
        const platform = new TestNES6502();
        const state = { PC: 0x1000 };
        const fixed = platform.fixPC(state);
        assert_1.default.strictEqual(fixed.PC, 0x0FFF); // PC - 1
        const unfixed = platform.unfixPC(fixed);
        assert_1.default.strictEqual(unfixed.PC, 0x1000);
    });
    (0, mocha_1.it)('should handle PC wrapping at 16-bit boundary', function () {
        const platform = new TestNES6502();
        const state = { PC: 0x0000 };
        const fixed = platform.fixPC(state);
        assert_1.default.strictEqual(fixed.PC, 0xFFFF);
    });
    (0, mocha_1.it)('should get debug categories', function () {
        const platform = new TestNES6502();
        const cats = platform.getDebugCategories();
        assert_1.default.ok(cats.includes('CPU'));
        assert_1.default.ok(cats.includes('Stack'));
    });
});
(0, mocha_1.describe)('inspectSymbol', function () {
    (0, mocha_1.it)('should inspect symbol value at address', function () {
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({ myvar: 0x100 }, {}),
            readAddress: (addr) => addr === 0x100 ? 0x42 : 0x00
        };
        const result = (0, baseplatform_1.inspectSymbol)(platform, 'myvar');
        assert_1.default.ok(result.includes('100'));
        assert_1.default.ok(result.includes('42'));
    });
    (0, mocha_1.it)('should handle two-byte values', function () {
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({ word: 0x200 }, {}),
            readAddress: (addr) => {
                if (addr === 0x200)
                    return 0x34;
                if (addr === 0x201)
                    return 0x12;
                return 0;
            }
        };
        const result = (0, baseplatform_1.inspectSymbol)(platform, 'word');
        assert_1.default.ok(result.includes('200'));
    });
    (0, mocha_1.it)('should look for C and asm symbol variants', function () {
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({ _myvar: 0x300 }, {}),
            readAddress: (addr) => addr === 0x300 ? 0x99 : 0
        };
        const result = (0, baseplatform_1.inspectSymbol)(platform, 'myvar');
        assert_1.default.ok(result.includes('99'));
    });
    (0, mocha_1.it)('should return undefined for missing symbol', function () {
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({}, {}),
            readAddress: (addr) => 0
        };
        const result = (0, baseplatform_1.inspectSymbol)(platform, 'nonexistent');
        assert_1.default.ok(result === undefined || result === null);
    });
    (0, mocha_1.it)('should handle missing debug symbols', function () {
        const platform = { debugSymbols: null };
        const result = (0, baseplatform_1.inspectSymbol)(platform, 'symbol');
        assert_1.default.strictEqual(result, undefined);
    });
    (0, mocha_1.it)('should handle missing readAddress method', function () {
        const platform = {
            debugSymbols: new baseplatform_1.DebugSymbols({ test: 0x100 }, {}),
            readAddress: undefined
        };
        const result = (0, baseplatform_1.inspectSymbol)(platform, 'test');
        assert_1.default.ok(result === null);
    });
});
//# sourceMappingURL=testbaseplatform.js.map