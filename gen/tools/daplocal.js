"use strict";
// A DebugBackend that runs the emulator in this process: for `8bws dap`, and
// for testing the adapter without VS Code. Running has no display to keep
// pace with, so it goes as fast as it can, a few frames at a time, taking
// requests (pause) in between.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalDebugBackend = void 0;
const debugservice_1 = require("./debugservice");
// frames to run between looking for requests
const FRAMES_PER_SLICE = 4;
class LocalDebugBackend {
    constructor(load) {
        this.load = load;
        this.service = null;
        this.stopListeners = [];
        this.outputListeners = [];
        this.looping = false;
    }
    onStop(fn) { this.stopListeners.push(fn); }
    onOutput(fn) { this.outputListeners.push(fn); }
    async launch(args) {
        const prog = await this.load(args);
        const svc = this.service = new debugservice_1.DebugService(prog.target, e => this.stopListeners.forEach(fn => fn(e)));
        if (prog.debugInfo)
            svc.setBuild(prog.debugInfo);
        if (args.script) {
            const r = svc.evaluate(args.script, 'repl');
            if (r.result)
                this.outputListeners.forEach(fn => fn(r.result + '\n'));
        }
        return { capabilities: svc.capabilities(), root: prog.root };
    }
    async terminate() {
        this.service = null;
    }
    async setBreakpoints(...a) { return this.svc.setBreakpoints(...a); }
    async continue() { this.svc.continue(); this.loop(); }
    async step(...a) { this.svc.step(...a); this.loop(); }
    async pause() { this.svc.pause(); }
    async stepBack(...a) { this.svc.stepBack(...a); }
    async reverseContinue() { this.svc.reverseContinue(); }
    async location() { return this.svc.location(); }
    async registers() { return this.svc.registers(); }
    async readMemory(...a) { return this.svc.readMemory(...a); }
    async disassemble(...a) { return this.svc.disassemble(...a); }
    async evaluate(...a) { return this.svc.evaluate(...a); }
    get svc() {
        if (!this.service)
            throw new Error('no program is loaded');
        return this.service;
    }
    /** Work toward the goal a slice at a time until it stops. */
    loop() {
        if (this.looping)
            return;
        this.looping = true;
        const slice = () => {
            const svc = this.service;
            if (!svc || !svc.running) {
                this.looping = false;
                return;
            }
            try {
                svc.advance(FRAMES_PER_SLICE);
            }
            catch (e) {
                this.looping = false;
                this.outputListeners.forEach(fn => fn(`emulator error: ${(e === null || e === void 0 ? void 0 : e.stack) || e}\n`));
                svc.pause();
                return;
            }
            setImmediate(slice);
        };
        setImmediate(slice);
    }
}
exports.LocalDebugBackend = LocalDebugBackend;
//# sourceMappingURL=daplocal.js.map