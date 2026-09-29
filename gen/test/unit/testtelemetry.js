"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const mocha_1 = require("mocha");
const telemetry_1 = require("../../src/common/telemetry");
const builder_1 = require("../../src/worker/builder");
const workertools_1 = require("../../src/worker/workertools");
const testlib_1 = require("../../src/tools/testlib");
(0, mocha_1.describe)("ErrorReporter", function () {
    function reporter() {
        const sent = [];
        return { sent, r: new telemetry_1.ErrorReporter('ide', p => sent.push(p), { version: '1.2' }) };
    }
    (0, mocha_1.it)("sends source, message, and fields", function () {
        const { sent, r } = reporter();
        assert_1.default.ok(r.report("boom", "at foo", { tool: "cc65", platform: "nes" }, 'worker'));
        assert_1.default.strictEqual(sent.length, 1);
        assert_1.default.strictEqual(sent[0].source, 'worker');
        assert_1.default.strictEqual(sent[0].msg, 'boom');
        assert_1.default.strictEqual(sent[0].stack, 'at foo');
        assert_1.default.strictEqual(sent[0].tool, 'cc65');
        assert_1.default.strictEqual(sent[0].version, '1.2');
    });
    (0, mocha_1.it)("sends the same error once per session", function () {
        const { sent, r } = reporter();
        r.report("boom", "", { tool: "cc65" });
        assert_1.default.ok(!r.report("boom", "", { tool: "cc65" }));
        // a different tool is a different error
        assert_1.default.ok(r.report("boom", "", { tool: "sdcc" }));
        assert_1.default.strictEqual(sent.length, 2);
    });
    (0, mocha_1.it)("stops after the session limit", function () {
        const { sent, r } = reporter();
        for (let i = 0; i < telemetry_1.MAX_REPORTS_PER_SESSION + 5; i++)
            r.report("error " + i);
        assert_1.default.strictEqual(sent.length, telemetry_1.MAX_REPORTS_PER_SESSION);
    });
    (0, mocha_1.it)("clamps long fields", function () {
        const { sent, r } = reporter();
        r.report("x".repeat(10000), "y".repeat(10000));
        assert_1.default.strictEqual(sent[0].msg.length, 500);
        assert_1.default.strictEqual(sent[0].stack.length, 2000);
    });
});
(0, mocha_1.describe)("Build tool crashes", function () {
    let dir;
    const tools = workertools_1.TOOLS;
    (0, mocha_1.before)(function () {
        dir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), "8bws-telemetry-"));
        tools.test_crash = () => { throw new TypeError("cannot read properties of undefined"); };
        // a malformed directive: the user's mistake, which a real tool reports the same way
        tools.test_usererror = (step) => {
            (0, builder_1.gatherFiles)(step);
            (0, builder_1.fixParamsWithDefines)(step.path, step.params);
            return { output: new Uint8Array(1) };
        };
    });
    (0, mocha_1.after)(function () {
        delete tools.test_crash;
        delete tools.test_usererror;
        fs_1.default.rmSync(dir, { recursive: true, force: true });
    });
    function source(name, code) {
        const fn = path_1.default.join(dir, name);
        fs_1.default.writeFileSync(fn, code);
        return fn;
    }
    (0, mocha_1.it)("flags an exception in a tool as internal", async function () {
        const result = await (0, testlib_1.compileSourceFile)("test_crash", "nes", source("crash.c", "int main;\n"));
        assert_1.default.ok(!result.success);
        assert_1.default.ok(result.internal, "expected internal");
        assert_1.default.strictEqual(result.internal.tool, "test_crash");
        assert_1.default.strictEqual(result.internal.platform, "nes");
        assert_1.default.match(result.internal.msg, /cannot read properties/);
        assert_1.default.match(result.internal.stack, /TypeError/);
        // the user still sees it as a build error
        assert_1.default.match(result.errors[0].msg, /cannot read properties/);
    });
    (0, mocha_1.it)("doesn't flag a bad build directive", async function () {
        const result = await (0, testlib_1.compileSourceFile)("test_usererror", "nes", source("bad.c", '//#symbol ld BAD="str"\n'));
        assert_1.default.ok(!result.success);
        assert_1.default.match(result.errors[0].msg, /build directive error/);
        assert_1.default.strictEqual(result.internal, undefined);
    });
});
//# sourceMappingURL=testtelemetry.js.map