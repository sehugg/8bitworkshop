import assert from "assert";
import * as fs from "fs";
import { describe, it } from "mocha";
import { KeyFlags } from "../../src/common/emu";
import { ProbeFlags, ProbeRecorder } from "../../src/common/probe";
import { hashState } from "../../src/common/statehash";
import { formatTimestamp, timestamp, timestampsEqual } from "../../src/common/timeline";
import { EmuTarget, loadPlatform } from "../../src/tools/emutarget";

// EmuCore is the one driver behind the CLI's run scripts and the extension's
// emulator. It runs the machine through the timeline, so stepping, running and
// rewinding all agree on where the machine is.

async function open(platform: string, rom: string): Promise<EmuTarget> {
  const t = await loadPlatform(platform);
  await t.start();
  await t.loadROM(new Uint8Array(fs.readFileSync(rom)));
  return t;
}

function stateOf(t: EmuTarget): number {
  return hashState(t.machine.saveState());
}

const TARGETS = [
  { platform: 'mw8080bw', rom: 'test/roms/mw8080bw/game2.c.rom' },    // Z80: steps are instructions
  { platform: 'apple2', rom: 'test/roms/apple2/cosmic.c.rom' },       // 6502: steps are clocks
];

for (const { platform, rom } of TARGETS) {
  describe(`EmuCore on ${platform}`, function () {
    this.timeout(60000);

    it('finishes the frame it stepped into, the same as running straight through', async function () {
      const straight = await open(platform, rom);
      for (let i = 0; i < 20; i++) straight.advanceFrame();

      const stepped = await open(platform, rom);
      for (let i = 0; i < 10; i++) stepped.advanceFrame();
      for (let i = 0; i < 100; i++) stepped.stepInsn();
      for (let i = 0; i < 10; i++) stepped.advanceFrame();

      assert.strictEqual(stepped.frameCount, 20);
      assert.strictEqual(stateOf(stepped), stateOf(straight));
    });

    it('steps back to the instruction before', async function () {
      const t = await open(platform, rom);
      for (let i = 0; i < 5; i++) t.advanceFrame();
      t.stepInsn();
      const pcs: number[] = [];
      const states: number[] = [];
      for (let i = 0; i < 5; i++) {
        pcs.push(t.getPC());
        states.push(stateOf(t));
        t.stepInsn();
      }
      for (let i = 4; i >= 0; i--) {
        assert.ok(t.stepBack(), `no step back at ${i}`);
        assert.strictEqual(t.getPC(), pcs[i]);
        assert.strictEqual(stateOf(t), states[i]);
      }
      assert.ok(t.isInPast());
    });

    it('seeks back and forward to the same state', async function () {
      const t = await open(platform, rom);
      for (let i = 0; i < 12; i++) t.advanceFrame();
      const present = stateOf(t);
      t.seek(timestamp(3, 0));
      assert.ok(timestampsEqual(t.now(), timestamp(3, 0)), formatTimestamp(t.now()));
      t.seek(timestamp(12, 0));
      assert.strictEqual(stateOf(t), present);
    });
  });
}

describe('EmuCore with a probe', function () {
  this.timeout(60000);

  function executes(rec: ProbeRecorder): number {
    let n = 0;
    for (let i = 0; i < rec.idx; i++) if ((rec.buf[i] & 0xff000000) === ProbeFlags.EXECUTE) n++;
    return n;
  }

  async function probed() {
    const t = await open('mw8080bw', 'test/roms/mw8080bw/game2.c.rom');
    for (let i = 0; i < 3; i++) t.advanceFrame();
    t.stepInsn(50);
    const rec = new ProbeRecorder(t.machine as any, 0x10000);
    rec.singleFrame = false;
    assert.ok(t.connectProbe(rec));
    return { t, rec };
  }

  it('logs each stepped instruction once, though stepping replays the frame', async function () {
    const { t, rec } = await probed();
    for (let i = 0; i < 10; i++) t.stepInsn();
    assert.strictEqual(executes(rec), 10);
  });

  it('keeps the probe connected after a search that uses its own', async function () {
    const { t, rec } = await probed();
    const search = new ProbeRecorder(t.machine as any, 0x10000);
    t.history.findLast({ test: () => false, probe: search });
    t.seek(t.history.last());
    const before = executes(rec);
    t.stepInsn(5);
    assert.strictEqual(executes(rec), before + 5);
  });
});

describe('EmuCore key input', function () {
  this.timeout(60000);

  it('replays keys, including one pressed while stopped mid-frame', async function () {
    const t = await open('apple2', 'test/roms/apple2/cosmic.c.rom');
    const keys: number[] = [];
    const deliver = (t as any).deliverKey.bind(t);
    (t as any).deliverKey = (key, code, flags) => { keys.push(flags); deliver(key, code, flags); };
    for (let i = 0; i < 2; i++) t.advanceFrame();
    t.setKeyInput(39, 39, KeyFlags.KeyDown);   // frame 2
    for (let i = 0; i < 3; i++) t.advanceFrame();
    t.stepInsn();
    t.setKeyInput(39, 39, KeyFlags.KeyUp);     // stopped mid-frame: waits for frame 6
    for (let i = 0; i < 4; i++) t.advanceFrame();
    const present = stateOf(t);
    assert.deepStrictEqual(keys, [KeyFlags.KeyDown, KeyFlags.KeyUp]);
    // run forward through the past a frame at a time; no checkpoint since
    // frame 0, so both keys are replayed
    t.seek(timestamp(1, 0));
    let replayed = 0;
    while (t.isInPast()) {
      t.advanceFrame();
      replayed++;
    }
    assert.strictEqual(replayed, 8);
    assert.deepStrictEqual(keys, [KeyFlags.KeyDown, KeyFlags.KeyUp, KeyFlags.KeyDown, KeyFlags.KeyUp]);
    assert.strictEqual(stateOf(t), present);
  });

  it('diverges without the key, so the key test means something', async function () {
    const withKey = await open('apple2', 'test/roms/apple2/cosmic.c.rom');
    const without = await open('apple2', 'test/roms/apple2/cosmic.c.rom');
    withKey.setKeyInput(39, 39, KeyFlags.KeyDown);
    for (let i = 0; i < 5; i++) { withKey.advanceFrame(); without.advanceFrame(); }
    assert.notStrictEqual(stateOf(withKey), stateOf(without));
  });

  it('drops the recorded future when a key is pressed in the past', async function () {
    const t = await open('apple2', 'test/roms/apple2/cosmic.c.rom');
    for (let i = 0; i < 10; i++) t.advanceFrame();
    t.seek(timestamp(4, 0));
    t.setKeyInput(39, 39, KeyFlags.KeyDown);
    assert.ok(!t.isInPast());
    assert.ok(timestampsEqual(t.history.last(), timestamp(4, 0)));
    t.advanceFrame();
    assert.strictEqual(t.frameCount, 5);
  });
});
