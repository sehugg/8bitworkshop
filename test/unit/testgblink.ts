import assert from "assert";
import { describe, it } from "mocha";
import { GameBoyMachine } from "../../src/machine/gb";
import { createLoopbackLink, createLoopbackTransports, LinkSession } from "../../src/common/link/link";

function newGB() {
  const m = new GameBoyMachine();
  m.connectVideo(new Uint32Array(160 * 144));
  m.loadROM(new Uint8Array(0x8000)); // all NOPs
  m.reset();
  return m;
}
const run = (ms: GameBoyMachine[], frames: number) => {
  for (let i = 0; i < frames; i++) ms.forEach(m => m.advanceFrame(() => false));
};

describe('GB serial port', function () {
  it('master with no cable shifts in 0xFF and raises the serial IRQ', function () {
    const m = newGB();
    m.write(0xff01, 0x42);
    m.write(0xff02, 0x81);
    assert.equal(m.read(0xff02) & 0x80, 0x80);
    run([m], 1);
    assert.equal(m.read(0xff02) & 0x80, 0);
    assert.equal(m.read(0xff01), 0xff);
    assert.equal(m.iflag & 0x08, 0x08);
  });

  it('slave with no cable never completes', function () {
    const m = newGB();
    m.write(0xff02, 0x80);
    run([m], 2);
    assert.equal(m.read(0xff02) & 0x80, 0x80);
  });

  it('linked machines swap bytes', function () {
    const [la, lb] = createLoopbackLink();
    const a = newGB(), b = newGB();
    a.connectLink(la); b.connectLink(lb);
    a.write(0xff01, 0x11); b.write(0xff01, 0x22);
    b.write(0xff02, 0x80);          // slave armed
    a.write(0xff02, 0x81);          // master starts
    run([a, b], 2); // machines run back to back, so the reply lands a frame later
    assert.equal(a.read(0xff01), 0x22);
    assert.equal(b.read(0xff01), 0x11);
    assert.equal(a.iflag & 0x08, 0x08);
    assert.equal(b.iflag & 0x08, 0x08);
    assert.equal(a.read(0xff02) & 0x80, 0);
    assert.equal(b.read(0xff02) & 0x80, 0);
  });

  it('master stalls until the slave is armed', function () {
    const [la, lb] = createLoopbackLink();
    const a = newGB(), b = newGB();
    a.connectLink(la); b.connectLink(lb);
    a.write(0xff01, 0x33); b.write(0xff01, 0x44);
    a.write(0xff02, 0x81);
    run([a, b], 2);
    assert.equal(a.read(0xff02) & 0x80, 0x80); // still waiting
    b.write(0xff02, 0x80);
    run([a, b], 2);
    assert.equal(a.read(0xff01), 0x44);
    assert.equal(b.read(0xff01), 0x33);
  });

  it('transfer state survives save/load', function () {
    const m = newGB();
    m.write(0xff01, 0x42);
    m.write(0xff02, 0x81);
    run([m], 0);
    const st = m.saveState();
    const n = newGB();
    n.loadState(st);
    assert.equal(n.serialCycles, m.serialCycles);
    assert.equal(n.read(0xff02), m.read(0xff02));
  });
});

describe('LinkSession lockstep', function () {
  // transport that delivers each packet `lag` polls later, to model network latency
  function laggyPair(lag: number) {
    const [a, b] = createLoopbackTransports();
    const wrap = (t: any, tick: { fns: (() => void)[] }) => {
      const send = t.send.bind(t);
      t.send = (msg: Uint8Array) => {
        let n = lag;
        const fn = () => { if (n-- <= 0) { send(msg); return true; } return false; };
        tick.fns.push(fn as any);
      };
    };
    const tick = { fns: [] as any[] };
    wrap(a, tick); wrap(b, tick);
    const pump = () => { tick.fns = tick.fns.filter(f => !f()); };
    return { a, b, pump };
  }

  function play(lag: number) {
    const { a: ta, b: tb, pump } = laggyPair(lag);
    const sa = new LinkSession(ta, 2), sb = new LinkSession(tb, 2);
    const a = newGB(), b = newGB();
    a.connectLink(sa); b.connectLink(sb);
    a.write(0xff01, 0x5a); b.write(0xff01, 0xa5);
    b.write(0xff02, 0x80);
    a.write(0xff02, 0x81);
    let ticks = 0, stalls = 0;
    // run both peers as a browser would: each tick, each side advances if it can
    while ((sa.frame < 12 || sb.frame < 12) && ticks++ < 1000) {
      for (const [m, s] of [[a, sa], [b, sb]] as [GameBoyMachine, LinkSession][]) {
        if (s.frame >= 12) continue;
        if (!s.canAdvance()) { stalls++; continue; }
        s.beginFrame(); m.advanceFrame(() => false); s.endFrame();
      }
      pump();
    }
    return { a, b, sa, sb, stalls };
  }

  it('swaps bytes deterministically with zero latency', function () {
    const { a, b } = play(0);
    assert.equal(a.read(0xff01), 0xa5);
    assert.equal(b.read(0xff01), 0x5a);
  });

  it('gives the same result under network lag, by stalling', function () {
    const fast = play(0), slow = play(3);
    assert.equal(slow.a.read(0xff01), 0xa5);
    assert.equal(slow.b.read(0xff01), 0x5a);
    assert.ok(slow.stalls > fast.stalls, 'lag should cause stalls');
    assert.deepEqual((slow.a.saveState() as any).io, (fast.a.saveState() as any).io);
  });

  it('runs free when the cable is unplugged', function () {
    const [t] = createLoopbackTransports();
    const s = new LinkSession(t, 2);
    s.setConnected(false);
    assert.ok(s.canAdvance());
  });
});
