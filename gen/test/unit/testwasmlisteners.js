"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const mocha_1 = require("mocha");
const testlib_1 = require("../../src/tools/testlib");
// Emscripten glue adds process-wide uncaughtException/unhandledRejection
// handlers each time a tool module is instantiated. Those handlers rethrow or
// abort, which kills a long-lived host (the VS Code extension), and they pile up.
(0, mocha_1.describe)("emscripten process listeners", function () {
    this.timeout(60000);
    const counts = () => ({
        uncaught: process.listenerCount('uncaughtException'),
        rejection: process.listenerCount('unhandledRejection'),
    });
    (0, mocha_1.it)("stay flat across builds", async function () {
        await (0, testlib_1.preload)('ca65', 'nes');
        const before = counts();
        for (let i = 0; i < 12; i++) {
            const result = await (0, testlib_1.compile)({
                tool: 'ca65', platform: 'nes', path: 'main.s',
                code: `\t.export _main\n\t.segment "CODE"\n_main:\tlda #${i}\n\trts\n`,
            });
            assert_1.default.ok(result.errors === undefined || result.errors.length === 0, JSON.stringify(result.errors));
        }
        assert_1.default.deepStrictEqual(counts(), before);
    });
    (0, mocha_1.it)("keeps listeners the host adds itself", async function () {
        await (0, testlib_1.initialize)();
        const mine = () => { };
        process.on('unhandledRejection', mine);
        try {
            assert_1.default.ok(process.listeners('unhandledRejection').includes(mine));
        }
        finally {
            process.off('unhandledRejection', mine);
        }
    });
});
//# sourceMappingURL=testwasmlisteners.js.map