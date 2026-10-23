import assert from "assert";
import { execFileSync } from "child_process";
import { describe, it } from "mocha";
import * as path from "path";

describe('worker CommonJS require shim', function () {
  it('keeps require() working after loading a module', function () {
    // Run this in a child process: it needs the shim installed by the unbundled
    // (tsc) wasmutils.js, and no loader another test file may have installed.
    // Mocha's parallel mode can put this file in a worker that already ran such
    // a test; the bundle then reuses that shim too.
    var wasmutils = path.resolve('gen/worker/wasmutils.js');
    var script = `
      const nodeRequire = require;
      delete global.require; // a fresh global, like a CommonJS module sees
      const { emglobal } = nodeRequire(${JSON.stringify(wasmutils)});
      emglobal.path = { dirname: (p) => p };
      emglobal.importScripts = () => { emglobal.exports = { answer: 42 }; };
      delete emglobal.test_module;
      if (emglobal.require('test_module').answer !== 42) {
        throw new Error('did not return the loaded module\\'s exports');
      }
      // loading that module must not break the shim's own module binding
      if (emglobal.require('path') !== emglobal.path) {
        throw new Error('require(path) failed after loading a module');
      }
    `;
    assert.doesNotThrow(() => execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' }));
  });
});
