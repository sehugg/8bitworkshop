"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const storage_1 = require("../../src/ide/storage");
function mockStorage(opts) {
    var mock = {
        persistCalls: 0,
        persisted: async () => !!opts.persisted,
        persist: async () => {
            mock.persistCalls++;
            if (opts.persist instanceof Error)
                throw opts.persist;
            return !!opts.persist;
        }
    };
    if (!opts.noEstimate)
        mock.estimate = async () => ({ usage: opts.usage, quota: opts.quota });
    return mock;
}
(0, mocha_1.describe)('persistent storage helpers', function () {
    (0, mocha_1.it)('detects missing StorageManager', async function () {
        assert_1.default.strictEqual((0, storage_1.isPersistSupported)(null), false);
        var status = await (0, storage_1.requestPersistentStorage)(null);
        assert_1.default.deepStrictEqual(status, { supported: false, persisted: false, granted: false, usage: undefined, quota: undefined });
    });
    (0, mocha_1.it)('does not re-request when already persisted', async function () {
        var mock = mockStorage({ persisted: true, usage: 1024, quota: 2048 });
        var status = await (0, storage_1.requestPersistentStorage)(mock);
        assert_1.default.strictEqual(status.persisted, true);
        assert_1.default.strictEqual(status.granted, false);
        assert_1.default.strictEqual(mock.persistCalls, 0, "should not call persist() when already granted");
    });
    (0, mocha_1.it)('requests persistence when not yet granted', async function () {
        var mock = mockStorage({ persisted: false, persist: true });
        var status = await (0, storage_1.requestPersistentStorage)(mock);
        assert_1.default.strictEqual(status.persisted, true);
        assert_1.default.strictEqual(status.granted, true);
        assert_1.default.strictEqual(mock.persistCalls, 1);
    });
    (0, mocha_1.it)('treats a denial as a normal result', async function () {
        var mock = mockStorage({ persisted: false, persist: false });
        var status = await (0, storage_1.requestPersistentStorage)(mock);
        assert_1.default.strictEqual(status.supported, true);
        assert_1.default.strictEqual(status.persisted, false);
        assert_1.default.strictEqual(status.granted, false);
    });
    (0, mocha_1.it)('survives persist() throwing (Safari, iframes)', async function () {
        var mock = mockStorage({ persisted: false, persist: new Error("SecurityError") });
        var status = await (0, storage_1.requestPersistentStorage)(mock);
        assert_1.default.strictEqual(status.persisted, false);
        assert_1.default.strictEqual(status.granted, false);
    });
    (0, mocha_1.it)('survives a missing or failing estimate()', async function () {
        assert_1.default.deepStrictEqual(await (0, storage_1.getStorageEstimate)(mockStorage({ noEstimate: true })), {});
        var broken = { persist: async () => true, estimate: async () => { throw new Error("nope"); } };
        assert_1.default.deepStrictEqual(await (0, storage_1.getStorageEstimate)(broken), {});
        var status = await (0, storage_1.getStorageStatus)(broken);
        assert_1.default.strictEqual(status.supported, true);
        assert_1.default.strictEqual(status.persisted, false); // no persisted() method
    });
    (0, mocha_1.it)('reports usage from estimate()', async function () {
        var status = await (0, storage_1.getStorageStatus)(mockStorage({ persisted: true, usage: 1500000, quota: 2000000000 }));
        assert_1.default.strictEqual(status.usage, 1500000);
        assert_1.default.strictEqual(status.quota, 2000000000);
    });
    (0, mocha_1.it)('formats sizes', function () {
        assert_1.default.strictEqual((0, storage_1.formatStorageSize)(0), "0 bytes");
        assert_1.default.strictEqual((0, storage_1.formatStorageSize)(512), "512 bytes");
        assert_1.default.strictEqual((0, storage_1.formatStorageSize)(1536), "1.5 KB");
        assert_1.default.strictEqual((0, storage_1.formatStorageSize)(1024 * 1024 * 3), "3.0 MB");
        assert_1.default.strictEqual((0, storage_1.formatStorageSize)(undefined), "?");
    });
    (0, mocha_1.it)('detects browser families for advice', function () {
        assert_1.default.strictEqual((0, storage_1.detectBrowserKind)("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36"), 'chromium');
        assert_1.default.strictEqual((0, storage_1.detectBrowserKind)("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0"), 'chromium');
        assert_1.default.strictEqual((0, storage_1.detectBrowserKind)("Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/122.0"), 'firefox');
        assert_1.default.strictEqual((0, storage_1.detectBrowserKind)("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"), 'safari');
        assert_1.default.strictEqual((0, storage_1.detectBrowserKind)(""), 'other');
        // each family gets non-empty, distinct advice
        var advice = ['chromium', 'firefox', 'safari', 'other'].map((k) => (0, storage_1.getPersistAdvice)(k));
        advice.forEach(a => assert_1.default.ok(a.length > 0));
        assert_1.default.strictEqual(new Set(advice).size, 4);
    });
    (0, mocha_1.it)('explains each outcome without calling it an error', function () {
        var denied = (0, storage_1.getPersistStatusMessage)({ supported: true, persisted: false, usage: 1024, quota: 4096 }, true);
        assert_1.default.ok(/has not granted/.test(denied));
        assert_1.default.ok(/Download All Changes/.test(denied), "should suggest a backup");
        assert_1.default.ok(/1.0 KB of the 4.0 KB/.test(denied), "should report usage");
        var granted = (0, storage_1.getPersistStatusMessage)({ supported: true, persisted: true, granted: true }, true);
        assert_1.default.ok(/just granted/.test(granted));
        var already = (0, storage_1.getPersistStatusMessage)({ supported: true, persisted: true, granted: false }, false);
        assert_1.default.ok(/already/.test(already));
        var unsupported = (0, storage_1.getPersistStatusMessage)({ supported: false, persisted: false }, true);
        assert_1.default.ok(/doesn't support/.test(unsupported));
    });
    (0, mocha_1.it)('tells the user what to do when the quota is full', function () {
        var msg = (0, storage_1.getQuotaExceededMessage)({ supported: true, persisted: false, usage: 100, quota: 200 });
        assert_1.default.ok(/ran out of space/.test(msg));
        assert_1.default.ok(/Download All Changes/.test(msg));
        assert_1.default.ok(msg.indexOf((0, storage_1.getPersistAdvice)()) >= 0, "should include advice when not persisted");
        var persisted = (0, storage_1.getQuotaExceededMessage)({ supported: true, persisted: true, usage: 100, quota: 200 });
        assert_1.default.ok(persisted.indexOf((0, storage_1.getPersistAdvice)()) < 0, "no persist advice when already persisted");
    });
});
//# sourceMappingURL=teststorage.js.map