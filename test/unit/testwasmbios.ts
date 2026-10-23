import assert from "assert";
import { describe, it } from "mocha";
import { BaseWASMMachine } from "../../src/common/wasmplatform";

// minimal machine: only the pieces loadBIOS touches
class StubMachine extends BaseWASMMachine {
  getCPUState() : any { return null; }
  saveState() : any { return null; }
  loadState(s) { }
}

function makeStub() {
  var calls : string[] = [];
  var m = new StubMachine('stub');
  m.exports = {
    memory: new WebAssembly.Memory({initial:1}),
    machine_init: (ptr) => { calls.push('init'+ptr); return 7; },
    machine_reset: (sys) => { calls.push('reset'+sys); },
    machine_get_pixel_buffer: () => 0,
  };
  m.biosptr = 16;
  m.biosarr = new Uint8Array(m.exports.memory.buffer, 16, 4);
  return {m, calls};
}

describe('BaseWASMMachine.loadBIOS', function () {
  it('only copies the BIOS before the machine exists', function () {
    var {m, calls} = makeStub();
    m.loadBIOS(new Uint8Array([1,2,3,4]));
    assert.deepEqual(Array.from(m.biosarr), [1,2,3,4]);
    assert.deepEqual(calls, []);
  });
  it('recreates the machine when loaded after init', function () {
    var {m, calls} = makeStub();
    m.sys = 3;
    m.loadBIOS(new Uint8Array([5,6,7,8]));
    assert.deepEqual(Array.from(m.biosarr), [5,6,7,8]);
    assert.equal(m.sys, 7);
    assert.deepEqual(calls, ['init16', 'reset7']);
  });
});
