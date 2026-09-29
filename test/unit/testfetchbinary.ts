import assert from "assert";
import { afterEach, describe, it } from "mocha";
import { fetchWithBinary, getWithBinary } from "../../src/common/util";
import { WebPresetsFileSystem } from "../../src/ide/project";

const realFetch = globalThis.fetch;

function stubFetch(status: number, body = "data") {
  globalThis.fetch = (async (url: string) => new Response(status == 200 ? body : "", { status })) as any;
}

// The IDE probes several preset paths for each #include, so "not found" is
// normal. Static hosts answer 403 for missing files; getWithBinary used to
// throw from the XHR callback on 403, which left the load hanging and sent
// an uncaught error to telemetry (bingbot, presets/vcs/examples/macro.h).
describe('fetchWithBinary', function () {

  afterEach(function () {
    globalThis.fetch = realFetch;
  });

  it('returns text on 200', async function () {
    stubFetch(200, "hello");
    assert.strictEqual(await fetchWithBinary("a.h", 'text'), "hello");
  });

  it('returns bytes on 200', async function () {
    stubFetch(200, "AB");
    assert.deepStrictEqual(await fetchWithBinary("a.bin", 'arraybuffer'), new Uint8Array([65, 66]));
  });

  // both mean "file isn't there", not an error
  it('returns null on 404 and 403', async function () {
    stubFetch(404);
    assert.strictEqual(await fetchWithBinary("a.h", 'text'), null);
    stubFetch(403);
    assert.strictEqual(await fetchWithBinary("a.h", 'text'), null);
  });

  // a real server failure must surface, not look like a missing file
  it('rejects on 5xx', async function () {
    stubFetch(503);
    await assert.rejects(fetchWithBinary("a.h", 'text'), /Error 503 loading a.h/);
  });

  // callback callers (revert, import URL, embed) show their own "could not
  // load" message on null, so they must still get called back
  it('getWithBinary passes null to the callback on 5xx', async function () {
    stubFetch(500);
    const origError = console.error;
    console.error = () => { };
    try {
      const data = await new Promise((resolve) => getWithBinary("a.h", resolve, 'text'));
      assert.strictEqual(data, null);
    } finally {
      console.error = origError;
    }
  });

  // the reported case: include lookup must resolve, not hang
  it('WebPresetsFileSystem resolves null for a header the server denies', async function () {
    stubFetch(403);
    const fs = new WebPresetsFileSystem("vcs");
    assert.strictEqual(await fs.getFileData("examples/macro.h"), null);
  });
});
