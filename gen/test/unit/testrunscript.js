"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs = __importStar(require("fs"));
const mocha_1 = require("mocha");
const statehash_1 = require("../../src/common/statehash");
const timeline_1 = require("../../src/common/timeline");
const util_1 = require("../../src/common/util");
const emutarget_1 = require("../../src/tools/emutarget");
const runscript_1 = require("../../src/tools/runscript");
// The run-script commands that move backwards in time: back, seek, rewind,
// rbreak, now. They drive EmuCore's timeline, so going back and forward again
// has to land on the same state.
async function open() {
    const t = await (0, emutarget_1.loadPlatform)('mw8080bw');
    await t.start();
    await t.loadROM(new Uint8Array(fs.readFileSync('test/roms/mw8080bw/game2.c.rom')));
    let out = '';
    const script = new runscript_1.RunScript(t, (s) => { out += s; });
    return { t, script, output: () => { const s = out; out = ''; return s; } };
}
function stateOf(t) { return (0, statehash_1.hashState)(t.machine.saveState()); }
(0, mocha_1.describe)('RunScript time travel', function () {
    this.timeout(60000);
    (0, mocha_1.it)('labels output with the frame and step', async function () {
        const { script, output } = await open();
        script.run('run 3; step 2');
        const out = output();
        assert_1.default.match(out, /^\[3:0\] ran 3 frames$/m);
        assert_1.default.match(out, /^\[3:2\] PC=\$[0-9A-F]{4}$/m);
    });
    (0, mocha_1.it)('steps back to where it stepped from', async function () {
        const { t, script, output } = await open();
        script.run('run 5; step 1');
        const pc = t.getPC();
        const state = stateOf(t);
        script.run('step 7; back 7');
        assert_1.default.strictEqual(t.getPC(), pc);
        assert_1.default.strictEqual(stateOf(t), state);
        assert_1.default.match(output(), new RegExp(`PC=\\$${(0, util_1.hex)(pc, 4)}`));
    });
    (0, mocha_1.it)('seeks to a frame and step, and back to the present', async function () {
        const { t, script, output } = await open();
        script.run('run 12');
        const present = stateOf(t);
        script.run('seek 4:10; now');
        assert_1.default.strictEqual((0, timeline_1.formatTimestamp)(t.now()), '4:10');
        assert_1.default.match(output(), /at 4:10 \(past; recorded 0:0 to 12:0\)/);
        script.run('seek 12');
        assert_1.default.strictEqual(stateOf(t), present);
        assert_1.default.ok(!t.isInPast());
    });
    (0, mocha_1.it)('rewinds whole frames, to a frame start', async function () {
        const { t, script } = await open();
        script.run('run 10; rewind 3');
        assert_1.default.strictEqual((0, timeline_1.formatTimestamp)(t.now()), '7:0');
        script.run('step 5; rewind');
        assert_1.default.strictEqual((0, timeline_1.formatTimestamp)(t.now()), '7:0');
    });
    (0, mocha_1.it)('runs back to the last time the PC was somewhere', async function () {
        const { t, script, output } = await open();
        script.run('run 10; step 1');
        const pc = t.getPC();
        const when = t.now();
        script.run('run 5');
        output();
        script.run(`rbreak $${(0, util_1.hex)(pc, 4)}`);
        assert_1.default.match(output(), /HIT/);
        assert_1.default.strictEqual(t.getPC(), pc);
        assert_1.default.ok(t.isInPast());
        // the last visit, which is no earlier than the one we saw
        assert_1.default.ok(t.now().frame >= when.frame);
    });
    (0, mocha_1.it)('reports a miss and stays put', async function () {
        const { t, script, output } = await open();
        script.run('run 5');
        script.run('rbreak $FFFF');
        assert_1.default.match(output(), /MISSED/);
        assert_1.default.strictEqual((0, timeline_1.formatTimestamp)(t.now()), '5:0');
    });
});
//# sourceMappingURL=testrunscript.js.map