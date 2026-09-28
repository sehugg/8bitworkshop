"use strict";

// Determinism regression tests: record a run with input, replay it from the
// first checkpoint, and require every frame to come back bit for bit.
//
// This is the guard that keeps rewinding meaningful. Without it, a field that
// is written but never saved (ANTIC's left/right, the WASM machines' joymask)
// leaks across a rewind and nothing notices until a user is staring at a
// debugger that shows the wrong past.

var assert = require('assert');
var fs = require('fs');
var path = require('path');

var emutarget = require('../../gen/tools/emutarget.js');
var verifyreplay = require('../../gen/tools/verifyreplay.js');

function firstROM(platid) {
  var dir = path.join('test', 'roms', platid);
  return path.join(dir, fs.readdirSync(dir)[0]);
}

/** Record `frames` frames with input, then replay and compare every frame. */
async function checkDeterministic(platid, frames, romid) {
  var target = await emutarget.loadPlatform(platid);
  await target.start();
  await target.loadROM(new Uint8Array(fs.readFileSync(firstROM(romid || platid))));
  var r = verifyreplay.verifyReplay(target, { frames: frames });
  // the input has to actually reach the machine, or a pass means nothing
  assert.ok(r.controlStates > 1,
    platid + ': the exerciser never changed the controls, so nothing was tested');
  assert.deepStrictEqual(r.diverged, [], platid + ': replay diverged at frame ' + r.diverged[0] + ' of ' + frames);
  return r.granularity;
}

describe('Deterministic replay', function () {
  this.timeout(120000);

  // a JS scanline machine, the two that had state-restore bugs, and a WASM
  // machine of each kind
  it('should replay mw8080bw exactly', async function () {
    assert.strictEqual(await checkDeterministic('mw8080bw', 20), 'insn');
  });
  it('should replay apple2 exactly', async function () {
    await checkDeterministic('apple2', 20);
  });
  it('should replay atari8-800 exactly (ANTIC left/right must round-trip)', async function () {
    await checkDeterministic('atari8-800', 20);
  });
  it('should replay atari8-5200 exactly (key-down IRQ must be redelivered)', async function () {
    await checkDeterministic('atari8-5200', 20);
  });
  it('should replay c64 exactly (joymask must round-trip)', async function () {
    assert.strictEqual(await checkDeterministic('c64', 20), 'clock');
  });
  it('should replay zx exactly (joymask must round-trip)', async function () {
    await checkDeterministic('zx', 20);
  });
  it('should replay nes exactly (jsnes save states must not alias live arrays)', async function () {
    assert.strictEqual(await checkDeterministic('nes', 20), 'insn');
  });
  it('should replay vcs.jt4 exactly (Javatari power-on noise and TIA colors)', async function () {
    // the ROMs live under the base platform's folder
    assert.strictEqual(await checkDeterministic('vcs.jt4', 20, 'vcs'), 'insn');
  });
});
