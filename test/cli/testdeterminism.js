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
var platformcore = require('../../gen/common/platformcore.js');
var history = require('../../gen/common/history.js');
var statehash = require('../../gen/common/statehash.js');
var emu = require('../../gen/common/emu.js');

var KEYS = [37, 38, 39, 40, 32, 13];   // left up right down space enter

/** Seeded button masher, so a failure is reproducible. */
function makeExerciser(target, log, seed) {
  var state = seed | 0 || 1;
  var held = {};
  function next() {
    var x = state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    return (state = x) >>> 0;
  }
  return function () {
    for (var i = 0; i < KEYS.length; i++) {
      var key = KEYS[i];
      if ((next() & 7) !== 0) continue;
      var down = !held[key];
      held[key] = down;
      var flags = down ? emu.KeyFlags.KeyDown : emu.KeyFlags.KeyUp;
      target.setKeyInput(key, key, flags);
      log.recordKey(key, key, flags);
    }
  };
}

function firstROM(platid) {
  var dir = path.join('test', 'roms', platid);
  return path.join(dir, fs.readdirSync(dir)[0]);
}

/** Record `frames` frames with input, then replay and compare every frame. */
async function checkDeterministic(platid, frames) {
  var target = await emutarget.loadPlatform(platid);
  await target.start();
  target.loadROM(new Uint8Array(fs.readFileSync(firstROM(platid))));

  var core = platformcore.createCore(target.platform);
  var input = new platformcore.PlatformFrameInput(target.platform, {
    currentFrame: function () { return core.now().frame; },
    dispatchKey: function (key, code, flags) { target.setKeyInput(key, code, flags); },
  });
  // one checkpoint, so the replay re-runs the whole span
  var hist = new history.History(core, { checkpointInterval: frames + 1, input: input });
  var exercise = makeExerciser(target, input, 12345);

  var recorded = [];
  var controlStates = {};
  for (var i = 0; i < frames; i++) {
    exercise();
    if (target.platform.saveControlsState) {
      controlStates[statehash.hashState(target.platform.saveControlsState())] = 1;
    }
    hist.recordFrame();
    recorded.push(statehash.hashState(core.snapshot()));
  }
  // the input has to actually reach the machine, or a pass means nothing
  assert.ok(Object.keys(controlStates).length > 1,
    platid + ': the exerciser never changed the controls, so nothing was tested');

  hist.seek(hist.first());
  for (var i = 0; i < frames; i++) {
    hist.seek({ frame: i + 1, step: 0 });
    assert.strictEqual(statehash.hashState(core.snapshot()), recorded[i],
      platid + ': replay diverged at frame ' + (i + 1) + ' of ' + frames);
  }
  return core.granularity;
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
});
