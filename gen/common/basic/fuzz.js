"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fuzz = void 0;
const compiler_1 = require("./compiler");
const runtime_1 = require("./runtime");
const emu_1 = require("../emu");
process.on('unhandledRejection', (reason, promise) => {
    if (!(reason instanceof emu_1.EmuHalt))
        console.log('Unhandled Rejection at:', promise, 'reason:', reason);
    // Application specific logging, throwing an error, or other logic here
});
function fuzz(buf) {
    var parser = new compiler_1.BASICParser();
    var str = buf.toString();
    try {
        var pgm = parser.parseFile(str, "test.bas");
        var runtime = new runtime_1.BASICRuntime();
        runtime.load(pgm);
        runtime.reset();
        runtime.print = (s) => {
            if (s == null)
                throw new Error("PRINT null string");
        };
        runtime.input = function (prompt, nargs) {
            var p = new Promise((resolve, reject) => {
                var arr = [];
                for (var i = 0; i < Math.random() * 10; i++)
                    arr.push(i + "");
                resolve({ vals: arr, line: arr.join(' ') });
            });
            return p;
        };
        for (var i = 0; i < 50000; i++) {
            if (!runtime.step())
                break;
        }
        if (Math.random() < 0.001)
            runtime.load(pgm);
        for (var i = 0; i < 50000; i++) {
            if (!runtime.step())
                break;
        }
    }
    catch (e) {
        if (e instanceof emu_1.EmuHalt)
            return;
        if (e instanceof compiler_1.CompileError)
            return;
        throw e;
    }
}
exports.fuzz = fuzz;
//# sourceMappingURL=fuzz.js.map