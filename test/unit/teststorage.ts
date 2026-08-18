import assert from "assert";
import { describe, it } from "mocha";
import {
    StorageManagerLike, detectBrowserKind, formatStorageSize, getPersistAdvice,
    getPersistStatusMessage, getQuotaExceededMessage, getStorageEstimate,
    getStorageStatus, isPersistSupported, requestPersistentStorage
} from "../../src/ide/storage";

function mockStorage(opts: {
    persisted?: boolean, persist?: boolean | Error, usage?: number, quota?: number, noEstimate?: boolean
}): StorageManagerLike & { persistCalls: number } {
    var mock: any = {
        persistCalls: 0,
        persisted: async () => !!opts.persisted,
        persist: async () => {
            mock.persistCalls++;
            if (opts.persist instanceof Error) throw opts.persist;
            return !!opts.persist;
        }
    };
    if (!opts.noEstimate)
        mock.estimate = async () => ({ usage: opts.usage, quota: opts.quota });
    return mock;
}

describe('persistent storage helpers', function () {

    it('detects missing StorageManager', async function () {
        assert.strictEqual(isPersistSupported(null), false);
        var status = await requestPersistentStorage(null);
        assert.deepStrictEqual(status, { supported: false, persisted: false, granted: false, usage: undefined, quota: undefined });
    });

    it('does not re-request when already persisted', async function () {
        var mock = mockStorage({ persisted: true, usage: 1024, quota: 2048 });
        var status = await requestPersistentStorage(mock);
        assert.strictEqual(status.persisted, true);
        assert.strictEqual(status.granted, false);
        assert.strictEqual(mock.persistCalls, 0, "should not call persist() when already granted");
    });

    it('requests persistence when not yet granted', async function () {
        var mock = mockStorage({ persisted: false, persist: true });
        var status = await requestPersistentStorage(mock);
        assert.strictEqual(status.persisted, true);
        assert.strictEqual(status.granted, true);
        assert.strictEqual(mock.persistCalls, 1);
    });

    it('treats a denial as a normal result', async function () {
        var mock = mockStorage({ persisted: false, persist: false });
        var status = await requestPersistentStorage(mock);
        assert.strictEqual(status.supported, true);
        assert.strictEqual(status.persisted, false);
        assert.strictEqual(status.granted, false);
    });

    it('survives persist() throwing (Safari, iframes)', async function () {
        var mock = mockStorage({ persisted: false, persist: new Error("SecurityError") });
        var status = await requestPersistentStorage(mock);
        assert.strictEqual(status.persisted, false);
        assert.strictEqual(status.granted, false);
    });

    it('survives a missing or failing estimate()', async function () {
        assert.deepStrictEqual(await getStorageEstimate(mockStorage({ noEstimate: true })), {});
        var broken: any = { persist: async () => true, estimate: async () => { throw new Error("nope"); } };
        assert.deepStrictEqual(await getStorageEstimate(broken), {});
        var status = await getStorageStatus(broken);
        assert.strictEqual(status.supported, true);
        assert.strictEqual(status.persisted, false); // no persisted() method
    });

    it('reports usage from estimate()', async function () {
        var status = await getStorageStatus(mockStorage({ persisted: true, usage: 1500000, quota: 2000000000 }));
        assert.strictEqual(status.usage, 1500000);
        assert.strictEqual(status.quota, 2000000000);
    });

    it('formats sizes', function () {
        assert.strictEqual(formatStorageSize(0), "0 bytes");
        assert.strictEqual(formatStorageSize(512), "512 bytes");
        assert.strictEqual(formatStorageSize(1536), "1.5 KB");
        assert.strictEqual(formatStorageSize(1024 * 1024 * 3), "3.0 MB");
        assert.strictEqual(formatStorageSize(undefined), "?");
    });

    it('detects browser families for advice', function () {
        assert.strictEqual(detectBrowserKind("Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0 Safari/537.36"), 'chromium');
        assert.strictEqual(detectBrowserKind("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0 Safari/537.36 Edg/120.0"), 'chromium');
        assert.strictEqual(detectBrowserKind("Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/122.0"), 'firefox');
        assert.strictEqual(detectBrowserKind("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15"), 'safari');
        assert.strictEqual(detectBrowserKind(""), 'other');
        // each family gets non-empty, distinct advice
        var advice = ['chromium', 'firefox', 'safari', 'other'].map((k: any) => getPersistAdvice(k));
        advice.forEach(a => assert.ok(a.length > 0));
        assert.strictEqual(new Set(advice).size, 4);
    });

    it('explains each outcome without calling it an error', function () {
        var denied = getPersistStatusMessage({ supported: true, persisted: false, usage: 1024, quota: 4096 }, true);
        assert.ok(/has not granted/.test(denied));
        assert.ok(/Download All Changes/.test(denied), "should suggest a backup");
        assert.ok(/1.0 KB of the 4.0 KB/.test(denied), "should report usage");

        var granted = getPersistStatusMessage({ supported: true, persisted: true, granted: true }, true);
        assert.ok(/just granted/.test(granted));
        var already = getPersistStatusMessage({ supported: true, persisted: true, granted: false }, false);
        assert.ok(/already/.test(already));
        var unsupported = getPersistStatusMessage({ supported: false, persisted: false }, true);
        assert.ok(/doesn't support/.test(unsupported));
    });

    it('tells the user what to do when the quota is full', function () {
        var msg = getQuotaExceededMessage({ supported: true, persisted: false, usage: 100, quota: 200 });
        assert.ok(/ran out of space/.test(msg));
        assert.ok(/Download All Changes/.test(msg));
        assert.ok(msg.indexOf(getPersistAdvice()) >= 0, "should include advice when not persisted");
        var persisted = getQuotaExceededMessage({ supported: true, persisted: true, usage: 100, quota: 200 });
        assert.ok(persisted.indexOf(getPersistAdvice()) < 0, "no persist advice when already persisted");
    });

});
