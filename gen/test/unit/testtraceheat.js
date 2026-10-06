"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const traceheat_1 = require("../../src/ide/views/traceheat");
// The "Highlight Executed Lines" overlay colors source lines by how often
// they run (cold -> hot). These tests pin down the level mapping so the
// color scale doesn't silently change.
(0, mocha_1.describe)("trace heat levels", function () {
    (0, mocha_1.it)("puts an isolated count in the coldest bucket", function () {
        assert_1.default.equal((0, traceheat_1.heatLevel)(1, 1), 0); // nothing to compare against
        assert_1.default.equal((0, traceheat_1.heatLevel)(1, 1000), 0);
        assert_1.default.equal((0, traceheat_1.heatLevel)(2, 1000), 0);
    });
    (0, mocha_1.it)("maps the maximum count to the hottest bucket", function () {
        assert_1.default.equal((0, traceheat_1.heatLevel)(1000, 1000), traceheat_1.TRACED_HEAT_LEVELS - 1);
        assert_1.default.equal((0, traceheat_1.heatLevel)(2, 2), traceheat_1.TRACED_HEAT_LEVELS - 1);
    });
    (0, mocha_1.it)("increases monotonically with count", function () {
        let prev = -1;
        for (const count of [1, 2, 4, 8, 16, 64, 256, 1024]) {
            const level = (0, traceheat_1.heatLevel)(count, 1024);
            assert_1.default.ok(level >= prev, `level for ${count} went backwards`);
            assert_1.default.ok(level >= 0 && level < traceheat_1.TRACED_HEAT_LEVELS);
            prev = level;
        }
    });
    (0, mocha_1.it)("keeps cold lines cold when a few lines are very hot", function () {
        // one line dominates; a rarely-run line should not be pulled hot
        assert_1.default.ok((0, traceheat_1.heatLevel)(1, 100000) < (0, traceheat_1.heatLevel)(100, 100000));
        assert_1.default.ok((0, traceheat_1.heatLevel)(100, 100000) < (0, traceheat_1.heatLevel)(100000, 100000));
    });
    (0, mocha_1.it)("computes levels for every line", function () {
        const levels = (0, traceheat_1.computeHeatLevels)(new Map([[10, 1], [20, 100], [30, 10000]]));
        const byLine = new Map(levels.map(l => [l.line, l.level]));
        assert_1.default.equal(byLine.size, 3);
        assert_1.default.ok(byLine.get(10) < byLine.get(20));
        assert_1.default.ok(byLine.get(20) < byLine.get(30));
        assert_1.default.equal(byLine.get(30), traceheat_1.TRACED_HEAT_LEVELS - 1);
    });
    (0, mocha_1.it)("only returns lines visible in the current update", function () {
        const counts = new Map([[10, 1], [20, 100], [30, 10000]]);
        const levels = (0, traceheat_1.computeHeatLevels)(counts, new Set([30]));
        assert_1.default.deepEqual(levels.map(l => l.line), [30]);
        // color still comes from the global maximum
        assert_1.default.equal(levels[0].level, traceheat_1.TRACED_HEAT_LEVELS - 1);
    });
    (0, mocha_1.it)("returns nothing when no lines are visible", function () {
        const counts = new Map([[10, 1], [20, 100]]);
        assert_1.default.deepEqual((0, traceheat_1.computeHeatLevels)(counts, new Set()), []);
    });
    (0, mocha_1.it)("handles an empty map", function () {
        assert_1.default.deepEqual((0, traceheat_1.computeHeatLevels)(new Map()), []);
    });
});
//# sourceMappingURL=testtraceheat.js.map