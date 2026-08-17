"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const emu_1 = require("../../src/common/emu");
(0, mocha_1.describe)('Noise PRNG', function () {
    (0, mocha_1.it)('should produce a deterministic sequence from seed 1', function () {
        (0, emu_1.setNoiseSeed)(1);
        const seq = [];
        for (let i = 0; i < 8; i++)
            seq.push((0, emu_1.noise)());
        assert_1.default.deepStrictEqual(seq, [33, 1, 34, 25, 250, 201, 8, 180]);
    });
    (0, mocha_1.it)('should track and restore the seed', function () {
        (0, emu_1.setNoiseSeed)(0x1234);
        assert_1.default.strictEqual((0, emu_1.getNoiseSeed)(), 0x1234);
        (0, emu_1.noise)();
        assert_1.default.notStrictEqual((0, emu_1.getNoiseSeed)(), 0x1234);
    });
    (0, mocha_1.it)('should return 0 forever for seed 0', function () {
        (0, emu_1.setNoiseSeed)(0);
        assert_1.default.strictEqual((0, emu_1.noise)(), 0);
        assert_1.default.strictEqual((0, emu_1.noise)(), 0);
        assert_1.default.strictEqual((0, emu_1.noise)(), 0);
        assert_1.default.strictEqual((0, emu_1.getNoiseSeed)(), 0);
    });
    (0, mocha_1.it)('should always return a byte', function () {
        (0, emu_1.setNoiseSeed)(1);
        for (let i = 0; i < 100; i++) {
            const n = (0, emu_1.noise)();
            assert_1.default.ok(n >= 0 && n <= 255);
        }
    });
});
(0, mocha_1.describe)('KeyFlags Enumeration', function () {
    (0, mocha_1.it)('should have correct flag values', function () {
        assert_1.default.strictEqual(emu_1.KeyFlags.KeyDown, 1);
        assert_1.default.strictEqual(emu_1.KeyFlags.Shift, 2);
        assert_1.default.strictEqual(emu_1.KeyFlags.Ctrl, 4);
        assert_1.default.strictEqual(emu_1.KeyFlags.Alt, 8);
        assert_1.default.strictEqual(emu_1.KeyFlags.Meta, 16);
        assert_1.default.strictEqual(emu_1.KeyFlags.KeyUp, 64);
        assert_1.default.strictEqual(emu_1.KeyFlags.KeyPress, 128);
    });
});
(0, mocha_1.describe)('RAM Class', function () {
    (0, mocha_1.it)('should allocate zero-initialized memory', function () {
        const ram = new emu_1.RAM(16);
        assert_1.default.ok(ram.mem instanceof Uint8Array);
        assert_1.default.strictEqual(ram.mem.length, 16);
        assert_1.default.strictEqual(ram.mem[0], 0);
        assert_1.default.strictEqual(ram.mem[15], 0);
    });
    (0, mocha_1.it)('should allow reading and writing', function () {
        const ram = new emu_1.RAM(4);
        ram.mem[2] = 0xAA;
        assert_1.default.strictEqual(ram.mem[2], 0xAA);
    });
});
(0, mocha_1.describe)('EmuHalt', function () {
    (0, mocha_1.it)('should be an Error subclass with default properties', function () {
        const e = new emu_1.EmuHalt("Halt!");
        assert_1.default.ok(e instanceof Error);
        assert_1.default.ok(e instanceof emu_1.EmuHalt);
        assert_1.default.strictEqual(e.message, "Halt!");
        assert_1.default.ok(e.squelchError);
        assert_1.default.strictEqual(e.$loc, undefined);
    });
    (0, mocha_1.it)('should carry a source location', function () {
        const e = new emu_1.EmuHalt("bad opcode", { line: 42 });
        assert_1.default.deepStrictEqual(e.$loc, { line: 42 });
    });
    (0, mocha_1.it)('should be catchable via instanceof', function () {
        let caught = null;
        try {
            throw new emu_1.EmuHalt("boom");
        }
        catch (err) {
            caught = err;
        }
        assert_1.default.ok(caught instanceof emu_1.EmuHalt);
        assert_1.default.ok(caught instanceof Error);
        assert_1.default.strictEqual(caught.message, "boom");
    });
});
(0, mocha_1.describe)('dumpRAM', function () {
    (0, mocha_1.it)('should format a Uint8Array dump', function () {
        const ram = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
        assert_1.default.strictEqual((0, emu_1.dumpRAM)(ram, 0, 16), "$00: 00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F\n");
    });
    (0, mocha_1.it)('should show the base offset in addresses', function () {
        const ram = new Uint8Array([1, 2, 3]);
        assert_1.default.strictEqual((0, emu_1.dumpRAM)(ram, 0x8000, 8), "$8000: 01 02 03\n");
    });
    (0, mocha_1.it)('should format a Uint16Array dump', function () {
        const ram = new Uint16Array([0x1234, 0x5678, 0x9ABC, 0xDEF0, 0x1111, 0x2222, 0x3333, 0x4444]);
        assert_1.default.strictEqual((0, emu_1.dumpRAM)(ram, 0, 16), "$00: 1234 5678 9ABC DEF0  1111 2222 3333 4444\n$08:\n");
    });
    (0, mocha_1.it)('should format a Float32Array dump with precision', function () {
        const ram = new Float32Array([1.5, 2.25, 3.125, 0.5]);
        assert_1.default.strictEqual((0, emu_1.dumpRAM)(ram, 0, 8), "$00: 1.5000000 2.2500000  3.1250000 0.50000000\n$04:\n");
    });
    (0, mocha_1.it)('should handle plain arrays (BYTES_PER_ELEMENT fallback)', function () {
        assert_1.default.strictEqual((0, emu_1.dumpRAM)([0x0A, 0x0B], 0, 2), "$00: 0A 0B\n");
    });
});
(0, mocha_1.describe)('Keys Table', function () {
    (0, mocha_1.it)('should define directional and action keys', function () {
        assert_1.default.strictEqual(emu_1.Keys.UP.c, 38);
        assert_1.default.strictEqual(emu_1.Keys.DOWN.c, 40);
        assert_1.default.strictEqual(emu_1.Keys.LEFT.c, 37);
        assert_1.default.strictEqual(emu_1.Keys.RIGHT.c, 39);
        assert_1.default.strictEqual(emu_1.Keys.A.c, 32); // Space
        assert_1.default.strictEqual(emu_1.Keys.B.c, 16); // Shift
        assert_1.default.strictEqual(emu_1.Keys.SELECT.c, 220);
        assert_1.default.strictEqual(emu_1.Keys.START.c, 13);
        assert_1.default.strictEqual(emu_1.Keys.ANYKEY.c, 0);
    });
    (0, mocha_1.it)('should annotate gamepad mapping metadata', function () {
        assert_1.default.strictEqual(emu_1.Keys.UP.plyr, 0);
        assert_1.default.strictEqual(emu_1.Keys.UP.button, 12);
        assert_1.default.strictEqual(emu_1.Keys.UP.yaxis, -1);
        assert_1.default.strictEqual(emu_1.Keys.RIGHT.xaxis, 1);
        assert_1.default.strictEqual(emu_1.Keys.A.button, 0);
        assert_1.default.strictEqual(emu_1.Keys.P2_UP.plyr, 1);
        assert_1.default.strictEqual(emu_1.Keys.P2_UP.c, 87); // W
    });
    (0, mocha_1.it)('should define function keys and misc keys', function () {
        assert_1.default.strictEqual(emu_1.Keys.VK_ESCAPE.c, 27);
        assert_1.default.strictEqual(emu_1.Keys.VK_F1.c, 112);
        assert_1.default.strictEqual(emu_1.Keys.VK_F12.c, 123);
        assert_1.default.strictEqual(emu_1.Keys.VK_ENTER.c, 13);
        assert_1.default.strictEqual(emu_1.Keys.VK_SPACE.c, 32);
    });
    (0, mocha_1.it)('should give every key a name and numeric code', function () {
        const entries = Object.keys(emu_1.Keys);
        assert_1.default.ok(entries.length >= 100);
        for (const name of entries) {
            assert_1.default.ok(name.length > 0);
            const def = emu_1.Keys[name];
            assert_1.default.strictEqual(typeof def.c, 'number');
            assert_1.default.ok(def.n.length > 0, `key ${name} should have a name`);
        }
    });
});
(0, mocha_1.describe)('makeKeycodeMap', function () {
    (0, mocha_1.it)('should build a map keyed by keycode', function () {
        const map = (0, emu_1.makeKeycodeMap)([[emu_1.Keys.A, 0, 0x01], [emu_1.Keys.B, 0, 0x02]]);
        assert_1.default.ok(map instanceof Map);
        assert_1.default.strictEqual(map[32].index, 0);
        assert_1.default.strictEqual(map[32].mask, 0x01);
        assert_1.default.strictEqual(map[32].def, emu_1.Keys.A);
        assert_1.default.strictEqual(map[16].index, 0);
        assert_1.default.strictEqual(map[16].mask, 0x02);
        assert_1.default.strictEqual(map[9999], undefined);
    });
});
(0, mocha_1.describe)('newKeyboardHandler', function () {
    (0, mocha_1.it)('should set switches on keydown and clear on keyup', function () {
        const map = (0, emu_1.makeKeycodeMap)([[emu_1.Keys.A, 0, 0x01]]);
        const switches = new Uint8Array(2);
        const handler = (0, emu_1.newKeyboardHandler)(switches, map);
        handler(32, 0, emu_1.KeyFlags.KeyDown); // A (Space)
        assert_1.default.strictEqual(switches[0], 0x01);
        handler(32, 0, emu_1.KeyFlags.KeyDown); // idempotent
        assert_1.default.strictEqual(switches[0], 0x01);
        handler(32, 0, emu_1.KeyFlags.KeyUp);
        assert_1.default.strictEqual(switches[0], 0x00);
    });
    (0, mocha_1.it)('should support multiple keys and switch indices', function () {
        const map = (0, emu_1.makeKeycodeMap)([
            [emu_1.Keys.A, 0, 0x01],
            [emu_1.Keys.B, 0, 0x02],
            [emu_1.Keys.UP, 1, 0x80],
        ]);
        const switches = new Uint8Array(2);
        const handler = (0, emu_1.newKeyboardHandler)(switches, map);
        handler(32, 0, emu_1.KeyFlags.KeyDown);
        handler(16, 0, emu_1.KeyFlags.KeyDown);
        handler(38, 0, emu_1.KeyFlags.KeyDown);
        assert_1.default.strictEqual(switches[0], 0x03);
        assert_1.default.strictEqual(switches[1], 0x80);
        handler(32, 0, emu_1.KeyFlags.KeyUp);
        assert_1.default.strictEqual(switches[0], 0x02);
    });
    (0, mocha_1.it)('should support active-low (negative mask) switches', function () {
        const map = (0, emu_1.makeKeycodeMap)([[emu_1.Keys.START, 0, -0x01]]);
        const switches = new Uint8Array(1);
        const handler = (0, emu_1.newKeyboardHandler)(switches, map);
        switches[0] = 0x01;
        handler(13, 0, emu_1.KeyFlags.KeyDown); // active-low press clears the bit
        assert_1.default.strictEqual(switches[0], 0x00);
        handler(13, 0, emu_1.KeyFlags.KeyUp); // release sets the bit
        assert_1.default.strictEqual(switches[0], 0x01);
    });
    (0, mocha_1.it)('should fall back to ANYKEY entry for unknown keys', function () {
        const map = (0, emu_1.makeKeycodeMap)([[emu_1.Keys.ANYKEY, 0, 0x40]]);
        const switches = new Uint8Array(1);
        const handler = (0, emu_1.newKeyboardHandler)(switches, map);
        handler(9999, 0, emu_1.KeyFlags.KeyDown);
        assert_1.default.strictEqual(switches[0], 0x40);
        handler(9999, 0, emu_1.KeyFlags.KeyUp);
        assert_1.default.strictEqual(switches[0], 0x00);
    });
    (0, mocha_1.it)('should ignore unmapped keys when no ANYKEY entry exists', function () {
        const map = (0, emu_1.makeKeycodeMap)([[emu_1.Keys.A, 0, 0x01]]);
        const switches = new Uint8Array(1);
        const handler = (0, emu_1.newKeyboardHandler)(switches, map);
        handler(9999, 0, emu_1.KeyFlags.KeyDown);
        assert_1.default.strictEqual(switches[0], 0x00);
    });
    (0, mocha_1.it)('should invoke the callback function with key info', function () {
        const map = (0, emu_1.makeKeycodeMap)([[emu_1.Keys.A, 0, 0x01]]);
        const switches = new Uint8Array(1);
        const calls = [];
        const handler = (0, emu_1.newKeyboardHandler)(switches, map, (o, key, code, flags) => {
            calls.push([o && o.def.n, key, code, flags]);
        });
        handler(32, 65, emu_1.KeyFlags.KeyDown | emu_1.KeyFlags.Shift);
        assert_1.default.deepStrictEqual(calls, [['Space', 32, 65, emu_1.KeyFlags.KeyDown | emu_1.KeyFlags.Shift]]);
    });
    (0, mocha_1.it)('should invoke callback for unmapped keys only with alwaysfunc', function () {
        const map = (0, emu_1.makeKeycodeMap)([[emu_1.Keys.A, 0, 0x01]]);
        const switches = new Uint8Array(1);
        const calls = [];
        const handler = (0, emu_1.newKeyboardHandler)(switches, map, (o) => {
            calls.push(o ? o.def.n : null);
        }, true);
        handler(9999, 0, emu_1.KeyFlags.KeyDown);
        assert_1.default.deepStrictEqual(calls, [null]);
        assert_1.default.strictEqual(switches[0], 0x00);
    });
    (0, mocha_1.it)('should pass through to callback when no map is given', function () {
        const switches = new Uint8Array(1);
        const calls = [];
        const handler = (0, emu_1.newKeyboardHandler)(switches, null, (o, key, code, flags) => {
            calls.push([o, key, code, flags]);
        });
        handler(65, 65, emu_1.KeyFlags.KeyDown);
        assert_1.default.deepStrictEqual(calls, [[null, 65, 65, emu_1.KeyFlags.KeyDown]]);
    });
});
(0, mocha_1.describe)('_setKeyboardEvents', function () {
    (0, mocha_1.it)('should wire keydown and keyup handlers', function () {
        const calls = [];
        const canvas = { onkeydown: null, onkeyup: null };
        (0, emu_1._setKeyboardEvents)(canvas, (which, keyCode, flags) => {
            calls.push([which, keyCode, flags]);
        });
        canvas.onkeydown({ which: 65, keyCode: 65, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault() { } });
        assert_1.default.deepStrictEqual(calls[0], [65, 65, emu_1.KeyFlags.KeyDown]);
        canvas.onkeyup({ which: 65, keyCode: 65, shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, preventDefault() { } });
        assert_1.default.deepStrictEqual(calls[1], [65, 65, emu_1.KeyFlags.KeyUp | emu_1.KeyFlags.Shift]);
    });
    (0, mocha_1.it)('should pass through modifier flags', function () {
        const calls = [];
        const canvas = { onkeydown: null, onkeyup: null };
        (0, emu_1._setKeyboardEvents)(canvas, (which, keyCode, flags) => {
            calls.push(flags);
        });
        canvas.onkeydown({ which: 13, keyCode: 13, shiftKey: true, ctrlKey: true, altKey: true, metaKey: true, preventDefault() { } });
        assert_1.default.strictEqual(calls[0], emu_1.KeyFlags.KeyDown | emu_1.KeyFlags.Shift | emu_1.KeyFlags.Ctrl | emu_1.KeyFlags.Alt | emu_1.KeyFlags.Meta);
    });
    (0, mocha_1.it)('should preventDefault on unmodified keydown only', function () {
        const prevented = [];
        const canvas = { onkeydown: null, onkeyup: null };
        (0, emu_1._setKeyboardEvents)(canvas, () => { });
        canvas.onkeydown({ which: 32, keyCode: 32, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault() { prevented.push('plain'); } });
        canvas.onkeydown({ which: 32, keyCode: 32, shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, preventDefault() { prevented.push('shift'); } });
        assert_1.default.deepStrictEqual(prevented, ['plain']);
    });
});
(0, mocha_1.describe)('padBytes', function () {
    (0, mocha_1.it)('should pad at the end by default', function () {
        const out = (0, emu_1.padBytes)([1, 2, 3], 8);
        assert_1.default.ok(out instanceof Uint8Array);
        assert_1.default.deepStrictEqual(Array.from(out), [1, 2, 3, 0, 0, 0, 0, 0]);
    });
    (0, mocha_1.it)('should pad at the start when requested', function () {
        const out = (0, emu_1.padBytes)(new Uint8Array([1, 2, 3]), 8, true);
        assert_1.default.deepStrictEqual(Array.from(out), [0, 0, 0, 0, 0, 1, 2, 3]);
    });
    (0, mocha_1.it)('should return unchanged data when length matches', function () {
        const out = (0, emu_1.padBytes)([0xAA, 0xBB], 2);
        assert_1.default.deepStrictEqual(Array.from(out), [0xAA, 0xBB]);
    });
    (0, mocha_1.it)('should throw when data is too long', function () {
        assert_1.default.throws(() => (0, emu_1.padBytes)([1, 2, 3], 2), /Data too long, 3 > 2/);
    });
});
(0, mocha_1.describe)('AddressDecoder', function () {
    (0, mocha_1.it)('should decode reads from a table', function () {
        const ram = new Uint8Array(256);
        ram[0x10] = 0x5A;
        const decode = (0, emu_1.newAddressDecoder)([[0x0000, 0x00FF, 0, (a) => ram[a]]]);
        assert_1.default.strictEqual(decode(0x10), 0x5A);
        assert_1.default.strictEqual(decode(0x99), 0x00);
    });
    (0, mocha_1.it)('should return default value for out-of-range addresses', function () {
        const ram = new Uint8Array(256);
        const decode = (0, emu_1.newAddressDecoder)([[0x0000, 0x00FF, 0, (a) => ram[a]]]);
        assert_1.default.strictEqual(decode(0x1000), 0);
    });
    (0, mocha_1.it)('should apply address masks', function () {
        const ram = new Uint8Array(0x800);
        ram[0x000] = 0x11;
        ram[0x7FF] = 0x22;
        const decode = (0, emu_1.newAddressDecoder)([[0x0000, 0x0FFF, 0x07FF, (a) => ram[a]]]);
        assert_1.default.strictEqual(decode(0x0000), 0x11);
        assert_1.default.strictEqual(decode(0x0800), 0x11); // 0x0800 & 0x07FF = 0x0000
        assert_1.default.strictEqual(decode(0x0FFF), 0x22); // 0x0FFF & 0x07FF = 0x07FF
    });
    (0, mocha_1.it)('should support write functions and mask the result', function () {
        const ram = new Uint8Array(0x800);
        const decode = (0, emu_1.newAddressDecoder)([[0x0000, 0x0FFF, 0x07FF,
                (a, v) => { if (v !== undefined)
                    ram[a] = v; return ram[a]; }]]);
        decode(0x0801, 0x99); // writes to 0x0801 & 0x07FF = 0x0001
        assert_1.default.strictEqual(ram[0x001], 0x99);
        assert_1.default.strictEqual(ram[0x801], undefined);
        assert_1.default.strictEqual(decode(0x0801), 0x99);
    });
    (0, mocha_1.it)('should apply a global mask before decoding', function () {
        const ram = new Uint8Array(0x100);
        ram[0x00] = 0x11;
        ram[0x20] = 0x22;
        const decode = (0, emu_1.newAddressDecoder)([[0x0000, 0x00FF, 0, (a) => ram[a]]], { gmask: 0x0FFF, defaultval: 0xFF });
        assert_1.default.strictEqual(decode(0x1000), 0x11); // 0x1000 & 0x0FFF = 0x0000
        assert_1.default.strictEqual(decode(0x0020), 0x22);
        assert_1.default.strictEqual(decode(0x1234), 0xFF); // masked to 0x0234, out of range
    });
    (0, mocha_1.it)('should handle an empty table with a default value', function () {
        const decode = (0, emu_1.newAddressDecoder)([], { defaultval: 0xEE });
        assert_1.default.strictEqual(decode(0x0000), 0xEE);
        const decode2 = (0, emu_1.newAddressDecoder)([]);
        assert_1.default.strictEqual(decode2(0x0000), 0);
    });
    (0, mocha_1.it)('should be usable as a constructor directly', function () {
        const decode = new emu_1.AddressDecoder([[0x0000, 0xFFFF, 0, () => 0x42]]);
        assert_1.default.strictEqual(decode(0x1234), 0x42);
    });
});
(0, mocha_1.describe)('AnimationTimer', function () {
    (0, mocha_1.it)('should invoke callback at scheduled intervals', function () {
        let count = 0;
        const timer = new emu_1.AnimationTimer(100, () => count++); // 10ms per frame
        timer.running = true;
        timer.nextFrame(50); // ts > nextts(0)
        assert_1.default.strictEqual(count, 1);
        timer.nextFrame(60); // ts(60) < nextts(100)
        assert_1.default.strictEqual(count, 2);
        timer.nextFrame(150); // ts > nextts(100)
        assert_1.default.strictEqual(count, 3); //
        timer.running = false;
    });
    (0, mocha_1.it)('should not invoke callback when not running', function () {
        let count = 0;
        const timer = new emu_1.AnimationTimer(100, () => count++);
        timer.nextFrame(50);
        assert_1.default.strictEqual(count, 0);
        timer.running = true;
        timer.nextFrame(60);
        assert_1.default.strictEqual(count, 1);
        timer.running = false;
    });
    (0, mocha_1.it)('should catch up after large gaps', function () {
        let count = 0;
        const timer = new emu_1.AnimationTimer(100, () => count++);
        timer.running = true;
        timer.nextts = 500;
        timer.nextFrame(3000); // > 1s gap: should catch up
        assert_1.default.strictEqual(count, 1);
        assert_1.default.strictEqual(timer.nextts, 3000);
        timer.running = false;
    });
    (0, mocha_1.it)('should set frame timing properties', function () {
        const timer = new emu_1.AnimationTimer(60, () => { });
        assert_1.default.strictEqual(timer.frameRate, 60);
        assert_1.default.strictEqual(timer.intervalMsec, 1000 / 60);
    });
    (0, mocha_1.it)('should start/stop and report running state', function () {
        const timer = new emu_1.AnimationTimer(60, () => { });
        assert_1.default.strictEqual(timer.isRunning(), false);
        timer.start();
        assert_1.default.strictEqual(timer.isRunning(), true);
        timer.stop();
        assert_1.default.strictEqual(timer.isRunning(), false);
    });
});
(0, mocha_1.describe)('drawCrosshair', function () {
    (0, mocha_1.it)('should no-op without setLineDash (unit testing support)', function () {
        let called = false;
        const ctx = { fillRect: () => { called = true; } };
        (0, emu_1.drawCrosshair)(ctx, 10, 20, 2);
        assert_1.default.strictEqual(called, false);
    });
    (0, mocha_1.it)('should draw vertical and horizontal lines', function () {
        const calls = [];
        const ctx = {
            fillStyle: '', strokeStyle: '', lineWidth: 0,
            setLineDash: (d) => calls.push(['setLineDash', String(d)]),
            fillRect: (x, y, w, h) => calls.push(['fillRect', x, y, w, h]),
            beginPath: () => calls.push(['beginPath']),
            moveTo: (x, y) => calls.push(['moveTo', x, y]),
            lineTo: (x, y) => calls.push(['lineTo', x, y]),
            stroke: () => calls.push(['stroke']),
        };
        (0, emu_1.drawCrosshair)(ctx, 10, 20, 2);
        assert_1.default.ok(calls.some(c => c[0] === 'fillRect' && c[1] === 8), 'vertical bar at x-2');
        assert_1.default.ok(calls.some(c => c[0] === 'fillRect' && c[2] === 18), 'horizontal bar at y-2');
        assert_1.default.ok(calls.some(c => c[0] === 'moveTo' && c[1] === 10), 'vertical line at x');
        assert_1.default.ok(calls.some(c => c[0] === 'moveTo' && c[2] === 20), 'horizontal line at y');
        assert_1.default.ok(calls.some(c => c[0] === 'setLineDash' && c[1] === '4,4'), 'dash pattern 2*width');
        assert_1.default.ok(calls.some(c => c[0] === 'stroke'), 'stroke called');
    });
});
(0, mocha_1.describe)('ControllerPoller', function () {
    const realWindow = global.window;
    // node defines a getter-only global navigator, so it can't just be assigned
    const realNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
    function setNavigator(nav) {
        Object.defineProperty(global, 'navigator', { value: nav, configurable: true, writable: true });
    }
    let pads;
    let listeners;
    let events;
    // builds a poller wired to two fake standard-layout gamepads
    function newPoller() {
        pads = [0, 1].map(() => ({
            axes: [0, 0],
            buttons: new Array(16).fill(null).map(() => ({ pressed: false })),
        }));
        listeners = {};
        events = [];
        global.window = { addEventListener: (n, f) => { listeners[n] = f; } };
        setNavigator({ getGamepads: () => pads });
        return new emu_1.ControllerPoller((key, code, flags) => { events.push([key, flags]); });
    }
    // polls and returns the keys that went down/up since the last call
    function poll(poller) {
        events = [];
        poller.poll();
        return events;
    }
    function down(k) { return [k.c, emu_1.KeyFlags.KeyDown]; }
    function up(k) { return [k.c, emu_1.KeyFlags.KeyUp]; }
    after(function () {
        if (realWindow === undefined)
            delete global.window;
        else
            global.window = realWindow;
        if (realNavigator === undefined)
            delete global.navigator;
        else
            Object.defineProperty(global, 'navigator', realNavigator);
    });
    (0, mocha_1.it)('should stay inactive until a gamepad connects', function () {
        const poller = newPoller();
        assert_1.default.strictEqual(poller.active, false);
        pads[0].buttons[0].pressed = true;
        assert_1.default.deepStrictEqual(poll(poller), []); // no state array yet, must not throw
    });
    (0, mocha_1.it)('should activate on the gamepadconnected event', function () {
        const poller = newPoller();
        listeners['gamepadconnected']({});
        assert_1.default.strictEqual(poller.active, true);
        assert_1.default.deepStrictEqual(poll(poller), []); // nothing pressed yet
    });
    (0, mocha_1.it)('should report button presses and releases once each', function () {
        const poller = newPoller();
        listeners['gamepadconnected']({});
        poll(poller);
        pads[0].buttons[9].pressed = true;
        assert_1.default.deepStrictEqual(poll(poller), [down(emu_1.Keys.START)]);
        assert_1.default.deepStrictEqual(poll(poller), []); // held, not re-sent
        pads[0].buttons[9].pressed = false;
        assert_1.default.deepStrictEqual(poll(poller), [up(emu_1.Keys.START)]);
    });
    (0, mocha_1.it)('should send every key sharing a button, not just the first', function () {
        // A and GP_A are both button 0 -- platforms bind one or the other
        const poller = newPoller();
        listeners['gamepadconnected']({});
        poll(poller);
        pads[0].buttons[0].pressed = true;
        assert_1.default.deepStrictEqual(poll(poller), [down(emu_1.Keys.A), down(emu_1.Keys.GP_A)]);
    });
    (0, mocha_1.it)('should map the face buttons past B', function () {
        const poller = newPoller();
        listeners['gamepadconnected']({});
        poll(poller);
        pads[0].buttons[2].pressed = true;
        pads[0].buttons[3].pressed = true;
        assert_1.default.deepStrictEqual(poll(poller), [down(emu_1.Keys.GP_C), down(emu_1.Keys.GP_D)]);
    });
    (0, mocha_1.it)('should translate axes into direction keys', function () {
        const poller = newPoller();
        listeners['gamepadconnected']({});
        poll(poller);
        pads[0].axes[0] = -1;
        assert_1.default.deepStrictEqual(poll(poller), [down(emu_1.Keys.LEFT)]);
        pads[0].axes[0] = 0;
        assert_1.default.deepStrictEqual(poll(poller), [up(emu_1.Keys.LEFT)]);
        pads[0].axes[1] = 1;
        assert_1.default.deepStrictEqual(poll(poller), [down(emu_1.Keys.DOWN)]);
        pads[0].axes[1] = 0;
        assert_1.default.deepStrictEqual(poll(poller), [up(emu_1.Keys.DOWN)]);
    });
    (0, mocha_1.it)('should release the old direction when an axis flicks across center', function () {
        const poller = newPoller();
        listeners['gamepadconnected']({});
        poll(poller);
        pads[0].axes[0] = -1;
        assert_1.default.deepStrictEqual(poll(poller), [down(emu_1.Keys.LEFT)]);
        // -1 to +1 in one poll: LEFT must not stay stuck down
        pads[0].axes[0] = 1;
        assert_1.default.deepStrictEqual(poll(poller), [up(emu_1.Keys.LEFT), down(emu_1.Keys.RIGHT)]);
        pads[0].axes[1] = -1;
        assert_1.default.deepStrictEqual(poll(poller), [down(emu_1.Keys.UP)]);
        pads[0].axes[1] = 1;
        assert_1.default.deepStrictEqual(poll(poller), [up(emu_1.Keys.UP), down(emu_1.Keys.DOWN)]);
    });
    (0, mocha_1.it)('should route the second gamepad to the player 2 keys', function () {
        const poller = newPoller();
        listeners['gamepadconnected']({});
        poll(poller);
        pads[1].axes[1] = -1;
        pads[1].buttons[9].pressed = true;
        assert_1.default.deepStrictEqual(poll(poller), [down(emu_1.Keys.P2_UP), down(emu_1.Keys.P2_START)]);
        // player 1 keys must not fire for player 2's pad
        assert_1.default.ok(!events.some(e => e[0] == emu_1.Keys.UP.c || e[0] == emu_1.Keys.START.c));
    });
    (0, mocha_1.it)('should ignore axes a key does not use', function () {
        // A is button-only, so it must not react to any axis movement
        const poller = newPoller();
        listeners['gamepadconnected']({});
        poll(poller);
        pads[0].axes[0] = 1;
        pads[0].axes[1] = 1;
        const codes = poll(poller).map(e => e[0]);
        assert_1.default.ok(!codes.includes(emu_1.Keys.A.c));
        assert_1.default.deepStrictEqual(codes, [emu_1.Keys.RIGHT.c, emu_1.Keys.DOWN.c]); // x axis polled before y
    });
    (0, mocha_1.it)('should drop gamepad state on disconnect', function () {
        const poller = newPoller();
        listeners['gamepadconnected']({});
        poll(poller);
        pads[0].buttons[0].pressed = true;
        poll(poller);
        listeners['gamepaddisconnected']({});
        // state is cleared, so a held button reads as a fresh press
        assert_1.default.deepStrictEqual(poll(poller), [down(emu_1.Keys.A), down(emu_1.Keys.GP_A)]);
    });
});
(0, mocha_1.describe)('getMousePos', function () {
    const realWindow = global.window;
    after(function () {
        if (realWindow === undefined)
            delete global.window;
        else
            global.window = realWindow;
    });
    function stubWindow() {
        global.window = {
            getComputedStyle: () => ({
                borderLeftWidth: '0px', borderRightWidth: '0px',
                borderTopWidth: '0px', borderBottomWidth: '0px',
                paddingLeft: '0px', paddingRight: '0px',
                paddingTop: '0px', paddingBottom: '0px',
            })
        };
    }
    (0, mocha_1.it)('should clamp out-of-bounds coordinates', function () {
        stubWindow();
        const canvas = {
            width: 100, height: 100,
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
        };
        const pos = (0, emu_1.getMousePos)(canvas, { clientX: 10000, clientY: -100 });
        assert_1.default.deepStrictEqual(pos, { x: 100, y: 0 });
    });
    (0, mocha_1.it)('should account for borders and padding', function () {
        global.window = {
            getComputedStyle: () => ({
                borderLeftWidth: '2px', borderRightWidth: '2px',
                borderTopWidth: '2px', borderBottomWidth: '2px',
                paddingLeft: '2px', paddingRight: '2px',
                paddingTop: '2px', paddingBottom: '2px',
            })
        };
        const canvas = {
            width: 100, height: 100,
            getBoundingClientRect: () => ({ left: 10, top: 10, width: 108, height: 108 })
        };
        // content origin = rect.left + border(2) + padding(2) = 14
        let pos = (0, emu_1.getMousePos)(canvas, { clientX: 14, clientY: 14 });
        assert_1.default.deepStrictEqual(pos, { x: 0, y: 0 });
        // content far edge
        pos = (0, emu_1.getMousePos)(canvas, { clientX: 14 + 99, clientY: 14 + 99 });
        assert_1.default.ok(pos.x >= 99 && pos.x <= 100);
    });
});
//# sourceMappingURL=testemu.js.map