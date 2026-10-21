import assert from "assert";
import { describe, it } from "mocha";
import * as fs from "fs";
import * as path from "path";
import { initialize, preload } from "../../src/tools/testlib";
import { toolRoot } from "../../src/tools/toolroot";
import { fsMeta, getFilesystemSize, makeBlob } from "../../src/worker/wasmutils";

/** Every .ts file under a directory, recursively. */
function tsFiles(dir: string): string[] {
  var files: string[] = [];
  for (var entry of fs.readdirSync(dir, { withFileTypes: true })) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(tsFiles(full));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

/** Drop comments, so that only real code is scanned. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ' ');
}

describe('toolchain filesystem packages', function () {
  this.timeout(60000);

  it('loads a package and keeps its data intact', async function () {
    await preload('sdcc');
    var meta = fsMeta['sdcc'];
    assert.ok(meta, 'the sdcc filesystem package was not loaded');
    assert.ok(meta.files.length > 0, 'the sdcc package has no files');
    // the package data must be the file on disk, byte for byte
    var datafile = path.resolve(toolRoot(), 'src/worker/fs/fssdcc.data');
    assert.equal(getFilesystemSize('sdcc'), fs.statSync(datafile).size);
  });

  it('wraps binary data in a blob without losing bytes', async function () {
    await initialize();
    var bytes = new Uint8Array([0, 1, 127, 128, 255]);
    var blob = makeBlob(bytes);
    assert.equal(blob.size, bytes.length);
    var read = blob.asArrayBuffer ? blob.asArrayBuffer() : new Uint8Array(await blob.arrayBuffer());
    assert.deepEqual(Array.from(read), Array.from(bytes));
  });

  it('never fetches a blob with a synchronous XHR', function () {
    // Firefox hangs on a synchronous XHR with responseType='blob' when the
    // response is 1MB or more, and every toolchain package is that big.
    // (Chrome is happy with it, so only Firefox shows the problem.)
    var dir = path.resolve(toolRoot(), 'src/worker');
    for (var file of tsFiles(dir)) {
      var text = stripComments(fs.readFileSync(file, 'utf-8'));
      assert.ok(!/responseType\s*=\s*['"]blob['"]/.test(text),
        path.relative(toolRoot(), file) + " uses responseType='blob'");
    }
  });
});
