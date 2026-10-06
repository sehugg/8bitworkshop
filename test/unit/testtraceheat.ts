import assert from "assert";
import { describe, it } from "mocha";
import { computeHeatLevels, heatLevel, TRACED_HEAT_LEVELS } from "../../src/ide/views/traceheat";

// The "Highlight Executed Lines" overlay colors source lines by how often
// they run (cold -> hot). These tests pin down the level mapping so the
// color scale doesn't silently change.

describe("trace heat levels", function () {
    it("puts an isolated count in the coldest bucket", function () {
        assert.equal(heatLevel(1, 1), 0); // nothing to compare against
        assert.equal(heatLevel(1, 1000), 0);
        assert.equal(heatLevel(2, 1000), 0);
    });

    it("maps the maximum count to the hottest bucket", function () {
        assert.equal(heatLevel(1000, 1000), TRACED_HEAT_LEVELS - 1);
        assert.equal(heatLevel(2, 2), TRACED_HEAT_LEVELS - 1);
    });

    it("increases monotonically with count", function () {
        let prev = -1;
        for (const count of [1, 2, 4, 8, 16, 64, 256, 1024]) {
            const level = heatLevel(count, 1024);
            assert.ok(level >= prev, `level for ${count} went backwards`);
            assert.ok(level >= 0 && level < TRACED_HEAT_LEVELS);
            prev = level;
        }
    });

    it("keeps cold lines cold when a few lines are very hot", function () {
        // one line dominates; a rarely-run line should not be pulled hot
        assert.ok(heatLevel(1, 100000) < heatLevel(100, 100000));
        assert.ok(heatLevel(100, 100000) < heatLevel(100000, 100000));
    });

    it("computes levels for every line", function () {
        const levels = computeHeatLevels(new Map([[10, 1], [20, 100], [30, 10000]]));
        const byLine = new Map(levels.map(l => [l.line, l.level]));
        assert.equal(byLine.size, 3);
        assert.ok(byLine.get(10) < byLine.get(20));
        assert.ok(byLine.get(20) < byLine.get(30));
        assert.equal(byLine.get(30), TRACED_HEAT_LEVELS - 1);
    });

    it("only returns lines visible in the current update", function () {
        const counts = new Map([[10, 1], [20, 100], [30, 10000]]);
        const levels = computeHeatLevels(counts, new Set([30]));
        assert.deepEqual(levels.map(l => l.line), [30]);
        // color still comes from the global maximum
        assert.equal(levels[0].level, TRACED_HEAT_LEVELS - 1);
    });

    it("returns nothing when no lines are visible", function () {
        const counts = new Map([[10, 1], [20, 100]]);
        assert.deepEqual(computeHeatLevels(counts, new Set()), []);
    });

    it("handles an empty map", function () {
        assert.deepEqual(computeHeatLevels(new Map()), []);
    });
});
