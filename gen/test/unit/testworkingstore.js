"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const builder_1 = require("../../src/worker/builder");
// Tools skip a build when no output is newer than its inputs
// (anyTargetChanged), so a file written later must get a later timestamp,
// even in the same millisecond.
(0, mocha_1.describe)('FileWorkingStore versions', () => {
    (0, mocha_1.it)('should give each new file version a later timestamp', () => {
        const store = new builder_1.FileWorkingStore();
        let last = 0;
        for (let i = 0; i < 1000; i++) {
            const ts = store.putFile('f' + i, 'x').ts;
            assert_1.default.ok(ts > last, `version ${i}: ${ts} <= ${last}`);
            last = ts;
        }
        assert_1.default.strictEqual(store.currentVersion(), last);
    });
});
//# sourceMappingURL=testworkingstore.js.map