"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BROWSER_UAS = exports.BOT_UAS = void 0;
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const mocha_1 = require("mocha");
const telemetry_1 = require("../../src/common/telemetry");
const builder_1 = require("../../src/worker/builder");
const workertools_1 = require("../../src/worker/workertools");
const testlib_1 = require("../../src/tools/testlib");
// Crawlers load IDE URLs and report errors (e.g. bingbot hitting a 403 on a
// header file). These UAs must be filtered; real browsers must not be.
// web/error.php has the same regex -- this list is also checked against it.
exports.BOT_UAS = [
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)",
    "Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)",
    "DuckDuckBot-Https/1.1; (+https://duckduckgo.com/duckduckbot)",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (compatible; Google-InspectionTool/1.0)",
    "python-requests/2.31.0",
    "curl/8.4.0",
];
exports.BROWSER_UAS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Mobile Safari/537.36",
];
(0, mocha_1.describe)("isBotUserAgent", function () {
    (0, mocha_1.it)("flags crawlers and headless browsers", function () {
        for (const ua of exports.BOT_UAS)
            assert_1.default.ok((0, telemetry_1.isBotUserAgent)(ua), ua);
    });
    (0, mocha_1.it)("passes real browsers", function () {
        for (const ua of exports.BROWSER_UAS)
            assert_1.default.ok(!(0, telemetry_1.isBotUserAgent)(ua), ua);
        // no UA at all isn't evidence of a bot
        assert_1.default.ok(!(0, telemetry_1.isBotUserAgent)(""));
    });
});
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