import assert from "assert";
import { describe, it } from "mocha";
import { FileWorkingStore } from "../../src/worker/builder";

// Tools skip a build when no output is newer than its inputs
// (anyTargetChanged), so a file written later must get a later timestamp,
// even in the same millisecond.
describe('FileWorkingStore versions', () => {
  it('should give each new file version a later timestamp', () => {
    const store = new FileWorkingStore();
    let last = 0;
    for (let i = 0; i < 1000; i++) {
      const ts = store.putFile('f' + i, 'x').ts;
      assert.ok(ts > last, `version ${i}: ${ts} <= ${last}`);
      last = ts;
    }
    assert.strictEqual(store.currentVersion(), last);
  });
});
