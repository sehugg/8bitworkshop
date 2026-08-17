import assert from "assert";
import { describe, it } from "mocha";
import {
  noise, getNoiseSeed, setNoiseSeed, KeyFlags, RAM, EmuHalt,
  AnimationTimer, dumpRAM, Keys, makeKeycodeMap, newKeyboardHandler,
  _setKeyboardEvents, padBytes, AddressDecoder, newAddressDecoder,
  getMousePos, drawCrosshair, ControllerPoller,
} from "../../src/common/emu";

describe('Noise PRNG', function () {
  it('should produce a deterministic sequence from seed 1', function () {
    setNoiseSeed(1);
    const seq = [];
    for (let i = 0; i < 8; i++) seq.push(noise());
    assert.deepStrictEqual(seq, [33, 1, 34, 25, 250, 201, 8, 180]);
  });

  it('should track and restore the seed', function () {
    setNoiseSeed(0x1234);
    assert.strictEqual(getNoiseSeed(), 0x1234);
    noise();
    assert.notStrictEqual(getNoiseSeed(), 0x1234);
  });

  it('should return 0 forever for seed 0', function () {
    setNoiseSeed(0);
    assert.strictEqual(noise(), 0);
    assert.strictEqual(noise(), 0);
    assert.strictEqual(noise(), 0);
    assert.strictEqual(getNoiseSeed(), 0);
  });

  it('should always return a byte', function () {
    setNoiseSeed(1);
    for (let i = 0; i < 100; i++) {
      const n = noise();
      assert.ok(n >= 0 && n <= 255);
    }
  });
});

describe('KeyFlags Enumeration', function () {
  it('should have correct flag values', function () {
    assert.strictEqual(KeyFlags.KeyDown, 1);
    assert.strictEqual(KeyFlags.Shift, 2);
    assert.strictEqual(KeyFlags.Ctrl, 4);
    assert.strictEqual(KeyFlags.Alt, 8);
    assert.strictEqual(KeyFlags.Meta, 16);
    assert.strictEqual(KeyFlags.KeyUp, 64);
    assert.strictEqual(KeyFlags.KeyPress, 128);
  });
});

describe('RAM Class', function () {
  it('should allocate zero-initialized memory', function () {
    const ram = new RAM(16);
    assert.ok(ram.mem instanceof Uint8Array);
    assert.strictEqual(ram.mem.length, 16);
    assert.strictEqual(ram.mem[0], 0);
    assert.strictEqual(ram.mem[15], 0);
  });

  it('should allow reading and writing', function () {
    const ram = new RAM(4);
    ram.mem[2] = 0xAA;
    assert.strictEqual(ram.mem[2], 0xAA);
  });
});

describe('EmuHalt', function () {
  it('should be an Error subclass with default properties', function () {
    const e = new EmuHalt("Halt!");
    assert.ok(e instanceof Error);
    assert.ok(e instanceof EmuHalt);
    assert.strictEqual(e.message, "Halt!");
    assert.ok(e.squelchError);
    assert.strictEqual(e.$loc, undefined);
  });

  it('should carry a source location', function () {
    const e = new EmuHalt("bad opcode", { line: 42 } as any);
    assert.deepStrictEqual(e.$loc, { line: 42 });
  });

  it('should be catchable via instanceof', function () {
    let caught = null;
    try {
      throw new EmuHalt("boom");
    } catch (err) {
      caught = err;
    }
    assert.ok(caught instanceof EmuHalt);
    assert.ok(caught instanceof Error);
    assert.strictEqual(caught.message, "boom");
  });
});

describe('dumpRAM', function () {
  it('should format a Uint8Array dump', function () {
    const ram = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    assert.strictEqual(dumpRAM(ram, 0, 16),
      "$00: 00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F\n");
  });

  it('should show the base offset in addresses', function () {
    const ram = new Uint8Array([1, 2, 3]);
    assert.strictEqual(dumpRAM(ram, 0x8000, 8),
      "$8000: 01 02 03\n");
  });

  it('should format a Uint16Array dump', function () {
    const ram = new Uint16Array([0x1234, 0x5678, 0x9ABC, 0xDEF0, 0x1111, 0x2222, 0x3333, 0x4444]);
    assert.strictEqual(dumpRAM(ram, 0, 16),
      "$00: 1234 5678 9ABC DEF0  1111 2222 3333 4444\n$08:\n");
  });

  it('should format a Float32Array dump with precision', function () {
    const ram = new Float32Array([1.5, 2.25, 3.125, 0.5]);
    assert.strictEqual(dumpRAM(ram, 0, 8),
      "$00: 1.5000000 2.2500000  3.1250000 0.50000000\n$04:\n");
  });

  it('should handle plain arrays (BYTES_PER_ELEMENT fallback)', function () {
    assert.strictEqual(dumpRAM([0x0A, 0x0B], 0, 2), "$00: 0A 0B\n");
  });
});

describe('Keys Table', function () {
  it('should define directional and action keys', function () {
    assert.strictEqual(Keys.UP.c, 38);
    assert.strictEqual(Keys.DOWN.c, 40);
    assert.strictEqual(Keys.LEFT.c, 37);
    assert.strictEqual(Keys.RIGHT.c, 39);
    assert.strictEqual(Keys.A.c, 32); // Space
    assert.strictEqual(Keys.B.c, 16); // Shift
    assert.strictEqual(Keys.SELECT.c, 220);
    assert.strictEqual(Keys.START.c, 13);
    assert.strictEqual(Keys.ANYKEY.c, 0);
  });

  it('should annotate gamepad mapping metadata', function () {
    assert.strictEqual(Keys.UP.plyr, 0);
    assert.strictEqual(Keys.UP.button, 12);
    assert.strictEqual(Keys.UP.yaxis, -1);
    assert.strictEqual(Keys.RIGHT.xaxis, 1);
    assert.strictEqual(Keys.A.button, 0);
    assert.strictEqual(Keys.P2_UP.plyr, 1);
    assert.strictEqual(Keys.P2_UP.c, 87); // W
  });

  it('should define function keys and misc keys', function () {
    assert.strictEqual(Keys.VK_ESCAPE.c, 27);
    assert.strictEqual(Keys.VK_F1.c, 112);
    assert.strictEqual(Keys.VK_F12.c, 123);
    assert.strictEqual(Keys.VK_ENTER.c, 13);
    assert.strictEqual(Keys.VK_SPACE.c, 32);
  });

  it('should give every key a name and numeric code', function () {
    const entries = Object.keys(Keys);
    assert.ok(entries.length >= 100);
    for (const name of entries) {
      assert.ok(name.length > 0);
      const def = Keys[name];
      assert.strictEqual(typeof def.c, 'number');
      assert.ok(def.n.length > 0, `key ${name} should have a name`);
    }
  });
});

describe('makeKeycodeMap', function () {
  it('should build a map keyed by keycode', function () {
    const map = makeKeycodeMap([[Keys.A, 0, 0x01], [Keys.B, 0, 0x02]]);
    assert.ok(map instanceof Map);
    assert.strictEqual(map[32].index, 0);
    assert.strictEqual(map[32].mask, 0x01);
    assert.strictEqual(map[32].def, Keys.A);
    assert.strictEqual(map[16].index, 0);
    assert.strictEqual(map[16].mask, 0x02);
    assert.strictEqual(map[9999], undefined);
  });
});

describe('newKeyboardHandler', function () {
  it('should set switches on keydown and clear on keyup', function () {
    const map = makeKeycodeMap([[Keys.A, 0, 0x01]]);
    const switches = new Uint8Array(2);
    const handler = newKeyboardHandler(switches, map);
    handler(32, 0, KeyFlags.KeyDown); // A (Space)
    assert.strictEqual(switches[0], 0x01);
    handler(32, 0, KeyFlags.KeyDown); // idempotent
    assert.strictEqual(switches[0], 0x01);
    handler(32, 0, KeyFlags.KeyUp);
    assert.strictEqual(switches[0], 0x00);
  });

  it('should support multiple keys and switch indices', function () {
    const map = makeKeycodeMap([
      [Keys.A, 0, 0x01],
      [Keys.B, 0, 0x02],
      [Keys.UP, 1, 0x80],
    ]);
    const switches = new Uint8Array(2);
    const handler = newKeyboardHandler(switches, map);
    handler(32, 0, KeyFlags.KeyDown);
    handler(16, 0, KeyFlags.KeyDown);
    handler(38, 0, KeyFlags.KeyDown);
    assert.strictEqual(switches[0], 0x03);
    assert.strictEqual(switches[1], 0x80);
    handler(32, 0, KeyFlags.KeyUp);
    assert.strictEqual(switches[0], 0x02);
  });

  it('should support active-low (negative mask) switches', function () {
    const map = makeKeycodeMap([[Keys.START, 0, -0x01]]);
    const switches = new Uint8Array(1);
    const handler = newKeyboardHandler(switches, map);
    switches[0] = 0x01;
    handler(13, 0, KeyFlags.KeyDown); // active-low press clears the bit
    assert.strictEqual(switches[0], 0x00);
    handler(13, 0, KeyFlags.KeyUp); // release sets the bit
    assert.strictEqual(switches[0], 0x01);
  });

  it('should fall back to ANYKEY entry for unknown keys', function () {
    const map = makeKeycodeMap([[Keys.ANYKEY, 0, 0x40]]);
    const switches = new Uint8Array(1);
    const handler = newKeyboardHandler(switches, map);
    handler(9999, 0, KeyFlags.KeyDown);
    assert.strictEqual(switches[0], 0x40);
    handler(9999, 0, KeyFlags.KeyUp);
    assert.strictEqual(switches[0], 0x00);
  });

  it('should ignore unmapped keys when no ANYKEY entry exists', function () {
    const map = makeKeycodeMap([[Keys.A, 0, 0x01]]);
    const switches = new Uint8Array(1);
    const handler = newKeyboardHandler(switches, map);
    handler(9999, 0, KeyFlags.KeyDown);
    assert.strictEqual(switches[0], 0x00);
  });

  it('should invoke the callback function with key info', function () {
    const map = makeKeycodeMap([[Keys.A, 0, 0x01]]);
    const switches = new Uint8Array(1);
    const calls = [];
    const handler = newKeyboardHandler(switches, map, (o, key, code, flags) => {
      calls.push([o && o.def.n, key, code, flags]);
    });
    handler(32, 65, KeyFlags.KeyDown | KeyFlags.Shift);
    assert.deepStrictEqual(calls, [['Space', 32, 65, KeyFlags.KeyDown | KeyFlags.Shift]]);
  });

  it('should invoke callback for unmapped keys only with alwaysfunc', function () {
    const map = makeKeycodeMap([[Keys.A, 0, 0x01]]);
    const switches = new Uint8Array(1);
    const calls = [];
    const handler = newKeyboardHandler(switches, map, (o) => {
      calls.push(o ? o.def.n : null);
    }, true);
    handler(9999, 0, KeyFlags.KeyDown);
    assert.deepStrictEqual(calls, [null]);
    assert.strictEqual(switches[0], 0x00);
  });

  it('should pass through to callback when no map is given', function () {
    const switches = new Uint8Array(1);
    const calls = [];
    const handler = newKeyboardHandler(switches, null, (o, key, code, flags) => {
      calls.push([o, key, code, flags]);
    });
    handler(65, 65, KeyFlags.KeyDown);
    assert.deepStrictEqual(calls, [[null, 65, 65, KeyFlags.KeyDown]]);
  });
});

describe('_setKeyboardEvents', function () {
  it('should wire keydown and keyup handlers', function () {
    const calls = [];
    const canvas: any = { onkeydown: null, onkeyup: null };
    _setKeyboardEvents(canvas, (which, keyCode, flags) => {
      calls.push([which, keyCode, flags]);
    });
    canvas.onkeydown({ which: 65, keyCode: 65, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault() { } });
    assert.deepStrictEqual(calls[0], [65, 65, KeyFlags.KeyDown]);
    canvas.onkeyup({ which: 65, keyCode: 65, shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, preventDefault() { } });
    assert.deepStrictEqual(calls[1], [65, 65, KeyFlags.KeyUp | KeyFlags.Shift]);
  });

  it('should pass through modifier flags', function () {
    const calls = [];
    const canvas: any = { onkeydown: null, onkeyup: null };
    _setKeyboardEvents(canvas, (which, keyCode, flags) => {
      calls.push(flags);
    });
    canvas.onkeydown({ which: 13, keyCode: 13, shiftKey: true, ctrlKey: true, altKey: true, metaKey: true, preventDefault() { } });
    assert.strictEqual(calls[0], KeyFlags.KeyDown | KeyFlags.Shift | KeyFlags.Ctrl | KeyFlags.Alt | KeyFlags.Meta);
  });

  it('should preventDefault on unmodified keydown only', function () {
    const prevented = [];
    const canvas: any = { onkeydown: null, onkeyup: null };
    _setKeyboardEvents(canvas, () => { });
    canvas.onkeydown({ which: 32, keyCode: 32, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, preventDefault() { prevented.push('plain'); } });
    canvas.onkeydown({ which: 32, keyCode: 32, shiftKey: true, ctrlKey: false, altKey: false, metaKey: false, preventDefault() { prevented.push('shift'); } });
    assert.deepStrictEqual(prevented, ['plain']);
  });
});

describe('padBytes', function () {
  it('should pad at the end by default', function () {
    const out = padBytes([1, 2, 3], 8);
    assert.ok(out instanceof Uint8Array);
    assert.deepStrictEqual(Array.from(out), [1, 2, 3, 0, 0, 0, 0, 0]);
  });

  it('should pad at the start when requested', function () {
    const out = padBytes(new Uint8Array([1, 2, 3]), 8, true);
    assert.deepStrictEqual(Array.from(out), [0, 0, 0, 0, 0, 1, 2, 3]);
  });

  it('should return unchanged data when length matches', function () {
    const out = padBytes([0xAA, 0xBB], 2);
    assert.deepStrictEqual(Array.from(out), [0xAA, 0xBB]);
  });

  it('should throw when data is too long', function () {
    assert.throws(() => padBytes([1, 2, 3], 2), /Data too long, 3 > 2/);
  });
});

describe('AddressDecoder', function () {
  it('should decode reads from a table', function () {
    const ram = new Uint8Array(256);
    ram[0x10] = 0x5A;
    const decode = newAddressDecoder([[0x0000, 0x00FF, 0, (a) => ram[a]]]);
    assert.strictEqual(decode(0x10), 0x5A);
    assert.strictEqual(decode(0x99), 0x00);
  });

  it('should return default value for out-of-range addresses', function () {
    const ram = new Uint8Array(256);
    const decode = newAddressDecoder([[0x0000, 0x00FF, 0, (a) => ram[a]]]);
    assert.strictEqual(decode(0x1000), 0);
  });

  it('should apply address masks', function () {
    const ram = new Uint8Array(0x800);
    ram[0x000] = 0x11;
    ram[0x7FF] = 0x22;
    const decode = newAddressDecoder([[0x0000, 0x0FFF, 0x07FF, (a) => ram[a]]]);
    assert.strictEqual(decode(0x0000), 0x11);
    assert.strictEqual(decode(0x0800), 0x11); // 0x0800 & 0x07FF = 0x0000
    assert.strictEqual(decode(0x0FFF), 0x22); // 0x0FFF & 0x07FF = 0x07FF
  });

  it('should support write functions and mask the result', function () {
    const ram = new Uint8Array(0x800);
    const decode = newAddressDecoder([[0x0000, 0x0FFF, 0x07FF,
      (a, v) => { if (v !== undefined) ram[a] = v; return ram[a]; }]]);
    decode(0x0801, 0x99); // writes to 0x0801 & 0x07FF = 0x0001
    assert.strictEqual(ram[0x001], 0x99);
    assert.strictEqual(ram[0x801], undefined);
    assert.strictEqual(decode(0x0801), 0x99);
  });

  it('should apply a global mask before decoding', function () {
    const ram = new Uint8Array(0x100);
    ram[0x00] = 0x11;
    ram[0x20] = 0x22;
    const decode = newAddressDecoder([[0x0000, 0x00FF, 0, (a) => ram[a]]],
      { gmask: 0x0FFF, defaultval: 0xFF });
    assert.strictEqual(decode(0x1000), 0x11); // 0x1000 & 0x0FFF = 0x0000
    assert.strictEqual(decode(0x0020), 0x22);
    assert.strictEqual(decode(0x1234), 0xFF); // masked to 0x0234, out of range
  });

  it('should handle an empty table with a default value', function () {
    const decode = newAddressDecoder([], { defaultval: 0xEE });
    assert.strictEqual(decode(0x0000), 0xEE);
    const decode2 = newAddressDecoder([]);
    assert.strictEqual(decode2(0x0000), 0);
  });

  it('should be usable as a constructor directly', function () {
    const decode = new (AddressDecoder as any)([[0x0000, 0xFFFF, 0, () => 0x42]]);
    assert.strictEqual(decode(0x1234), 0x42);
  });
});

describe('AnimationTimer', function () {
  it('should invoke callback at scheduled intervals', function () {
    let count = 0;
    const timer = new AnimationTimer(100, () => count++); // 10ms per frame
    timer.running = true;
    timer.nextFrame(50); // ts > nextts(0)
    assert.strictEqual(count, 1);
    timer.nextFrame(60); // ts(60) < nextts(100)
    assert.strictEqual(count, 2);
    timer.nextFrame(150); // ts > nextts(100)
    assert.strictEqual(count, 3); //
    timer.running = false;
  });

  it('should not invoke callback when not running', function () {
    let count = 0;
    const timer = new AnimationTimer(100, () => count++);
    timer.nextFrame(50);
    assert.strictEqual(count, 0);
    timer.running = true;
    timer.nextFrame(60);
    assert.strictEqual(count, 1);
    timer.running = false;
  });

  it('should catch up after large gaps', function () {
    let count = 0;
    const timer = new AnimationTimer(100, () => count++);
    timer.running = true;
    timer.nextts = 500;
    timer.nextFrame(3000); // > 1s gap: should catch up
    assert.strictEqual(count, 1);
    assert.strictEqual(timer.nextts, 3000);
    timer.running = false;
  });

  it('should set frame timing properties', function () {
    const timer = new AnimationTimer(60, () => { });
    assert.strictEqual(timer.frameRate, 60);
    assert.strictEqual(timer.intervalMsec, 1000 / 60);
  });

  it('should start/stop and report running state', function () {
    const timer = new AnimationTimer(60, () => { });
    assert.strictEqual(timer.isRunning(), false);
    timer.start();
    assert.strictEqual(timer.isRunning(), true);
    timer.stop();
    assert.strictEqual(timer.isRunning(), false);
  });
});

describe('drawCrosshair', function () {
  it('should no-op without setLineDash (unit testing support)', function () {
    let called = false;
    const ctx: any = { fillRect: () => { called = true; } };
    drawCrosshair(ctx, 10, 20, 2);
    assert.strictEqual(called, false);
  });

  it('should draw vertical and horizontal lines', function () {
    const calls: any[][] = [];
    const ctx: any = {
      fillStyle: '', strokeStyle: '', lineWidth: 0,
      setLineDash: (d) => calls.push(['setLineDash', String(d)]),
      fillRect: (x, y, w, h) => calls.push(['fillRect', x, y, w, h]),
      beginPath: () => calls.push(['beginPath']),
      moveTo: (x, y) => calls.push(['moveTo', x, y]),
      lineTo: (x, y) => calls.push(['lineTo', x, y]),
      stroke: () => calls.push(['stroke']),
    };
    drawCrosshair(ctx, 10, 20, 2);
    assert.ok(calls.some(c => c[0] === 'fillRect' && c[1] === 8), 'vertical bar at x-2');
    assert.ok(calls.some(c => c[0] === 'fillRect' && c[2] === 18), 'horizontal bar at y-2');
    assert.ok(calls.some(c => c[0] === 'moveTo' && c[1] === 10), 'vertical line at x');
    assert.ok(calls.some(c => c[0] === 'moveTo' && c[2] === 20), 'horizontal line at y');
    assert.ok(calls.some(c => c[0] === 'setLineDash' && c[1] === '4,4'), 'dash pattern 2*width');
    assert.ok(calls.some(c => c[0] === 'stroke'), 'stroke called');
  });
});

describe('ControllerPoller', function () {
  const realWindow = (global as any).window;
  // node defines a getter-only global navigator, so it can't just be assigned
  const realNavigator = Object.getOwnPropertyDescriptor(global, 'navigator');
  function setNavigator(nav) {
    Object.defineProperty(global, 'navigator', { value: nav, configurable: true, writable: true });
  }

  let pads: any[];
  let listeners: { [name: string]: (e: any) => void };
  let events: [number, number][];

  // builds a poller wired to two fake standard-layout gamepads
  function newPoller() {
    pads = [0, 1].map(() => ({
      axes: [0, 0],
      buttons: new Array(16).fill(null).map(() => ({ pressed: false })),
    }));
    listeners = {};
    events = [];
    (global as any).window = { addEventListener: (n, f) => { listeners[n] = f; } };
    setNavigator({ getGamepads: () => pads });
    return new ControllerPoller((key, code, flags) => { events.push([key, flags]); });
  }

  // polls and returns the keys that went down/up since the last call
  function poll(poller: ControllerPoller) {
    events = [];
    poller.poll();
    return events;
  }

  function down(k) { return [k.c, KeyFlags.KeyDown]; }
  function up(k) { return [k.c, KeyFlags.KeyUp]; }

  after(function () {
    if (realWindow === undefined) delete (global as any).window;
    else (global as any).window = realWindow;
    if (realNavigator === undefined) delete (global as any).navigator;
    else Object.defineProperty(global, 'navigator', realNavigator);
  });

  it('should stay inactive until a gamepad connects', function () {
    const poller = newPoller();
    assert.strictEqual(poller.active, false);
    pads[0].buttons[0].pressed = true;
    assert.deepStrictEqual(poll(poller), []); // no state array yet, must not throw
  });

  it('should activate on the gamepadconnected event', function () {
    const poller = newPoller();
    listeners['gamepadconnected']({});
    assert.strictEqual(poller.active, true);
    assert.deepStrictEqual(poll(poller), []); // nothing pressed yet
  });

  it('should report button presses and releases once each', function () {
    const poller = newPoller();
    listeners['gamepadconnected']({});
    poll(poller);
    pads[0].buttons[9].pressed = true;
    assert.deepStrictEqual(poll(poller), [down(Keys.START)]);
    assert.deepStrictEqual(poll(poller), []); // held, not re-sent
    pads[0].buttons[9].pressed = false;
    assert.deepStrictEqual(poll(poller), [up(Keys.START)]);
  });

  it('should send every key sharing a button, not just the first', function () {
    // A and GP_A are both button 0 -- platforms bind one or the other
    const poller = newPoller();
    listeners['gamepadconnected']({});
    poll(poller);
    pads[0].buttons[0].pressed = true;
    assert.deepStrictEqual(poll(poller), [down(Keys.A), down(Keys.GP_A)]);
  });

  it('should map the face buttons past B', function () {
    const poller = newPoller();
    listeners['gamepadconnected']({});
    poll(poller);
    pads[0].buttons[2].pressed = true;
    pads[0].buttons[3].pressed = true;
    assert.deepStrictEqual(poll(poller), [down(Keys.GP_C), down(Keys.GP_D)]);
  });

  it('should translate axes into direction keys', function () {
    const poller = newPoller();
    listeners['gamepadconnected']({});
    poll(poller);
    pads[0].axes[0] = -1;
    assert.deepStrictEqual(poll(poller), [down(Keys.LEFT)]);
    pads[0].axes[0] = 0;
    assert.deepStrictEqual(poll(poller), [up(Keys.LEFT)]);
    pads[0].axes[1] = 1;
    assert.deepStrictEqual(poll(poller), [down(Keys.DOWN)]);
    pads[0].axes[1] = 0;
    assert.deepStrictEqual(poll(poller), [up(Keys.DOWN)]);
  });

  it('should release the old direction when an axis flicks across center', function () {
    const poller = newPoller();
    listeners['gamepadconnected']({});
    poll(poller);
    pads[0].axes[0] = -1;
    assert.deepStrictEqual(poll(poller), [down(Keys.LEFT)]);
    // -1 to +1 in one poll: LEFT must not stay stuck down
    pads[0].axes[0] = 1;
    assert.deepStrictEqual(poll(poller), [up(Keys.LEFT), down(Keys.RIGHT)]);
    pads[0].axes[1] = -1;
    assert.deepStrictEqual(poll(poller), [down(Keys.UP)]);
    pads[0].axes[1] = 1;
    assert.deepStrictEqual(poll(poller), [up(Keys.UP), down(Keys.DOWN)]);
  });

  it('should route the second gamepad to the player 2 keys', function () {
    const poller = newPoller();
    listeners['gamepadconnected']({});
    poll(poller);
    pads[1].axes[1] = -1;
    pads[1].buttons[9].pressed = true;
    assert.deepStrictEqual(poll(poller), [down(Keys.P2_UP), down(Keys.P2_START)]);
    // player 1 keys must not fire for player 2's pad
    assert.ok(!events.some(e => e[0] == Keys.UP.c || e[0] == Keys.START.c));
  });

  it('should ignore axes a key does not use', function () {
    // A is button-only, so it must not react to any axis movement
    const poller = newPoller();
    listeners['gamepadconnected']({});
    poll(poller);
    pads[0].axes[0] = 1;
    pads[0].axes[1] = 1;
    const codes = poll(poller).map(e => e[0]);
    assert.ok(!codes.includes(Keys.A.c));
    assert.deepStrictEqual(codes, [Keys.RIGHT.c, Keys.DOWN.c]); // x axis polled before y
  });

  it('should drop gamepad state on disconnect', function () {
    const poller = newPoller();
    listeners['gamepadconnected']({});
    poll(poller);
    pads[0].buttons[0].pressed = true;
    poll(poller);
    listeners['gamepaddisconnected']({});
    // state is cleared, so a held button reads as a fresh press
    assert.deepStrictEqual(poll(poller), [down(Keys.A), down(Keys.GP_A)]);
  });
});

describe('getMousePos', function () {
  const realWindow = (global as any).window;

  after(function () {
    if (realWindow === undefined) delete (global as any).window;
    else (global as any).window = realWindow;
  });

  function stubWindow() {
    (global as any).window = {
      getComputedStyle: () => ({
        borderLeftWidth: '0px', borderRightWidth: '0px',
        borderTopWidth: '0px', borderBottomWidth: '0px',
        paddingLeft: '0px', paddingRight: '0px',
        paddingTop: '0px', paddingBottom: '0px',
      })
    };
  }

  it('should clamp out-of-bounds coordinates', function () {
    stubWindow();
    const canvas: any = {
      width: 100, height: 100,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 })
    };
    const pos = getMousePos(canvas, { clientX: 10000, clientY: -100 });
    assert.deepStrictEqual(pos, { x: 100, y: 0 });
  });

  it('should account for borders and padding', function () {
    (global as any).window = {
      getComputedStyle: () => ({
        borderLeftWidth: '2px', borderRightWidth: '2px',
        borderTopWidth: '2px', borderBottomWidth: '2px',
        paddingLeft: '2px', paddingRight: '2px',
        paddingTop: '2px', paddingBottom: '2px',
      })
    };
    const canvas: any = {
      width: 100, height: 100,
      getBoundingClientRect: () => ({ left: 10, top: 10, width: 108, height: 108 })
    };
    // content origin = rect.left + border(2) + padding(2) = 14
    let pos = getMousePos(canvas, { clientX: 14, clientY: 14 });
    assert.deepStrictEqual(pos, { x: 0, y: 0 });
    // content far edge
    pos = getMousePos(canvas, { clientX: 14 + 99, clientY: 14 + 99 });
    assert.ok(pos.x >= 99 && pos.x <= 100);
  });
});

