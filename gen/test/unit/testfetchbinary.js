"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const util_1 = require("../../src/common/util");
const project_1 = require("../../src/ide/project");
const realFetch = globalThis.fetch;
function stubFetch(status, body = "data") {
    globalThis.fetch = (async (url) => new Response(status == 200 ? body : "", { status }));
}
// The IDE probes several preset paths for each #include, so "not found" is
// normal. Static hosts answer 403 for missing files; getWithBinary used to
// throw from the XHR callback on 403, which left the load hanging and sent
// an uncaught error to telemetry (bingbot, presets/vcs/examples/macro.h).
(0, mocha_1.describe)('fetchWithBinary', function () {
    (0, mocha_1.afterEach)(function () {
        globalThis.fetch = realFetch;
    });
    (0, mocha_1.it)('returns text on 200', async function () {
        stubFetch(200, "hello");
        assert_1.default.strictEqual(await (0, util_1.fetchWithBinary)("a.h", 'text'), "hello");
    });
    (0, mocha_1.it)('returns bytes on 200', async function () {
        stubFetch(200, "AB");
        assert_1.default.deepStrictEqual(await (0, util_1.fetchWithBinary)("a.bin", 'arraybuffer'), new Uint8Array([65, 66]));
    });
    // both mean "file isn't there", not an error
    (0, mocha_1.it)('returns null on 404 and 403', async function () {
        stubFetch(404);
        assert_1.default.strictEqual(await (0, util_1.fetchWithBinary)("a.h", 'text'), null);
        stubFetch(403);
        assert_1.default.strictEqual(await (0, util_1.fetchWithBinary)("a.h", 'text'), null);
    });
    // a real server failure must surface, not look like a missing file
    (0, mocha_1.it)('rejects on 5xx', async function () {
        stubFetch(503);
        await assert_1.default.rejects((0, util_1.fetchWithBinary)("a.h", 'text'), /Error 503 loading a.h/);
    });
    // callback callers (revert, import URL, embed) show their own "could not
    // load" message on null, so they must still get called back
    (0, mocha_1.it)('getWithBinary passes null to the callback on 5xx', async function () {
        stubFetch(500);
        const origError = console.error;
        console.error = () => { };
        try {
            const data = await new Promise((resolve) => (0, util_1.getWithBinary)("a.h", resolve, 'text'));
            assert_1.default.strictEqual(data, null);
        }
        finally {
            console.error = origError;
        }
    });
    // the reported case: include lookup must resolve, not hang
    (0, mocha_1.it)('WebPresetsFileSystem resolves null for a header the server denies', async function () {
        stubFetch(403);
        const fs = new project_1.WebPresetsFileSystem("vcs");
        assert_1.default.strictEqual(await fs.getFileData("examples/macro.h"), null);
    });
});
//# sourceMappingURL=testfetchbinary.js.map